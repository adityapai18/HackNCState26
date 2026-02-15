"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { RefreshCw, FileDown } from "lucide-react";

type Totals = {
  date?: string;
  range_label?: string;
  wallet: string;
  total_trades: number;
  buy_count: number;
  sell_count: number;
  confirmed_count: number;
  pending_count: number;
  failed_count: number;
  buy_volume_wei: string;
  sell_volume_wei: string;
  operational_runs?: number;
};

type Report = {
  headline: string;
  one_liner: string;
  highlights: string[];
  kpis: { label: string; value: string }[];
  risks: string[];
  next_steps: string[];
  confidence: number;
};

type Resp = {
  totals: Totals;
  report?: Report;
};

const RANGES = [
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "12h", label: "Last 12 hours" },
] as const;

export function DailyAgentReportCard() {
  const { address } = useAccount();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<"1h" | "6h" | "12h">("1h");

  const fetchReport = async (rangeParam: string) => {
    if (!address) return;
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({
        wallet: address,
        refresh: "1",
      });
      if (rangeParam) params.set("range", rangeParam);
      else params.set("date", new Date().toISOString().slice(0, 10));

      const res = await fetch(`/api/insights?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch report");
      setData(json);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => void fetchReport(range);

  useEffect(() => {
    if (address) fetchReport(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, range]);

  const totals = data?.totals;
  const totalTrades = totals?.total_trades ?? 0;
  const successRate =
    totalTrades > 0
      ? Math.round(((totals?.confirmed_count ?? 0) / totalTrades) * 100)
      : 100;
  const buyWei = BigInt(totals?.buy_volume_wei ?? "0");
  const sellWei = BigInt(totals?.sell_volume_wei ?? "0");
  const netWei = buyWei - sellWei;
  const netWeiStr =
    netWei >= 0n ? `+${netWei.toString()} WEI` : `${netWei.toString()} WEI`;

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range;
  const report = data?.report;

  const [exporting, setExporting] = useState(false);
  const exportPdf = async () => {
    if (!data?.totals) return;
    setExporting(true);
    try {
      const res = await fetch("/api/insights/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totals: data.totals, report: data.report ?? null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const html = await res.text();
      const w = window.open("", "_blank", "width=900,height=1200");
      if (!w) return;
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    } catch (e) {
      console.error("Export failed:", e);
      setErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-nowrap items-center gap-2 border-b px-4 py-3">
        <span className="shrink-0 text-sm font-semibold">Agent Report</span>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as "1h" | "6h" | "12h")}
          disabled={loading}
          className="shrink-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            onClick={exportPdf}
            disabled={!data?.totals || loading || exporting}
          >
            {exporting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {exporting ? "Generating…" : "Export PDF"}
          </button>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-50"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh report"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {!address ? (
          <p className="text-sm text-muted-foreground">Connect your wallet to view the report.</p>
        ) : err ? (
          <p className="text-sm text-destructive">{err}</p>
        ) : !totals ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Kpi label="Total Trades Executed" value={String(totals.total_trades)} />
            <Kpi label="Execution Success Rate" value={`${successRate}%`} />
            <Kpi
              label="Buy-to-Sell Ratio"
              value={`${totals.buy_count} BUYs / ${totals.sell_count} SELLs`}
            />
            <Kpi label="Net Asset Flow (WEI)" value={netWeiStr} />
            <Kpi
              label="Operational Runs"
              value={String(totals.operational_runs ?? 0)}
              className="sm:col-span-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border/60 bg-muted/20 px-3 py-2 ${className}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
