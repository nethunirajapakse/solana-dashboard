import { NextRequest } from "next/server";
import { badRequest, respond } from "@/lib/api";
import { fetchTokenChart, TTL } from "@/lib/solanaTracker";
import { isValidSolanaAddress } from "@/lib/validate";
import { CHART_INTERVALS, isChartInterval } from "@/types/solana";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!isValidSolanaAddress(mint)) {
    return badRequest("That doesn't look like a valid Solana token mint address.");
  }

  const interval = request.nextUrl.searchParams.get("interval") ?? "1h";
  if (!isChartInterval(interval)) {
    return badRequest(`Invalid interval. Use one of: ${CHART_INTERVALS.join(", ")}.`);
  }

  return respond(
    "/api/chart/:mint",
    TTL.chart[interval],
    () => fetchTokenChart(mint, interval),
    (candles, fetchedAt) => ({ candles, fetchedAt })
  );
}
