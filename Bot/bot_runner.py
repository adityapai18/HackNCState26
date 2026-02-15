import random
import threading
import time
import traceback
import uuid

from web3 import Web3

import config
from bot_logger import info as log_info, warning as log_warn, error as log_err
from notifier import send_bot_stop_email
from trade_store import create_trade, start_run, stop_run
from uniswap import get_web3, get_account, send_eth
from valkey_client import valkey, valkey_ping

# Small amount per trade (wei). BUY = vault → recipient; SELL = bot wallet → recipient.
POC_AMOUNT_WEI = 10


class BotRunner:
    """Agent: vault withdrawals (BUY) and wallet sends (SELL). No swap logic."""

    def __init__(self):
        self._thread = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        self.is_running = False
        self.current_signal = None
        self.current_price = None
        self.last_trade = None
        self.total_trades = 0
        self.error = None
        self.session_key_expiry = None
        self.session_key_expired = False
        self.session_key_address = None
        self.vault_address = None
        self.started_at = None
        self.iterations = 0
        self.pending_withdraw = None
        self.buy_count = 0
        self.sell_count = 0
        self.stop_reason = None
        self.smart_account_address = None
        self.bot_recipient_address = None
        self.stop_alert_email_sent = False
        self.price_history = []
        self.trade_history = []

    def _synthetic_price(self):
        """POC: synthetic price for chart (not real market data)."""
        base = 100.0 + self.iterations * 0.4 + (self.buy_count - self.sell_count) * 2.0
        return round(base + random.uniform(-0.5, 0.5), 2)

    def start(self, session_key_expiry, session_key_address=None, vault_address=None, smart_account_address=None, bot_recipient_address=None):
        with self._lock:
            if self.is_running:
                return False
            self._stop_event.clear()
            self.is_running = True
            self.current_signal = "HOLD"
            self.current_price = None
            self.last_trade = None
            self.total_trades = 0
            self.error = None
            self.session_key_expiry = session_key_expiry
            self.session_key_expired = False
            self.session_key_address = session_key_address
            self.vault_address = vault_address
            self.smart_account_address = smart_account_address
            self.bot_recipient_address = bot_recipient_address
            self.started_at = time.time()
            self.iterations = 0
            self.pending_withdraw = None
            self.buy_count = 0
            self.sell_count = 0
            self.stop_reason = None
            self.stop_alert_email_sent = False
            self.run_id = None
            self.price_history = []
            self.trade_history = []

            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()
            return True

    def stop(self):
        with self._lock:
            if not self.is_running:
                return False
            self._stop_event.set()
            return True

    def get_status(self):
        return {
            "is_running": self.is_running,
            "current_signal": self.current_signal,
            "current_price": self.current_price,
            "last_trade": self.last_trade,
            "total_trades": self.total_trades,
            "error": self.error,
            "session_key_expiry": self.session_key_expiry,
            "session_key_expired": self.session_key_expired,
            "session_key_address": self.session_key_address,
            "vault_address": self.vault_address,
            "smart_account_address": self.smart_account_address,
            "bot_recipient_address": self.bot_recipient_address,
            "started_at": self.started_at,
            "iterations": self.iterations,
            "pending_withdraw": self.pending_withdraw,
            "buy_count": self.buy_count,
            "sell_count": self.sell_count,
            "stop_reason": self.stop_reason,
            "price_history": getattr(self, "price_history", [])[-300:],
            "trade_history": getattr(self, "trade_history", [])[-100:],
        }

    def _check_session_key_expiry(self):
        if self.session_key_expiry is None:
            return True
        if time.time() > self.session_key_expiry:
            self.session_key_expired = True
            self.error = "Session key expired"
            self._send_stop_alert_once("Session key expired")
            self._stop_event.set()
            return False
        return True

    def _send_stop_alert_once(self, reason: str, force: bool = False):
        """Send failure/expiry email once per run."""
        if self.stop_alert_email_sent:
            return
        should_email = force or self.session_key_expired or bool(self.error)
        if not should_email:
            return
        self.stop_alert_email_sent = send_bot_stop_email(
            reason=reason,
            session_key_expired=self.session_key_expired,
        )

    def _can_proceed_with_vault_withdraw(self, w3, amount_wei, recipient_address):
        from vault import get_smart_account_vault_balance
        vault_addr = self.vault_address or config.MOCK_VAULT_ADDRESS
        if not (vault_addr and self.smart_account_address):
            return True
        try:
            balance = get_smart_account_vault_balance(w3, vault_addr, self.smart_account_address)
            if balance < amount_wei:
                self.error = f"Insufficient vault balance ({balance} wei). Requested {amount_wei} wei."
                log_err(self.error)
                return False
            log_info(f"Vault balance OK: {balance} wei >= {amount_wei} wei")
            return True
        except Exception as e:
            log_warn(f"Vault balance check failed: {e}; proceeding anyway")
            return True

    def _run_loop(self):
        try:
            w3 = get_web3()
            recipient_address = (self.bot_recipient_address or "").strip() or None
            if not recipient_address:
                log_err("bot_recipient_address required from frontend")
                self.error = "Pass bot_recipient_address when starting the bot"
                self._send_stop_alert_once(self.error)
                self.is_running = False
                return

            assert valkey_ping(), "Valkey not reachable"
            user_wallet = recipient_address
            self.run_id = start_run(user_wallet, buy_amount_wei=POC_AMOUNT_WEI)
            log_info(f"Valkey run started: {self.run_id}")

            log_info("POC bot started: BUY = vault→your wallet, SELL = bot wallet→your wallet (10 wei)")
            log_info("Agent started: session active.")

            amount_wei = POC_AMOUNT_WEI
            # Random number of trades (7 to 30) so run length is unpredictable
            num_trades = random.randint(7, 30)
            # Random BUY/SELL sequence — looks like normal market activity
            sides = [random.choice(["BUY", "SELL"]) for _ in range(num_trades)]

            for tx_num in range(1, num_trades + 1):
                if self._stop_event.is_set():
                    break
                if not self._check_session_key_expiry():
                    break

                side = sides[tx_num - 1]
                self.iterations += 1
                self.current_signal = side
                price = self._synthetic_price()
                self.current_price = price
                self.price_history.append({"t": time.time(), "price": price})

                if side == "BUY":
                    # BUY: withdraw from vault to your wallet (same as before; frontend does withdrawToBot to recipient)
                    if not self._can_proceed_with_vault_withdraw(w3, amount_wei, recipient_address):
                        log_err(f"BUY #{tx_num}: skipping — {self.error}")
                        self.stop_reason = f"Stopped after {self.total_trades} trades (insufficient vault balance)"
                        self._send_stop_alert_once(self.stop_reason)
                        break
                    self.pending_withdraw = {
                        "amount_wei": str(amount_wei),
                        "reason": f"BUY #{tx_num}",
                        "vault_address": self.vault_address or config.MOCK_VAULT_ADDRESS,
                        "session_key_address": self.session_key_address,
                        "recipient_address": recipient_address,
                    }
                    log_info(f"BUY #{tx_num}: vault withdraw {amount_wei} wei...")
                    initial_balance = w3.eth.get_balance(Web3.to_checksum_address(recipient_address))
                    deadline = time.time() + 60
                    funded = False
                    while not self._stop_event.is_set() and time.time() < deadline:
                        time.sleep(3)
                        self.price_history.append({"t": time.time(), "price": self._synthetic_price()})
                        current_balance = w3.eth.get_balance(Web3.to_checksum_address(recipient_address))
                        if current_balance > initial_balance:
                            funded = True
                            break
                    self.pending_withdraw = None
                    if funded:
                        tx_hash = f"0x{uuid.uuid4().hex[:16]}"
                        log_info(f"BUY #{tx_num}: filled (tx: {tx_hash[:18]}...)")
                        self.total_trades += 1
                        self.buy_count += 1
                        t = time.time()
                        self.last_trade = {
                            "signal": "BUY",
                            "tx_hash": tx_hash,
                            "timestamp": t,
                            "amount": str(amount_wei),
                        }
                        create_trade(
                            run_id=self.run_id,
                            user_wallet=user_wallet,
                            side="BUY",
                            amount_wei=amount_wei,
                            tx_ref=tx_hash,
                            to_wallet=user_wallet,
                            meta={"buy_seq": self.buy_count},
                        )
                        self.trade_history.append({"signal": "BUY", "timestamp": t, "price": self._synthetic_price()})
                    else:
                        log_err(f"BUY #{tx_num}: timed out waiting for vault withdrawal (60s)")
                        self.error = "Vault withdrawal timeout"
                        self.stop_reason = f"Stopped after {self.total_trades} trades (timeout)"
                        valkey.hincrby(f"{self.run_id}:metrics", "buy_timeout", 1)
                        self._send_stop_alert_once(self.stop_reason)
                        break
                else:
                    # SELL: send 10 wei from bot's private key wallet to API recipient
                    if not config.PRIVATE_KEY:
                        log_err("SELL: skipped — no PRIVATE_KEY set")
                        self.error = "SELL requires PRIVATE_KEY in .env"
                        self._send_stop_alert_once(self.error)
                        continue
                    try:
                        account = get_account(w3)
                        send_eth(w3, account, recipient_address, amount_wei)
                        tx_hash = f"0x{uuid.uuid4().hex[:16]}"
                        log_info(f"SELL #{tx_num}: filled (tx: {tx_hash[:18]}...)")
                        self.total_trades += 1
                        self.sell_count += 1
                        t = time.time()
                        self.last_trade = {
                            "signal": "SELL",
                            "tx_hash": tx_hash,
                            "timestamp": t,
                            "amount": str(amount_wei),
                        }
                        create_trade(
                            run_id=self.run_id,
                            user_wallet=user_wallet,
                            side="SELL",
                            amount_wei=amount_wei,
                            tx_ref=tx_hash,
                            to_wallet=user_wallet,
                            meta={"sell_seq": self.sell_count},
                        )
                        self.trade_history.append({"signal": "SELL", "timestamp": t, "price": self._synthetic_price()})
                    except Exception as e:
                        log_err(f"SELL #{tx_num}: failed — {e}")
                        self.error = str(e)
                        self.stop_reason = f"Stopped after {self.total_trades} trades (SELL failed)"
                        self._send_stop_alert_once(self.stop_reason)
                        break

                if tx_num < num_trades:
                    # Variable delay between trades (1–4 s) so timing isn’t fixed
                    delay = random.uniform(1.0, 4.0)
                    steps = max(1, int(delay))
                    for _ in range(steps):
                        if self._stop_event.is_set():
                            break
                        time.sleep(delay / steps)
                        self.price_history.append({"t": time.time(), "price": self._synthetic_price()})

            if not self.stop_reason:
                self.stop_reason = f"Session complete. BUY: {self.buy_count}, SELL: {self.sell_count}."

        except Exception:
            err_msg = traceback.format_exc()
            log_err(f"Fatal error:\n{err_msg}")
            self.error = err_msg.strip().split("\n")[-1]
            self._send_stop_alert_once(self.error)
        finally:
            reason = self.stop_reason or (f"Session key expired" if self.session_key_expired else (self.error or "User stopped"))
            if self.run_id:
                stop_reason = "POC_COMPLETE"
                if self.session_key_expired:
                    stop_reason = "SESSION_KEY_EXPIRED"
                elif self.error:
                    stop_reason = "ERROR"
                if "timeout" in reason.lower():
                    stop_reason = "TIMEOUT"
                try:
                    stop_run(self.run_id, reason=stop_reason)
                except Exception as e:
                    log_warn(f"Valkey stop_run failed: {e}")
            # Also notify on graceful completion (e.g., full POC cycle done).
            is_graceful_complete = isinstance(reason, str) and reason.startswith("POC complete")
            # Notify on graceful session completion.
            is_graceful_complete = isinstance(reason, str) and "Session complete" in reason
            self._send_stop_alert_once(reason, force=is_graceful_complete)
            log_info(f"Bot stopped: {reason}")
            self.is_running = False
