"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useConfig, useSwitchChain } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { createPublicClient, http, encodeFunctionData, getAbiItem, getFunctionSelector, toHex, parseEther, type Hex, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { MOCK_VAULT_ABI, ETH_TOKEN } from "@/lib/mockVaultAbi";

/** ERC-4337: if sender is already deployed, initCode must be empty. */
async function stripInitCodeIfDeployed<T>(
  publicClient: PublicClient,
  sender: `0x${string}`,
  prepared: T
): Promise<T> {
  const candidate = prepared as {
    type?: string;
    data?: { factory?: string; factoryData?: string };
  };
  if (candidate.type !== "user-operation-v070" && candidate.type !== "user-operation-v060") return prepared;
  if (!candidate.data?.factory && !candidate.data?.factoryData) return prepared;
  const code = await publicClient.getCode({ address: sender });
  if (!code || code === "0x") return prepared;
  return {
    ...(prepared as Record<string, unknown>),
    data: {
      ...(candidate.data ?? {}),
      factory: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      factoryData: "0x" as `0x${string}`,
    },
  } as T;
}

const MOCK_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_MOCK_VAULT_ADDRESS || "") as `0x${string}`;

type SmartWalletClient = Awaited<ReturnType<typeof import("@account-kit/wallet-client").createSmartWalletClient>>;
type GrantPermissionsResult = Awaited<ReturnType<SmartWalletClient["grantPermissions"]>>;

export interface VaultEvent {
  type: "deposit" | "withdraw" | "ping";
  timestamp: number;
  amountWei?: bigint;
}

