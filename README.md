# CryptoKnight 🛡️🤖

> **"Delegate the Trade. Keep the Keys."**

A full-stack **Account Abstraction (ERC-4337)** platform that enables **trustless AI trading**. CryptoKnight solves the "Delegation Dilemma" by using **Session Keys** to give an automated bot permission to trade on your behalf, while physically preventing it from withdrawing your funds.

Built for **Sepolia testnet**.

---

## 💡 The Problem

In traditional DeFi, if you want an AI agent to trade for you, you have to give it your **Private Key**. This is a massive security risk—if the bot is hacked or goes rogue, your wallet is drained.

## 🛡️ The Solution: CryptoKnight

We built a system where the AI Agent acts as a **Guest**, not an Owner.

1. **Smart Account Vault:** You deploy a Modular Account (via Alchemy) that holds your funds.
2. **Session Keys:** You issue a temporary, restricted key to the bot.
3. **On-Chain Policy:** The bot can call `swap()` or `ping()`, but if it attempts to call `withdraw()`, the transaction **reverts on-chain**.

---

## 🏗️ Architecture

```mermaid
graph LR
    User[User EOA "Master Key"] -- 1. Grants Permission --> SessionKey[Session Key "Guest Pass"]
    SessionKey -- 2. Signs Trade --> Bundler[Alchemy Bundler]
    Bundler -- 3. Validates Rules --> SmartAccount[Smart Account]
    SmartAccount -- 4. Executes Trade --> Uniswap[Uniswap V3]
    SmartAccount -- 5. BLOCKS Withdrawal --> Hacker[Attacker]

```

### 1. **CryptoKnight (Frontend)**

The command center for your vault.

* **Stack:** Next.js 14, wagmi, viem, Alchemy Account Kit.
* **Functionality:**
* **Onboarding:** Deploys a Smart Account and funds it with Sepolia ETH.
* **Session Management:** Issues session keys with **functions-on-contract** permissions.
* **Vault Control:** Deposit funds, view balance, and set admin withdrawal limits.
* **Bot Dashboard:** Start/Stop the Python bot and view live trade logs.



### 2. **MockVault (Contracts)**

The on-chain security layer.

* **Stack:** Hardhat, Solidity.
* **Logic:** A vault contract that enforces **Per-Session Limits**.
* `deposit()`: Anyone can fund the account.
* `withdraw()`: Only allowed if the signer has permission AND has not exceeded their specific allowance.



### 3. **The Agent (Bot)**

The autonomous trader.

* **Stack:** Python, Flask, Web3.py, CoinGecko, Uniswap V3.
* **Logic:**
* Monitors market data (SMA Crossover Strategy).
* Executes swaps on Sepolia Uniswap V3 using the **Session Key**.
* **Trade Logger:** Posts trade proofs to IPFS and logs them on-chain for transparency.



---

## 🚀 Quick Start

### Prerequisites

* **Node.js 18+** & **Python 3.10+**
* **Alchemy Account** (for Sepolia RPC & Account Kit)
* **Sepolia ETH** (for gas)

### Step 1: Deploy the Vault

Deploy the `MockVault` contract that will enforce our security rules.

```bash
cd Frontend/contracts
npm install
# Create .env with PRIVATE_KEY (deployer) & ALCHEMY_API_KEY
npm run compile
npm run deploy:sepolia
# 📋 COPY THE DEPLOYED VAULT ADDRESS!

```

### Step 2: Start the Frontend

Configure the UI to talk to your vault and Alchemy.

```bash
cd Frontend
npm install
cp .env.example .env.local

```

**Update `.env.local`:**

```env
NEXT_PUBLIC_MOCK_VAULT_ADDRESS=0xYourDeployedAddress
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
NEXT_PUBLIC_BOT_API_URL=http://localhost:5001

```

Run the app:

```bash
npm run dev
# Open http://localhost:3000

```

### Step 3: Unleash the Bot (Optional)

Run the Python agent locally to simulate the trading activity.

```bash
cd Bot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env 
# Configure .env with your Session Key (generated from frontend) or a test key
python app.py

```

---

## 🧪 Testing the Security

To verify the system works as intended, try the **"Break the System"** flow in the Dashboard:

1. **Fund the Vault:** Deposit 0.01 Sepolia ETH.
2. **Authorize the Bot:** Issue a session key.
3. **Run a Trade:** Click "Test Trade" (Bot calls `ping` or `swap`). **Result: ✅ Success.**
4. **Try to Steal:** Click "Test Withdraw" using the Bot's key. **Result: ❌ Reverted.**

## 📂 Project Structure

```
├── Frontend/           # Next.js Dashboard & Logic
│   ├── app/            # App Router (Onboarding -> Dashboard)
│   ├── contracts/      # Hardhat MockVault environment
│   └── lib/            # Alchemy Account Kit integration
├── Bot/                # Python Trading Agent
│   ├── app.py          # Flask API for Frontend control
│   ├── bot.py          # SMA Trading Logic
│   └── uniswap.py      # V3 Interaction Scripts
└── images/             # Diagrams & Screenshots

```

---

*Built with ❤️ for HackNC State 2026.*
