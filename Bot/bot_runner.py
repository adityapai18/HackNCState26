import threading
import time
import traceback
import uuid

from web3 import Web3

import config
from bot_logger import info as log_info, warning as log_warn, error as log_err
from price_feed import get_price_history_or_simulated
from strategy import Signal, compute_sma, evaluate_signal
from trade_proof import record_trade_proof
from uniswap import (
    check_and_approve,
    execute_swap,
    get_account,
    get_token_balance,
    get_web3,
    unwrap_weth,
)
from vault import Vault, prepare_withdraw_via_smart_account, InsufficientVaultBalance


class BotRunner:
    """Wraps the trading bot loop in a background thread."""

    def __init__(self):
        self._thread = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        # Status fields
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
        self.pending_withdraw = None  # { amount_wei: str, reason: str } when BUY needs vault withdraw
        self.buy_count = 0
        self.sell_count = 0
        self.stop_reason = None  # Short message for why bot stopped
        self.smart_account_address = None  # Smart account whose vault balance we check (handleTestWithdraw-style)

    def start(self, session_key_expiry, session_key_address=None, vault_address=None, smart_account_address=None):
        with self._lock:
            if self.is_running:
                return False
            # Reset state
            self._stop_event.clear()
            self.is_running = True
            self.current_signal = None
            self.current_price = None
            self.last_trade = None
            self.total_trades = 0
            self.error = None
            self.session_key_expiry = session_key_expiry
            self.session_key_expired = False
            self.session_key_address = session_key_address
            self.vault_address = vault_address
            self.smart_account_address = smart_account_address
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
        """
        Like handleTestWithdraw: just read balances(ETH_TOKEN, smartAccount) to check
        the smart account has enough deposited. No transaction encoding (avoids revert).
        Returns True if OK; False and sets self.error if insufficient.
        """
        from vault import get_smart_account_vault_balance
        vault_addr = self.vault_address or config.MOCK_VAULT_ADDRESS
        if not (vault_addr and self.smart_account_address):
            return True  # Can't check; frontend will validate
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
            signal_only = not config.PRIVATE_KEY
            if signal_only:
                log_info("Bot loop started (signal-only: no private key, no swap execution)")
                recipient_address = config.BOT_RECIPIENT_ADDRESS
                if not recipient_address:
                    log_err("BOT_RECIPIENT_ADDRESS not set in .env for signal-only mode")
                    self.error = "BOT_RECIPIENT_ADDRESS required when PRIVATE_KEY not set"
                    self.is_running = False
                    return
                account = None
            else:
                log_info("Bot loop started")
                account = get_account(w3)
                recipient_address = account.address
            # If no private key, can't do real trades — always simulate
            sim_trades = config.SIMULATION_MODE or signal_only
            if sim_trades:
                log_info("Running in SIMULATION MODE (no on-chain swaps)")
            token_in_cfg = config.TOKENS[config.TRADE_TOKEN_IN]
            token_out_cfg = config.TOKENS[config.TRADE_TOKEN_OUT]
            token_in_address = token_in_cfg["address"]
            token_out_address = token_out_cfg["address"]
            token_in_decimals = token_in_cfg["decimals"]
            token_out_decimals = token_out_cfg["decimals"]
            amount_in_raw = int(config.TRADE_AMOUNT * (10 ** token_in_decimals))

            if not signal_only:
                weth_address = config.TOKENS["WETH"]["address"]
                if token_in_address.lower() != weth_address.lower():
                    check_and_approve(
                        w3, account, token_in_address,
                        config.SWAP_ROUTER_ADDRESS, amount_in_raw
                    )

            coin_id = token_in_cfg["coingecko_id"]
            last_signal = Signal.HOLD

            # Demo mode: hardcode 4 transactions with dummy iterations between them
            if config.DEMO_FORCE_3_BUYS:
                def _demo_dummy_iterations(n=3):
                    """Run n dummy 'watching' iterations between transactions."""
                    for i in range(n):
                        if self._stop_event.is_set():
                            return
                        self.iterations += 1
                        price_data = get_price_history_or_simulated(coin_id)
                        prices = [p[1] for p in price_data]
                        current_price = prices[-1] if prices else config.ETH_BASE_PRICE
                        self.current_price = current_price
                        self.current_signal = "HOLD"
                        log_info(f"[WATCHING] Price: ${current_price:.2f} | Signal: HOLD | Monitoring market ({i+1}/{n}) — no trade yet")
                        for _ in range(3):
                            if self._stop_event.is_set():
                                return
                            time.sleep(1)

                log_info("DEMO MODE: 4 transactions (BUY->SELL->BUY->BUY) with watching iterations between. 4th BUY may hit limit.")
                for tx_num, side in enumerate(["BUY", "SELL", "BUY", "BUY"], 1):
                    if self._stop_event.is_set():
                        break
                    _demo_dummy_iterations(3)
                    if self._stop_event.is_set():
                        break
                    log_info(f"DEMO TX #{tx_num}/4: {side}")
                    self.current_signal = side
                    if config.SIMULATION_MODE:
                        tx_hash = f"sim-{uuid.uuid4().hex[:12]}"
                        log_info(f"SIM {side} #{tx_num}/4 (tx: {tx_hash})")
                        self.total_trades += 1
                        if side == "BUY":
                            self.buy_count += 1
                        else:
                            self.sell_count += 1
                        self.last_trade = {"signal": side, "tx_hash": tx_hash, "timestamp": time.time(), "amount": str(config.TRADE_AMOUNT)}
                    elif signal_only:
                        if side == "BUY":
                            if not self._can_proceed_with_vault_withdraw(w3, amount_in_raw, recipient_address):
                                log_err(f"DEMO BUY #{tx_num}: skipping — {self.error}")
                                continue
                            self.pending_withdraw = {
                                "amount_wei": str(amount_in_raw),
                                "reason": f"DEMO TX #{tx_num} BUY",
                                "vault_address": self.vault_address or config.MOCK_VAULT_ADDRESS,
                                "session_key_address": self.session_key_address,
                                "recipient_address": recipient_address,
                            }
                            log_info(f"DEMO BUY #{tx_num}: requesting vault withdrawTo({amount_in_raw} wei, {recipient_address}) via frontend session key...")
                            # Wait for frontend to process pending_withdraw and send ETH
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
                                tx_hash = f"vault-withdraw-{uuid.uuid4().hex[:12]}"
                                log_info(f"DEMO BUY #{tx_num}: vault withdrawal confirmed, funds received (tx: {tx_hash})")
                                self.total_trades += 1
                                self.buy_count += 1
                                self.last_trade = {"signal": "BUY", "tx_hash": tx_hash, "timestamp": time.time(), "amount": str(config.TRADE_AMOUNT)}
                            else:
                                log_err(f"DEMO BUY #{tx_num}: timed out waiting for vault withdrawal (60s)")
                                self.error = "Vault withdrawal timeout"
                        else:
                            tx_hash = f"sim-sell-{uuid.uuid4().hex[:12]}"
                            log_info(f"DEMO SELL #{tx_num}: signal only (tx: {tx_hash})")
                            self.total_trades += 1
                            self.sell_count += 1
                            self.last_trade = {"signal": "SELL", "tx_hash": tx_hash, "timestamp": time.time(), "amount": str(config.TRADE_AMOUNT)}
                    else:
                        if side == "BUY":
                            if not (self.session_key_address and self.vault_address):
                                log_err(f"DEMO BUY #{tx_num}: Session key and vault required. Start bot from UI with session key.")
                                self.error = "Session key and vault required for BUY"
                                continue
                            if not self._can_proceed_with_vault_withdraw(w3, amount_in_raw, account.address):
                                log_err(f"DEMO BUY #{tx_num}: skipping — {self.error}")
                                continue
                            self.pending_withdraw = {
                                "amount_wei": str(amount_in_raw),
                                "reason": f"DEMO TX #{tx_num} BUY",
                                "vault_address": self.vault_address or config.MOCK_VAULT_ADDRESS,
                                "session_key_address": self.session_key_address,
                                "recipient_address": account.address,
                            }
                            log_info(f"DEMO BUY #{tx_num}: waiting for vault withdraw to bot (frontend withdrawToBot)...")
                            deadline = time.time() + 45
                            while not self._stop_event.is_set() and time.time() < deadline:
                                eth_balance = w3.eth.get_balance(account.address)
                                if eth_balance >= amount_in_raw:
                                    break
                                time.sleep(2)
                            self.pending_withdraw = None
                            if w3.eth.get_balance(account.address) >= amount_in_raw:
                                receipt, quoted_out = execute_swap(
                                    w3, account, token_in_address, token_out_address,
                                    config.POOL_FEE, amount_in_raw, config.SLIPPAGE_PERCENT,
                                )
                                tx_hash = receipt["transactionHash"].hex()
                                log_info(f"DEMO BUY #{tx_num} tx: {tx_hash}")
                                self.total_trades += 1
                                self.buy_count += 1
                                self.last_trade = {"signal": "BUY", "tx_hash": tx_hash, "timestamp": time.time(), "amount": str(config.TRADE_AMOUNT)}
                                record_trade_proof(w3, account, receipt, "BUY", token_in_address, token_out_address, amount_in_raw, quoted_out, config.SLIPPAGE_PERCENT, 0, None, None, token_in_decimals, token_out_decimals)
                            else:
                                log_err(f"DEMO BUY #{tx_num}: Timed out waiting for vault withdraw to bot.")
                                self.error = "Vault withdrawal timeout"
                                self.stop_reason = f"4th BUY failed (withdrawal limit). {self.buy_count} buys, {self.sell_count} sells completed."
                        else:
                            token_out_bal = get_token_balance(w3, account.address, token_out_address)
                            if token_out_bal > 0:
                                check_and_approve(w3, account, token_out_address, config.SWAP_ROUTER_ADDRESS, token_out_bal)
                                receipt, quoted_out = execute_swap(
                                    w3, account, token_out_address, token_in_address,
                                    config.POOL_FEE, token_out_bal, config.SLIPPAGE_PERCENT,
                                )
                                tx_hash = receipt["transactionHash"].hex()
                                log_info(f"DEMO SELL #{tx_num} tx: {tx_hash}")
                                self.total_trades += 1
                                self.sell_count += 1
                                self.last_trade = {"signal": "SELL", "tx_hash": tx_hash, "timestamp": time.time(), "amount": str(token_out_bal)}
                                record_trade_proof(w3, account, receipt, "SELL", token_out_address, token_in_address, token_out_bal, quoted_out, config.SLIPPAGE_PERCENT, 0, None, None, token_out_decimals, token_in_decimals)
                                weth_balance = get_token_balance(w3, account.address, token_in_address)
                                if weth_balance > 0 and self.vault_address:
                                    try:
                                        unwrap_weth(w3, account, weth_balance)
                                        vault = Vault(w3, account, session_key_address=self.session_key_address, vault_address=self.vault_address)
                                        vault.deposit(weth_balance)
                                        log_info(f"Deposited {weth_balance} wei back to vault")
                                    except Exception as e:
                                        log_err(f"Failed to deposit to vault: {e}")
                            else:
                                log_info(f"DEMO SELL #{tx_num}: No USDC to sell, skipping")
                    if tx_num < 4:
                        for _ in range(5):
                            if self._stop_event.is_set():
                                break
                            time.sleep(1)
                if not self.stop_reason:
                    self.stop_reason = f"Demo complete. {self.buy_count} buys, {self.sell_count} sells."
                return

            while not self._stop_event.is_set():
                # Check session key expiry at top of each iteration
                if not self._check_session_key_expiry():
                    break

                try:
                    self.iterations += 1

                    # Fetch price history (real or simulated)
                    price_data = get_price_history_or_simulated(coin_id)
                    prices = [p[1] for p in price_data]

                    if config.SIMULATION_MODE and self.iterations == 1:
                        log_info(f"Simulation mode: using random prices near ${config.ETH_BASE_PRICE}")

                    # Evaluate signal
                    signal = evaluate_signal(
                        prices, config.SHORT_SMA_PERIOD, config.LONG_SMA_PERIOD
                    )

                    current_price = prices[-1] if prices else 0
                    self.current_price = current_price
                    self.current_signal = signal.value

                    short_sma = compute_sma(prices, config.SHORT_SMA_PERIOD)
                    long_sma = compute_sma(prices, config.LONG_SMA_PERIOD)

                    log_info(f"Price: ${current_price:.2f} | Signal: {signal.value} | SMA short={(short_sma or 0):.2f} long={(long_sma or 0):.2f}")

                    # Act on signal changes
                    if signal == Signal.BUY and last_signal != Signal.BUY:
                        amount_in_raw = int(config.TRADE_AMOUNT * (10 ** token_in_decimals))
                        if config.SIMULATION_MODE:
                            tx_hash = f"sim-{uuid.uuid4().hex[:12]}"
                            log_info(f"SIM BUY: withdraw {config.TRADE_AMOUNT} {config.TRADE_TOKEN_IN} from vault -> swap (tx: {tx_hash})")
                            self.total_trades += 1
                            self.buy_count += 1
                            self.last_trade = {
                                "signal": "BUY",
                                "tx_hash": tx_hash,
                                "timestamp": time.time(),
                                "amount": str(config.TRADE_AMOUNT),
                            }
                        elif signal_only:
                            if not self._can_proceed_with_vault_withdraw(w3, amount_in_raw, recipient_address):
                                log_err(f"BUY signal only: skipping — {self.error}")
                                continue
                            self.pending_withdraw = {
                                "amount_wei": str(amount_in_raw),
                                "reason": "BUY",
                                "vault_address": self.vault_address or config.MOCK_VAULT_ADDRESS,
                                "session_key_address": self.session_key_address,
                                "recipient_address": recipient_address,
                            }
                            log_info(f"BUY: requesting vault withdrawTo({amount_in_raw} wei, {recipient_address}) via frontend session key...")
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
                                tx_hash = f"vault-withdraw-{uuid.uuid4().hex[:12]}"
                                log_info(f"BUY: vault withdrawal confirmed, funds received (tx: {tx_hash})")
                                self.total_trades += 1
                                self.buy_count += 1
                                self.last_trade = {
                                    "signal": "BUY",
                                    "tx_hash": tx_hash,
                                    "timestamp": time.time(),
                                    "amount": str(config.TRADE_AMOUNT),
                                }
                            else:
                                log_err("BUY: timed out waiting for vault withdrawal (60s)")
                                continue
                        else:
                            if not (self.session_key_address and self.vault_address):
                                log_err("BUY: Session key and vault required. Start bot from UI with session key.")
                                self.error = "Session key and vault required for BUY"
                                continue
                            if not self._can_proceed_with_vault_withdraw(w3, amount_in_raw, account.address):
                                log_err(f"BUY: skipping — {self.error}")
                                continue
                            self.pending_withdraw = {
                                "amount_wei": str(amount_in_raw),
                                "reason": "BUY",
                                "vault_address": self.vault_address or config.MOCK_VAULT_ADDRESS,
                                "session_key_address": self.session_key_address,
                                "recipient_address": account.address,
                            }
                            log_info(f"BUY: waiting for vault withdraw to bot (frontend withdrawToBot)...")
                            deadline = time.time() + 120
                            while not self._stop_event.is_set() and time.time() < deadline:
                                eth_balance = w3.eth.get_balance(account.address)
                                if eth_balance >= amount_in_raw:
                                    break
                                time.sleep(3)
                            self.pending_withdraw = None
                            if w3.eth.get_balance(account.address) < amount_in_raw:
                                log_err("BUY: timed out waiting for vault withdraw to bot")
                                continue
                            receipt, quoted_out = execute_swap(
                                w3, account,
                                token_in_address, token_out_address,
                                config.POOL_FEE, int(config.TRADE_AMOUNT * (10 ** token_in_decimals)),
                                config.SLIPPAGE_PERCENT,
                            )
                            tx_hash = receipt["transactionHash"].hex()
                            log_info(f"BUY tx: {tx_hash}")
                            self.total_trades += 1
                            self.buy_count += 1
                            self.last_trade = {
                                "signal": "BUY",
                                "tx_hash": tx_hash,
                                "timestamp": time.time(),
                                "amount": str(config.TRADE_AMOUNT),
                            }
                            record_trade_proof(
                                w3, account, receipt, "BUY",
                                token_in_address, token_out_address,
                                amount_in_raw, quoted_out,
                                config.SLIPPAGE_PERCENT, current_price,
                                short_sma, long_sma,
                                token_in_decimals, token_out_decimals,
                            )

                    elif signal == Signal.SELL and last_signal != Signal.SELL:
                        if config.SIMULATION_MODE:
                            tx_hash = f"sim-{uuid.uuid4().hex[:12]}"
                            mock_amount = str(config.TRADE_AMOUNT * 3500)  # Approx USDC for demo
                            log_info(f"SIM SELL: {config.TRADE_TOKEN_OUT} -> {config.TRADE_TOKEN_IN} (tx: {tx_hash})")
                            self.total_trades += 1
                            self.sell_count += 1
                            self.last_trade = {
                                "signal": "SELL",
                                "tx_hash": tx_hash,
                                "timestamp": time.time(),
                                "amount": mock_amount,
                            }
                        elif signal_only:
                            tx_hash = f"sim-sell-{uuid.uuid4().hex[:12]}"
                            log_info(f"SELL signal only (tx: {tx_hash})")
                            self.total_trades += 1
                            self.sell_count += 1
                            self.last_trade = {
                                "signal": "SELL",
                                "tx_hash": tx_hash,
                                "timestamp": time.time(),
                                "amount": str(config.TRADE_AMOUNT),
                            }
                        elif not config.SIMULATION_MODE:
                            token_out_balance = get_token_balance(
                                w3, account.address, token_out_address
                            )
                            if token_out_balance > 0:
                                check_and_approve(
                                    w3, account, token_out_address,
                                    config.SWAP_ROUTER_ADDRESS, token_out_balance,
                                )
                                receipt, quoted_out = execute_swap(
                                    w3, account,
                                    token_out_address, token_in_address,
                                    config.POOL_FEE, token_out_balance,
                                    config.SLIPPAGE_PERCENT,
                                )
                                tx_hash = receipt["transactionHash"].hex()
                                log_info(f"SELL tx: {tx_hash}")
                                self.total_trades += 1
                                self.sell_count += 1
                                self.last_trade = {
                                    "signal": "SELL",
                                    "tx_hash": tx_hash,
                                    "timestamp": time.time(),
                                    "amount": str(token_out_balance),
                                }
                                record_trade_proof(
                                    w3, account, receipt, "SELL",
                                    token_out_address, token_in_address,
                                    token_out_balance, quoted_out,
                                    config.SLIPPAGE_PERCENT, current_price,
                                    short_sma, long_sma,
                                    token_out_decimals, token_in_decimals,
                                )
                                weth_balance = get_token_balance(w3, account.address, token_in_address)
                                if weth_balance > 0 and self.vault_address:
                                    try:
                                        unwrap_weth(w3, account, weth_balance)
                                        vault = Vault(w3, account, session_key_address=self.session_key_address, vault_address=self.vault_address)
                                        vault.deposit(weth_balance)
                                        log_info(f"Deposited {weth_balance} wei back to vault")
                                    except Exception as e:
                                        log_err(f"Failed to deposit to vault: {e}")

                    if signal != Signal.HOLD:
                        last_signal = signal

                except Exception:
                    err_msg = traceback.format_exc()
                    log_err(f"Error in iteration:\n{err_msg}")
                    self.error = err_msg.strip().split("\n")[-1]

                # Sleep in 1-second increments for responsive stopping
                for _ in range(config.CHECK_INTERVAL_SECONDS):
                    if self._stop_event.is_set():
                        break
                    time.sleep(1)

        except Exception:
            err_msg = traceback.format_exc()
            log_err(f"Fatal error:\n{err_msg}")
            self.error = err_msg.strip().split("\n")[-1]
        finally:
            reason = self.stop_reason or (f"Session key expired" if self.session_key_expired else (self.error or "User stopped or completed"))
            log_info(f"Bot stopped: {reason}")
            self.is_running = False