export function useSessionKeys() {
  const config = useConfig();
  const { address: eoaAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const [client, setClient] = useState<SmartWalletClient | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  /** EOA that created the smart account; only this wallet can issue/revoke session keys */
  const [ownerEoaAddress, setOwnerEoaAddress] = useState<string | null>(null);
  const [sessionKeySigner, setSessionKeySigner] = useState<import("@aa-sdk/core").SmartAccountSigner | null>(null);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<GrantPermissionsResult | null>(null);

  const [step1Status, setStep1Status] = useState<string>("");
  const [step2Status, setStep2Status] = useState<string>("");
  const [pingStatus, setPingStatus] = useState<string>("");
  const [withdrawStatus, setWithdrawStatus] = useState<string>("");
  const [withdrawalCount, setWithdrawalCount] = useState<number>(0);
  const [withdrawalCountEth, setWithdrawalCountEth] = useState<number>(0);
  const [depositVaultStatus, setDepositVaultStatus] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);
  const [vaultBalanceWei, setVaultBalanceWei] = useState<bigint | null>(null);
  const [refreshBalanceTrigger, setRefreshBalanceTrigger] = useState(0);
  const [vaultOwner, setVaultOwner] = useState<string | null>(null);
  const [maxWithdrawalsEth, setMaxWithdrawalsEth] = useState<number>(2);
  const [withdrawalLimitEth, setWithdrawalLimitEth] = useState<bigint | null>(null);
  const [totalWithdrawnEth, setTotalWithdrawnEth] = useState<bigint | null>(null);
  const [setLimitsStatus, setSetLimitsStatus] = useState<string>("");
  const [withdrawToAddress, setWithdrawToAddress] = useState<string>("");
  const [withdrawAmountWei, setWithdrawAmountWei] = useState<string>("1");

  // Track events for charts
  const [vaultEvents, setVaultEvents] = useState<VaultEvent[]>([]);

  const DEPOSIT_AMOUNT_WEI = 100000000000000n; // 0.0001 ETH

  const addEvent = useCallback((event: VaultEvent) => {
    setVaultEvents((prev) => [...prev, event]);
  }, []);

  // Read vault owner (for display only; limits are per-account via setMyTokenLimits)
  useEffect(() => {
    if (!MOCK_VAULT_ADDRESS || MOCK_VAULT_ADDRESS === "0x") return;
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
    if (!rpcUrl) return;
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    let cancelled = false;
    publicClient.readContract({ address: MOCK_VAULT_ADDRESS, abi: MOCK_VAULT_ABI, functionName: "owner" })
      .then((owner) => { if (!cancelled) setVaultOwner(owner as string); })
      .catch(() => { if (!cancelled) setVaultOwner(null); });
    return () => { cancelled = true; };
  }, [refreshBalanceTrigger]);

  // Clear smart account and session key state when wallet disconnects
  useEffect(() => {
    if (eoaAddress != null) return;
    setClient(null);
    setSmartAccountAddress(null);
    setOwnerEoaAddress(null);
    setSessionKeySigner(null);
    setSessionKeyAddress(null);
    setPermissions(null);
  }, [eoaAddress]);

  // Read vault balance, effective limits for this smart account, and per-session-key totals
  useEffect(() => {
    if (!smartAccountAddress || !MOCK_VAULT_ADDRESS || MOCK_VAULT_ADDRESS === "0x") return;
    const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
    if (!rpcUrl) return;
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    let cancelled = false;
    const skAddr = sessionKeyAddress as `0x${string}` | null;
    const reads: Promise<unknown>[] = [
      publicClient.readContract({
        address: MOCK_VAULT_ADDRESS,
        abi: MOCK_VAULT_ABI,
        functionName: "balances",
        args: [ETH_TOKEN as `0x${string}`, smartAccountAddress as `0x${string}`],
      }),
      publicClient.readContract({
        address: MOCK_VAULT_ADDRESS,
        abi: MOCK_VAULT_ABI,
        functionName: "getEffectiveLimits",
        args: [ETH_TOKEN as `0x${string}`, smartAccountAddress as `0x${string}`],
      }),
    ];
    if (skAddr) {
      reads.push(
        publicClient.readContract({
          address: MOCK_VAULT_ADDRESS,
          abi: MOCK_VAULT_ABI,
          functionName: "totalWithdrawn",
          args: [ETH_TOKEN as `0x${string}`, smartAccountAddress as `0x${string}`, skAddr],
        }),
        publicClient.readContract({
          address: MOCK_VAULT_ADDRESS,
          abi: MOCK_VAULT_ABI,
          functionName: "withdrawalCount",
          args: [ETH_TOKEN as `0x${string}`, smartAccountAddress as `0x${string}`, skAddr],
        })
      );
    }
    Promise.all(reads)
      .then((results) => {
        if (!cancelled) {
          setVaultBalanceWei(results[0] as bigint);
          const [maxW, maxTotal] = results[1] as [bigint, bigint];
          setMaxWithdrawalsEth(Number(maxW));
          setWithdrawalLimitEth(maxTotal === 0n ? null : maxTotal);
          setAdminMaxWithdrawals(String(maxW));
          setAdminMaxTotalWei(maxTotal === 0n ? "0" : String(maxTotal));
          if (skAddr && results.length >= 4) {
            setTotalWithdrawnEth(results[2] as bigint);
            setWithdrawalCountEth(Number(results[3]));
          } else {
            setTotalWithdrawnEth(null);
            setWithdrawalCountEth(0);
          }
        }
      })
      .catch(() => { if (!cancelled) { setVaultBalanceWei(null); setTotalWithdrawnEth(null); setWithdrawalCountEth(0); } });
    return () => { cancelled = true; };
  }, [smartAccountAddress, sessionKeyAddress, refreshBalanceTrigger]);

  const log = useCallback((label: string, ...args: unknown[]) => {
    console.log(`[SessionKeysPoC] ${label}`, ...args);
  }, []);

  const handleConnectAndCreateAccount = useCallback(async () => {
    if (!eoaAddress) {
      setStep1Status("Connect wallet first.");
      return;
    }
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
    if (!apiKey && !sepoliaRpcUrl?.trim()) {
      setStep1Status("Set NEXT_PUBLIC_ALCHEMY_API_KEY or NEXT_PUBLIC_SEPOLIA_RPC_URL in .env and restart dev server.");
      return;
    }
    setLoading("step1");
    setStep1Status("Creating smart account…");
    try {
      const { createSmartWalletClient } = await import("@account-kit/wallet-client");
      const { alchemy, sepolia } = await import("@account-kit/infra");
      const { WalletClientSigner } = await import("@aa-sdk/core");

      setStep1Status("Switching to Sepolia…");
      await switchChainAsync({ chainId: sepolia.id });
      await new Promise((r) => setTimeout(r, 600));

      setStep1Status("Getting wallet…");
      const walletClient = await getWalletClient(config, {
        chainId: sepolia.id,
        assertChainId: false,
      });
      if (!walletClient) {
        setStep1Status("Could not get wallet. Switch your wallet to Sepolia and try again.");
        setLoading(null);
        return;
      }

      const rpcUrl =
        sepoliaRpcUrl?.trim() ||
        (apiKey ? `https://eth-sepolia.g.alchemy.com/v2/${apiKey}` : "");
      const chainAgnosticUrl =
        (apiKey ? `https://api.g.alchemy.com/v2/${apiKey}` : null) || sepoliaRpcUrl?.trim() || rpcUrl;
      if (!rpcUrl) {
        setStep1Status("Set NEXT_PUBLIC_SEPOLIA_RPC_URL or NEXT_PUBLIC_ALCHEMY_API_KEY in .env and restart dev server.");
        setLoading(null);
        return;
      }
      const transport = alchemy({
        rpcUrl,
        chainAgnosticUrl,
      });
      const signer = new WalletClientSigner(walletClient as never, "wallet");

      const smartWalletClient = createSmartWalletClient({
        transport,
        chain: sepolia,
        signer,
      });

      setStep1Status("Requesting account…");
      const account = await smartWalletClient.requestAccount();
      const saAddress = account.address;
      setClient(smartWalletClient);
      setSmartAccountAddress(saAddress);
      setOwnerEoaAddress(eoaAddress ?? null);
      log("Step 1: Smart Account address", saAddress, "owner EOA:", eoaAddress);
      setStep1Status(`Smart Account created: ${saAddress}`);
    } catch (e) {
      const err = e as { message?: string };
      console.error("[SessionKeysPoC] Step 1 error", e);
      log("Step 1 error", err);
      setStep1Status("Error: " + (err?.message ?? String(e)));
    } finally {
      setLoading(null);
    }
  }, [eoaAddress, config, switchChainAsync, log]);

  const handleIssueSessionKey = useCallback(async () => {
    if (!client || !smartAccountAddress) {
      setStep2Status("Complete Step 1 first (Connect & Create Smart Account).");
      return;
    }
    if (ownerEoaAddress != null && eoaAddress !== ownerEoaAddress) {
      setStep2Status("Only the wallet that created this smart account can change session keys. Connect with that wallet.");
      return;
    }
    if (!MOCK_VAULT_ADDRESS || MOCK_VAULT_ADDRESS === "0x") {
      setStep2Status("Set NEXT_PUBLIC_MOCK_VAULT_ADDRESS and deploy MockVault.");
      return;
    }
    setLoading("session");
    setStep2Status("");
    setWithdrawalCount(0);
    try {
      const { LocalAccountSigner } = await import("@aa-sdk/core");

      const sessionKey = LocalAccountSigner.generatePrivateKeySigner();
      setSessionKeySigner(sessionKey);

      const pingAbiItem = getAbiItem({ abi: MOCK_VAULT_ABI, name: "ping" });
      const withdrawAbiItem = getAbiItem({ abi: MOCK_VAULT_ABI, name: "withdraw" });
      const withdrawToAbiItem = getAbiItem({ abi: MOCK_VAULT_ABI, name: "withdrawTo" });
      const pingSelector = (pingAbiItem ? getFunctionSelector(pingAbiItem) : "0x5c36b186") as `0x${string}`;
      const withdrawSelector = (withdrawAbiItem ? getFunctionSelector(withdrawAbiItem) : "0x2e1a7d4d") as `0x${string}`;
      const withdrawToSelector = (withdrawToAbiItem ? getFunctionSelector(withdrawToAbiItem) : "0x00") as `0x${string}`;

      const allowanceForTwoOps = 5000000000000000n;
      log("Step 2: Granting ping() + withdraw() + withdrawTo() on MockVault and native-token allowance", {
        pingSelector,
        withdrawSelector,
        withdrawToSelector,
        allowance: allowanceForTwoOps.toString(),
      });

      const result = await client.grantPermissions({
        account: smartAccountAddress as `0x${string}`,
        expirySec: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        key: {
          publicKey: (await sessionKey.getAddress()) as `0x${string}`,
          type: "secp256k1",
        },
        permissions: [
          {
            type: "functions-on-contract",
            data: {
              address: MOCK_VAULT_ADDRESS,
              functions: [pingSelector, withdrawSelector, ...(withdrawToSelector !== "0x00" ? [withdrawToSelector] : [])],
            },
          },
          {
            type: "native-token-transfer",
            data: {
              allowance: toHex(allowanceForTwoOps),
            },
          },
        ],
      });

      setPermissions(result);
      const skAddress = (await sessionKey.getAddress()) as string;
      setSessionKeyAddress(skAddress);
      log("Step 2: Session key issued. Result:", result, "sessionKeyAddress:", skAddress);
      setStep2Status("Session key issued. Limits apply per session key — issue a new key to get fresh limits.");
    } catch (e) {
      const err = e as { message?: string };
      log("Step 2 error", err);
      setStep2Status("Error: " + (err?.message ?? String(e)));
    } finally {
      setLoading(null);
    }
  }, [client, smartAccountAddress, ownerEoaAddress, eoaAddress, log]);

  const handleTestPing = useCallback(async () => {
    if (!client || !smartAccountAddress || !sessionKeySigner || !permissions) {
      setPingStatus("Complete Steps 1 and 2 first.");
      return;
    }
    if (!MOCK_VAULT_ADDRESS) {
      setPingStatus("NEXT_PUBLIC_MOCK_VAULT_ADDRESS not set.");
      return;
    }
    setLoading("ping");
    setPingStatus("");
    try {
      const pingData = encodeFunctionData({
        abi: MOCK_VAULT_ABI,
        functionName: "ping",
      });
      log("Step 3: Preparing and sending ping() via session key");

      let preparedCalls = await client.prepareCalls({
        calls: [{ to: MOCK_VAULT_ADDRESS, data: pingData }],
        from: smartAccountAddress as `0x${string}`,
        capabilities: { permissions },
      });
      const rpcUrlPing = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (rpcUrlPing) {
        const publicClientPing = createPublicClient({ chain: sepolia, transport: http(rpcUrlPing) });
        preparedCalls = await stripInitCodeIfDeployed(publicClientPing, smartAccountAddress as `0x${string}`, preparedCalls);
      }

      const { signPreparedCalls } = await import("@account-kit/wallet-client");
      const signedCalls = await signPreparedCalls(sessionKeySigner, preparedCalls);
      const result = await client.sendPreparedCalls({
        ...signedCalls,
        capabilities: { permissions },
      });

      console.log("[SessionKeysPoC] Step 3 — Authorized ping() sent. Result:", result);
      setPingStatus(`Success. Call id: ${result.id ?? "—"}.`);
      addEvent({ type: "ping", timestamp: Date.now() });
    } catch (e) {
      const err = e as {
        message?: string;
        details?: string;
        cause?: { message?: string; code?: number; data?: unknown };
        code?: number;
        data?: unknown;
      };
      const serverMessage =
        err?.details ??
        (typeof err?.cause === "object" && err?.cause && "message" in err.cause
          ? String((err.cause as { message?: string }).message)
          : undefined) ??
        err?.message;
      console.error("[SessionKeysPoC] Step 3 (ping) full error:", e);
      if (err?.code != null) console.error("[SessionKeysPoC] Error code:", err.code);
      if (err?.data != null) console.error("[SessionKeysPoC] Error data:", err.data);
      log("Step 3 (ping) error", err);
      const msg = err?.message ?? String(e);
      const details = serverMessage ?? msg;
      const fullText = [msg, details].filter(Boolean).join(" ");
      const isInsufficientBalance =
        /sender balance.*is 0|must be at least.*to pay/i.test(fullText) ||
        /insufficient.*balance|not enough.*eth/i.test(fullText);
      const isAA23 = /AA23 reverted/i.test(fullText);
      const isGenericError = /missing or invalid parameters|internal error was received/i.test(msg);
      const isAlchemyRpcFailed =
        /RPC Request failed/i.test(fullText) && /api\.g\.alchemy\.com/i.test(fullText);
      const urlHasKey = /api\.g\.alchemy\.com\/v2\/[^/\s"']+/.test(fullText);
      const safeDetails = details.replace(/\/v2\/[A-Za-z0-9_-]+/g, "/v2/***");
      if (isInsufficientBalance && smartAccountAddress) {
        setPingStatus(
          `Smart account has no ETH for gas. Send Sepolia ETH to ${smartAccountAddress}, then try again.`
        );
      } else if (isAA23) {
        setPingStatus(
          "Ping failed: AA23 (signature validation reverted). Try Disconnect → Step 1 → Step 2 → Ping again."
        );
      } else if (isAlchemyRpcFailed) {
        const serverHint =
          serverMessage && serverMessage.length > 10
            ? ` Server: ${safeDetails.slice(0, 150)}${safeDetails.length > 150 ? "…" : ""}`
            : "";
        setPingStatus(
          urlHasKey
            ? `Ping failed (Alchemy).${serverHint} Check console for full error.`
            : `Ping failed (Alchemy RPC): ${safeDetails.slice(0, 100)}${safeDetails.length > 100 ? "…" : ""}.`
        );
      } else if (isGenericError) {
        setPingStatus(
          `Ping failed. If you already funded the smart account, wait a minute and retry. Details: ${details.slice(0, 200)}${details.length > 200 ? "…" : ""}`
        );
      } else {
        setPingStatus("Error: " + msg);
      }
    } finally {
      setLoading(null);
    }
  }, [client, smartAccountAddress, sessionKeySigner, permissions, log, addEvent]);

  const handleTestWithdraw = useCallback(async () => {
    if (!client || !smartAccountAddress || !sessionKeySigner || !permissions) {
      setWithdrawStatus("Complete Steps 1 and 2 first.");
      return;
    }
    if (!MOCK_VAULT_ADDRESS) {
      setWithdrawStatus("NEXT_PUBLIC_MOCK_VAULT_ADDRESS not set.");
      return;
    }
    let sessionKeyId: `0x${string}`;
    try {
      sessionKeyId = (await sessionKeySigner.getAddress()) as `0x${string}`;
    } catch {
      setWithdrawStatus("Could not get session key address. Re-do Step 2.");
      return;
    }
    setLoading("withdraw");
    setWithdrawStatus("");
    const recipient = withdrawToAddress?.trim();
    const useWithdrawTo = /^0x[a-fA-F0-9]{40}$/.test(recipient);
    const amountStr = withdrawAmountWei?.trim() || "1";
    let amountWei: bigint;
    try {
      amountWei = BigInt(amountStr);
      if (amountWei <= 0n) throw new Error("Amount must be positive");
    } catch (_) {
      setWithdrawStatus("Enter a valid amount in wei (positive integer).");
      setLoading(null);
      return;
    }
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (rpcUrl) {
        const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
        const balance = await publicClient.readContract({
          address: MOCK_VAULT_ADDRESS,
          abi: MOCK_VAULT_ABI,
          functionName: "balances",
          args: [ETH_TOKEN as `0x${string}`, smartAccountAddress as `0x${string}`],
        });
        if (balance < amountWei) {
          setWithdrawStatus(`Insufficient vault balance (${balance} wei). You requested ${amountWei} wei. Deposit first.`);
          setLoading(null);
          return;
        }
      }
      const withdrawData = encodeFunctionData({
        abi: MOCK_VAULT_ABI,
        functionName: useWithdrawTo ? "withdrawTo" : "withdraw",
        args: useWithdrawTo ? [amountWei, recipient as `0x${string}`, sessionKeyId] : [amountWei, sessionKeyId],
      });
      log("Step 4: Attempting " + (useWithdrawTo ? "withdrawTo(" + amountWei + ", " + recipient + ")" : "withdraw(" + amountWei + ")") + " via session key");

      let preparedCalls = await client.prepareCalls({
        calls: [{ to: MOCK_VAULT_ADDRESS, data: withdrawData }],
        from: smartAccountAddress as `0x${string}`,
        capabilities: { permissions },
      });
      const rpcUrlWithdraw = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (rpcUrlWithdraw) {
        const publicClientWithdraw = createPublicClient({ chain: sepolia, transport: http(rpcUrlWithdraw) });
        preparedCalls = await stripInitCodeIfDeployed(publicClientWithdraw, smartAccountAddress as `0x${string}`, preparedCalls);
      }

      const { signPreparedCalls } = await import("@account-kit/wallet-client");
      const signedCalls = await signPreparedCalls(sessionKeySigner, preparedCalls);
      const result = await client.sendPreparedCalls({
        ...signedCalls,
        capabilities: { permissions },
      });

      setVaultBalanceWei((p) => (p === null ? null : p - amountWei));
      setTotalWithdrawnEth((p) => (p === null ? null : p + amountWei));
      setWithdrawalCountEth((c) => c + 1);
      addEvent({ type: "withdraw", timestamp: Date.now(), amountWei });
      setWithdrawalCount((c) => {
        const next = c + 1;
        const statusMsg =
          next < maxWithdrawalsEth
            ? `Withdrew ${amountWei} wei. ${next}/${maxWithdrawalsEth} — Call id: ${result.id ?? "—"}. ${maxWithdrawalsEth - next} more allowed.`
            : next === maxWithdrawalsEth
              ? `Withdrew ${amountWei} wei. ${maxWithdrawalsEth}/${maxWithdrawalsEth} — Call id: ${result.id ?? "—"}. Limit reached.`
              : `Withdrew ${amountWei} wei (over limit ${maxWithdrawalsEth}). Call id: ${result.id ?? "—"}.`;
        setWithdrawStatus(statusMsg);
        return next;
      });
    } catch (e) {
      const err = e as { message?: string; details?: string; shortMessage?: string; cause?: { message?: string; details?: string }; walk?: () => Iterable<{ message?: string; details?: string }> };
      const reason = err?.shortMessage ?? err?.message ?? err?.details ?? "";
      const causeMsg = typeof err?.cause === "object" && err?.cause && "message" in err.cause ? String((err.cause as { message?: string }).message) : "";
      const causeDetails = typeof err?.cause === "object" && err?.cause && "details" in err.cause ? String((err.cause as { details?: string }).details) : "";
      const walkMessages: string[] = [];
      try {
        if (typeof (e as { walk?: () => Iterable<unknown> }).walk === "function") {
          for (const x of (e as { walk: () => Iterable<{ message?: string }> }).walk()) {
            if (x?.message) walkMessages.push(String(x.message));
          }
        }
      } catch (_) {}
      let nested: unknown = err?.cause;
      for (let i = 0; i < 3 && nested && typeof nested === "object"; i++) {
        const obj = nested as { details?: string; message?: string; cause?: unknown };
        if (obj.details) walkMessages.push(String(obj.details));
        if (obj.message) walkMessages.push(String(obj.message));
        nested = obj.cause;
      }
      const fullErrorText = [reason, causeMsg, causeDetails, ...walkMessages, String(e)].filter(Boolean).join(" ");
      console.log("[SessionKeysPoC] Step 4 — Withdraw error:", fullErrorText.slice(0, 300), e);
      const isVaultInsufficientBalance = /MockVault: insufficient balance|InsufficientBalance|insufficient balance/i.test(fullErrorText);
      const isWithdrawalLimitReached = /MockVault: withdrawal limit reached|withdrawal limit reached|WithdrawalCountLimitReached|WithdrawalAmountLimitReached/i.test(fullErrorText);
      const isTransferFailed = /TransferFailed|transfer failed/i.test(fullErrorText);
      const isExecutionReverted = /execution reverted/i.test(fullErrorText);
      const isAllowanceExceeded =
        /allowance|exceeded|insufficient.*spend|native.*limit/i.test(fullErrorText) || /AA23/i.test(fullErrorText);
      if (isVaultInsufficientBalance) {
        setWithdrawStatus("MockVault: insufficient balance. Deposit first, then try again.");
      } else if (isWithdrawalLimitReached) {
        setWithdrawStatus(`MockVault: withdrawal limit reached (${maxWithdrawalsEth} per account).`);
      } else if (isTransferFailed) {
        setWithdrawStatus("Vault could not send ETH (transfer failed). Try withdrawing to an EOA.");
      } else if (isExecutionReverted) {
        const maxTotalHint = withdrawalLimitEth != null && withdrawalLimitEth > 0n && totalWithdrawnEth != null
          ? ` Or max total withdrawal (${withdrawalLimitEth} wei) reached; withdrawn ${totalWithdrawnEth} wei.`
          : "";
        setWithdrawStatus(
          useWithdrawTo
            ? "Withdraw reverted. Vault may not support withdrawTo()." + maxTotalHint
            : "Withdraw reverted. Possible: no balance, count/total limit reached." + maxTotalHint
        );
      } else {
        const displayErr = fullErrorText.slice(0, 280) || reason.slice(0, 200) || "Unknown error";
        setWithdrawStatus(
          isAllowanceExceeded
            ? `Session expired for withdrawals (allowance used after ${maxWithdrawalsEth}). ${withdrawalCount}/${maxWithdrawalsEth} succeeded.`
            : `Withdraw failed: ${displayErr}`
        );
      }
    } finally {
      setLoading(null);
    }
  }, [client, smartAccountAddress, sessionKeySigner, permissions, withdrawalCount, maxWithdrawalsEth, withdrawToAddress, withdrawAmountWei, withdrawalLimitEth, totalWithdrawnEth, log, addEvent]);

  const handleDepositToVault = useCallback(async (amountEth?: string) => {
    if (!client || !smartAccountAddress) {
      setDepositVaultStatus("Complete Step 1 first.");
      return;
    }
    if (!MOCK_VAULT_ADDRESS) {
      setDepositVaultStatus("NEXT_PUBLIC_MOCK_VAULT_ADDRESS not set.");
      return;
    }
    let amountWei: bigint = DEPOSIT_AMOUNT_WEI;
    try {
      if (amountEth && amountEth.trim().length > 0) {
        amountWei = parseEther(amountEth.trim());
        if (amountWei <= 0n) throw new Error("Amount must be positive");
      }
    } catch (e) {
      setDepositVaultStatus("Enter a valid deposit amount in ETH.");
      return;
    }
    setLoading("deposit");
    setDepositVaultStatus("");
    try {
      const depositData = encodeFunctionData({
        abi: MOCK_VAULT_ABI,
        functionName: "deposit",
      });
      let preparedCalls = await client.prepareCalls({
        calls: [{ to: MOCK_VAULT_ADDRESS, data: depositData, value: toHex(amountWei) }],
        from: smartAccountAddress as `0x${string}`,
      });
      const rpcUrlDeposit = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (rpcUrlDeposit) {
        const publicClientDeposit = createPublicClient({ chain: sepolia, transport: http(rpcUrlDeposit) });
        preparedCalls = await stripInitCodeIfDeployed(publicClientDeposit, smartAccountAddress as `0x${string}`, preparedCalls);
      }
      const signedCalls = await client.signPreparedCalls(preparedCalls);
      const result = await client.sendPreparedCalls(signedCalls);
      setDepositVaultStatus(`Deposit submitted (${amountWei} wei). Call id: ${result.id ?? "—"}. Waiting for confirmation…`);
      addEvent({ type: "deposit", timestamp: Date.now(), amountWei });
      const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (rpcUrl) {
        const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2000));
          const balance = await publicClient.readContract({
            address: MOCK_VAULT_ADDRESS,
            abi: MOCK_VAULT_ABI,
            functionName: "balances",
            args: [ETH_TOKEN as `0x${string}`, smartAccountAddress as `0x${string}`],
          });
          if (balance >= amountWei) {
            setVaultBalanceWei(balance);
            setDepositVaultStatus(`Deposit confirmed. You can now withdraw (up to ${maxWithdrawalsEth}x).`);
            break;
          }
          setDepositVaultStatus(`Deposit submitted. Waiting… (balance: ${balance} wei)`);
        }
        if (Date.now() >= deadline) {
          setDepositVaultStatus("Deposit may still be pending. Wait and refresh.");
        }
      } else {
        setVaultBalanceWei((p) => (p ?? 0n) + amountWei);
        setDepositVaultStatus(`Deposited ${amountWei} wei. Wait 10-15s for confirmation.`);
      }
    } catch (e) {
      const err = e as { message?: string };
      setDepositVaultStatus("Error: " + (err?.message ?? String(e)));
    } finally {
      setLoading(null);
    }
  }, [client, smartAccountAddress, addEvent, maxWithdrawalsEth]);

  const [adminMaxWithdrawals, setAdminMaxWithdrawals] = useState<string>("2");
  const [adminMaxTotalWei, setAdminMaxTotalWei] = useState<string>("0");
  const handleSetTokenLimits = useCallback(async () => {
    if (!client || !smartAccountAddress) {
      setSetLimitsStatus("Complete Step 1 first (Connect & Create Smart Account).");
      return;
    }
    if (ownerEoaAddress != null && eoaAddress !== ownerEoaAddress) {
      setSetLimitsStatus("Connect with the wallet that created this smart account to set your limits.");
      return;
    }
    if (!MOCK_VAULT_ADDRESS || MOCK_VAULT_ADDRESS === "0x") {
      setSetLimitsStatus("Vault address not set.");
      return;
    }
    const maxW = BigInt(adminMaxWithdrawals || "0");
    const maxTotal = BigInt(adminMaxTotalWei || "0");
    setLoading("setLimits");
    setSetLimitsStatus("");
    try {
      const setMyLimitsData = encodeFunctionData({
        abi: MOCK_VAULT_ABI,
        functionName: "setMyTokenLimits",
        args: [ETH_TOKEN as `0x${string}`, maxW, maxTotal],
      });
      let preparedCalls = await client.prepareCalls({
        calls: [{ to: MOCK_VAULT_ADDRESS, data: setMyLimitsData }],
        from: smartAccountAddress as `0x${string}`,
      });
      const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (rpcUrl) {
        const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
        preparedCalls = await stripInitCodeIfDeployed(publicClient, smartAccountAddress as `0x${string}`, preparedCalls);
      }
      const walletClient = await getWalletClient(config, { chainId: sepolia.id });
      if (!walletClient) {
        setSetLimitsStatus("Connect wallet and try again.");
        setLoading(null);
        return;
      }
      const { WalletClientSigner } = await import("@aa-sdk/core");
      const ownerSigner = new WalletClientSigner(walletClient as never, "wallet");
      const { signPreparedCalls } = await import("@account-kit/wallet-client");
      const signedCalls = await signPreparedCalls(ownerSigner, preparedCalls);
      const result = await client.sendPreparedCalls(signedCalls);
      setSetLimitsStatus(`Your limits set. Call id: ${result.id ?? "—"}`);
      setRefreshBalanceTrigger((t) => t + 1);
    } catch (e) {
      const err = e as { message?: string };
      setSetLimitsStatus("Error: " + (err?.message ?? String(e)));
    } finally {
      setLoading(null);
    }
  }, [client, smartAccountAddress, ownerEoaAddress, eoaAddress, adminMaxWithdrawals, adminMaxTotalWei, config]);

  const connectWallet = useCallback(() => {
    connect({ connector: connectors[0] });
  }, [connect, connectors]);

  const refreshBalance = useCallback(() => {
    setRefreshBalanceTrigger((t) => t + 1);
  }, []);

  return {
    // Connection
    eoaAddress,
    isConnected,
    connectWallet,
    disconnect,

    // Smart Account
    client,
    smartAccountAddress,
    step1Status,
    handleConnectAndCreateAccount,

    // Session Key (only owner EOA can issue/revoke)
    ownerEoaAddress,
    isOwnerWallet: Boolean(eoaAddress && ownerEoaAddress && eoaAddress === ownerEoaAddress),
    sessionKeyAddress,
    permissions,
    step2Status,
    handleIssueSessionKey,

    // Ping
    pingStatus,
    handleTestPing,

    // Withdraw
    withdrawStatus,
    withdrawalCount,
    withdrawalCountEth,
    maxWithdrawalsEth,
    withdrawToAddress,
    setWithdrawToAddress,
    withdrawAmountWei,
    setWithdrawAmountWei,
    withdrawalLimitEth,
    totalWithdrawnEth,
    handleTestWithdraw,

    // Deposit
    depositVaultStatus,
    vaultBalanceWei,
    handleDepositToVault,
    refreshBalance,

    // Admin
    vaultOwner,
    setLimitsStatus,
    adminMaxWithdrawals,
    setAdminMaxWithdrawals,
    adminMaxTotalWei,
    setAdminMaxTotalWei,
    handleSetTokenLimits,

    // Loading state
    loading,

    // Events for charts
    vaultEvents,
  };
}
