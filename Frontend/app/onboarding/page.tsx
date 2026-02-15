"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WalletInfoCard } from "@/components/dashboard/wallet-info-card";
import { VaultBalanceCard } from "@/components/dashboard/vault-balance-card";
import { useSessionKeys } from "@/hooks/useSessionKeys";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { useConfig } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { sepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { setOnboardingComplete } from "@/lib/onboarding";
import { ArrowRight } from "lucide-react";

const MIN_GAS_WEI = 10_000_000_000_000_000n; // 0.01 ETH

export default function OnboardingPage() {
  const router = useRouter();
  const sk = useSessionKeys();
  const { balanceSnapshots } = useVaultHistory(sk.vaultEvents, sk.vaultBalanceWei);
  const wagmiConfig = useConfig();
  const [fundStatus, setFundStatus] = useState("");
  const [depositAmountEth, setDepositAmountEth] = useState("0.0001");
  const [isDeployed, setIsDeployed] = useState<boolean | null>(null);
  const [deploymentChecked, setDeploymentChecked] = useState(false);
  const [gasChecked, setGasChecked] = useState(false);

  // Detect if the smart account (for this EOA) already exists on-chain
  useEffect(() => {
    const checkDeployment = async () => {
      if (!sk.smartAccountAddress) {
        setIsDeployed(null);
        setDeploymentChecked(false);
        setGasChecked(false);
        return;
      }
      setDeploymentChecked(false);
      setGasChecked(false);
      const rpcUrl =
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
        (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (!rpcUrl) {
        setIsDeployed(null);
        setDeploymentChecked(true);
        return;
      }
      const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
      try {
        const code = await publicClient.getCode({ address: sk.smartAccountAddress as `0x${string}` });
        setIsDeployed(code !== "0x");
        setDeploymentChecked(true);
      } catch {
        setIsDeployed(null);
        setDeploymentChecked(true);
      }
    };
    checkDeployment();
  }, [sk.smartAccountAddress]);

  // During onboarding, ensure smart account has at least 0.01 ETH gas
  useEffect(() => {
    const ensureGas = async () => {
      if (!sk.smartAccountAddress || !deploymentChecked || gasChecked) return;
      const rpcUrl =
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
        (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}` : "");
      if (!rpcUrl) {
        setFundStatus("Gas check unavailable (RPC not configured).");
        setGasChecked(true);
        return;
      }
      try {
        const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
        const balance = await publicClient.getBalance({ address: sk.smartAccountAddress as `0x${string}` });
        if (balance >= MIN_GAS_WEI) {
          setFundStatus("");
          setGasChecked(true);
          return;
        }
        setFundStatus("Smart account gas is low. Requesting 0.01 ETH top-up…");
        const walletClient = await getWalletClient(wagmiConfig, { chainId: sepolia.id, assertChainId: false });
        if (!walletClient) throw new Error("Wallet client unavailable. Reconnect and try again.");
        if (!walletClient.account) throw new Error("Wallet account unavailable. Reconnect and try again.");
        await walletClient.sendTransaction({
          account: walletClient.account,
          chain: sepolia,
          to: sk.smartAccountAddress as `0x${string}`,
          value: MIN_GAS_WEI,
        });
        setFundStatus("Added 0.01 ETH gas to smart account.");
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? String(e);
        setFundStatus("Gas top-up failed: " + msg);
      } finally {
        setGasChecked(true);
      }
    };
    ensureGas();
  }, [sk.smartAccountAddress, deploymentChecked, gasChecked, wagmiConfig]);

  // After gas, always wait: show vault (add amount) or skip. No auto-redirect to dashboard.

  // When user deposits and it's confirmed, mark complete and go to dashboard
  useEffect(() => {
    if (sk.smartAccountAddress && sk.eoaAddress && sk.vaultBalanceWei !== null && sk.vaultBalanceWei > 0n) {
      setOnboardingComplete(sk.eoaAddress);
      router.push("/dashboard");
    }
  }, [sk.smartAccountAddress, sk.eoaAddress, sk.vaultBalanceWei, router]);

  const handleSkipToDashboard = () => {
    if (sk.eoaAddress) {
      setOnboardingComplete(sk.eoaAddress);
      router.push("/dashboard");
    }
  };

  const handleCreateAndFund = async () => {
    setFundStatus("");
    await sk.handleConnectAndCreateAccount();
  };

  const canSkip = !!sk.smartAccountAddress && deploymentChecked && gasChecked;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <Card className="bg-slate-900/70 text-white">
          <CardHeader>
            <CardTitle className="text-2xl">Onboarding</CardTitle>
            <CardDescription className="text-slate-300">
              Create your smart account. We’ll add a little gas (0.01 ETH) when it’s new. Then you can add money to the vault or skip to the main screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <WalletInfoCard
                eoaAddress={sk.eoaAddress}
                smartAccountAddress={sk.smartAccountAddress}
                step1Status={sk.step1Status}
                loading={sk.loading}
                onCreateAccount={handleCreateAndFund}
              />
              {fundStatus && (
                <p className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
                  {fundStatus}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <VaultBalanceCard
                vaultBalanceWei={sk.vaultBalanceWei}
                depositVaultStatus={sk.depositVaultStatus}
                loading={sk.loading}
                hasSmartAccount={!!sk.smartAccountAddress}
                onDeposit={sk.handleDepositToVault}
                onRefresh={sk.refreshBalance}
                balanceSnapshots={balanceSnapshots}
                showAmountInput
                depositAmountEth={depositAmountEth}
                setDepositAmountEth={setDepositAmountEth}
              />
              {canSkip && (
                <Button
                  variant="outline"
                  className="w-full border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={handleSkipToDashboard}
                  disabled={sk.loading !== null}
                >
                  Skip to main screen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
