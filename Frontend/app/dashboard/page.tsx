"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionKeys } from "@/hooks/useSessionKeys";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AccountDialog } from "@/components/dashboard/account-dialog";
import { SessionKeyPanel } from "@/components/dashboard/session-key-panel";
import { VaultBalanceCard } from "@/components/dashboard/vault-balance-card";
import { WithdrawalActivityCard } from "@/components/dashboard/withdrawal-activity-card";
import { SessionActivityCard } from "@/components/dashboard/session-activity-card";
import { AdminControlsCard } from "@/components/dashboard/admin-controls-card";

export default function DashboardPage() {
  const sk = useSessionKeys();
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
        </div>

        {/* Row 3: Admin controls */}
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
