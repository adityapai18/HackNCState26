"use client";

import { useMemo } from "react";
import type { VaultEvent } from "./useSessionKeys";

export interface BalanceSnapshot {
  time: string;
  balance: number;
}

export interface WithdrawBar {
  time: string;
  amount: number;
}

export interface PingDot {
  time: string;
  count: number;
}

export function useVaultHistory(events: VaultEvent[], currentBalanceWei: bigint | null) {
  const balanceSnapshots = useMemo<BalanceSnapshot[]>(() => {
    if (events.length === 0) return [];
    let running = 0;
    const snaps: BalanceSnapshot[] = [];
    for (const e of events) {
      const t = new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (e.type === "deposit" && e.amountWei) {
        running += Number(e.amountWei);
      } else if (e.type === "withdraw" && e.amountWei) {
        running -= Number(e.amountWei);
      }
      snaps.push({ time: t, balance: running });
    }
    return snaps;
  }, [events]);

  const withdrawBars = useMemo<WithdrawBar[]>(() => {
    return events
      .filter((e) => e.type === "withdraw" && e.amountWei)
      .map((e) => ({
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        amount: Number(e.amountWei!),
      }));
  }, [events]);

  const pingDots = useMemo<PingDot[]>(() => {
    let count = 0;
    return events
      .filter((e) => e.type === "ping")
      .map((e) => {
        count += 1;
        return {
          time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          count,
        };
      });
  }, [events]);

  return { balanceSnapshots, withdrawBars, pingDots };
}
