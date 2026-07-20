import { NextRequest, NextResponse } from "next/server";
import { fetchTrendingTokens } from "@/lib/solanaTracker";

export async function GET(request: NextRequest) {
  const timeframe = request.nextUrl.searchParams.get("timeframe") ?? "1h";

  try {
    const tokens = await fetchTrendingTokens(timeframe);
    return NextResponse.json({ tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/trending]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
