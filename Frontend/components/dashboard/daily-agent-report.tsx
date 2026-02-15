"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

type Resp = {
  totals: {
    date: string;
    wallet: string;
    total_trades: number;
    buy_count: number;
    sell_count: number;
    confirmed_count: number;
    pending_count: number;
    failed_count: number;
    buy_volume_wei: string;
    sell_volume_wei: string;
  };
  report: {
    headline: string;
    one_liner: string;
    highlights: string[];
    kpis: { label: string; value: string }[];
    risks: string[];
    next_steps: string[];
    confidence: number;
  };
};

export function DailyAgentReportCard() {
  const { address } = useAccount();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const date = new Date().toISOString().slice(0, 10);

  const refresh = async () => {
    if (!address) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/insights?wallet=${address}&date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch report");
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const redactWallets = (text: string) =>
    text.replace(/0x[a-fA-F0-9]{10,}/g, "agent wallet");

  const exportPdf = () => {
    if (!data) return;

    const esc = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const list = (items: string[]) =>
      items?.length
        ? `<ul>${items.map((i) => `<li>${esc(redactWallets(i))}</li>`).join("")}</ul>`
        : "<p>None</p>";

    const kpisHtml = data.report.kpis?.length
      ? data.report.kpis
          .map((k) => `<tr><td>${esc(redactWallets(k.label))}</td><td>${esc(redactWallets(k.value))}</td></tr>`)
          .join("")
      : `
        <tr><td>Trades</td><td>${data.totals.total_trades}</td></tr>
        <tr><td>BUY</td><td>${data.totals.buy_count}</td></tr>
        <tr><td>SELL</td><td>${data.totals.sell_count}</td></tr>
        <tr><td>Confirmed</td><td>${data.totals.confirmed_count}</td></tr>
      `;

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Daily Agent Report - ${esc(data.totals.date)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111; }
          h1 { margin: 0 0 8px 0; font-size: 24px; }
          .muted { color: #555; margin-bottom: 16px; }
          .section { margin-top: 18px; }
          .section h2 { font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.04em; color: #333; }
          table { border-collapse: collapse; width: 100%; }
          td { border: 1px solid #ddd; padding: 8px; font-size: 13px; }
          ul { margin: 0; padding-left: 18px; }
          li { margin: 4px 0; }
        </style>
      </head>
      <body>
        <h1>${esc(redactWallets(data.report.headline || "Daily Agent Report"))}</h1>
        <div class="muted">${esc(redactWallets(data.report.one_liner || ""))}</div>
        <div class="muted">Date: ${esc(data.totals.date)} | Confidence: ${Math.round((data.report.confidence ?? 0.6) * 100)}%</div>

        <div class="section">
          <h2>KPIs</h2>
          <table>${kpisHtml}</table>
        </div>

        <div class="section">
          <h2>Highlights</h2>
          ${list(data.report.highlights || [])}
        </div>

        <div class="section">
          <h2>Risks</h2>
          ${list(data.report.risks || [])}
        </div>

        <div class="section">
          <h2>Next Steps</h2>
          ${list(data.report.next_steps || [])}
        </div>
      </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  useEffect(() => {
    if (address) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <div className="text-sm font-semibold">Agent Daily Report</div>
          <div className="text-xs text-muted-foreground">{date}</div>
        </div>
        <button
          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <button
          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          onClick={exportPdf}
          disabled={!data || loading}
        >
          Export PDF
        </button>
      </div>

      <div className="px-5 py-4">
        {!address ? (
          <div className="text-sm text-muted-foreground">Connect your wallet to view the report.</div>
        ) : err ? (
          <div className="text-sm text-destructive">{err}</div>
        ) : !data ? (
          <div className="text-sm text-muted-foreground">Generating report…</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{redactWallets(data.report.headline)}</div>
                <div className="mt-1 text-sm text-muted-foreground">{redactWallets(data.report.one_liner)}</div>
              </div>
              <div className="rounded-full border px-3 py-1 text-xs font-semibold">
                Confidence: {Math.round((data.report.confidence ?? 0.6) * 100)}%
              </div>
            </div>

            {/* KPIs (Gemini-generated, fallback to totals) */}
            {data.report.kpis?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.report.kpis.slice(0, 8).map((k, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">{redactWallets(k.label)}</div>
                    <div className="text-lg font-semibold">{redactWallets(k.value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MiniKpi label="Trades" value={String(data.totals.total_trades)} />
                <MiniKpi label="BUY" value={String(data.totals.buy_count)} />
                <MiniKpi label="SELL" value={String(data.totals.sell_count)} />
                <MiniKpi label="Confirmed" value={String(data.totals.confirmed_count)} />
              </div>
            )}

            {data.report.highlights?.length ? (
              <Section title="Highlights">
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {data.report.highlights.map((h, i) => <li key={i}>{redactWallets(h)}</li>)}
                </ul>
              </Section>
            ) : null}

            {data.report.risks?.length ? (
              <Section title="Risks / Issues">
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {data.report.risks.map((r, i) => <li key={i}>{redactWallets(r)}</li>)}
                </ul>
              </Section>
            ) : null}

            {data.report.next_steps?.length ? (
              <Section title="Next Steps">
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {data.report.next_steps.map((n, i) => <li key={i}>{redactWallets(n)}</li>)}
                </ul>
              </Section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
