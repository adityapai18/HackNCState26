"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings } from "lucide-react";

interface AdminControlsCardProps {
  vaultOwner: string | null;
  hasSmartAccount: boolean;
  isOwnerWallet: boolean;
  maxWithdrawalsEth: number;
  withdrawalLimitEth: bigint | null;
  setLimitsStatus: string;
  adminMaxWithdrawals: string;
  setAdminMaxWithdrawals: (v: string) => void;
  adminMaxTotalWei: string;
  setAdminMaxTotalWei: (v: string) => void;
  loading: string | null;
  onSetLimits: () => void;
}

export function AdminControlsCard({
  vaultOwner,
  hasSmartAccount,
  isOwnerWallet,
  maxWithdrawalsEth,
  withdrawalLimitEth,
  setLimitsStatus,
  adminMaxWithdrawals,
  setAdminMaxWithdrawals,
  adminMaxTotalWei,
  setAdminMaxTotalWei,
  loading,
  onSetLimits,
}: AdminControlsCardProps) {
  const canSetLimits = hasSmartAccount && isOwnerWallet;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-chart-4" />
          Your Token Limits
        </CardTitle>
        <CardDescription>
          Your current ETH limits: max <strong>{maxWithdrawalsEth}</strong> withdrawals
          {withdrawalLimitEth != null && withdrawalLimitEth > 0n
            ? `, max total ${withdrawalLimitEth.toString()} wei`
            : ", no total limit"}
          {vaultOwner != null && (
            <span className="block mt-1 text-muted-foreground/80">
              Vault contract owner: {vaultOwner.slice(0, 6)}…{vaultOwner.slice(-4)}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canSetLimits ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="adminMaxW" className="text-xs">Max Withdrawals</Label>
                <Input
                  id="adminMaxW"
                  type="number"
                  min={0}
                  value={adminMaxWithdrawals}
                  onChange={(e) => setAdminMaxWithdrawals(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="adminMaxTotal" className="text-xs">Max Total (wei, 0=none)</Label>
                <Input
                  id="adminMaxTotal"
                  type="text"
                  value={adminMaxTotalWei}
                  onChange={(e) => setAdminMaxTotalWei(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <Button
              onClick={onSetLimits}
              disabled={loading !== null}
              variant="secondary"
              className="w-full"
            >
              {loading === "setLimits" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting…
                </>
              ) : (
                "Set My ETH Limits"
              )}
            </Button>
            {setLimitsStatus && (
              <p className="text-xs text-muted-foreground">{setLimitsStatus}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Connect with the wallet that created this smart account to set your withdrawal limits.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
