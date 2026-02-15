"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Settings, Lock, Minus, Plus } from "lucide-react";

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
  const [maxDurationDays, setMaxDurationDays] = useState<string>("");

  return (
    <Card className="border-border/50 transition-all duration-300">
      <CardContent className="p-6">
        {/* Header — Configuration, no Owner */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/15">
            <Settings className="h-5 w-5 text-chart-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold tracking-tight">Configuration</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Custom session key and withdrawal settings.
            </p>
          </div>
        </div>

        {canSetLimits ? (
          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Settings
            </p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/90">Max transactions</label>
                <Input
                  type="number"
                  min={0}
                  value={adminMaxWithdrawals}
                  onChange={(e) => setAdminMaxWithdrawals(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/90">Max total (wei)</label>
                <Input
                  type="text"
                  value={adminMaxTotalWei}
                  onChange={(e) => setAdminMaxTotalWei(e.target.value)}
                  placeholder="0 = none"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground/90">Max duration (days)</label>
                <div className="flex items-center gap-0 rounded-lg border border-input bg-background overflow-hidden h-10 w-full max-w-[140px]">
                  <button
                    type="button"
                    onClick={() =>
                      setMaxDurationDays((prev) =>
                        prev === "" ? "0" : String(Math.max(0, parseInt(prev, 10) - 1))
                      )
                    }
                    className="flex h-full w-10 shrink-0 items-center justify-center border-r border-input bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label="Decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxDurationDays}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) setMaxDurationDays(v);
                    }}
                    placeholder="—"
                    className="h-full w-12 flex-1 min-w-0 border-0 bg-transparent text-center text-sm font-medium tabular-nums outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setMaxDurationDays((prev) =>
                        prev === "" ? "1" : String(parseInt(prev, 10) + 1)
                      )
                    }
                    className="flex h-full w-10 shrink-0 items-center justify-center border-l border-input bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Increase"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <Button
                onClick={onSetLimits}
                disabled={loading !== null}
                variant="secondary"
                className="w-full h-10 mt-1 transition-all duration-200 hover:opacity-90 active:scale-[0.99]"
              >
                {loading === "setLimits" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update configuration"
                )}
              </Button>
            </div>

            {setLimitsStatus && (
              <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground animate-in fade-in-0 duration-200">
                {setLimitsStatus}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="text-[13px]">Connect with the account owner wallet to manage configuration.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
