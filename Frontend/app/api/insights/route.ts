import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectPromise: Promise<unknown> | null = null;

function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.VALKEY_URL || "redis://localhost:6379",
    });
  }
  if (!redisClient.isOpen) {
    if (!redisConnectPromise) {
      redisConnectPromise = redisClient.connect().finally(() => {
        redisConnectPromise = null;
      });
    }
    return redisConnectPromise.then(() => redisClient as ReturnType<typeof createClient>);
  }
  return Promise.resolve(redisClient);
}

function parseGeminiJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

function boundsForDay(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`).getTime();
  const end = new Date(`${dateStr}T23:59:59.999`).getTime();
  return { start, end };
}

const RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
};

function boundsForRange(range: string) {
  const ms = RANGE_MS[range] ?? RANGE_MS["1h"];
  const end = Date.now();
  const start = end - ms;
  return { start, end };
}

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const range = req.nextUrl.searchParams.get("range")?.toLowerCase(); // "1h" | "6h" | "12h"
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

  const useRange = range && RANGE_MS[range];
  const { start, end } = useRange ? boundsForRange(range) : boundsForDay(date);
  const cacheKey = useRange
    ? `report:${wallet}:${range}:${Math.floor(start / 60000)}`
    : `daily_report:${wallet}:${date}`;

  const rangeLabel = useRange
    ? (range === "1h" ? "Last 1 hour" : range === "6h" ? "Last 6 hours" : "Last 12 hours")
    : null;

  let buyCount = 0, sellCount = 0, confirmed = 0, pending = 0, failed = 0;
  let buyWei = 0n, sellWei = 0n;
  let totalTrades = 0, operationalRuns = 0;
  const sampleTrades: any[] = [];
  const maxSamples = 30;

  let redis: Awaited<ReturnType<typeof getRedis>> | null = null;
  try {
    redis = await getRedis();
  } catch {
    // Redis unavailable (no VALKEY_URL / not running); use zeros from DB below
  }

  if (redis) {
    try {
      if (!forceRefresh) {
        const cached = await redis.get(cacheKey);
        if (cached) return NextResponse.json(JSON.parse(cached));
      }

      const tradeIds = await redis.zRangeByScore(`user:${wallet}:trades`, start, end);
      totalTrades = tradeIds.length;
      const runIds = new Set<string>();

      for (const tradeKey of tradeIds) {
        try {
          const t = await redis!.hGetAll(tradeKey);
          const side = (t.side || "").toUpperCase();
          const status = (t.status || "").toUpperCase();
          const amountWei = BigInt(t.amount_wei || "0");

          if (side === "BUY") { buyCount++; buyWei += amountWei; }
          else if (side === "SELL") { sellCount++; sellWei += amountWei; }

          if (status === "CONFIRMED") confirmed++;
          else if (status === "PENDING") pending++;
          else if (status === "FAILED") failed++;

          const rid = (t.run_id || tradeKey).trim();
          if (rid) runIds.add(rid);

          if (sampleTrades.length < maxSamples) {
            sampleTrades.push({
              side,
              amount_wei: t.amount_wei || "0",
              status,
              tx_ref: t.tx_ref || "",
              ts: t.ts || "",
              run_id: t.run_id || "",
              to_wallet: t.to_wallet || "",
            });
          }
        } catch {
          // skip bad trade key
        }
      }
      operationalRuns = runIds.size || (totalTrades > 0 ? 1 : 0);
    } catch {
      // Redis read failed; keep zeros
    }
  }

  const totals = {
    date: useRange ? "" : date,
    range_label: rangeLabel ?? undefined,
    wallet,
    total_trades: totalTrades,
    buy_count: buyCount,
    sell_count: sellCount,
    confirmed_count: confirmed,
    pending_count: pending,
    failed_count: failed,
    buy_volume_wei: buyWei.toString(),
    sell_volume_wei: sellWei.toString(),
    operational_runs: operationalRuns,
  };

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

  const periodDesc = useRange ? rangeLabel! : date;

  const prompt = `
You are generating a "Daily Annual-Report Style" summary for a crypto trading agent.
Make it engaging and demo-friendly for a hackathon.

Write a report for ${periodDesc} based on the totals + sample trades.
Be specific: mention counts, flow (BUY/SELL), success vs failures, and any anomalies.

Return ONLY valid JSON with this schema:
{
  "headline": string,
  "one_liner": string,
  "highlights": string[],
  "kpis": [{"label": string, "value": string}],
  "risks": string[],
  "next_steps": string[],
  "confidence": number
}

Data:
${JSON.stringify({ totals, sample_trades: sampleTrades }, null, 2)}
`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let report;
  try {
    report = parseGeminiJson(text);
  } catch {
    report = {
      headline: `Agent Report — ${periodDesc}`,
      one_liner: text || "Summary based on trade data.",
      highlights: [],
      kpis: [],
      risks: [],
      next_steps: [],
      confidence: 0.6,
    };
  }

  const response = { totals, report };

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(response), { EX: useRange ? 300 : 600 });
    } catch {
      // ignore cache write failure
    }
  }

  return NextResponse.json(response);
}
