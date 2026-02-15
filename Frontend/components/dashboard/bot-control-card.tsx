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
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
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
    default:
      return (
        <Badge variant="secondary">
          <Minus className="mr-1 h-3 w-3" /> HOLD
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
  vaultAddress,
  vaultBalanceWei,
  onStart,
  onStop,
  withdrawToBot,
  withdrawToBotError,
  onRefreshBalance,
  pendingWithdraw,
}: BotControlCardProps) {
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pendingWithdrawHandledRef = useRef<string | null>(null);

  const isRunning = botStatus?.is_running ?? false;
  const isStarting = loading === "start" || fundingStatus !== null;

  // When bot signals pending_withdraw (BUY needs vault withdraw), frontend withdraws via session key
  useEffect(() => {
    if (!pendingWithdraw || !botInfo?.wallet_address) return;
    const key = `${pendingWithdraw.amount_wei}-${pendingWithdraw.reason}`;
    if (pendingWithdrawHandledRef.current === key) return;
    pendingWithdrawHandledRef.current = key;
    withdrawToBot(BigInt(pendingWithdraw.amount_wei), botInfo.wallet_address).catch(() => {
      pendingWithdrawHandledRef.current = null;
    });
  }, [pendingWithdraw, botInfo?.wallet_address, withdrawToBot]);

  useEffect(() => {
    if (!pendingWithdraw) pendingWithdrawHandledRef.current = null;
  }, [pendingWithdraw]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleCopy = () => {
    if (botInfo?.wallet_address) {
      navigator.clipboard.writeText(botInfo.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStart = () => {
    const params: StartBotParams = {
      session_key_expiry: sessionKeyExpiry ?? undefined,
      session_key_address: sessionKeyAddress ?? undefined,
      smart_account_address: smartAccountAddress ?? undefined,
      vault_address: vaultAddress || undefined,
    };
    if (!botInfo) return;
    onStart(params);
  };

  const canStart = botInfo && hasSessionKey && vaultAddress && sessionKeyAddress;

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
        {/* Bot wallet info */}
        {botInfo ? (
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Bot Wallet</p>
                <p className="font-mono text-sm">
                  {truncateAddress(botInfo.wallet_address)}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied && <p className="text-xs text-green-500">Copied!</p>}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Bot ETH Balance</p>
                <p className="font-mono text-sm">{botInfo.eth_balance} ETH</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vault Balance</p>
                <p className="font-mono text-sm">
                  {vaultBalanceWei !== null ? `${vaultBalanceWei} wei` : "---"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Bot API not reachable. Start the Flask server.
            </p>
          </div>
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
                  {botStatus.buy_count != null || botStatus.sell_count != null
                    ? `BUY: ${botStatus.buy_count ?? 0} · SELL: ${botStatus.sell_count ?? 0}`
                    : botStatus.total_trades}
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
