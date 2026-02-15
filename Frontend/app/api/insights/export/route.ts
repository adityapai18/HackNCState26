import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * POST /api/insights/export — body: { totals, report } (from GET /api/insights).
 * Returns Gemini-generated HTML for printable PDF (open in new window → print).
 */
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

  let data: { totals?: unknown; report?: unknown };
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `You are generating a single HTML document for a printable PDF report. Use only inline styles (no external CSS). The document must be self-contained.

Given this report data, output a complete HTML document (starting with <!DOCTYPE html>) that includes:
1. A clear title (headline)
2. A one-liner summary
3. A table of KPIs (label + value)
4. Sections for Highlights, Risks, and Next Steps as lists
5. A footer line: "Report generated with Google Gemini"

Data:
${JSON.stringify(data, null, 2)}

Output ONLY the raw HTML, no markdown code fence or explanation.`;

  const result = await model.generateContent(prompt);
  const html = result.response.text()?.trim() || "";

  if (!html.toLowerCase().includes("<!doctype") && !html.toLowerCase().includes("<html")) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Agent Report</title></head><body><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre><p>Report generated with Google Gemini.</p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
