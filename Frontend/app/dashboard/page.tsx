"use client";

import { useSessionKeys } from "@/hooks/useSessionKeys";
import { useBotControl } from "@/hooks/useBotControl";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WalletInfoCard } from "@/components/dashboard/wallet-info-card";
import { SessionKeyPanel } from "@/components/dashboard/session-key-panel";
import { VaultBalanceCard } from "@/components/dashboard/vault-balance-card";
import { SessionActivityCard } from "@/components/dashboard/session-activity-card";
import { AdminControlsCard } from "@/components/dashboard/admin-controls-card";
import { BotControlCard } from "@/components/dashboard/bot-control-card";

export default function DashboardPage() {
  const sk = useSessionKeys();
  const bot = useBotControl();
  const { balanceSnapshots, pingDots } = useVaultHistory(
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
          <SessionActivityCard
            pingStatus={sk.pingStatus}
            loading={sk.loading}
            hasSessionKey={!!sk.sessionKeyAddress}
            onPing={sk.handleTestPing}
            pingDots={pingDots}
          />
          <BotControlCard
            botInfo={bot.botInfo}
            botStatus={bot.botStatus}
            logs={bot.logs}
            loading={bot.loading}
            error={bot.error}
            fundingStatus={bot.fundingStatus}
            hasSessionKey={!!sk.sessionKeyAddress}
            sessionKeyExpiry={sk.sessionKeyExpiry}
            sessionKeyAddress={sk.sessionKeyAddress}
            smartAccountAddress={sk.smartAccountAddress}
            vaultAddress={sk.mockVaultAddress || ""}
            vaultBalanceWei={sk.vaultBalanceWei}
            onStart={bot.startBot}
            onStop={bot.stopBot}
            withdrawToBot={sk.withdrawToBot}
            withdrawToBotError={sk.withdrawToBotError}
            onRefreshBalance={sk.refreshBalance}
            pendingWithdraw={bot.pendingWithdraw}
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
