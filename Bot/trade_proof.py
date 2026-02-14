import json
import time

import requests
from web3 import Web3

import config
from uniswap import load_abi


def build_trade_metadata(receipt, signal, token_in, token_out, amount_in_raw,
                         quoted_amount_out, slippage_percent, current_price,
                         short_sma, long_sma, token_in_decimals, token_out_decimals):
    """Build a JSON-serialisable dict of trade metadata for IPFS pinning."""
    return {
        "tx_hash": receipt["transactionHash"].hex(),
        "block_number": receipt["blockNumber"],
        "signal": signal,
        "token_in": token_in,
        "token_out": token_out,
        "amount_in_raw": str(amount_in_raw),
        "amount_in_human": amount_in_raw / (10 ** token_in_decimals),
        "quoted_amount_out_raw": str(quoted_amount_out),
        "quoted_amount_out_human": quoted_amount_out / (10 ** token_out_decimals),
        "slippage_percent": slippage_percent,
        "current_price_usd": current_price,
        "short_sma": short_sma,
        "long_sma": long_sma,
        "timestamp": int(time.time()),
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def pin_to_ipfs(metadata):
    """Pin a JSON object to IPFS via Pinata V3 Files API and return the CID."""
    url = "https://uploads.pinata.cloud/v3/files"
    headers = {
        "Authorization": f"Bearer {config.PINATA_JWT}",
    }
    # V3 API uses multipart form-data with a file upload
    json_bytes = json.dumps(metadata).encode("utf-8")
    files = {
        "file": (f"trade-{metadata['tx_hash'][:10]}.json", json_bytes, "application/json"),
    }
    data = {
        "network": "public",
        "name": f"trade-{metadata['tx_hash'][:10]}",
    }
    resp = requests.post(url, headers=headers, files=files, data=data, timeout=30)
    resp.raise_for_status()
    result = resp.json()
    cid = result["data"]["cid"]
    return cid


def log_trade_on_chain(w3, account, swap_tx_hash_hex, cid):
    """Call TradeLogger.logTrade(swapTxHash, cid) on Sepolia."""
    abi = load_abi("trade_logger_abi.json")
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(config.TRADE_LOGGER_ADDRESS),
        abi=abi,
    )

    swap_tx_hash_bytes32 = bytes.fromhex(swap_tx_hash_hex.replace("0x", ""))

    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.functions.logTrade(swap_tx_hash_bytes32, cid).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "maxFeePerGas": w3.eth.gas_price * 2,
        "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt


def record_trade_proof(w3, account, receipt, signal, token_in, token_out,
                       amount_in_raw, quoted_amount_out, slippage_percent,
                       current_price, short_sma, long_sma,
                       token_in_decimals, token_out_decimals):
    """End-to-end: build metadata → pin to IPFS → log on-chain.

    Wrapped in try/except so proof logging never interrupts trading.
    """
    try:
        # 1. Build metadata
        metadata = build_trade_metadata(
            receipt, signal, token_in, token_out, amount_in_raw,
            quoted_amount_out, slippage_percent, current_price,
            short_sma, long_sma, token_in_decimals, token_out_decimals,
        )

        # 2. Pin to IPFS
        print(f"[TradeProof] Pinning trade metadata to IPFS...")
        cid = pin_to_ipfs(metadata)
        print(f"[TradeProof] IPFS CID: {cid}")
        print(f"[TradeProof] View: https://gateway.pinata.cloud/ipfs/{cid}")

        # 3. Log on-chain
        print(f"[TradeProof] Logging proof on-chain...")
        log_receipt = log_trade_on_chain(
            w3, account, receipt["transactionHash"].hex(), cid,
        )
        print(f"[TradeProof] On-chain TX: {log_receipt['transactionHash'].hex()}")
        print(f"[TradeProof] Etherscan: https://sepolia.etherscan.io/tx/{log_receipt['transactionHash'].hex()}")

    except Exception as e:
        print(f"[TradeProof] WARNING: Proof logging failed: {e}")
        print(f"[TradeProof] Trading will continue normally.")
