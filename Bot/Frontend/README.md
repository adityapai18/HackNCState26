# Session Keys PoC — Alchemy on Sepolia

Proof-of-Concept: a **session key** can call `ping()` on a vault but is **forbidden** from calling `withdraw()`.

## Stack

- **Frontend:** Next.js (App Router), viem, wagmi, `@account-kit/wallet-client`, `@account-kit/infra`, `@aa-sdk/core`
- **Contract:** MockVault.sol (Hardhat), Sepolia — `ping()` (emits event), `withdraw(uint256)` (transfers ETH)
- **Session model:** Alchemy Account Kit — `createSmartWalletClient`, `grantPermissions` with **functions-on-contract** (only `ping()` selector; `withdraw()` not allowed)

## Quick start

### 1. Deploy MockVault (Sepolia)

```bash
cd contracts
npm install
# Set in .env: PRIVATE_KEY (deployer), optional SEPOLIA_RPC_URL
npm run compile
npm run deploy:sepolia
```

Copy the printed `MockVault` address and set it in the Next.js env (see below).

### 2. Run the Next.js app

```bash
# From repo root
npm install
cp .env.example .env.local
# Edit .env.local: set NEXT_PUBLIC_MOCK_VAULT_ADDRESS and NEXT_PUBLIC_ALCHEMY_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Test flow in the UI

1. **Connect** — Connect wallet (MetaMask) on Sepolia.
2. **Button 1: Connect & Create Smart Account** — Initializes the Modular Account via Alchemy; fund it via the Sepolia faucet if needed.
3. **Button 2: Issue Session Key** — Calls `grantPermissions` (signed by owner) with **functions-on-contract**: only `ping()` selector allowed; `withdraw()` not in the list.
4. **Button 3: Test Ping (Authorized)** — Executes `ping()` using the session key; should succeed.
5. **Button 4: Test Withdraw (Unauthorized)** — Executes `withdraw()` using the session key; must **fail**; the revert/error is shown in the UI.

## Contract: MockVault.sol

- `mapping(address => uint256) public balances`
- `deposit()` (payable)
- `ping()` (emits event)
- `withdraw(uint256 amount)`

## Session policy

The session is created with a **single allowed action**: `ping()` on the MockVault. `withdraw()` is **not** in the policy, so the session key cannot withdraw.

## Console logs

- **Step 3:** `[SessionKeysPoC] Step 3 — Authorized ping() UserOp/superTxn hash: 0x...`
- **Step 4:** `[SessionKeysPoC] Step 4 — Unauthorized withdrawal REJECTED (expected).` plus **Rejection reason** and full error/cause for debugging.

## Env vars

- **Contracts:** `PRIVATE_KEY`, optional `SEPOLIA_RPC_URL`
- **Next.js:** `NEXT_PUBLIC_MOCK_VAULT_ADDRESS` (deployed MockVault on Sepolia), `NEXT_PUBLIC_ALCHEMY_API_KEY` (from [Alchemy Dashboard](https://dashboard.alchemy.com/))

## Notes

- Alchemy Account Kit supports Sepolia; use an Alchemy app on Sepolia and set `NEXT_PUBLIC_ALCHEMY_API_KEY`.
- Session key is generated with `viem`’s `generatePrivateKey()` and kept in React state (PoC only; do not use in production as-is).
