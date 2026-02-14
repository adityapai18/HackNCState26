"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings } from "lucide-react";

interface AdminControlsCardProps {
  eoaAddress: string | undefined;
  vaultOwner: string;
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
  eoaAddress,
  vaultOwner,
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
  const isOwner = eoaAddress?.toLowerCase() === vaultOwner.toLowerCase();

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-chart-4" />
          Token Limits (Admin)
        </CardTitle>
        <CardDescription>
          ETH limits: max <strong>{maxWithdrawalsEth}</strong> withdrawals
          {withdrawalLimitEth != null && withdrawalLimitEth > 0n
            ? `, max total ${withdrawalLimitEth.toString()} wei`
            : ", no total limit"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner ? (
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
                "Set ETH Limits"
              )}
            </Button>
            {setLimitsStatus && (
              <p className="text-xs text-muted-foreground">{setLimitsStatus}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Connect as vault owner to change limits.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
