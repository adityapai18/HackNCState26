# HackNC State 2026 — CryptoKnight & Trading Bot

A full-stack **session-key–powered** app for managing a smart-account vault and an automated **Uniswap V3 trading bot** with on-chain trade proofs. Built for **Sepolia testnet**.

---

## What This Repo Does

### 1. **CryptoKnight (Frontend)**

**CryptoKnight** is a Next.js app that lets you:

- **Connect** an EOA (e.g. MetaMask) on Sepolia.
- **Create** an Alchemy Modular (smart) account and fund it with gas.
- **Issue a session key** with scoped permissions: the key can call `ping()`, `deposit()`, `withdraw()`, and `withdrawTo()` on a **MockVault** contract, with per–session-key withdrawal limits.
- **Onboard**: ensure the smart account has gas, optionally deposit ETH into the vault, then continue to the dashboard.
- **Dashboard**: view session key status, vault balance and history, set admin withdrawal limits (if you’re the vault owner), and control the trading bot (start/stop, view logs, pending withdrawals).

Session keys are created with **Alchemy Account Kit** using **functions-on-contract** permissions and per-session withdrawal limits enforced on-chain by the vault.

### 2. **MockVault (Contracts)**

A Hardhat project under `Frontend/contracts/` that deploys **MockVault.sol** to Sepolia:

- **Deposit** ETH (payable) to credit the smart account’s balance.
- **Ping** to test session key authorization (emits event).
- **Withdraw** / **WithdrawTo** with per–session-key limits (count and max total) set by the vault owner.

### 3. **Trading Bot (Bot)**

A Python service that:

- Fetches price data from **CoinGecko** and runs an **SMA crossover** strategy.
- Executes **Uniswap V3** swaps on Sepolia.
- Records **trade proofs** (IPFS + on-chain TradeLogger).
- Exposes a **Flask API** (default port **5001**) so the CryptoKnight dashboard can start/stop the bot, stream logs, and see pending vault withdrawals.

The frontend dashboard talks to this API when you use the “Trade agent” controls.

---

## Architecture (High Level)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CryptoKnight (Next.js)                          │
│  Login → Onboarding (create SA, fund gas, deposit/skip) → Dashboard      │
│  Dashboard: Session keys, vault balance, admin limits, bot control       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Alchemy       │     │ MockVault       │     │ Bot API          │
│ (Account Kit, │     │ (Sepolia)       │     │ (Flask :5001)    │
│  RPC, Bundler)│     │ deposit/ping/   │     │ start/stop/logs  │
└───────────────┘     │ withdraw/limits │     └────────┬────────┘
                      └─────────────────┘              │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Trading Bot     │
                                              │ CoinGecko → SMA │
                                              │ → Uniswap V3    │
                                              │ → IPFS + Logger │
                                              └─────────────────┘
```

---

## Screenshots

You can add screenshots under `images/` and reference them here.

| Screen | Description |
|--------|-------------|
| [Login](./images/login.png) | Connect wallet (MetaMask) on Sepolia. |
| [Onboarding](./images/onboarding.png) | Create smart account, add gas, deposit to vault or skip. |
| [Dashboard](./images/dashboard.png) | Session key panel, vault balance, admin limits, bot control. |

*(Add `login.png`, `onboarding.png`, and `dashboard.png` in the `images/` folder to show them above.)*

![Login — Connect wallet](images/login.png)  
*Login: connect your wallet on Sepolia.*

![Onboarding — Smart account & vault](images/onboarding.png)  
*Onboarding: create smart account, fund gas, deposit or skip.*

![Dashboard — Session keys & bot](images/dashboard.png)  
*Dashboard: session keys, vault, admin limits, and trading bot control.*

---

## Quick Start

### Prerequisites

- **Node.js** 18+ (for Frontend and contracts)
- **Python** 3.10+ (for Bot)
- **MetaMask** (or any injected wallet) on **Sepolia**
- **Alchemy** account ([dashboard](https://dashboard.alchemy.com/)) for Sepolia RPC and Account Kit
- **Sepolia ETH** for gas (e.g. [Alchemy](https://sepoliafaucet.com/) or [Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia))
- For the **Bot**: Valkey/Redis, CoinGecko API key, Pinata (see [Bot/README.md](./Bot/README.md))

---

### Step 1: Deploy MockVault (Sepolia)

```bash
cd Frontend/contracts
npm install
cp .env.example .env
# Edit .env: set PRIVATE_KEY (deployer) and optionally SEPOLIA_RPC_URL
npm run compile
npm run deploy:sepolia
```

Copy the printed **MockVault** address; you’ll need it for the Frontend.

---

### Step 2: Run the CryptoKnight Frontend

```bash
cd Frontend
npm install
```

Create `.env.local` (or `.env`) in `Frontend/` with at least:

```env
# Required
NEXT_PUBLIC_MOCK_VAULT_ADDRESS=0xYourDeployedMockVaultAddress
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Optional (defaults used if omitted)
# NEXT_PUBLIC_BOT_API_URL=http://localhost:5001
```

Then:

```bash
npm run dev
```

Open **http://localhost:3000**.

1. **Connect** your wallet (MetaMask) and switch to Sepolia.
2. You’ll be sent to **Onboarding**: create the smart account, add gas if prompted, optionally deposit into the vault (or “Skip to main screen”).
3. On the **Dashboard** you can issue a session key, ping the vault, deposit/withdraw, set limits (if owner), and use the bot controls.

---

### Step 3 (Optional): Run the Trading Bot & API

The dashboard’s “Trade agent” section needs the Bot API. From the repo root:

```bash
cd Bot
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Configure Valkey (see [Bot/README.md](./Bot/README.md)), then copy env and set variables:

