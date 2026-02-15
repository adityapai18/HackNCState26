"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWei } from "@/lib/utils";
import { Loader2, Vault, RefreshCw, TrendingUp } from "lucide-react";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { BalanceSnapshot } from "@/hooks/useVaultHistory";

interface VaultBalanceCardProps {
  vaultBalanceWei: bigint | null;
  depositVaultStatus: string;
  loading: string | null;
  hasSmartAccount: boolean;
  onDeposit: (amountEth?: string) => void;
  onRefresh: () => void;
  balanceSnapshots: BalanceSnapshot[];
  showAmountInput?: boolean;
  depositAmountEth?: string;
  setDepositAmountEth?: (v: string) => void;
}

const chartConfig = {
  balance: {
    label: "Balance (wei)",
    color: "hsl(var(--chart-1))",
  },
};

export function VaultBalanceCard({
  vaultBalanceWei,
  depositVaultStatus,
  loading,
  hasSmartAccount,
  onDeposit,
  onRefresh,
  balanceSnapshots,
  showAmountInput = false,
  depositAmountEth,
  setDepositAmountEth,
}: VaultBalanceCardProps) {
  const buttonLabel = showAmountInput
    ? `Deposit ${depositAmountEth && depositAmountEth.length > 0 ? depositAmountEth : "0.0001"} ETH`
    : "Deposit 0.0001 ETH";

  const hasBalance = vaultBalanceWei !== null && vaultBalanceWei > 0n;

  return (
    <Card className="overflow-hidden transition-all duration-300">
      <CardContent className="p-5">
        {/* Top row: icon + title + refresh */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
              hasBalance ? "bg-chart-1/15" : "bg-muted/60"
            }`}>
              <Vault className={`h-5 w-5 transition-colors duration-300 ${
                hasBalance ? "text-chart-1" : "text-muted-foreground"
              }`} />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Vault Balance</h3>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                ETH for your agent to invest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground hover:rotate-180"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Separator */}
        <div className="my-4 h-px bg-border/50" />

        {/* Balance display */}
        <div className="text-center">
          <p className="font-mono text-3xl font-bold tracking-tight transition-all duration-300">
            {vaultBalanceWei !== null ? formatWei(vaultBalanceWei) : "—"}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            ETH
          </p>
        </div>

        {/* Chart (inline, no wrapper box) */}
        <div className="mt-3">
          {balanceSnapshots.length > 0 ? (
            <div className="animate-in fade-in-0 duration-300">
              <ChartContainer config={chartConfig} className="h-[72px] w-full">
                <AreaChart data={balanceSnapshots} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={9} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="var(--color-balance)"
                    fill="var(--color-balance)"
                    fillOpacity={0.1}
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex h-[48px] items-center justify-center gap-1.5 text-muted-foreground/50">
              <TrendingUp className="h-4 w-4" />
              <span className="text-[11px]">Chart appears after activity</span>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="my-3 h-px bg-border/50" />

        {/* Deposit */}
        {showAmountInput && (
          <div className="mb-3 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Amount (ETH)</p>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={depositAmountEth ?? ""}
              onChange={(e) => setDepositAmountEth?.(e.target.value)}
              placeholder="0.0001"
              className="h-9"
            />
          </div>
        )}

        <Button
          onClick={() => onDeposit(depositAmountEth)}
          disabled={loading !== null || !hasSmartAccount}
          className="w-full transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
        >
          {loading === "deposit" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Depositing…
            </>
          ) : (
            buttonLabel
          )}
        </Button>

        {depositVaultStatus && (
          <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground break-all animate-in fade-in-0 duration-200">
            {depositVaultStatus}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
