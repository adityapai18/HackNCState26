"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const BOT_API_URL =
  process.env.NEXT_PUBLIC_BOT_API_URL || "http://localhost:5001";

export interface BotInfo {
  wallet_address: string;
  bot_recipient_address?: string; // Where vault withdrawals go (same as wallet_address when no key)
  eth_balance_wei: string;
  eth_balance: string;
  network: string;
}

export interface BotLastTrade {
  signal: string;
  tx_hash: string;
  timestamp: number;
  amount: string;
}

export interface PendingWithdraw {
  amount_wei: string;
  reason: string;
  /** When set (e.g. BUY to random wallet), frontend sends vault withdrawal to this address */
  recipient_address?: string;
}

export interface BotStatus {
  is_running: boolean;
  current_signal: string | null;
  current_price: number | null;
  last_trade: BotLastTrade | null;
  total_trades: number;
  error: string | null;
  session_key_expiry: number | null;
  session_key_expired: boolean;
  session_key_address: string | null;
  vault_address: string | null;
  smart_account_address: string | null;
  /** Recipient address passed at start (from frontend); used for vault withdrawals in signal-only mode */
  bot_recipient_address: string | null;
  started_at: number | null;
  iterations: number;
  pending_withdraw: PendingWithdraw | null;
  buy_count: number;
  sell_count: number;
  stop_reason: string | null;
}

export interface BotLogEntry {
  ts: number;
  level: string;
  msg: string;
}

export interface StartBotParams {
  session_key_expiry?: number;
  session_key_address?: string;
  vault_address?: string;
  smart_account_address?: string;
  /** Where vault withdrawals go in signal-only mode (from frontend when starting bot) */
  bot_recipient_address?: string;
}

export type FundingStatus = "starting" | null;

export function useBotControl() {
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fundingStatus, setFundingStatus] = useState<FundingStatus>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLogTsRef = useRef<number>(0);

  const fetchBotInfo = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_API_URL}/bot/info`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBotInfo(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to fetch bot info: ${msg}`);
      return null;
    }
  }, []);

  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BOT_API_URL}/bot/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BotStatus = await res.json();
      setBotStatus(data);
      // Stop polling if bot stopped
      if (!data.is_running && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (!data.is_running && logPollingRef.current) {
        clearInterval(logPollingRef.current);
        logPollingRef.current = null;
      }
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to fetch bot status: ${msg}`);
      return null;
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const since = lastLogTsRef.current > 0 ? lastLogTsRef.current : undefined;
      const url = since ? `${BOT_API_URL}/bot/logs?since=${since}` : `${BOT_API_URL}/bot/logs`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newLogs: BotLogEntry[] = data.logs ?? [];
      if (newLogs.length > 0) {
        const maxTs = Math.max(...newLogs.map((l) => l.ts));
        lastLogTsRef.current = maxTs;
        setLogs((prev) => {
          const existing = new Set(prev.map((l) => `${l.ts}-${l.msg}`));
          const appended = newLogs.filter((l) => !existing.has(`${l.ts}-${l.msg}`));
          return [...prev, ...appended].slice(-300);
        });
      }
    } catch {
      // Silently ignore log fetch errors
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      fetchBotStatus();
    }, 5000);
    // Also poll logs more frequently for real-time feel
    lastLogTsRef.current = 0;
    fetchLogs();
    if (logPollingRef.current) return;
    logPollingRef.current = setInterval(() => {
      fetchLogs();
    }, 1500);
  }, [fetchBotStatus, fetchLogs]);

  const startBot = useCallback(
    async (params: StartBotParams) => {
      setLoading("start");
      setError(null);
      setFundingStatus("starting");
      try {
        const res = await fetch(`${BOT_API_URL}/bot/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || `HTTP ${res.status}`);
          return false;
        }
        await fetchBotStatus();
        startPolling();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Failed to start bot: ${msg}`);
        return false;
      } finally {
        setFundingStatus(null);
        setLoading(null);
      }
    },
    [fetchBotStatus, startPolling]
  );

  const stopBot = useCallback(async () => {
    setLoading("stop");
    setError(null);
    try {
      const res = await fetch(`${BOT_API_URL}/bot/stop`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || `HTTP ${res.status}`);
        return false;
      }
      await fetchBotStatus();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to stop bot: ${msg}`);
      return false;
    } finally {
      setLoading(null);
    }
  }, [fetchBotStatus]);

  // Fetch info and status on mount; resume polling if already running
  useEffect(() => {
    fetchBotInfo();
    fetchBotStatus().then((status) => {
      if (status?.is_running) {
        startPolling();
      } else {
        fetchLogs(); // Show any recent logs from previous session
      }
    });
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (logPollingRef.current) {
        clearInterval(logPollingRef.current);
        logPollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    botInfo,
    botStatus,
    logs,
    pendingWithdraw: botStatus?.pending_withdraw ?? null,
    loading,
    error,
    fundingStatus,
    fetchBotInfo,
    fetchBotStatus,
    fetchLogs,
    startBot,
    stopBot,
  };
}
