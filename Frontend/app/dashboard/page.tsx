"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionKeys } from "@/hooks/useSessionKeys";
import { useBotControl } from "@/hooks/useBotControl";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AccountDialog } from "@/components/dashboard/account-dialog";
import { SessionKeyPanel } from "@/components/dashboard/session-key-panel";
import { AdminControlsCard } from "@/components/dashboard/admin-controls-card";
import { BotControlCard } from "@/components/dashboard/bot-control-card";
import { DailyAgentReportCard } from "@/components/dashboard/daily-agent-report";

export default function DashboardPage() {
  const sk = useSessionKeys();
  const bot = useBotControl();
  const pingOnLoadDone = useRef(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(true);

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
    <div className="flex h-screen w-full flex-col bg-background">
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

      <main className="flex min-h-0 flex-1 w-full flex-col gap-5 overflow-hidden px-5 py-6 md:flex-row md:px-8 md:py-8">
        {/* Left 1/3: Session key, Limits — scrolls if content is tall */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col gap-5 overflow-y-auto md:w-1/3 md:min-w-[320px] md:max-w-[400px]">
          <SessionKeyPanel
            sessionKeyAddress={sk.sessionKeyAddress}
            smartAccountAddress={sk.smartAccountAddress ?? null}
            step2Status={sk.step2Status}
            loading={sk.loading}
            hasSmartAccount={!!sk.smartAccountAddress}
            isOwnerWallet={sk.isOwnerWallet}
            onIssueSessionKey={sk.handleIssueSessionKey}
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
        <div className="mt-1">
          <DailyAgentReportCard />
        </div>
        </aside>

        {/* Center 2/3: Trade agent control — section scrolls, not the whole page */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pb-6">
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
              hasSmartAccount={!!sk.smartAccountAddress}
              depositVaultStatus={sk.depositVaultStatus}
              onDepositToVault={sk.handleDepositToVault}
              onRefreshBalance={sk.refreshBalance}
              onStart={bot.startBot}
              onStop={bot.stopBot}
              withdrawToBot={sk.withdrawToBot}
              withdrawToBotError={sk.withdrawToBotError}
              pendingWithdraw={bot.pendingWithdraw}
            />
        </section>
      </main>
    </div>
  );
}
