import json
import os

from web3 import Web3

import config

ABI_DIR = os.path.join(os.path.dirname(__file__), "abi")
MAX_UINT256 = 2**256 - 1


def get_web3():
    """Create a Web3 instance connected to the configured RPC."""
    w3 = Web3(Web3.HTTPProvider(config.RPC_URL))
    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to RPC: {config.RPC_URL}")
    return w3


def get_account(w3):
    """Return the bot account. Only source: config.PRIVATE_KEY from env. Never use frontend or user wallet."""
    if not config.PRIVATE_KEY:
        raise ValueError("PRIVATE_KEY not set; use a dedicated bot wallet in .env only")
    account = w3.eth.account.from_key(config.PRIVATE_KEY)
    return account


def load_abi(filename):
    """Load a JSON ABI file from the abi/ directory."""
    path = os.path.join(ABI_DIR, filename)
    with open(path) as f:
        return json.load(f)


def unwrap_weth(w3, account, amount_wei):
    """Unwrap WETH to native ETH. Sends ETH to account."""
    weth_address = Web3.to_checksum_address(config.TOKENS["WETH"]["address"])
    weth_abi = [{"inputs": [{"name": "wad", "type": "uint256"}], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function"}]
    weth = w3.eth.contract(address=weth_address, abi=weth_abi)
    nonce = w3.eth.get_transaction_count(account.address)
    tx = weth.functions.withdraw(amount_wei).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "maxFeePerGas": w3.eth.gas_price * 2,
        "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return w3.eth.wait_for_transaction_receipt(tx_hash)


def get_token_balance(w3, wallet_address, token_address):
    """Get the ERC-20 token balance for a wallet (raw units)."""
    erc20_abi = load_abi("erc20.json")
    token = w3.eth.contract(
        address=Web3.to_checksum_address(token_address), abi=erc20_abi
    )
    return token.functions.balanceOf(
        Web3.to_checksum_address(wallet_address)
    ).call()


def check_and_approve(w3, account, token_address, spender_address, amount):
    """Check allowance and approve if insufficient. Uses infinite approval."""
    erc20_abi = load_abi("erc20.json")
    token = w3.eth.contract(
        address=Web3.to_checksum_address(token_address), abi=erc20_abi
    )

    current_allowance = token.functions.allowance(
        account.address, Web3.to_checksum_address(spender_address)
    ).call()

    if current_allowance >= amount:
        print(f"  Allowance sufficient ({current_allowance}), skipping approval.")
        return None

    print(f"  Approving {token_address} for spending...")
    nonce = w3.eth.get_transaction_count(account.address)
    tx = token.functions.approve(
        Web3.to_checksum_address(spender_address), MAX_UINT256
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "maxFeePerGas": w3.eth.gas_price * 2,
        "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  Approval tx sent: {tx_hash.hex()}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"  Approval confirmed in block {receipt['blockNumber']}")
    return receipt


def get_quote(w3, token_in, token_out, fee, amount_in):
    """Get expected output amount from the Uniswap V3 Quoter (static call)."""
    quoter_abi = load_abi("quoter.json")
    quoter = w3.eth.contract(
        address=Web3.to_checksum_address(config.QUOTER_ADDRESS), abi=quoter_abi
    )
    # QuoterV2 takes a struct as a tuple
    params = (
        Web3.to_checksum_address(token_in),
        Web3.to_checksum_address(token_out),
        amount_in,
        fee,
        0,  # sqrtPriceLimitX96 = 0 means no limit
    )
    result = quoter.functions.quoteExactInputSingle(params).call()
    # QuoterV2 returns (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate)
    return result[0]


def execute_swap(w3, account, token_in, token_out, fee, amount_in, slippage_percent):
    """Execute a swap on Uniswap V3 SwapRouter.

    Args:
        w3: Web3 instance
        account: account object with .address and .sign_transaction
        token_in: address of input token
        token_out: address of output token
        fee: pool fee tier (e.g. 3000)
        amount_in: amount in raw token units (wei)
        slippage_percent: slippage tolerance as a percentage (e.g. 0.5)

    Returns:
        Tuple of (transaction receipt, quoted_amount_out).
    """
    token_in = Web3.to_checksum_address(token_in)
    token_out = Web3.to_checksum_address(token_out)
    router_address = Web3.to_checksum_address(config.SWAP_ROUTER_ADDRESS)
    weth_address = Web3.to_checksum_address(
        config.TOKENS["WETH"]["address"]
    )

    # Get quote for amountOutMinimum
    print(f"  Getting quote for swap...")
    quoted_amount_out = get_quote(w3, token_in, token_out, fee, amount_in)
    amount_out_minimum = int(quoted_amount_out * (1 - slippage_percent / 100))
    print(f"  Quoted output: {quoted_amount_out}, min accepted: {amount_out_minimum}")

    # Build params as a TUPLE (critical — web3.py encodes structs as ordered tuples)
    # SwapRouter02 has no deadline field (use multicall wrapper if needed)
    params = (
        token_in,          # tokenIn
        token_out,         # tokenOut
        fee,               # fee
        account.address,   # recipient
        amount_in,         # amountIn
        amount_out_minimum,  # amountOutMinimum
        0,                 # sqrtPriceLimitX96
    )

    router_abi = load_abi("swap_router.json")
    router = w3.eth.contract(address=router_address, abi=router_abi)

    # If swapping native ETH (token_in is WETH), set msg.value
    is_native_eth = token_in == weth_address
    tx_value = amount_in if is_native_eth else 0

    nonce = w3.eth.get_transaction_count(account.address)
    tx = router.functions.exactInputSingle(params).build_transaction({
        "from": account.address,
        "value": tx_value,
        "nonce": nonce,
        "maxFeePerGas": w3.eth.gas_price * 2,
        "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
    })

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"  Swap tx sent: {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt["status"] == 1:
        print(f"  Swap confirmed in block {receipt['blockNumber']}")
    else:
        print(f"  Swap FAILED in block {receipt['blockNumber']}")
    return receipt, quoted_amount_out
