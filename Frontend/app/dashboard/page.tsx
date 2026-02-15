"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionKeys } from "@/hooks/useSessionKeys";
import { useBotControl } from "@/hooks/useBotControl";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AccountDialog } from "@/components/dashboard/account-dialog";
import { SessionKeyPanel } from "@/components/dashboard/session-key-panel";
import { VaultBalanceCard } from "@/components/dashboard/vault-balance-card";
import { SessionActivityCard } from "@/components/dashboard/session-activity-card";
import { AdminControlsCard } from "@/components/dashboard/admin-controls-card";
import { BotControlCard } from "@/components/dashboard/bot-control-card";

export default function DashboardPage() {
  const sk = useSessionKeys();
  const bot = useBotControl();
  const pingOnLoadDone = useRef(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(true);
  const { balanceSnapshots, withdrawBars, pingDots } = useVaultHistory(
    sk.vaultEvents,
    sk.vaultBalanceWei
  );

  useEffect(() => {
    if (pingOnLoadDone.current || sk.loading !== null) return;
    if (sk.sessionKeyAddress && sk.smartAccountAddress && sk.client) {
      pingOnLoadDone.current = true;
      sk.handleTestPing();
    }
  }, [sk.sessionKeyAddress, sk.smartAccountAddress, sk.client, sk.loading, sk.handleTestPing]);

  const walletProps = {
    eoaAddress: sk.eoaAddress,
    smartAccountAddress: sk.smartAccountAddress,
    step1Status: sk.step1Status,
    loading: sk.loading,
    loadingSmartAccount: sk.smartAccountLoading,
    onCreateAccount: sk.handleConnectAndCreateAccount,
  };

  return (
    <div className="min-h-screen bg-background">
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
        onAccountDialogOpen={setAccountDialogOpen}
      />

      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        {...walletProps}
      />

      <main className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">
        {/* Row 1: Session Key + Vault Balance */}
        <div className="grid gap-5 md:grid-cols-2">
          <SessionKeyPanel
            sessionKeyAddress={sk.sessionKeyAddress}
            smartAccountAddress={sk.smartAccountAddress ?? null}
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
        </div>

        {/* Row 2: Withdraw + Session Activity */}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
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
            eoaAddress={sk.eoaAddress ?? null}
            vaultAddress={sk.mockVaultAddress || ""}
            vaultBalanceWei={sk.vaultBalanceWei}
            onStart={bot.startBot}
            onStop={bot.stopBot}
            withdrawToBot={sk.withdrawToBot}
            withdrawToBotError={sk.withdrawToBotError}
            onRefreshBalance={sk.refreshBalance}
            pendingWithdraw={bot.pendingWithdraw}
          />
        </div>
        {sk.smartAccountAddress != null && (
          <div className="mt-5">
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
          </div>
        )}
      </main>
    </div>
  );
}
