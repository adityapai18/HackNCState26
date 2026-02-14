"use client";

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
  const { balanceSnapshots, withdrawBars, pingDots } = useVaultHistory(
    sk.vaultEvents,
    sk.vaultBalanceWei
  );

  return (
    <div className="min-h-screen">
      <DashboardHeader
        eoaAddress={sk.eoaAddress}
        disconnect={sk.disconnect}
      />
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <WalletInfoCard
            eoaAddress={sk.eoaAddress}
            smartAccountAddress={sk.smartAccountAddress}
            step1Status={sk.step1Status}
            loading={sk.loading}
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
          <SessionActivityCard
            pingStatus={sk.pingStatus}
            loading={sk.loading}
            hasSessionKey={!!sk.sessionKeyAddress}
            onPing={sk.handleTestPing}
            pingDots={pingDots}
          />
          {(sk.smartAccountAddress != null) && (
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
      </main>
    </div>
  );
}
