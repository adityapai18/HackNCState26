# Session Keys — High-Level Flow

```mermaid
flowchart TB
    subgraph User["👤 User"]
        EOA[EOA Wallet\n(e.g. MetaMask)]
    end

    subgraph Frontend["🖥️ Frontend (Next.js)"]
        Step1[Step 1: Connect & Create\nSmart Account]
        Step2[Step 2: Issue Session Key\n(generate key + grantPermissions)]
        Step3[Step 3: Ping\n(session key signs)]
        Step4[Step 4: Withdraw\n(session key signs)]
    end

    subgraph Alchemy["Alchemy Account Kit"]
        SA[Smart Account\n(modular account)]
        SK[Session Key\n(ephemeral signer)]
        Perms[Permissions\n• ping, withdraw, withdrawTo on MockVault\n• native-token allowance]
    end

    subgraph Chain["Sepolia"]
        Vault[MockVault\n• balances[token][account]\n• withdrawalCount / totalWithdrawn\n  per (account, sessionKeyId)]
    end

    EOA -->|"1. sign (once)"| Step1
    Step1 --> SA
    SA --> Step2
    Step2 -->|"owner signs grantPermissions"| Perms
    Perms --> SK
    Step2 -->|"store sessionKeyAddress"| Frontend

    SK -->|"2. sign (no EOA)"| Step3
    SK -->|"2. sign (no EOA)"| Step4
    Step3 -->|"userOp: vault.ping()"| Vault
    Step4 -->|"userOp: vault.withdraw(amount, sessionKeyId)\nor withdrawTo(amount, recipient, sessionKeyId)"| Vault

    Vault -->|"limits keyed by sessionKeyId"| Vault
```

## Sequence (who signs what)

```mermaid
sequenceDiagram
    participant U as User (EOA)
    participant F as Frontend
    participant SA as Smart Account
    participant SK as Session Key
    participant V as MockVault

    Note over U,V: Step 1 — One-time setup
    U->>F: Connect wallet
    F->>SA: createSmartWalletClient + requestAccount
    U->>SA: (implicit: EOA backs SA)
    SA-->>F: smartAccountAddress

    Note over U,V: Step 2 — Issue session key
    F->>F: Generate session key (LocalAccountSigner)
    F->>SA: grantPermissions(publicKey, ping+withdraw+withdrawTo, allowance)
    U->>SA: Sign grant (owner)
    SA-->>F: permissions; F stores sessionKeyAddress

    Note over U,V: Step 3 — Ping (session key only)
    F->>F: encode vault.ping()
    F->>SK: signPreparedCalls(sessionKeySigner, prepareCalls(...))
    SK->>SA: Signed userOp (session key, no EOA)
    SA->>V: Execute ping()
    V-->>F: Success

    Note over U,V: Step 4 — Withdraw (session key only)
    F->>F: encode vault.withdraw(amount, sessionKeyId)
    F->>SK: signPreparedCalls(sessionKeySigner, ...)
    SK->>SA: Signed userOp (session key, no EOA)
    SA->>V: Execute withdraw(amount, sessionKeyId)
    V->>V: Check limits per (account, sessionKeyId)
    V-->>F: ETH sent
```

## Summary

| Actor | Role |
|-------|------|
| **EOA** | Owner; signs once to create smart account and to grant session key permissions. |
| **Smart Account** | Holds vault balance; executes userOps signed by owner or by session key. |
| **Session Key** | Ephemeral signer; can only call `ping` / `withdraw` / `withdrawTo` on MockVault, within allowance. |
| **MockVault** | Tracks balance and per–session-key limits (`withdrawalCount`, `totalWithdrawn` by `sessionKeyId`). |

**Session key management:** Only the wallet that created the smart account (the EOA used in Step 1) can issue or revoke session keys. The app stores `ownerEoaAddress` at account creation and disables “Issue Session Key” when the connected wallet is not that owner; reconnecting with the owner wallet re-enables it.
