# Uniswap V3 Trading Bot with On-Chain Trade Proofs

An automated trading bot that executes SMA crossover trades on Uniswap V3 (Sepolia testnet) and records immutable proof of every trade via IPFS and a custom smart contract.

## What It Does

1. **Monitors prices** — Fetches live price data from CoinGecko every 30 seconds
2. **Detects signals** — Computes short (10) and long (30) period Simple Moving Averages; triggers BUY when short SMA crosses above long, SELL when it crosses below
3. **Executes swaps** — Sends transactions to Uniswap V3 SwapRouter02 on Sepolia with slippage protection
4. **Records proof** — After each swap, pins full trade metadata to IPFS via Pinata, then logs the IPFS CID on-chain in a TradeLogger smart contract

Every trade produces a tamper-proof, publicly verifiable audit trail.

## Architecture

```
CoinGecko API ──> price_feed.py ──> strategy.py (SMA crossover)
                                         │
                                      bot.py (main loop)
                                         │
                                    uniswap.py ──> Uniswap V3 SwapRouter02
                                         │
                                   trade_proof.py
                                     │         │
                                Pinata IPFS   TradeLogger.sol
                                  (JSON)      (Sepolia contract)
```

## Project Structure

```
├── bot.py                  # Main loop: price → signal → swap → proof
├── config.py               # All configuration from .env
├── strategy.py             # SMA crossover signal detection
├── price_feed.py           # CoinGecko price history
├── uniswap.py              # Uniswap V3 swap execution + quoting
├── trade_proof.py          # IPFS pinning + on-chain proof logging
├── deploy_logger.py        # One-shot TradeLogger deployment script
├── contracts/
│   └── TradeLogger.sol     # Solidity source for the proof contract
├── abi/
│   ├── trade_logger_abi.json     # Compiled ABI
│   ├── trade_logger_bytecode.txt # Compiled bytecode
│   ├── swap_router.json          # Uniswap SwapRouter02 ABI
│   ├── quoter.json               # Uniswap QuoterV2 ABI
│   └── erc20.json                # Standard ERC-20 ABI
├── requirements.txt
├── .env.example
└── .env                    # Secrets (not committed)
```

## Trade Proof System

Each swap produces two artifacts:

**IPFS metadata** (~1 KB JSON pinned via Pinata):
- Transaction hash, block number
- Signal type (BUY / SELL / TEST)
- Token addresses, raw and human-readable amounts
- Quoted output amount and slippage tolerance
- Current price, short SMA, long SMA
- UTC timestamp

**On-chain record** (TradeLogger contract on Sepolia):
- Stores the swap tx hash mapped to the IPFS CID
- Emits a `TradeLogged` event with indexed `tradeId`, `swapTxHash`, and `trader`
- Anyone can look up any trade by its swap tx hash

The proof logging is wrapped in try/except — if IPFS or the contract call fails, trading continues uninterrupted.

## TradeLogger Contract

Minimal, permissionless Solidity contract:

| Function | Description |
|----------|-------------|
| `logTrade(bytes32 swapTxHash, string ipfsCid)` | Store a trade record and emit event |
| `getTradeByHash(bytes32)` | Look up trader, CID, and timestamp by swap tx hash |
| `getTradeCount()` | Total number of logged trades |
| `trades(uint256)` | Access trade by index |

No access control — any address can log trades.

## Setup

### Prerequisites

- Python 3.10+
- A funded Sepolia wallet (needs ETH for gas)
- [Pinata](https://pinata.cloud) account (free tier: 100 pins, 1 GB)
- [Alchemy](https://alchemy.com) or other Sepolia RPC endpoint
- [CoinGecko](https://coingecko.com) API key (free demo tier)

### Installation

```bash
git clone <repo-url> && cd HackNC
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Valkey Setup (macOS)

Install Valkey:

```bash
brew install valkey
```

Run Valkey as a background service:

```bash
brew services start valkey
```

Check service status:

```bash
brew services info valkey
```

Stop the service:

```bash
brew services stop valkey
```

### Configuration

Copy the example env and fill in your values:

```bash
cp .env.example .env
```

```env
PRIVATE_KEY=0xYourPrivateKeyHere
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
COINGECKO_API_KEY=CG-YourDemoKeyHere
PINATA_JWT=YourPinataJWTHere
TRADE_LOGGER_ADDRESS=0xYourDeployedTradeLoggerAddress
```

### Deploy the TradeLogger Contract

```bash
python deploy_logger.py
```

This prints the deployed contract address. Paste it into `.env` as `TRADE_LOGGER_ADDRESS`.

### Run the Bot

```bash
python bot.py
```

The bot will:
1. Execute a test swap to verify everything works
2. Enter the main loop — checking prices and executing trades on signal changes
3. Log `[TradeProof]` output after each swap with the IPFS CID and Etherscan link

## Verification

After a swap, you can verify the proof trail:

1. **Console** — Look for `[TradeProof] IPFS CID: ...` in the output
2. **IPFS** — Visit `https://gateway.pinata.cloud/ipfs/<CID>` to see the full trade JSON
3. **Etherscan** — Visit `https://sepolia.etherscan.io/address/<contract>#events` to see `TradeLogged` events
4. **Contract** — Call `getTradeByHash(txHash)` to retrieve the CID for any past swap

## Tech Stack

- **Python 3** with web3.py for blockchain interaction
- **Uniswap V3** SwapRouter02 + QuoterV2 on Sepolia
- **Pinata** V3 Files API for IPFS pinning
- **Solidity 0.8.19** for the TradeLogger contract
- **CoinGecko** API for real-time price data
