"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWei } from "@/lib/utils";
import { Loader2, Vault, RefreshCw } from "lucide-react";
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Vault className="h-5 w-5 text-chart-1" />
              Vault Balance
            </CardTitle>
            <CardDescription>
              Deposit ETH from smart account to MockVault
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Your Vault Balance</p>
          <p className="text-2xl font-bold font-mono">
            {vaultBalanceWei !== null ? formatWei(vaultBalanceWei) : "—"}
          </p>
          {vaultBalanceWei !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              {vaultBalanceWei.toString()} wei
            </p>
          )}
        </div>

        {showAmountInput && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Amount (ETH)</p>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={depositAmountEth ?? ""}
              onChange={(e) => setDepositAmountEth?.(e.target.value)}
              placeholder="0.0001"
            />
          </div>
        )}

        <Button
          onClick={() => onDeposit(depositAmountEth)}
          disabled={loading !== null || !hasSmartAccount}
          className="w-full"
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
          <p className="text-xs text-muted-foreground break-all">{depositVaultStatus}</p>
        )}

        {balanceSnapshots.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <AreaChart data={balanceSnapshots} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="var(--color-balance)"
                fill="var(--color-balance)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-xs text-muted-foreground">No activity yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
