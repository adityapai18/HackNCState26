from web3 import Web3

import config
from uniswap import load_abi

# address(0) represents native ETH in the vault's token mappings
ETH_TOKEN = "0x0000000000000000000000000000000000000000"


def get_vault_contract(w3, vault_address):
    """Return a contract instance for the MockVault at vault_address."""
    vault_addr = vault_address or config.MOCK_VAULT_ADDRESS
    if not vault_addr:
        raise ValueError("vault_address or MOCK_VAULT_ADDRESS must be set")
    abi = load_abi("mock_vault_abi.json")
    return w3.eth.contract(
        address=Web3.to_checksum_address(vault_addr),
        abi=abi,
    )


def get_smart_account_vault_balance(w3, vault_address, smart_account_address):
    """
    Return the vault ETH balance for the smart account (same check as handleTestWithdraw).
    Uses balances(ETH_TOKEN, smart_account_address).
    On contract revert or RPC error, raises VaultError with a clear message.
    """
    contract = get_vault_contract(w3, vault_address)
    eth_token = Web3.to_checksum_address(ETH_TOKEN)
    account = Web3.to_checksum_address(smart_account_address)
    try:
        return contract.functions.balances(eth_token, account).call()
    except Exception as e:
        # Contract revert (e.g. custom error) or RPC error; avoid surfacing raw revert data
        raise VaultError("Vault balance read failed (contract reverted or RPC error)") from e


def encode_withdraw_to(amount_wei, recipient_address, session_key_address, vault_address=None, w3=None):
    """
    Encode calldata for vault.withdrawTo(amount, recipient, sessionKeyId).
    Same encoding as frontend handleTestWithdraw/withdrawToBot.
    """
    if w3 is None:
        from uniswap import get_web3
        w3 = get_web3()
    vault_addr = vault_address or config.MOCK_VAULT_ADDRESS
    if not vault_addr:
        raise ValueError("vault_address or MOCK_VAULT_ADDRESS must be set")
    contract = get_vault_contract(w3, vault_addr)
    recipient = Web3.to_checksum_address(recipient_address)
    session_key = Web3.to_checksum_address(session_key_address)
    # build_transaction needs 'from'; use zero address just to get data
    tx = contract.functions.withdrawTo(
        amount_wei, recipient, session_key
    ).build_transaction({"from": "0x0000000000000000000000000000000000000000"})
    return tx["data"]


def prepare_withdraw_via_smart_account(
    w3, vault_address, smart_account_address, session_key_address, recipient_address, amount_wei
):
    """
    Same logical steps as handleTestWithdraw: validate amount, check vault balance
    for the smart account, and return encoded withdrawTo calldata.
    Raises InsufficientVaultBalance if balance < amount_wei.
    Returns (encoded_data_hex, vault_balance_wei).
    """
    if amount_wei <= 0:
        raise VaultError("Amount must be positive")
    balance = get_smart_account_vault_balance(w3, vault_address, smart_account_address)
    if balance < amount_wei:
        raise InsufficientVaultBalance(
            f"Insufficient vault balance ({balance} wei). Requested {amount_wei} wei."
        )
    data = encode_withdraw_to(
        amount_wei, recipient_address, session_key_address, vault_address, w3
    )
    return (data.hex() if hasattr(data, "hex") else data, balance)


class VaultError(Exception):
    pass


class WithdrawalLimitReached(VaultError):
    pass


class InsufficientVaultBalance(VaultError):
    pass


class Vault:
    """Interact with the MockVault contract and track session key usage."""

    def __init__(self, w3, account, session_key_address=None, vault_address=None):
        self.w3 = w3
        self.account = account
        addr = session_key_address or config.SESSION_KEY_ADDRESS
        if not addr:
            raise ValueError("session_key_address or SESSION_KEY_ADDRESS must be set")
        self.session_key = Web3.to_checksum_address(addr)
        self.eth_token = Web3.to_checksum_address(ETH_TOKEN)
        vault_addr = vault_address or config.MOCK_VAULT_ADDRESS
        if not vault_addr:
            raise ValueError("vault_address or MOCK_VAULT_ADDRESS must be set")

        abi = load_abi("mock_vault_abi.json")
        self.contract = w3.eth.contract(
            address=Web3.to_checksum_address(vault_addr),
            abi=abi,
        )

    # ---- Read methods ----

    def get_vault_balance(self):
        """Return bot's ETH balance in the vault (wei)."""
        return self.contract.functions.balances(
            self.eth_token, self.account.address
        ).call()

    def get_withdrawal_count(self):
        """Return how many times the current session key has withdrawn."""
        return self.contract.functions.withdrawalCount(
            self.eth_token, self.account.address, self.session_key
        ).call()

    def get_max_withdrawals(self):
        """Return the on-chain max withdrawal count for ETH."""
        return self.contract.functions.maxWithdrawalsPerAccount(
            self.eth_token
        ).call()

    def can_withdraw(self):
        """Return True if the session key still has withdrawals remaining."""
        max_w = self.get_max_withdrawals()
        if max_w == 0:
            return False
        current = self.get_withdrawal_count()
        return current < max_w

    # ---- Write methods ----

    def withdraw(self, amount_wei):
        """Call vault.withdraw(amount, sessionKeyAddress). Returns tx receipt."""
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        tx = self.contract.functions.withdraw(
            amount_wei, self.session_key
        ).build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "maxFeePerGas": self.w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": self.w3.to_wei(2, "gwei"),
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt["status"] != 1:
            raise VaultError(f"Vault withdrawal tx reverted: {tx_hash.hex()}")
        return receipt

    def deposit(self, amount_wei):
        """Call vault.deposit() with value. Credits msg.sender (bot) in vault."""
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        tx = self.contract.functions.deposit().build_transaction({
            "from": self.account.address,
            "value": amount_wei,
            "nonce": nonce,
            "maxFeePerGas": self.w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": self.w3.to_wei(2, "gwei"),
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        if receipt["status"] != 1:
            raise VaultError(f"Vault deposit tx reverted: {tx_hash.hex()}")
        return receipt

    def ping(self):
        """Call vault.ping() to test connectivity. Returns tx receipt."""
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        tx = self.contract.functions.ping().build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "maxFeePerGas": self.w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": self.w3.to_wei(2, "gwei"),
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt
