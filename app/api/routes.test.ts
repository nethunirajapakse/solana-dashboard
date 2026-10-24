// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as trending } from "@/app/api/trending/route";
import { GET as wallet } from "@/app/api/wallet/[address]/route";
import { GET as token } from "@/app/api/token/[mint]/route";
import { GET as chart } from "@/app/api/chart/[mint]/route";
import { GET as prices } from "@/app/api/prices/route";
import { GET as health } from "@/app/api/health/route";
import {
  ApiErrorSchema,
  CandlesResponseSchema,
  PricesResponseSchema,
  TokenResponseSchema,
  TrendingResponseSchema,
  WalletResponseSchema,
} from "@/lib/contracts";
import { resetCache } from "@/lib/upstream";

const MINT_A = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MINT_B = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";

// Minimal base58 encoder so tests can mint *valid* distinct addresses.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes: number[]): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}
const validMints = (n: number) =>
  Array.from({ length: n }, (_, i) => encodeBase58([1, i, ...Array<number>(30).fill(7)]));

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

function upstream(body: unknown, status = 200, headers?: HeadersInit) {
  const fetchMock = vi.fn().mockImplementation(
    async () => new Response(JSON.stringify(body), { status, headers })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetCache();
  process.env.SOLANA_TRACKER_API_KEY = "test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/trending", () => {
  it("returns a contract-valid response with CDN cache headers", async () => {
    upstream([{ token: { mint: MINT_A, name: "Alpha", symbol: "ALP" }, pools: [{ price: { usd: 2 } }] }]);
    const res = await trending(req("/api/trending?timeframe=6h"));

    expect(res.status).toBe(200);
    const body = TrendingResponseSchema.parse(await res.json());
    expect(body.timeframe).toBe("6h");
    expect(body.tokens[0]).toMatchObject({ mint: MINT_A, priceUsd: 2 });
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=120, stale-while-revalidate=600");
    expect(res.headers.get("x-cache")).toBe("MISS");
  });

  it("defaults to 1h", async () => {
    const fetchMock = upstream([]);
    await trending(req("/api/trending"));
    expect(fetchMock.mock.calls[0][0]).toContain("/tokens/trending/1h");
  });

  it("reports cache hits on repeat requests without calling the provider again", async () => {
    const fetchMock = upstream([]);
    await trending(req("/api/trending?timeframe=1h"));
    const second = await trending(req("/api/trending?timeframe=1h"));
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Regression: `timeframe` used to be interpolated into the upstream URL
  // path unchecked, letting a caller aim our API key at other endpoints.
  it.each([
    "../wallet/" + MINT_A,
    "1h/../../wallet/" + MINT_A,
    "1h?x=1",
    "",
    "banana",
    "1H",
  ])("rejects timeframe %j without calling the provider", async (timeframe) => {
    const fetchMock = upstream([]);
    const res = await trending(req(`/api/trending?timeframe=${encodeURIComponent(timeframe)}`));
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json()).error).toMatch(/Invalid timeframe/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes provider rate limiting through as 429 with Retry-After, uncached", async () => {
    upstream({ message: "too many" }, 429, { "retry-after": "7" });
    const res = await trending(req("/api/trending"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 with a clear message when the server has no API key", async () => {
    delete process.env.SOLANA_TRACKER_API_KEY;
    const res = await trending(req("/api/trending"));
    expect(res.status).toBe(503);
    expect(ApiErrorSchema.parse(await res.json()).error).toMatch(/API key/);
  });
});

describe("GET /api/wallet/[address]", () => {
  it("returns the contract-valid wallet", async () => {
    upstream({ total: 10, tokens: [{ token: { mint: MINT_A, name: "A", symbol: "A" }, balance: 1, value: 10 }] });
    const res = await wallet(req("/x"), ctx({ address: MINT_B }));
    expect(res.status).toBe(200);
    expect(WalletResponseSchema.parse(await res.json()).wallet.tokens).toHaveLength(1);
  });

  it("rejects invalid addresses without calling the provider", async () => {
    const fetchMock = upstream({});
    const res = await wallet(req("/x"), ctx({ address: "../../etc/passwd" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an unknown address to 404", async () => {
    upstream({ message: "Not found" }, 404);
    const res = await wallet(req("/x"), ctx({ address: MINT_B }));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/token/[mint]", () => {
  it("returns the contract-valid token", async () => {
    upstream({ token: { mint: MINT_A, name: "Alpha", symbol: "ALP" }, pools: [{ price: { usd: 1 } }] });
    const res = await token(req("/x"), ctx({ mint: MINT_A }));
    expect(TokenResponseSchema.parse(await res.json()).token.name).toBe("Alpha");
  });

  it("rejects invalid mints", async () => {
    upstream({});
    expect((await token(req("/x"), ctx({ mint: "nope" }))).status).toBe(400);
  });
});

describe("GET /api/chart/[mint]", () => {
  it("returns contract-valid candles", async () => {
    upstream({ oclhv: [{ time: 1, open: 1, high: 2, low: 1, close: 2 }] });
    const res = await chart(req("/api/chart/x?interval=4h"), ctx({ mint: MINT_A }));
    const { candles } = CandlesResponseSchema.parse(await res.json());
    expect(candles[0]).toMatchObject({ time: 1, volume: 0 });
    expect(candles.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects unknown intervals and invalid mints", async () => {
    const fetchMock = upstream({});
    expect((await chart(req("/api/chart/x?interval=1s"), ctx({ mint: MINT_A }))).status).toBe(400);
    expect((await chart(req("/api/chart/x"), ctx({ mint: "bad" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/prices", () => {
  it("returns batched quotes using a single upstream call", async () => {
    const fetchMock = upstream({ [MINT_A]: { price: 5 }, [MINT_B]: { price: 6 } });
    const res = await prices(req(`/api/prices?mints=${MINT_A},${MINT_B}`));
    expect(res.status).toBe(200);
    expect(Object.keys(PricesResponseSchema.parse(await res.json()).prices)).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts exactly the maximum number of mints (50)", async () => {
    const mints = validMints(50);
    expect(mints.every((m) => m.length >= 32 && m.length <= 44)).toBe(true);
    const fetchMock = upstream({});
    const res = await prices(req(`/api/prices?mints=${mints.join(",")}`));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects 51 valid mints", async () => {
    const fetchMock = upstream({});
    const res = await prices(req(`/api/prices?mints=${validMints(51).join(",")}`));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", ""],
    ["empty", "?mints="],
    ["invalid mint", `?mints=${MINT_A},nope`],
  ])("rejects %s", async (_label, query) => {
    const fetchMock = upstream({});
    const res = await prices(req(`/api/prices${query}`));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/health", () => {
  it("is ok when configured and degraded when not, without calling the provider", async () => {
    const fetchMock = upstream({});
    const ok = await health();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ status: "ok", apiKeyConfigured: true });

    delete process.env.SOLANA_TRACKER_API_KEY;
    const degraded = await health();
    expect(degraded.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
