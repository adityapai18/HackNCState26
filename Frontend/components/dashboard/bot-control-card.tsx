"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { truncateAddress } from "@/lib/utils";
import {
  Loader2,
  Bot,
  Play,
  Square,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Terminal,
  XCircle,
  Wallet,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useBalance } from "wagmi";
import type { BotInfo, BotStatus, BotLogEntry, StartBotParams, FundingStatus } from "@/hooks/useBotControl";

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
  onStart: (params: StartBotParams) => Promise<boolean>;
  onStop: () => Promise<boolean>;
  withdrawToBot: (amountWei: bigint, recipientAddress: string) => Promise<boolean>;
  withdrawToBotError: string | null;
  pendingWithdraw: { amount_wei: string; reason: string } | null;
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
  return status === "starting" ? "Starting bot..." : "Starting...";
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
  onStart,
  onStop,
  withdrawToBot,
  withdrawToBotError,
  onRefreshBalance,
  pendingWithdraw,
}: BotControlCardProps) {
  const [copiedMy, setCopiedMy] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pendingWithdrawHandledRef = useRef<string | null>(null);

  const { data: myWalletBalance, refetch: refetchBalance } = useBalance({
    address: eoaAddress as `0x${string}` | undefined,
    refetchInterval: 4000, // Real-time: refetch every 4s so balance updates after BUY/SELL
  });

  const isRunning = botStatus?.is_running ?? false;
  const isStarting = loading === "start" || fundingStatus !== null;

  // When bot signals pending_withdraw: use recipient from payload (e.g. BUY = random wallet) or fallback to API recipient
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

  // Refetch wallet balance when bot reports a new trade (BUY/SELL) so My Wallet updates in real time
  const lastTradeRef = useRef<string | null>(null);
  useEffect(() => {
    const key = botStatus?.last_trade
      ? `${botStatus.last_trade.signal}-${botStatus.last_trade.tx_hash}-${botStatus.last_trade.timestamp}`
      : null;
    if (key && key !== lastTradeRef.current) {
      lastTradeRef.current = key;
      refetchBalance();
    }
  }, [botStatus?.last_trade, refetchBalance]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCopyMyWallet = () => {
    if (eoaAddress) {
      navigator.clipboard.writeText(eoaAddress);
      setCopiedMy(true);
      setTimeout(() => setCopiedMy(false), 2000);
    }
  };

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
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-chart-2" />
          Trading Bot Control
          {isRunning && (
            <Badge className="bg-green-600 text-white ml-2">Running</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Manage the Uniswap V3 SMA crossover trading bot
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* My wallet (MetaMask / EOA) */}
        {eoaAddress ? (
          <div className="rounded-lg bg-muted/50 p-4 space-y-2 border border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              My Wallet
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-mono text-sm">
                  {truncateAddress(eoaAddress)}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyMyWallet}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copiedMy && <p className="text-xs text-green-500">Copied!</p>}
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">ETH Balance</p>
                <p className="font-mono text-sm">
                  {myWalletBalance?.formatted ?? "—"} ETH
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vault Balance</p>
                <p className="font-mono text-sm">
                  {vaultBalanceWei !== null
                    ? `${Number(vaultBalanceWei) / 1e18} ETH`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!botInfo && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Bot API not reachable. Start the Flask server to control the bot.
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
                      ? "Issue or re-issue a session key, then start the bot again."
                      : "Check vault balance and Limits below, then try starting the bot again."}
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
                  Start Bot
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
                  Stop Bot
                </>
              )}
            </Button>
          )}
        </div>

        {botInfo && !hasSessionKey && (
          <p className="text-xs text-muted-foreground">Issue a session key first to enable the bot.</p>
        )}
        {botInfo && hasSessionKey && !vaultAddress && (
          <p className="text-xs text-muted-foreground">Set NEXT_PUBLIC_MOCK_VAULT_ADDRESS in .env to enable the bot.</p>
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

        {/* Stopped status with results */}
        {botStatus && !isRunning && (botStatus.total_trades > 0 || botStatus.stop_reason) && (
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">Bot Stopped</p>
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
              Session key expired. The bot has stopped. Issue a new session key to continue.
            </p>
          </div>
        )}

        {/* Real-time logs */}
        {logs.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="h-4 w-4" />
              Bot Logs
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
