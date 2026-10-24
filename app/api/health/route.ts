import { NextResponse } from "next/server";

// Liveness probe for uptime monitors / container orchestrators.
// Deliberately does NOT call the data provider (that would spend quota on
// every probe); it only reports whether the server is configured to.
export const dynamic = "force-dynamic";

export function GET() {
  const configured = Boolean(process.env.SOLANA_TRACKER_API_KEY);
  return NextResponse.json(
    { status: configured ? "ok" : "degraded", apiKeyConfigured: configured },
    { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
