"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatWeiExact, cn } from "@/lib/utils";
import {
  Loader2,
  Bot,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Terminal,
  XCircle,
  Wallet,
  Vault,
  Plus,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useBalance } from "wagmi";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceDot,
  Tooltip,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { BotInfo, BotStatus, BotLogEntry, StartBotParams, FundingStatus } from "@/hooks/useBotControl";

const CANDLE_BUCKET_SEC = 15;

function buildCandles(priceHistory: { t: number; price: number }[]): { t: number; timeLabel: string; open: number; high: number; low: number; close: number }[] {
  if (!priceHistory?.length) return [];
  const buckets = new Map<number, { t: number; prices: number[] }>();
  for (const p of priceHistory) {
    const key = Math.floor(p.t / CANDLE_BUCKET_SEC) * CANDLE_BUCKET_SEC;
    if (!buckets.has(key)) buckets.set(key, { t: key, prices: [] });
    buckets.get(key)!.prices.push(p.price);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => ({
      t: v.t,
      timeLabel: new Date(v.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      open: v.prices[0]!,
      high: Math.max(...v.prices),
      low: Math.min(...v.prices),
      close: v.prices[v.prices.length - 1]!,
    }));
}

const chartConfig = {
  close: { label: "Price", color: "hsl(var(--chart-1))" },
  high: { label: "High", color: "hsl(var(--muted-foreground))" },
};

interface BotControlCardProps {
  botInfo: BotInfo | null;
  botStatus: BotStatus | null;
  logs: BotLogEntry[];
  loading: string | null;
  error: string | null;
  fundingStatus: FundingStatus;
  hasSessionKey: boolean;
  sessionKeyExpiry: number | null;
  sessionKeyAddress: string | null;
  smartAccountAddress: string | null;
  eoaAddress: string | null;
  vaultAddress: string;
  vaultBalanceWei: bigint | null;
  hasSmartAccount?: boolean;
  depositVaultStatus?: string;
  onDepositToVault?: (amountEth?: string) => void;
  onStart: (params: StartBotParams) => Promise<boolean>;
  onStop: () => Promise<boolean>;
  withdrawToBot: (amountWei: bigint, recipientAddress: string) => Promise<boolean>;
  withdrawToBotError: string | null;
  pendingWithdraw: { amount_wei: string; reason: string; recipient_address?: string } | null;
  onRefreshBalance: () => void;
}

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <Badge variant="secondary">---</Badge>;
  switch (signal) {
    case "BUY":
      return (
        <Badge className="bg-green-600 text-white">
          <TrendingUp className="mr-1 h-3 w-3" /> BUY
        </Badge>
      );
    case "SELL":
      return (
        <Badge className="bg-red-600 text-white">
          <TrendingDown className="mr-1 h-3 w-3" /> SELL
        </Badge>
      );
    case "DEPOSIT":
      return (
        <Badge className="bg-blue-600 text-white">
          <Wallet className="mr-1 h-3 w-3" /> DEPOSIT
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Minus className="mr-1 h-3 w-3" /> {signal}
        </Badge>
      );
  }
}

function fundingLabel(status: FundingStatus): string {
  return status === "starting" ? "Starting agent..." : "Starting...";
}

