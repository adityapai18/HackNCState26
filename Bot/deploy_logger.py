"""One-shot script to deploy TradeLogger contract to Sepolia."""

import json
import os

from web3 import Web3

import config

ABI_DIR = os.path.join(os.path.dirname(__file__), "abi")


def main():
    # Connect
    w3 = Web3(Web3.HTTPProvider(config.RPC_URL))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to {config.RPC_URL}")

    account = w3.eth.account.from_key(config.PRIVATE_KEY)
    print(f"Deploying from: {account.address}")
    print(f"ETH balance: {Web3.from_wei(w3.eth.get_balance(account.address), 'ether')} ETH")

    # Load ABI and bytecode
    with open(os.path.join(ABI_DIR, "trade_logger_abi.json")) as f:
        abi = json.load(f)

    with open(os.path.join(ABI_DIR, "trade_logger_bytecode.txt")) as f:
        bytecode = f.read().strip()

    # Build deployment transaction
    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.constructor().build_transaction({
        "from": account.address,
        "nonce": nonce,
        "maxFeePerGas": w3.eth.gas_price * 2,
        "maxPriorityFeePerGas": w3.to_wei(2, "gwei"),
    })

    # Sign and send
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Deploy tx sent: {tx_hash.hex()}")
    print("Waiting for confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt["status"] == 1:
        print(f"\nTradeLogger deployed successfully!")
        print(f"  Contract address: {receipt['contractAddress']}")
        print(f"  Block: {receipt['blockNumber']}")
        print(f"  Gas used: {receipt['gasUsed']}")
        print(f"\nAdd this to your .env file:")
        print(f"  TRADE_LOGGER_ADDRESS={receipt['contractAddress']}")
        print(f"\nEtherscan: https://sepolia.etherscan.io/address/{receipt['contractAddress']}")
    else:
        print(f"\nDeployment FAILED in block {receipt['blockNumber']}")


if __name__ == "__main__":
    main()