```bash
cp .env.example .env
# Edit .env: PRIVATE_KEY, RPC_URL, COINGECKO_API_KEY, PINATA_JWT, TRADE_LOGGER_ADDRESS, etc.
```

Start the API (which also runs the bot when started from the dashboard):

```bash
python app.py
```

By default the API listens on **http://localhost:5001**. The frontend uses `NEXT_PUBLIC_BOT_API_URL` (default `http://localhost:5001`) to talk to it.

---

## Project Layout

```
├── Frontend/                 # CryptoKnight Next.js app
│   ├── app/
│   │   ├── page.tsx         # Login
│   │   ├── onboarding/     # Smart account + vault onboarding
│   │   └── dashboard/      # Main app (session keys, vault, bot)
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── contracts/           # Hardhat + MockVault.sol
│   │   ├── contracts/
│   │   └── scripts/deploy.ts
│   └── .env / .env.local    # NEXT_PUBLIC_*, etc.
├── Bot/                     # Trading bot + Flask API
│   ├── app.py               # Flask API (port 5001)
│   ├── bot.py               # Trading loop
│   ├── strategy.py, uniswap.py, trade_proof.py, ...
│   └── README.md            # Full bot setup & trade proofs
├── images/                  # Screenshots for this README
│   └── README.md            # How to add images
└── README.md                # This file
```

---

## Environment Variables Summary

| Where | Variable | Purpose |
|-------|----------|---------|
| **Frontend** | `NEXT_PUBLIC_MOCK_VAULT_ADDRESS` | Deployed MockVault on Sepolia |
| **Frontend** | `NEXT_PUBLIC_ALCHEMY_API_KEY` | Alchemy app key (Sepolia) |
| **Frontend** | `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC URL |
| **Frontend** | `NEXT_PUBLIC_BOT_API_URL` | Bot API base URL (default `http://localhost:5001`) |
| **Frontend** | (optional) Gemini, CoinGecko, Valkey | For AI insights / price / cache (see Frontend/.env) |
| **Contracts** | `PRIVATE_KEY` | Deployer EOA for MockVault |
| **Contracts** | `SEPOLIA_RPC_URL` | Optional; defaults or Alchemy |
| **Bot** | See [Bot/README.md](./Bot/README.md) | RPC, CoinGecko, Pinata, Valkey, TradeLogger, etc. |

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, wagmi, viem, Alchemy Account Kit, Tailwind, Radix UI
- **Contracts:** Hardhat, Solidity, MockVault (deposit / ping / withdraw / limits)
- **Bot:** Python 3, Flask, web3.py, Uniswap V3, CoinGecko, Pinata (IPFS), Valkey (Redis)

---

## More Detail

- **Session keys & vault flow:** [Frontend/README.md](./Frontend/README.md) and [Frontend/SESSION_KEYS_POC_CONTEXT.md](./Frontend/SESSION_KEYS_POC_CONTEXT.md)
- **Trading bot & trade proofs:** [Bot/README.md](./Bot/README.md)

---