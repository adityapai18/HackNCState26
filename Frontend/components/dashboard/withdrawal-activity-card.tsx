"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowDownToLine } from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { WithdrawBar } from "@/hooks/useVaultHistory";

interface WithdrawalActivityCardProps {
  withdrawStatus: string;
  withdrawalCountEth: number;
  maxWithdrawalsEth: number;
  withdrawToAddress: string;
  setWithdrawToAddress: (v: string) => void;
  withdrawAmountWei: string;
  setWithdrawAmountWei: (v: string) => void;
  withdrawalLimitEth: bigint | null;
  totalWithdrawnEth: bigint | null;
  vaultBalanceWei: bigint | null;
  loading: string | null;
  hasSessionKey: boolean;
  onWithdraw: () => void;
  eoaAddress: string | undefined;
  withdrawBars: WithdrawBar[];
}

const chartConfig = {
  amount: {
    label: "Amount (wei)",
    color: "hsl(var(--chart-2))",
  },
};

export function WithdrawalActivityCard({
  withdrawStatus,
  withdrawalCountEth,
  maxWithdrawalsEth,
  withdrawToAddress,
  setWithdrawToAddress,
  withdrawAmountWei,
  setWithdrawAmountWei,
  withdrawalLimitEth,
  totalWithdrawnEth,
  vaultBalanceWei,
  loading,
  hasSessionKey,
  onWithdraw,
  eoaAddress,
  withdrawBars,
}: WithdrawalActivityCardProps) {
  const progress = Math.min(withdrawalCountEth / maxWithdrawalsEth, 1) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-chart-2" />
          Withdraw
        </CardTitle>
        <CardDescription>
          Withdraw from MockVault via session key (max {maxWithdrawalsEth})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Withdrawals: {Math.min(withdrawalCountEth, maxWithdrawalsEth)}/{maxWithdrawalsEth}
            </span>
            {withdrawalLimitEth != null && withdrawalLimitEth > 0n && (
              <span className="text-muted-foreground">
                Max total: {withdrawalLimitEth.toString()} wei
              </span>
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-chart-2 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {withdrawalLimitEth != null && withdrawalLimitEth > 0n && totalWithdrawnEth !== null && (
            <p className={`text-xs ${totalWithdrawnEth >= withdrawalLimitEth ? "text-chart-4" : "text-muted-foreground"}`}>
              Withdrawn: {totalWithdrawnEth.toString()} / {withdrawalLimitEth.toString()} wei
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="withdrawAmount" className="text-xs">Amount (wei)</Label>
          <Input
            id="withdrawAmount"
            type="text"
            value={withdrawAmountWei}
            onChange={(e) => setWithdrawAmountWei(e.target.value)}
            placeholder="1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="withdrawTo" className="text-xs">Withdraw to (optional)</Label>
          <Input
            id="withdrawTo"
            type="text"
            value={withdrawToAddress}
            onChange={(e) => setWithdrawToAddress(e.target.value)}
            placeholder={eoaAddress || "0x… EOA address"}
          />
        </div>

        <Button
          onClick={onWithdraw}
          disabled={loading !== null || !hasSessionKey}
          variant="default"
          className="w-full"
        >
          {loading === "withdraw" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Withdrawing…
            </>
          ) : (
            `Withdraw ${withdrawAmountWei.trim() || "1"} wei`
          )}
        </Button>

        {withdrawStatus && (
          <p className="text-xs text-muted-foreground break-all">{withdrawStatus}</p>
        )}

        {withdrawBars.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <BarChart data={withdrawBars} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-xs text-muted-foreground">No withdrawals yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