export function BotControlCard({
  botInfo,
  botStatus,
  logs,
  loading,
  error,
  fundingStatus,
  hasSessionKey,
  sessionKeyExpiry,
  sessionKeyAddress,
  smartAccountAddress,
  eoaAddress,
  vaultAddress,
  vaultBalanceWei,
  hasSmartAccount = false,
  depositVaultStatus = "",
  onDepositToVault,
  onStart,
  onStop,
  withdrawToBot,
  withdrawToBotError,
  onRefreshBalance,
  pendingWithdraw,
}: BotControlCardProps) {
  const [animatingBalance, setAnimatingBalance] = useState<"wallet" | "vault" | null>(null);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [depositAmountEth, setDepositAmountEth] = useState("0.0001");
  const logEndRef = useRef<HTMLDivElement>(null);

  const priceHistory = botStatus?.price_history ?? [];
  const tradeHistory = botStatus?.trade_history ?? [];
  const candlesFromHistory = useMemo(() => buildCandles(priceHistory), [priceHistory]);
  // When bot is running but no history yet, seed one candle from current_price so chart shows immediately
  const candles = useMemo(() => {
    if (candlesFromHistory.length > 0) return candlesFromHistory;
    const isRunning = botStatus?.is_running ?? false;
    const price = botStatus?.current_price;
    const startedAt = botStatus?.started_at;
    if (!isRunning || price == null || startedAt == null) return [];
    const t = Math.floor(startedAt / CANDLE_BUCKET_SEC) * CANDLE_BUCKET_SEC;
    return [
      {
        t,
        timeLabel: new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        open: price,
        high: price,
        low: price,
        close: price,
      },
    ];
  }, [candlesFromHistory, botStatus?.is_running, botStatus?.current_price, botStatus?.started_at]);
  const hasChartData = candles.length > 0;
  const chartMinPrice = hasChartData ? Math.min(...candles.flatMap((c) => [c.low, c.open, c.close])) - 1 : 0;
  const chartMaxPrice = hasChartData ? Math.max(...candles.flatMap((c) => [c.high, c.open, c.close])) + 1 : 100;
  const pendingWithdrawHandledRef = useRef<string | null>(null);
  const prevVaultWeiRef = useRef<bigint | null>(null);
  const prevWalletWeiRef = useRef<bigint | undefined>(undefined);

  const { data: myWalletBalance, refetch: refetchBalance } = useBalance({
    address: eoaAddress as `0x${string}` | undefined,
    refetchInterval: 4000, // Real-time: refetch every 4s so balance updates after BUY/SELL
  });

  const isRunning = botStatus?.is_running ?? false;
  const isStarting = loading === "start" || fundingStatus !== null;

  // When agent signals pending_withdraw: use recipient from payload (e.g. BUY = random wallet) or fallback to API recipient
  const defaultRecipient = botStatus?.bot_recipient_address ?? eoaAddress ?? undefined;
  useEffect(() => {
    const recipient = pendingWithdraw?.recipient_address ?? defaultRecipient;
    if (!pendingWithdraw || !recipient) return;
    const key = `${pendingWithdraw.amount_wei}-${pendingWithdraw.reason}`;
    if (pendingWithdrawHandledRef.current === key) return;
    pendingWithdrawHandledRef.current = key;
    withdrawToBot(BigInt(pendingWithdraw.amount_wei), recipient).catch(() => {
      pendingWithdrawHandledRef.current = null;
    });
  }, [pendingWithdraw, defaultRecipient, withdrawToBot]);

  useEffect(() => {
    if (!pendingWithdraw) pendingWithdrawHandledRef.current = null;
  }, [pendingWithdraw]);

  // On new trade: refetch wallet + vault (animation triggers when values actually update)
  const lastTradeRef = useRef<string | null>(null);
  useEffect(() => {
    const lastTrade = botStatus?.last_trade;
    const key = lastTrade
      ? `${lastTrade.signal}-${lastTrade.tx_hash}-${lastTrade.timestamp}`
      : null;
    if (key && key !== lastTradeRef.current) {
      lastTradeRef.current = key;
      refetchBalance();
      onRefreshBalance();
    }
  }, [botStatus?.last_trade, refetchBalance, onRefreshBalance]);

  // Flash when displayed values actually change (vault decreased or wallet increased)
  useEffect(() => {
    if (vaultBalanceWei !== null && prevVaultWeiRef.current !== null && vaultBalanceWei < prevVaultWeiRef.current) {
      setAnimatingBalance("vault");
    }
    prevVaultWeiRef.current = vaultBalanceWei;
  }, [vaultBalanceWei]);

  useEffect(() => {
    const walletWei = myWalletBalance?.value;
    if (walletWei !== undefined && prevWalletWeiRef.current !== undefined && walletWei > prevWalletWeiRef.current) {
      setAnimatingBalance("wallet");
    }
    prevWalletWeiRef.current = walletWei;
  }, [myWalletBalance?.value]);

  useEffect(() => {
    if (animatingBalance === null) return;
    const t = setTimeout(() => setAnimatingBalance(null), 700);
    return () => clearTimeout(t);
  }, [animatingBalance]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = () => {
    if (!eoaAddress) return;
    const params: StartBotParams = {
      session_key_expiry: sessionKeyExpiry ?? undefined,
      session_key_address: sessionKeyAddress ?? undefined,
      smart_account_address: smartAccountAddress ?? undefined,
      vault_address: vaultAddress || undefined,
      bot_recipient_address: eoaAddress,
    };
    onStart(params);
  };

  const canStart = botInfo && hasSessionKey && vaultAddress && sessionKeyAddress && eoaAddress;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-chart-2" />
          Trading Agent Control
          {isRunning && (
            <Badge className="bg-green-600 text-white ml-2">Running</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Start, monitor, and stop your Uniswap V3 SMA agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet + Vault balance blocks */}
        {eoaAddress ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* My Wallet */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3 transition-colors duration-300">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                    myWalletBalance?.value ? "bg-chart-2/15" : "bg-muted/60"
                  }`}
                >
                  <Wallet
                    className={`h-5 w-5 transition-colors duration-300 ${
                      myWalletBalance?.value ? "text-chart-2" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold tracking-tight">My Wallet</h3>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    Your connected wallet (EOA).
                  </p>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  ETH balance
                </p>
                <p
                  className={cn(
                    "mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-xl md:text-2xl font-bold tracking-tight -ml-1",
                    animatingBalance === "wallet" && "balance-flash-up"
                  )}
                >
                  {myWalletBalance?.formatted ?? "—"} ETH
                </p>
              </div>
            </div>

            {/* Vault balance — Add balance button opens deposit modal */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3 transition-colors duration-300">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                      vaultBalanceWei !== null && vaultBalanceWei > 0n ? "bg-chart-1/15" : "bg-muted/60"
                    }`}
                  >
                    <Vault
                      className={`h-5 w-5 transition-colors duration-300 ${
                        vaultBalanceWei !== null && vaultBalanceWei > 0n ? "text-chart-1" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold tracking-tight">Vault balance</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setVaultModalOpen(true)}
                        className="shrink-0 gap-1.5 h-8"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add balance
                      </Button>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                      ETH available for the agent to trade.
                    </p>
                  </div>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Balance
                </p>
                <p
                  className={cn(
                    "mt-0.5 rounded-md px-1.5 py-0.5 font-mono text-xl md:text-2xl font-bold tracking-tight -ml-1",
                    animatingBalance === "vault" && "balance-flash-down"
                  )}
                >
                  {formatWeiExact(vaultBalanceWei)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Vault deposit modal */}
        <Dialog open={vaultModalOpen} onOpenChange={setVaultModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Vault className="h-5 w-5 text-chart-1" />
                Vault balance
              </DialogTitle>
              <DialogDescription>
                Deposit ETH from your wallet into the vault so the agent can trade.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Current balance
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-tight">
                  {formatWeiExact(vaultBalanceWei)} ETH
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="deposit-amount" className="text-sm font-medium">
                  Amount to deposit (ETH)
                </label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.0001"
                  value={depositAmountEth}
                  onChange={(e) => setDepositAmountEth(e.target.value)}
                  className="font-mono"
                />
              </div>
              {depositVaultStatus && (
                <p className="text-xs text-muted-foreground">{depositVaultStatus}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setVaultModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onDepositToVault?.(depositAmountEth || undefined);
                  onRefreshBalance();
                }}
                disabled={loading !== null || !hasSmartAccount || !onDepositToVault}
              >
                {loading === "deposit" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Depositing…
                  </>
                ) : (
                  "Deposit"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!botInfo && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Agent API not reachable. Start the Flask server to control the agent.
          </p>
        )}

        {pendingWithdraw && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Withdrawing {pendingWithdraw.amount_wei} wei from vault via session key for {pendingWithdraw.reason}...
          </p>
        )}

        {withdrawToBotError && (
          <div
            className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200"
            role="alert"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-semibold text-red-400">Withdrawal failed</p>
              <p className="text-[13px] leading-relaxed text-red-400 break-words">
                {withdrawToBotError}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {withdrawToBotError.includes("Insufficient") || withdrawToBotError.toLowerCase().includes("balance")
                  ? "Deposit more ETH to the vault, then try again."
                  : withdrawToBotError.includes("WithdrawalCountLimitReached") || withdrawToBotError.includes("limit")
                    ? "Session key withdrawal limit reached. Use Limits to increase max withdrawals or re-issue a session key."
                    : withdrawToBotError.includes("Missing session") || withdrawToBotError.includes("session key")
                      ? "Issue or re-issue a session key, then start the agent again."
                      : "Check vault balance and Limits below, then try starting the agent again."}
              </p>
            </div>
          </div>
        )}

        {/* Start / Stop */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              onClick={handleStart}
              disabled={isStarting || !canStart}
              className="flex-1"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {fundingLabel(fundingStatus)}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Agent
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={onStop}
              disabled={loading === "stop"}
              variant="destructive"
              className="flex-1"
            >
              {loading === "stop" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Stop Agent
                </>
              )}
            </Button>
          )}
        </div>

        {botInfo && !hasSessionKey && (
          <p className="text-xs text-muted-foreground">Issue a session key first to enable the agent.</p>
        )}
        {botInfo && hasSessionKey && !vaultAddress && (
          <p className="text-xs text-muted-foreground">Set NEXT_PUBLIC_MOCK_VAULT_ADDRESS in .env to enable the agent.</p>
        )}

        {/* Running status */}
        {botStatus && isRunning && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Signal</p>
                <SignalBadge signal={botStatus.current_signal} />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-mono text-sm">
                  {botStatus.current_price !== null
                    ? `$${botStatus.current_price.toFixed(2)}`
                    : "---"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Trades</p>
                <p className="font-mono text-sm">
                  BUY: {botStatus.buy_count ?? 0} · SELL: {botStatus.sell_count ?? 0}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Iterations</p>
                <p className="font-mono text-sm">{botStatus.iterations}</p>
              </div>
            </div>

            {botStatus.last_trade && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Last Trade</p>
                <div className="flex items-center gap-2">
                  <SignalBadge signal={botStatus.last_trade.signal} />
                  <span className="font-mono text-xs">
                    {botStatus.last_trade.tx_hash.slice(0, 10)}...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Candle chart — always visible so user can find it; shows when running + has data */}
        <div className="rounded-lg border border-border/50 bg-card/50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Price & trades</p>
          {!isRunning ? (
            <div className="flex h-[220px] w-full items-center justify-center rounded-md bg-muted/20 text-sm text-muted-foreground">
              Start the agent to see the live candle chart and buy/sell points.
            </div>
          ) : hasChartData ? (
            <>
              <div className="h-[220px] w-full" style={{ minHeight: 220 }}>
                <ChartContainer config={chartConfig} className="h-full w-full !aspect-auto">
                  <ComposedChart data={candles} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={
                        candles.length === 1
                          ? [candles[0]!.t - CANDLE_BUCKET_SEC, candles[0]!.t + CANDLE_BUCKET_SEC]
                          : ["dataMin", "dataMax"]
                      }
                      tickFormatter={(t) => new Date(t * 1000).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      domain={[chartMinPrice, chartMaxPrice]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `$${v.toFixed(1)}`}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Price"]}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.timeLabel ?? ""}
                        />
                      }
                    />
                    <Bar
                      dataKey="close"
                      baseValue={(entry: { open: number }) => entry.open}
                      fill="transparent"
                      barSize={8}
                      radius={0}
                      isAnimationActive={false}
                      fillOpacity={1}
                      shape={(props: { x: number; y: number; width: number; height: number; payload: { open: number; close: number } }) => {
                        const { x, y, width, height, payload } = props;
                        const isUp = payload.close >= payload.open;
                        return (
                          <g>
                            <rect
                              x={x}
                              y={y}
                              width={Math.max(width, 4)}
                              height={Math.abs(height)}
                              fill={isUp ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                              stroke={isUp ? "rgb(22, 163, 74)" : "rgb(220, 38, 38)"}
                              strokeWidth={1}
                            />
                          </g>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {tradeHistory.map((trade, i) => (
                      <ReferenceDot
                        key={`${trade.timestamp}-${trade.signal}-${i}`}
                        x={trade.timestamp}
                        y={trade.price}
                        r={5}
                        fill={trade.signal === "BUY" ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                  </ComposedChart>
                </ChartContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> BUY
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> SELL
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-[220px] w-full items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground">
              Collecting price data…
            </div>
          )}
        </div>

        {/* Stopped status with results */}
        {botStatus && !isRunning && (botStatus.total_trades > 0 || botStatus.stop_reason) && (
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">Agent Stopped</p>
            {botStatus.stop_reason && (
              <p className="text-sm text-muted-foreground">{botStatus.stop_reason}</p>
            )}
            <p className="text-xs text-muted-foreground">
              BUY: {botStatus.buy_count ?? 0} · SELL: {botStatus.sell_count ?? 0} | Iterations: {botStatus.iterations}
            </p>
            {botStatus.last_trade && (
              <p className="text-xs text-muted-foreground font-mono">
                Last: {botStatus.last_trade.signal} - {botStatus.last_trade.tx_hash.slice(0, 16)}...
              </p>
            )}
          </div>
        )}

        {/* Session key expiry warning */}
        {botStatus?.session_key_expired && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">
              Session key expired. The agent has stopped. Issue a new session key to continue.
            </p>
          </div>
        )}

        {/* Real-time logs */}
        {logs.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="h-4 w-4" />
              Agent Logs
            </div>
            <div
              className="h-40 overflow-y-auto rounded bg-zinc-950 p-3 font-mono text-xs text-zinc-300 space-y-1"
              style={{ scrollBehavior: "smooth" }}
            >
              {logs.map((entry, i) => (
                <div
                  key={`${entry.ts}-${i}`}
                  className={
                    entry.level === "error"
                      ? "text-red-400"
                      : entry.level === "warning"
                        ? "text-amber-400"
                        : "text-zinc-400"
                  }
                >
                  <span className="text-zinc-500 select-none">
                    {new Date(entry.ts * 1000).toLocaleTimeString()}{" "}
                  </span>
                  {entry.msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* Error display */}
        {(error || (botStatus?.error && !botStatus.session_key_expired)) && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-sm text-orange-600 dark:text-orange-400 break-all">
              {error || botStatus?.error}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
