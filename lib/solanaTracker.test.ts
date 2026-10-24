// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPrices,
  fetchTokenChart,
  fillGaps,
  fetchTokenDetails,
  fetchTrendingTokens,
  fetchWalletPortfolio,
  normalizeCandles,
  normalizeTrendingToken,
} from "@/lib/solanaTracker";
import { resetCache } from "@/lib/upstream";

const WSOL = "So11111111111111111111111111111111111111112";
const MINT_A = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MINT_B = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";

function mockUpstream(body: unknown) {
  const fetchMock = vi.fn().mockImplementation(
    async () => new Response(JSON.stringify(body), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetCache();
  process.env.SOLANA_TRACKER_API_KEY = "test-key";
  delete process.env.SOLANA_TRACKER_BASE_URL;
});
afterEach(() => vi.unstubAllGlobals());

describe("normalizeTrendingToken", () => {
  it("flattens token, first pool and events", () => {
    expect(
      normalizeTrendingToken({
        token: { mint: MINT_A, name: "Alpha", symbol: "ALP", image: "https://img/a.png" },
        pools: [
          { price: { usd: 1.5 }, liquidity: { usd: 100 }, marketCap: { usd: 5000 } },
          { price: { usd: 999 } },
        ],
        events: { "1h": { priceChangePercentage: 2 }, "24h": { priceChangePercentage: -7.5 } },
      })
    ).toEqual({
      mint: MINT_A,
      name: "Alpha",
      symbol: "ALP",
      image: "https://img/a.png",
      priceUsd: 1.5,
      change1h: 2,
      change24h: -7.5,
      marketCapUsd: 5000,
      liquidityUsd: 100,
    });
  });

  it("degrades to nulls/placeholders when fields are missing", () => {
    expect(normalizeTrendingToken({ token: { mint: MINT_A } })).toEqual({
      mint: MINT_A,
      name: "Unknown token",
      symbol: "?",
      image: null,
      priceUsd: null,
      change1h: null,
      change24h: null,
      marketCapUsd: null,
      liquidityUsd: null,
    });
  });

  it("drops entries without a mint and non-finite numbers", () => {
    expect(normalizeTrendingToken({ token: { name: "No mint" } })).toBeNull();
    const t = normalizeTrendingToken({
      token: { mint: MINT_A },
      pools: [{ price: { usd: Number.NaN } }],
    });
    expect(t?.priceUsd).toBeNull();
  });
});

describe("normalizeCandles", () => {
  it("drops malformed rows, de-duplicates by time (last wins) and sorts ascending", () => {
    const out = normalizeCandles([
      { time: 300, open: 3, high: 3, low: 3, close: 3 },
      { time: 100, open: 1, high: 1, low: 1, close: 1 },
      { time: 100, open: 9, high: 9, low: 9, close: 9 },
      { time: 200, open: 2, high: 2, low: 2 }, // missing close
      { time: Number.NaN, open: 1, high: 1, low: 1, close: 1 },
      { open: 1, high: 1, low: 1, close: 1 }, // missing time
    ]);
    expect(out.map((c) => [c.time, c.open])).toEqual([
      [100, 9],
      [300, 3],
    ]);
    expect(out.every((c) => c.volume === 0)).toBe(true);
  });
});

describe("fillGaps", () => {
  const c = (time: number, close: number, volume = 5) => ({ time, open: close, high: close, low: close, close, volume });

  it("fills empty intervals with flat candles at the previous close, zero volume", () => {
    const out = fillGaps([c(0, 1), c(300 * 3, 2)], 300, 300 * 3);
    expect(out.map((x) => x.time)).toEqual([0, 300, 600, 900]);
    expect(out[1]).toEqual({ time: 300, open: 1, high: 1, low: 1, close: 1, volume: 0 });
    expect(out[2].close).toBe(1);
    expect(out[3].close).toBe(2);
  });

  it("carries the series forward to the current interval", () => {
    const out = fillGaps([c(0, 7)], 300, 300 * 4 + 120);
    expect(out.map((x) => x.time)).toEqual([0, 300, 600, 900, 1200]);
    expect(out.at(-1)).toMatchObject({ close: 7, volume: 0 });
  });

  it("leaves contiguous data untouched and handles empty input", () => {
    const data = [c(0, 1), c(300, 2), c(600, 3)];
    expect(fillGaps(data, 300, 600)).toEqual(data);
    expect(fillGaps([], 300, 600)).toEqual([]);
  });

  it("refuses to fill an absurd span (provider ignoring the time window)", () => {
    const data = [c(0, 1), c(300 * 10_000, 2)];
    expect(fillGaps(data, 300, 300 * 10_000)).toBe(data);
  });
});

describe("fetchTrendingTokens", () => {
  it("requests the chosen timeframe and caches the result", async () => {
    const fetchMock = mockUpstream([{ token: { mint: MINT_A, name: "A", symbol: "A" } }]);
    const first = await fetchTrendingTokens("6h");
    const second = await fetchTrendingTokens("6h");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://data.solanatracker.io/tokens/trending/6h");
    expect(first.value).toHaveLength(1);
    expect(second.status).toBe("HIT");
  });

  it("caches each timeframe separately", async () => {
    const fetchMock = mockUpstream([]);
    await fetchTrendingTokens("1h");
    await fetchTrendingTokens("24h");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list if the provider sends a non-array", async () => {
    mockUpstream({ unexpected: true });
    expect((await fetchTrendingTokens("1h")).value).toEqual([]);
  });
});

describe("fetchWalletPortfolio", () => {
  it("separates SOL from SPL tokens and reads totals", async () => {
    mockUpstream({
      total: 300,
      tokens: [
        { token: { mint: WSOL, name: "Wrapped SOL", symbol: "SOL" }, balance: 2, value: 200 },
        { token: { mint: MINT_A, name: "Alpha", symbol: "ALP" }, balance: 10, value: 100 },
        { token: { name: "no mint" }, balance: 1 },
      ],
    });
    const { value } = await fetchWalletPortfolio(MINT_B);
    expect(value).toEqual({
      address: MINT_B,
      solBalance: 2,
      solValueUsd: 200,
      totalValueUsd: 300,
      tokens: [{ mint: MINT_A, name: "Alpha", symbol: "ALP", amount: 10, valueUsd: 100 }],
    });
  });

  it("handles an empty/odd response without throwing", async () => {
    mockUpstream({});
    const { value } = await fetchWalletPortfolio(MINT_B);
    expect(value).toMatchObject({ solBalance: 0, solValueUsd: null, totalValueUsd: null, tokens: [] });
  });
});

describe("fetchTokenDetails", () => {
  it("normalises the token and its primary pool", async () => {
    mockUpstream({
      token: { mint: MINT_A, name: "Alpha", symbol: "ALP" },
      pools: [{ price: { usd: 0.00002 }, marketCap: { usd: 20000 }, liquidity: { usd: 900 } }],
      events: { "24h": { priceChangePercentage: 12.5 } },
    });
    const { value } = await fetchTokenDetails(MINT_A);
    expect(value).toMatchObject({ priceUsd: 0.00002, change24h: 12.5, marketCapUsd: 20000, liquidityUsd: 900 });
  });
});

describe("fetchPrices", () => {
  it("makes ONE batched request, sorted, with price changes", async () => {
    const fetchMock = mockUpstream({
      [MINT_A]: { price: 2, marketCap: 10, liquidity: 5, priceChanges: { "24h": { priceChangePercentage: 4 } } },
      [MINT_B]: { price: 3 },
    });
    const { value } = await fetchPrices([MINT_B, MINT_A]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sorted = [MINT_A, MINT_B].sort().join(",");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://data.solanatracker.io/price/multi?tokens=${sorted}&priceChanges=true`
    );
    expect(value[MINT_A]).toEqual({ mint: MINT_A, priceUsd: 2, change24h: 4, marketCapUsd: 10, liquidityUsd: 5 });
    expect(value[MINT_B]).toMatchObject({ priceUsd: 3, change24h: null });
  });

  it("omits mints the provider doesn't know instead of failing", async () => {
    mockUpstream({ [MINT_A]: { price: 1 } });
    const { value } = await fetchPrices([MINT_A, MINT_B]);
    expect(Object.keys(value)).toEqual([MINT_A]);
  });

  it("shares a cache entry regardless of mint order", async () => {
    const fetchMock = mockUpstream({});
    await fetchPrices([MINT_A, MINT_B]);
    await fetchPrices([MINT_B, MINT_A]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchTokenChart (1m)", () => {
  it("supports the 1m interval with a 6h window and fills quiet minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_020 * 1000));
    const bucket = Math.floor(1_000_020 / 60) * 60;
    const fetchMock = mockUpstream({
      oclhv: [{ time: bucket - 180, open: 1, high: 1, low: 1, close: 1, volume: 3 }],
    });
    const { value } = await fetchTokenChart(MINT_B, "1m");
    vi.useRealTimers();

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("type")).toBe("1m");
    expect(Number(url.searchParams.get("time_to")) - Number(url.searchParams.get("time_from"))).toBe(6 * 3600);
    expect(value.map((c) => c.time)).toEqual([bucket - 180, bucket - 120, bucket - 60, bucket]);
  });
});

describe("fetchTokenChart", () => {
  it("asks for an explicit time window, then normalises, keeps volume and fills gaps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000 * 1000)); // now = 1,000,000s
    const bucket = Math.floor(1_000_000 / 900) * 900; // current 15m bucket
    const fetchMock = mockUpstream({
      oclhv: [
        { time: bucket - 1800, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
        { time: bucket - 900 * 3, open: 1, high: 1, low: 1, close: 1 }, // earlier, no volume
      ],
    });
    const { value } = await fetchTokenChart(MINT_A, "15m");
    vi.useRealTimers();

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe(`/chart/${MINT_A}`);
    expect(url.searchParams.get("type")).toBe("15m");
    expect(Number(url.searchParams.get("time_to"))).toBe(1_000_000);
    expect(Number(url.searchParams.get("time_from"))).toBe(1_000_000 - 5 * 86_400);

    const times = value.map((c) => c.time);
    expect(times).toEqual([bucket - 2700, bucket - 1800, bucket - 900, bucket]); // sorted + gaps filled to now
    expect(value[0].volume).toBe(0); // missing volume defaults to 0
    expect(value[1].volume).toBe(10);
    expect(value[3]).toMatchObject({ close: 1.5, volume: 0 }); // flat carry-forward
  });
});
