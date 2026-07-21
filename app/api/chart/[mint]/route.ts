import { NextRequest, NextResponse } from "next/server";
import { fetchTokenChart } from "@/lib/solanaTracker";
import { isValidSolanaAddress } from "@/lib/validate";
import { CHART_INTERVALS, isChartInterval } from "@/types/solana";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!isValidSolanaAddress(mint)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid Solana token mint address." },
      { status: 400 }
    );
  }

  const interval = request.nextUrl.searchParams.get("interval") ?? "1h";
  if (!isChartInterval(interval)) {
    return NextResponse.json(
      { error: `Invalid interval. Use one of: ${CHART_INTERVALS.join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const candles = await fetchTokenChart(mint, interval);
    return NextResponse.json({ candles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/chart/:mint]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
