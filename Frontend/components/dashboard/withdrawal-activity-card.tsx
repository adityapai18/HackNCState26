"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  loading,
  hasSessionKey,
  onWithdraw,
  eoaAddress,
  withdrawBars,
}: WithdrawalActivityCardProps) {
  const progress = Math.min(withdrawalCountEth / maxWithdrawalsEth, 1) * 100;
  const used = Math.min(withdrawalCountEth, maxWithdrawalsEth);

  return (
    <Card className="overflow-hidden transition-all duration-300">
      <CardContent className="p-5">
        {/* Top row: icon + title + usage pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/15">
              <ArrowDownToLine className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Withdraw</h3>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                Transfer ETH from vault via session key.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums">
            {used}/{maxWithdrawalsEth}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 w-full rounded-full bg-border/40">
          <div
            className="h-1 rounded-full bg-chart-2 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {withdrawalLimitEth != null && withdrawalLimitEth > 0n && totalWithdrawnEth !== null && (
          <p className={`mt-1.5 text-[11px] tabular-nums ${
            totalWithdrawnEth >= withdrawalLimitEth ? "text-chart-5" : "text-muted-foreground"
          }`}>
            {totalWithdrawnEth.toString()} / {withdrawalLimitEth.toString()} wei used
          </p>
        )}

        {/* Separator */}
        <div className="my-4 h-px bg-border/50" />

        {/* Inputs — stacked for better readability */}
        <div className="space-y-2.5">
          <div className="flex items-end gap-2.5">
            <div className="flex-1 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">Amount (wei)</p>
              <Input
                type="text"
                value={withdrawAmountWei}
                onChange={(e) => setWithdrawAmountWei(e.target.value)}
                placeholder="1"
                className="h-9"
              />
            </div>
            <Button
              onClick={onWithdraw}
              disabled={loading !== null || !hasSessionKey}
              className="h-9 shrink-0 px-5 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading === "withdraw" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Withdraw"
              )}
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">To address (optional)</p>
            <Input
              type="text"
              value={withdrawToAddress}
              onChange={(e) => setWithdrawToAddress(e.target.value)}
              placeholder={eoaAddress ? `${eoaAddress.slice(0, 10)}…${eoaAddress.slice(-4)}` : "0x…"}
              className="h-9 font-mono text-xs"
            />
          </div>
        </div>

        {/* Status feedback */}
        {withdrawStatus && (
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground break-all animate-in fade-in-0 duration-200">
            {withdrawStatus}
          </p>
        )}

        {/* Chart footer */}
        {withdrawBars.length > 0 && (
          <>
            <div className="my-3 h-px bg-border/50" />
            <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
              <ChartContainer config={chartConfig} className="h-[64px] w-full">
                <BarChart data={withdrawBars} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={9} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
