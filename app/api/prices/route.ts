import { NextRequest } from "next/server";
import { badRequest, respond } from "@/lib/api";
import { fetchPrices, TTL } from "@/lib/solanaTracker";
import { parseMintList } from "@/lib/validate";
import { MAX_PRICE_MINTS } from "@/types/solana";

// Batched quotes for the watchlist: one upstream call for the whole list.
// GET /api/prices?mints=<mint>,<mint>,...
export async function GET(request: NextRequest) {
  const mints = parseMintList(request.nextUrl.searchParams.get("mints"), MAX_PRICE_MINTS);
  if (!mints) {
    return badRequest(
      `Pass "mints" as 1-${MAX_PRICE_MINTS} comma-separated, valid Solana token addresses.`
    );
  }

  return respond(
    "/api/prices",
    TTL.prices,
    () => fetchPrices(mints),
    (prices, fetchedAt) => ({ prices, fetchedAt })
  );
}
