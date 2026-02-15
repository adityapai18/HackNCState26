import time
import uuid
from typing import Optional, Dict, Any
from valkey_client import valkey

def now_ms() -> int:
    return int(time.time() * 1000)

def new_run_id() -> str:
    # stable enough for hackathon; you can also do timestamp-based
    return f"run:{uuid.uuid4().hex}"

def create_trade(
    run_id: str,
    user_wallet: str,
    side: str,                 # "BUY" or "SELL"
    amount_wei: int,
    tx_ref: str,               # "vault-buy-..." or real tx hash
    vault_address: Optional[str] = None,
    bot_wallet: Optional[str] = None,
    to_wallet: Optional[str] = None,
    status: str = "CONFIRMED", # or "PENDING"
    meta: Optional[Dict[str, Any]] = None,
) -> str:
    ts = now_ms()
    trade_id = f"trade:{uuid.uuid4().hex}"

    record = {
        "trade_id": trade_id,
        "run_id": run_id,
        "user_wallet": user_wallet.lower(),
        "side": side,
        "amount_wei": str(amount_wei),
        "tx_ref": tx_ref,
        "status": status,
        "ts": str(ts),
    }
    if vault_address:
        record["vault_address"] = vault_address.lower()
    if bot_wallet:
        record["bot_wallet"] = bot_wallet.lower()
    if to_wallet:
        record["to_wallet"] = to_wallet.lower()
    if meta:
        # store a few useful fields; keep it flat to avoid JSON parsing complexity
        for k, v in meta.items():
            record[f"meta:{k}"] = str(v)

    # 1) store trade object
    valkey.hset(trade_id, mapping=record)

    # 2) index for analysis / dashboard
    valkey.zadd(f"user:{user_wallet.lower()}:trades", {trade_id: ts})
    valkey.zadd(f"{run_id}:trades", {trade_id: ts})

    # 3) quick metrics per run
    valkey.hincrby(f"{run_id}:metrics", "trades_total", 1)
    if side == "BUY":
        valkey.hincrby(f"{run_id}:metrics", "buy_confirmed", 1)
    elif side == "SELL":
        valkey.hincrby(f"{run_id}:metrics", "sell_confirmed", 1)

    return trade_id

def start_run(user_wallet: str, buy_amount_wei: int = 10) -> str:
    run_id = new_run_id()
    ts = now_ms()

    valkey.hset(run_id, mapping={
        "run_id": run_id,
        "user_wallet": user_wallet.lower(),
        "buy_amount_wei": str(buy_amount_wei),
        "status": "RUNNING",
        "started_ts": str(ts),
    })

    valkey.zadd("runs:by_time", {run_id: ts})
    valkey.zadd(f"user:{user_wallet.lower()}:runs", {run_id: ts})
    return run_id

def stop_run(run_id: str, reason: str) -> None:
    ts = now_ms()
    valkey.hset(run_id, mapping={
        "status": "STOPPED",
        "stop_reason": reason,
        "stopped_ts": str(ts),
    })
