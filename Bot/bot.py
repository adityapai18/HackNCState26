import sys
import time
import traceback

sys.stdout.reconfigure(line_buffering=True)

from web3 import Web3

import config
from price_feed import get_price_history
from strategy import Signal, compute_sma, evaluate_signal
from trade_proof import record_trade_proof
from uniswap import (
    check_and_approve,
    execute_swap,
    get_account,
    get_token_balance,
    get_web3,
)


def print_banner(account, w3):
    eth_balance = w3.eth.get_balance(account.address)
    print("=" * 60)
    print("  Uniswap V3 Trading Bot")
    print("=" * 60)
    print(f"  Wallet:  {account.address}")
    print(f"  ETH:     {Web3.from_wei(eth_balance, 'ether')} ETH")
    print(f"  Pair:    {config.TRADE_TOKEN_IN} -> {config.TRADE_TOKEN_OUT}")
    print(f"  Fee:     {config.POOL_FEE / 10000:.2%}")
    print(f"  Amount:  {config.TRADE_AMOUNT} {config.TRADE_TOKEN_IN}")
    print(f"  SMA:     {config.SHORT_SMA_PERIOD}/{config.LONG_SMA_PERIOD}")
    print(f"  Interval: {config.CHECK_INTERVAL_SECONDS}s")
    print("=" * 60)


def main():
    # --- Init ---
    w3 = get_web3()
    account = get_account(w3)
    print_banner(account, w3)

    token_in_cfg = config.TOKENS[config.TRADE_TOKEN_IN]
    token_out_cfg = config.TOKENS[config.TRADE_TOKEN_OUT]

    token_in_address = token_in_cfg["address"]
    token_out_address = token_out_cfg["address"]
    token_in_decimals = token_in_cfg["decimals"]
    token_out_decimals = token_out_cfg["decimals"]

    # Convert human-readable trade amount to raw units
    amount_in_raw = int(config.TRADE_AMOUNT * (10 ** token_in_decimals))

    # One-time approval for token_in (skip if swapping native ETH)
    weth_address = config.TOKENS["WETH"]["address"]
    if token_in_address.lower() != weth_address.lower():
        print("\nChecking token approval...")
        check_and_approve(
            w3, account, token_in_address, config.SWAP_ROUTER_ADDRESS, amount_in_raw
        )
    else:
        print("\nSwapping native ETH — no token approval needed.")

    # --- Test swap (one-time) ---
    print("\n[TEST MODE] Executing a test swap to verify on-chain flow...")
    try:
        receipt, quoted_out = execute_swap(
            w3, account,
            token_in_address, token_out_address,
            config.POOL_FEE, amount_in_raw,
            config.SLIPPAGE_PERCENT,
        )
        print(f"[TEST MODE] SUCCESS! TX: {receipt['transactionHash'].hex()}")
        print(f"[TEST MODE] View on Etherscan: https://sepolia.etherscan.io/tx/{receipt['transactionHash'].hex()}\n")
        record_trade_proof(
            w3, account, receipt, "TEST",
            token_in_address, token_out_address,
            amount_in_raw, quoted_out,
            config.SLIPPAGE_PERCENT, 0,
            None, None,
            token_in_decimals, token_out_decimals,
        )
    except Exception as e:
        print(f"[TEST MODE] Swap failed: {e}\n")

    # Use the token_in's coingecko_id for price data
    coin_id = token_in_cfg["coingecko_id"]

    last_signal = Signal.HOLD
    print("Bot started. Monitoring for signals...\n")

    while True:
        try:
            # 1. Fetch price history
            price_data = get_price_history(coin_id)
            prices = [p[1] for p in price_data]  # extract price values

            # 2. Evaluate signal
            signal = evaluate_signal(
                prices, config.SHORT_SMA_PERIOD, config.LONG_SMA_PERIOD
            )

            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            current_price = prices[-1] if prices else 0

            # Compute SMAs for proof logging
            short_sma = compute_sma(prices, config.SHORT_SMA_PERIOD)
            long_sma = compute_sma(prices, config.LONG_SMA_PERIOD)

            print(f"[{timestamp}] Price: ${current_price:.2f} | Signal: {signal.value}")

            # 3. Act on signal changes
            if signal == Signal.BUY and last_signal != Signal.BUY:
                print(f"\n>>> BUY signal detected! Swapping {config.TRADE_AMOUNT} {config.TRADE_TOKEN_IN} -> {config.TRADE_TOKEN_OUT}")
                receipt, quoted_out = execute_swap(
                    w3, account,
                    token_in_address, token_out_address,
                    config.POOL_FEE, amount_in_raw,
                    config.SLIPPAGE_PERCENT,
                )
                print(f">>> TX: {receipt['transactionHash'].hex()}\n")
                record_trade_proof(
                    w3, account, receipt, "BUY",
                    token_in_address, token_out_address,
                    amount_in_raw, quoted_out,
                    config.SLIPPAGE_PERCENT, current_price,
                    short_sma, long_sma,
                    token_in_decimals, token_out_decimals,
                )

            elif signal == Signal.SELL and last_signal != Signal.SELL:
                # Sell: swap token_out back to token_in
                # Determine how much token_out we hold
                token_out_balance = get_token_balance(
                    w3, account.address, token_out_address
                )
                if token_out_balance > 0:
                    print(f"\n>>> SELL signal detected! Swapping {config.TRADE_TOKEN_OUT} -> {config.TRADE_TOKEN_IN}")
                    # Approve token_out for the router
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
                    print(f">>> TX: {receipt['transactionHash'].hex()}\n")
                    record_trade_proof(
                        w3, account, receipt, "SELL",
                        token_out_address, token_in_address,
                        token_out_balance, quoted_out,
                        config.SLIPPAGE_PERCENT, current_price,
                        short_sma, long_sma,
                        token_out_decimals, token_in_decimals,
                    )
                else:
                    print(f"  SELL signal but no {config.TRADE_TOKEN_OUT} balance to sell.")

            if signal != Signal.HOLD:
                last_signal = signal

        except KeyboardInterrupt:
            print("\nBot stopped by user.")
            break
        except Exception:
            print(f"\nError during loop iteration:")
            traceback.print_exc()
            print("Continuing...\n")

        time.sleep(config.CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
