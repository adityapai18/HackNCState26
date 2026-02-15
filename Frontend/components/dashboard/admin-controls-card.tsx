"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Settings, Lock } from "lucide-react";

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
    <Card className="border-border/50 transition-all duration-300">
      <CardContent className="p-5">
        {/* Top row: icon + title */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/15">
            <Settings className="h-5 w-5 text-chart-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold tracking-tight">Limits</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              Configure withdrawal limits for your session key.
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="my-4 h-px bg-border/50" />

        {/* Current limits — horizontal stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Max txns</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{maxWithdrawalsEth}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Total limit</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {withdrawalLimitEth != null && withdrawalLimitEth > 0n
                ? `${withdrawalLimitEth.toString()}`
                : "—"}
            </p>
          </div>
          {vaultOwner && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Owner</p>
              <p className="mt-0.5 truncate font-mono text-[13px] text-muted-foreground">
                {vaultOwner.slice(0, 6)}…{vaultOwner.slice(-4)}
              </p>
            </div>
          )}
        </div>

        {canSetLimits ? (
          <>
            {/* Separator */}
            <div className="my-4 h-px bg-border/50" />

            {/* Inputs + button inline */}
            <div className="flex items-end gap-2.5">
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Max txns</p>
                <Input
                  type="number"
                  min={0}
                  value={adminMaxWithdrawals}
                  onChange={(e) => setAdminMaxWithdrawals(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Max total (wei)</p>
                <Input
                  type="text"
                  value={adminMaxTotalWei}
                  onChange={(e) => setAdminMaxTotalWei(e.target.value)}
                  placeholder="0 = none"
                  className="h-9"
                />
              </div>
              <Button
                onClick={onSetLimits}
                disabled={loading !== null}
                variant="secondary"
                className="h-9 shrink-0 px-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading === "setLimits" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update"
                )}
              </Button>
            </div>

            {setLimitsStatus && (
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground animate-in fade-in-0 duration-200">
                {setLimitsStatus}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="my-4 h-px bg-border/50" />
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <Lock className="h-4 w-4" />
              <span className="text-[12px]">Connect with the account owner wallet to manage limits.</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
