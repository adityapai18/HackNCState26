"use client";

import { useEffect, useRef } from "react";
import { useSessionKeys } from "@/hooks/useSessionKeys";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WalletInfoCard } from "@/components/dashboard/wallet-info-card";
import { SessionKeyPanel } from "@/components/dashboard/session-key-panel";
import { VaultBalanceCard } from "@/components/dashboard/vault-balance-card";
import { WithdrawalActivityCard } from "@/components/dashboard/withdrawal-activity-card";
import { SessionActivityCard } from "@/components/dashboard/session-activity-card";
import { AdminControlsCard } from "@/components/dashboard/admin-controls-card";

export default function DashboardPage() {
  const sk = useSessionKeys();
  const pingOnLoadDone = useRef(false);
  const { balanceSnapshots, withdrawBars, pingDots } = useVaultHistory(
    sk.vaultEvents,
    sk.vaultBalanceWei
  );

  // On load: run ping once when we have session key and smart account (test connection)
  useEffect(() => {
    if (pingOnLoadDone.current || sk.loading !== null) return;
    if (sk.sessionKeyAddress && sk.smartAccountAddress && sk.client) {
      pingOnLoadDone.current = true;
      sk.handleTestPing();
    }
  }, [sk.sessionKeyAddress, sk.smartAccountAddress, sk.client, sk.loading, sk.handleTestPing]);

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader
        eoaAddress={sk.eoaAddress}
        disconnect={sk.disconnect}
        pingStatus={sk.pingStatus}
        loading={sk.loading}
        addGasStatus={sk.addGasStatus}
        hasSessionKey={!!sk.sessionKeyAddress}
        hasSmartAccount={!!sk.smartAccountAddress}
        onPing={sk.handleTestPing}
        onAddGas={sk.handleAddGasToSmartAccount}
      />
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        {/* Section: Smart account & session key */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Account
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <WalletInfoCard
              eoaAddress={sk.eoaAddress}
              smartAccountAddress={sk.smartAccountAddress}
              step1Status={sk.step1Status}
              loading={sk.loading}
              loadingSmartAccount={sk.smartAccountLoading}
              onCreateAccount={sk.handleConnectAndCreateAccount}
            />
            <SessionKeyPanel
              sessionKeyAddress={sk.sessionKeyAddress}
              step2Status={sk.step2Status}
              loading={sk.loading}
              hasSmartAccount={!!sk.smartAccountAddress}
              isOwnerWallet={sk.isOwnerWallet}
              onIssueSessionKey={sk.handleIssueSessionKey}
            />
          </div>
        </section>

        {/* Section: Vault */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Vault
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <VaultBalanceCard
              vaultBalanceWei={sk.vaultBalanceWei}
              depositVaultStatus={sk.depositVaultStatus}
              loading={sk.loading}
              hasSmartAccount={!!sk.smartAccountAddress}
              onDeposit={sk.handleDepositToVault}
              onRefresh={sk.refreshBalance}
              balanceSnapshots={balanceSnapshots}
            />
            <WithdrawalActivityCard
              withdrawStatus={sk.withdrawStatus}
              withdrawalCountEth={sk.withdrawalCountEth}
              maxWithdrawalsEth={sk.maxWithdrawalsEth}
              withdrawToAddress={sk.withdrawToAddress}
              setWithdrawToAddress={sk.setWithdrawToAddress}
              withdrawAmountWei={sk.withdrawAmountWei}
              setWithdrawAmountWei={sk.setWithdrawAmountWei}
              withdrawalLimitEth={sk.withdrawalLimitEth}
              totalWithdrawnEth={sk.totalWithdrawnEth}
              vaultBalanceWei={sk.vaultBalanceWei}
              loading={sk.loading}
              hasSessionKey={!!sk.sessionKeyAddress}
              onWithdraw={sk.handleTestWithdraw}
              eoaAddress={sk.eoaAddress}
              withdrawBars={withdrawBars}
            />
          </div>
        </section>

        {/* Section: Activity & admin */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Activity & controls
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <SessionActivityCard
              pingStatus={sk.pingStatus}
              loading={sk.loading}
              hasSessionKey={!!sk.sessionKeyAddress}
              onPing={sk.handleTestPing}
              pingDots={pingDots}
            />
            {sk.smartAccountAddress != null && (
              <AdminControlsCard
                vaultOwner={sk.vaultOwner}
                hasSmartAccount={!!sk.smartAccountAddress}
                isOwnerWallet={sk.isOwnerWallet}
                maxWithdrawalsEth={sk.maxWithdrawalsEth}
                withdrawalLimitEth={sk.withdrawalLimitEth}
                setLimitsStatus={sk.setLimitsStatus}
                adminMaxWithdrawals={sk.adminMaxWithdrawals}
                setAdminMaxWithdrawals={sk.setAdminMaxWithdrawals}
                adminMaxTotalWei={sk.adminMaxTotalWei}
                setAdminMaxTotalWei={sk.setAdminMaxTotalWei}
                loading={sk.loading}
                onSetLimits={sk.handleSetTokenLimits}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
