// Shared response helpers for the /api routes, so every route reports
// success, cache state and failure the same way.

import { NextResponse } from "next/server";
import { UpstreamError } from "@/lib/upstream";
import type { Cached } from "@/lib/upstream";

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: noStore() });
}

function noStore(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

/**
 * Run a cached upstream call and shape the HTTP response.
 *  - success: `build` makes the body; Cache-Control lets the CDN absorb
 *    repeat traffic for `ttlSeconds` (and serve stale while revalidating)
 *  - failure: provider errors keep their meaningful status (404/429/504...),
 *    anything unexpected becomes a generic 500. Errors are never cached.
 */
export async function respond<T, B extends object>(
  label: string,
  ttlSeconds: number,
  run: () => Promise<Cached<T>>,
  build: (value: T, fetchedAt: number) => B
): Promise<NextResponse> {
  try {
    const { value, fetchedAt, status } = await run();
    return NextResponse.json(build(value, fetchedAt), {
      headers: {
        "Cache-Control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 5}`,
        "X-Cache": status,
      },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      const headers: Record<string, string> = { ...(noStore() as Record<string, string>) };
      if (err.retryAfterSeconds) headers["Retry-After"] = String(err.retryAfterSeconds);
      return NextResponse.json({ error: err.message }, { status: err.status, headers });
    }
    console.error(`[${label}] unexpected error`, err);
    return NextResponse.json(
      { error: "Something went wrong on our side." },
      { status: 500, headers: noStore() }
    );
  }
}
