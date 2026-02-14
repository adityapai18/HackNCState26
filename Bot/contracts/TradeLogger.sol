// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TradeLogger {
    struct Trade {
        address trader;
        bytes32 swapTxHash;
        string ipfsCid;
        uint256 timestamp;
    }

    Trade[] public trades;
    mapping(bytes32 => Trade) public tradeByHash;

    event TradeLogged(
        uint256 indexed tradeId,
        bytes32 indexed swapTxHash,
        address indexed trader,
        string ipfsCid,
        uint256 timestamp
    );

    function logTrade(bytes32 swapTxHash, string calldata ipfsCid) external {
        Trade memory t = Trade({
            trader: msg.sender,
            swapTxHash: swapTxHash,
            ipfsCid: ipfsCid,
            timestamp: block.timestamp
        });
        trades.push(t);
        tradeByHash[swapTxHash] = t;
        emit TradeLogged(trades.length - 1, swapTxHash, msg.sender, ipfsCid, block.timestamp);
    }

    function getTradeByHash(bytes32 swapTxHash)
        external
        view
        returns (address trader, string memory ipfsCid, uint256 timestamp)
    {
        Trade storage t = tradeByHash[swapTxHash];
        return (t.trader, t.ipfsCid, t.timestamp);
    }

    function getTradeCount() external view returns (uint256) {
        return trades.length;
    }
}
