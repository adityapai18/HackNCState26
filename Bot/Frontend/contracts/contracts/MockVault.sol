// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockVault
 * @dev Vault with per-token, per-session-key limits. Limits apply per (account, sessionKeyId) so each new session key gets fresh limits.
 *      address(0) = native ETH. Pass the session key address (e.g. from signer.getAddress()) as sessionKeyId in withdraw/withdrawTo.
 */
contract MockVault {
    address public owner;

    /// @dev token address(0) = ETH. token => user => balance
    mapping(address => mapping(address => uint256)) public balances;
    /// @dev token => user => sessionKeyId => number of withdrawals (limits are per session key)
    mapping(address => mapping(address => mapping(address => uint256))) public withdrawalCount;
    /// @dev token => user => sessionKeyId => total amount withdrawn (for limit check, per session key)
    mapping(address => mapping(address => mapping(address => uint256))) public totalWithdrawn;

    /// @dev token => max number of withdrawals allowed per account (0 = use default or deny)
    mapping(address => uint256) public maxWithdrawalsPerAccount;
    /// @dev token => max total amount an account can withdraw (0 = no limit)
    mapping(address => uint256) public withdrawalLimitPerAccount;

    event Deposited(address indexed user, uint256 amount);
    event Pinged(address indexed caller, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount);
    event WithdrawnTo(address indexed user, address indexed recipient, uint256 amount);
    event TokenLimitsSet(address indexed token, uint256 maxWithdrawals, uint256 maxTotalWithdrawable);

    error OnlyOwner();
    error ZeroDeposit();
    error InsufficientBalance();
    error WithdrawalCountLimitReached();
    error WithdrawalAmountLimitReached();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        // Default for ETH: 2 withdrawals per account, no amount limit
        maxWithdrawalsPerAccount[address(0)] = 2;
        withdrawalLimitPerAccount[address(0)] = 0; // 0 = no limit
        emit TokenLimitsSet(address(0), 2, 0);
    }

    /// @param token address(0) for ETH. For future ERC20, pass token address.
    /// @param maxWithdrawals max number of times an account can withdraw this token (0 = no withdrawals).
    /// @param maxTotalWithdrawable max total amount an account can withdraw (0 = no limit).
    function setTokenLimits(
        address token,
        uint256 maxWithdrawals,
        uint256 maxTotalWithdrawable
    ) external onlyOwner {
        maxWithdrawalsPerAccount[token] = maxWithdrawals;
        withdrawalLimitPerAccount[token] = maxTotalWithdrawable;
        emit TokenLimitsSet(token, maxWithdrawals, maxTotalWithdrawable);
    }

    function deposit() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        balances[address(0)][msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function ping() external {
        emit Pinged(msg.sender, block.timestamp);
    }

    /// @param sessionKeyId Address of the session key (e.g. from signer.getAddress()). Limits are applied per session key.
    function withdraw(uint256 amount, address sessionKeyId) external {
        address token = address(0);
        if (balances[token][msg.sender] < amount) revert InsufficientBalance();
        uint256 maxCount = maxWithdrawalsPerAccount[token];
        if (maxCount == 0) revert WithdrawalCountLimitReached();
        if (withdrawalCount[token][msg.sender][sessionKeyId] >= maxCount) revert WithdrawalCountLimitReached();
        uint256 limit = withdrawalLimitPerAccount[token];
        if (limit != 0 && totalWithdrawn[token][msg.sender][sessionKeyId] + amount > limit) revert WithdrawalAmountLimitReached();

        withdrawalCount[token][msg.sender][sessionKeyId] += 1;
        totalWithdrawn[token][msg.sender][sessionKeyId] += amount;
        balances[token][msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    /// @dev Withdraw from your balance to a recipient (e.g. EOA). Limits apply per sessionKeyId. Use when the sender (smart account) cannot receive ETH.
    function withdrawTo(uint256 amount, address recipient, address sessionKeyId) external {
        address token = address(0);
        if (balances[token][msg.sender] < amount) revert InsufficientBalance();
        uint256 maxCount = maxWithdrawalsPerAccount[token];
        if (maxCount == 0) revert WithdrawalCountLimitReached();
        if (withdrawalCount[token][msg.sender][sessionKeyId] >= maxCount) revert WithdrawalCountLimitReached();
        uint256 limit = withdrawalLimitPerAccount[token];
        if (limit != 0 && totalWithdrawn[token][msg.sender][sessionKeyId] + amount > limit) revert WithdrawalAmountLimitReached();

        withdrawalCount[token][msg.sender][sessionKeyId] += 1;
        totalWithdrawn[token][msg.sender][sessionKeyId] += amount;
        balances[token][msg.sender] -= amount;
        (bool ok, ) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit WithdrawnTo(msg.sender, recipient, amount);
    }

    receive() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        balances[address(0)][msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
