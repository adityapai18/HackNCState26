import threading
import time
import traceback
import uuid

from web3 import Web3

import config
from bot_logger import info as log_info, warning as log_warn, error as log_err
from uniswap import get_web3, get_account, send_eth

# POC: 10 wei. BUY = vault -> your wallet (same as before). SELL = bot wallet -> your wallet.
POC_AMOUNT_WEI = 10


class BotRunner:
    """POC: requests vault -> recipient transfers (10 wei). No swap logic."""

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
        }

    def _check_session_key_expiry(self):
        if self.session_key_expiry is None:
            return True
        if time.time() > self.session_key_expiry:
            self.session_key_expired = True
            self.error = "Session key expired"
            self._stop_event.set()
            return False
        return True

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
                self.is_running = False
                return

            log_info("POC bot started: BUY = vault→your wallet, SELL = bot wallet→your wallet (10 wei)")

            amount_wei = POC_AMOUNT_WEI
            num_deposits = 4  # demo: 4 x 10 wei to wallet

            # BUY = withdraw from vault to random wallet. SELL = 10 wei from private key wallet to API recipient.
            sides = ["BUY", "SELL", "BUY", "SELL"]
            for tx_num in range(1, num_deposits + 1):
                if self._stop_event.is_set():
                    break
                if not self._check_session_key_expiry():
                    break

                side = sides[tx_num - 1]
                self.iterations += 1
                self.current_signal = side

                if side == "BUY":
                    # BUY: withdraw from vault to your wallet (same as before; frontend does withdrawToBot to recipient)
                    if not self._can_proceed_with_vault_withdraw(w3, amount_wei, recipient_address):
                        log_err(f"BUY #{tx_num}: skipping — {self.error}")
                        self.stop_reason = f"Stopped after {self.total_trades} trades (insufficient vault balance)"
                        break
                    self.pending_withdraw = {
                        "amount_wei": str(amount_wei),
                        "reason": f"POC BUY #{tx_num}",
                        "vault_address": self.vault_address or config.MOCK_VAULT_ADDRESS,
                        "session_key_address": self.session_key_address,
                        "recipient_address": recipient_address,
                    }
                    log_info(f"BUY #{tx_num}: requesting vault withdrawTo({amount_wei} wei, {recipient_address[:10]}...) via frontend session key...")
                    initial_balance = w3.eth.get_balance(Web3.to_checksum_address(recipient_address))
                    deadline = time.time() + 60
                    funded = False
                    while not self._stop_event.is_set() and time.time() < deadline:
                        time.sleep(3)
                        current_balance = w3.eth.get_balance(Web3.to_checksum_address(recipient_address))
                        if current_balance > initial_balance:
                            funded = True
                            break
                    self.pending_withdraw = None
                    if funded:
                        tx_hash = f"vault-buy-{uuid.uuid4().hex[:12]}"
                        log_info(f"BUY #{tx_num}: vault withdrawal confirmed, funds received (tx: {tx_hash})")
                        self.total_trades += 1
                        self.buy_count += 1
                        self.last_trade = {
                            "signal": "BUY",
                            "tx_hash": tx_hash,
                            "timestamp": time.time(),
                            "amount": str(amount_wei),
                        }
                    else:
                        log_err(f"BUY #{tx_num}: timed out waiting for vault withdrawal (60s)")
                        self.error = "Vault withdrawal timeout"
                        self.stop_reason = f"Stopped after {self.total_trades} trades (timeout)"
                        break
                else:
                    # SELL: send 10 wei from bot's private key wallet to API recipient
                    if not config.PRIVATE_KEY:
                        log_err("SELL: skipped — no PRIVATE_KEY set; need bot wallet to send 10 wei to your wallet")
                        self.error = "SELL requires PRIVATE_KEY in .env (bot sends 10 wei to your wallet)"
                        continue
                    try:
                        account = get_account(w3)
                        send_eth(w3, account, recipient_address, amount_wei)
                        tx_hash = f"sell-{uuid.uuid4().hex[:12]}"
                        log_info(f"SELL #{tx_num}: sent {amount_wei} wei from bot wallet to your wallet ({recipient_address[:14]}...)")
                        self.total_trades += 1
                        self.sell_count += 1
                        self.last_trade = {
                            "signal": "SELL",
                            "tx_hash": tx_hash,
                            "timestamp": time.time(),
                            "amount": str(amount_wei),
                        }
                    except Exception as e:
                        log_err(f"SELL #{tx_num}: failed — {e}")
                        self.error = str(e)
                        self.stop_reason = f"Stopped after {self.total_trades} trades (SELL failed)"
                        break

                if tx_num < num_deposits:
                    for _ in range(3):
                        if self._stop_event.is_set():
                            break
                        time.sleep(1)

            if not self.stop_reason:
                self.stop_reason = f"POC complete. BUY: {self.buy_count} (vault→your wallet). SELL: {self.sell_count} (bot wallet→your wallet)."

        except Exception:
            err_msg = traceback.format_exc()
            log_err(f"Fatal error:\n{err_msg}")
            self.error = err_msg.strip().split("\n")[-1]
        finally:
            reason = self.stop_reason or (f"Session key expired" if self.session_key_expired else (self.error or "User stopped"))
            log_info(f"Bot stopped: {reason}")
            self.is_running = False
