import { NextRequest, NextResponse } from "next/server";

// In-memory store for the latest session key (shared across requests in same process)
let latestSessionKey: { sessionKeyAddress: string; smartAccountAddress?: string; updatedAt: number } | null = null;

export async function GET() {
  if (!latestSessionKey) {
    return NextResponse.json({ sessionKeyAddress: null, smartAccountAddress: null });
  }
  return NextResponse.json({
    sessionKeyAddress: latestSessionKey.sessionKeyAddress,
    smartAccountAddress: latestSessionKey.smartAccountAddress ?? null,
    updatedAt: latestSessionKey.updatedAt,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionKeyAddress = body.sessionKeyAddress as string | undefined;
    const smartAccountAddress = body.smartAccountAddress as string | undefined;

    if (!sessionKeyAddress || typeof sessionKeyAddress !== "string") {
      return NextResponse.json(
        { error: "sessionKeyAddress is required" },
        { status: 400 }
      );
    }

    // Basic validation: should look like an Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(sessionKeyAddress)) {
      return NextResponse.json(
        { error: "Invalid sessionKeyAddress format" },
        { status: 400 }
      );
    }

    latestSessionKey = {
      sessionKeyAddress,
      smartAccountAddress,
      updatedAt: Date.now(),
    };

    return NextResponse.json({
      ok: true,
      sessionKeyAddress,
      smartAccountAddress: smartAccountAddress ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
