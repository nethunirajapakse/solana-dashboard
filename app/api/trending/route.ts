import { NextRequest } from "next/server";
import { badRequest, respond } from "@/lib/api";
import { fetchTrendingTokens, TTL } from "@/lib/solanaTracker";
import { TRENDING_TIMEFRAMES, isTrendingTimeframe } from "@/types/solana";

export async function GET(request: NextRequest) {
  const timeframe = request.nextUrl.searchParams.get("timeframe") ?? "1h";

  // The timeframe becomes part of an upstream URL path, so only known
  // values are allowed through (free text would let a caller steer our
  // API key at other provider endpoints).
  if (!isTrendingTimeframe(timeframe)) {
    return badRequest(
      `Invalid timeframe. Use one of: ${TRENDING_TIMEFRAMES.join(", ")}.`
    );
  }

  return respond(
    "/api/trending",
    TTL.trending,
    () => fetchTrendingTokens(timeframe),
    (tokens, fetchedAt) => ({ timeframe, tokens, fetchedAt })
  );
}
