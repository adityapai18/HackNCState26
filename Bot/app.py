import os
import time

from flask import Flask, jsonify, request
from flask_cors import CORS
from web3 import Web3

import config
from bot_logger import get_logs
from bot_runner import BotRunner
from uniswap import get_account, get_web3

app = Flask(__name__)
CORS(app)

runner = BotRunner()


@app.route("/bot/info", methods=["GET"])
def bot_info():
    """Return bot recipient address and balance. No private key from frontend; uses env only or BOT_RECIPIENT_ADDRESS."""
    try:
        w3 = get_web3()
        if config.PRIVATE_KEY:
            account = get_account(w3)
            addr = account.address
            eth_balance_wei = w3.eth.get_balance(addr)
        else:
            addr = config.BOT_RECIPIENT_ADDRESS
            eth_balance_wei = w3.eth.get_balance(addr)
        return jsonify({
            "bot_recipient_address": addr,
            "wallet_address": addr,
            "eth_balance_wei": str(eth_balance_wei),
            "eth_balance": str(Web3.from_wei(eth_balance_wei, "ether")),
            "network": "sepolia",
        })
    except Exception as e:
        err_msg = str(e)
        if "private_key" in err_msg.lower() or "private key" in err_msg.lower() or (len(err_msg) > 66 and err_msg.strip().startswith("0x")):
            err_msg = "Server error (sensitive details redacted)"
        return jsonify({"error": err_msg}), 500


# Keys that must never be sent from the frontend; bot uses only env for any signing.
_FORBIDDEN_REQUEST_KEYS = frozenset({
    "private_key", "privateKey", "wallet_key", "walletKey", "secret_key", "secretKey",
    "account_key", "accountKey", "key", "mnemonic", "seed",
})


@app.route("/bot/start", methods=["POST"])
def bot_start():
    if runner.is_running:
        return jsonify({"status": "error", "message": "Bot is already running"}), 409

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"status": "error", "message": "Invalid body"}), 400
    for k in data:
        if k and k.strip().lower() in _FORBIDDEN_REQUEST_KEYS:
            return jsonify({"status": "error", "message": "Request must not contain any key or secret"}), 400
    session_key_expiry = data.get("session_key_expiry")
    session_key_address = data.get("session_key_address")
    smart_account_address = data.get("smart_account_address")
    # Vault address always from bot env; session key from frontend (UI) when starting the bot
    vault_address = config.MOCK_VAULT_ADDRESS

    if session_key_expiry is not None:
        try:
            session_key_expiry = float(session_key_expiry)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Invalid session_key_expiry"}), 400
        if session_key_expiry < time.time():
            return jsonify({"status": "error", "message": "Session key expiry is in the past"}), 400

    runner.start(session_key_expiry, session_key_address, vault_address, smart_account_address)
    return jsonify({"status": "ok", "message": "Bot started"})


@app.route("/bot/stop", methods=["POST"])
def bot_stop():
    if not runner.is_running:
        return jsonify({"status": "error", "message": "Bot is not running"}), 409

    runner.stop()
    return jsonify({"status": "ok", "message": "Bot stopping"})


@app.route("/bot/status", methods=["GET"])
def bot_status():
    status = runner.get_status()
    if status.get("error"):
        err = str(status["error"])
        if "private_key" in err.lower() or "private key" in err.lower():
            status = dict(status)
            status["error"] = "Error (details redacted)"
    return jsonify(status)


@app.route("/bot/logs", methods=["GET"])
def bot_logs():
    """Return recent bot logs for real-time dashboard display."""
    since = request.args.get("since", type=float)
    logs = get_logs(since_ts=since)
    return jsonify({"logs": logs})


if __name__ == "__main__":
    port = int(os.environ.get("BOT_API_PORT", 5001))
    print(f"Starting Bot API on port {port}...")
    print("Routes:", [r.rule for r in app.url_map.iter_rules()])
    app.run(host="0.0.0.0", port=port, debug=False)
