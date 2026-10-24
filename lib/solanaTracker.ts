import type {
  Candle,
  ChartInterval,
  PriceQuote,
  TokenDetails,
  TrendingTimeframe,
  TrendingToken,
  WalletData,
} from "@/types/solana";
import { cached, trackerFetch } from "@/lib/upstream";
import type { Cached } from "@/lib/upstream";

const SOL_MINT = "So11111111111111111111111111111111111111112";

// Cache lifetimes (seconds). Chosen against the provider's free-plan quota
// (10k requests/month): data that moves slowly gets a longer TTL.
export const TTL = {
  trending: 120,
  token: 60,
  wallet: 60,
  prices: 30,
  chart: { "1m": 30, "5m": 60, "15m": 120, "1h": 300, "4h": 600, "1d": 900 } as Record<
    ChartInterval,
    number
  >,
} as const;

/** Defensive numeric read: upstream fields can be missing, null or NaN. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// --- Shared raw shapes --------------------------------------------------

// Different tokens can have missing pools/events, so every field below is
// read defensively rather than assumed to exist.
interface RawTokenMeta {
  name?: string;
  symbol?: string;
  mint?: string;
  image?: string;
}

interface RawPool {
  price?: { usd?: number };
  liquidity?: { usd?: number };
  marketCap?: { usd?: number };
}

interface RawEvents {
  "1h"?: { priceChangePercentage?: number };
  "24h"?: { priceChangePercentage?: number };
}

// --- Trending tokens -------------------------------------------------

// The raw /tokens/trending/:timeframe response is an array of
// { token, pools: [...], events: { "24h": { priceChangePercentage } } }.
interface RawTrendingEntry {
  token?: RawTokenMeta;
  pools?: RawPool[];
  events?: RawEvents;
}

export function normalizeTrendingToken(raw: RawTrendingEntry): TrendingToken | null {
  const mint = raw.token?.mint;
  if (!mint) return null;

  // Pools come back ordered by liquidity, so the first entry carries the
  // reference price/market cap.
  const primaryPool = raw.pools?.[0];

  return {
    mint,
    name: raw.token?.name ?? "Unknown token",
    symbol: raw.token?.symbol ?? "?",
    image: raw.token?.image ?? null,
    priceUsd: num(primaryPool?.price?.usd),
    change1h: num(raw.events?.["1h"]?.priceChangePercentage),
    change24h: num(raw.events?.["24h"]?.priceChangePercentage),
    marketCapUsd: num(primaryPool?.marketCap?.usd),
    liquidityUsd: num(primaryPool?.liquidity?.usd),
  };
}

/**
 * `timeframe` is interpolated into the upstream URL path, so callers MUST
 * pass a value already checked with isTrendingTimeframe().
 */
export function fetchTrendingTokens(
  timeframe: TrendingTimeframe
): Promise<Cached<TrendingToken[]>> {
  return cached(`trending:${timeframe}`, TTL.trending, async () => {
    const raw = (await trackerFetch(`/tokens/trending/${timeframe}`)) as RawTrendingEntry[];
    if (!Array.isArray(raw)) return [];
    return raw
      .map(normalizeTrendingToken)
      .filter((t): t is TrendingToken => t !== null);
  });
}

// --- Wallet portfolio --------------------------------------------------

// Raw /wallet/:address response:
// { total: number, tokens: [{ token: { mint, name, symbol }, balance: number, value: number }] }
interface RawWalletHolding {
  token?: { mint?: string; name?: string; symbol?: string };
  balance?: number;
  value?: number;
}

interface RawWalletResponse {
  total?: number;
  tokens?: RawWalletHolding[];
}

export function fetchWalletPortfolio(address: string): Promise<Cached<WalletData>> {
  return cached(`wallet:${address}`, TTL.wallet, async () => {
    const raw = (await trackerFetch(`/wallet/${address}`)) as RawWalletResponse;
    const holdings = Array.isArray(raw?.tokens) ? raw.tokens : [];

    const solHolding = holdings.find((h) => h.token?.mint === SOL_MINT);

    return {
      address,
      solBalance: num(solHolding?.balance) ?? 0,
      solValueUsd: num(solHolding?.value),
      totalValueUsd: num(raw?.total),
      tokens: holdings
        .filter((h) => !!h.token?.mint && h.token.mint !== SOL_MINT)
        .map((h) => ({
          mint: h.token!.mint as string,
          name: h.token?.name ?? null,
          symbol: h.token?.symbol ?? null,
          amount: num(h.balance) ?? 0,
          valueUsd: num(h.value),
        })),
    };
  });
}

// --- Token details -----------------------------------------------------

// Raw /tokens/:mint response: token metadata plus a `pools` array in the
// same shape as the trending endpoint, plus per-timeframe price events.
interface RawTokenInfoResponse {
  token?: RawTokenMeta;
  pools?: RawPool[];
  events?: RawEvents;
}

export function fetchTokenDetails(mint: string): Promise<Cached<TokenDetails>> {
  return cached(`token:${mint}`, TTL.token, async () => {
    const raw = (await trackerFetch(`/tokens/${mint}`)) as RawTokenInfoResponse;
    const primaryPool = raw?.pools?.[0];

    return {
      mint: raw?.token?.mint ?? mint,
      name: raw?.token?.name ?? "Unknown token",
      symbol: raw?.token?.symbol ?? "?",
      image: raw?.token?.image ?? null,
      priceUsd: num(primaryPool?.price?.usd),
      change24h: num(raw?.events?.["24h"]?.priceChangePercentage),
      marketCapUsd: num(primaryPool?.marketCap?.usd),
      liquidityUsd: num(primaryPool?.liquidity?.usd),
    };
  });
}

// --- Batched prices (watchlist) -------------------------------------------

// Raw GET /price/multi?tokens=a,b&priceChanges=true response is an object
// keyed by mint:
// { [mint]: { price, liquidity, marketCap, priceChanges: { "24h": { priceChangePercentage } } } }
interface RawPriceEntry {
  price?: number;
  liquidity?: number;
  marketCap?: number;
  priceChanges?: { "24h"?: { priceChangePercentage?: number } };
}

export function fetchPrices(
  mints: string[]
): Promise<Cached<Record<string, PriceQuote>>> {
  // Sorted so the same set of tokens shares a cache entry regardless of order.
  const sorted = [...mints].sort();
  return cached(`prices:${sorted.join(",")}`, TTL.prices, async () => {
    const raw = (await trackerFetch(
      `/price/multi?tokens=${sorted.join(",")}&priceChanges=true`
    )) as Record<string, RawPriceEntry | null>;

    const out: Record<string, PriceQuote> = {};
    for (const mint of sorted) {
      const entry = raw?.[mint];
      if (!entry) continue; // unknown to the provider: omit, UI shows "—"
      out[mint] = {
        mint,
        priceUsd: num(entry.price),
        change24h: num(entry.priceChanges?.["24h"]?.priceChangePercentage),
        marketCapUsd: num(entry.marketCap),
        liquidityUsd: num(entry.liquidity),
      };
    }
    return out;
  });
}

// --- OHLC chart ---------------------------------------------------------

// Raw /chart/:mint?type=:interval response:
// { oclhv: [{ open, close, low, high, volume, time }] }
// (yes, the array key really is "oclhv"). `time` is Unix seconds.
interface RawChartCandle {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  time?: number;
}

interface RawChartResponse {
  oclhv?: RawChartCandle[];
}

export const INTERVAL_SECONDS: Record<ChartInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "1d": 86_400,
};

// How far back to request per interval. The provider's docs don't state a
// default range, so we ask explicitly (time_from / time_to) for a window
// that is deep enough to zoom out in, but bounded to ~300-600 candles.
const LOOKBACK_SECONDS: Record<ChartInterval, number> = {
  "1m": 6 * 3_600,
  "5m": 2 * 86_400,
  "15m": 5 * 86_400,
  "1h": 21 * 86_400,
  "4h": 90 * 86_400,
  "1d": 365 * 86_400,
};

export function fetchTokenChart(
  mint: string,
  interval: ChartInterval
): Promise<Cached<Candle[]>> {
  return cached(`chart:${mint}:${interval}`, TTL.chart[interval], async () => {
    const now = Math.floor(Date.now() / 1000);
    const from = now - LOOKBACK_SECONDS[interval];
    const raw = (await trackerFetch(
      `/chart/${mint}?type=${encodeURIComponent(interval)}&time_from=${from}&time_to=${now}`
    )) as RawChartResponse;

    const candles = normalizeCandles(Array.isArray(raw?.oclhv) ? raw.oclhv : []);
    return fillGaps(candles, INTERVAL_SECONDS[interval], now);
  });
}

// lightweight-charts is strict: times must be finite, unique and in
// ascending order. The upstream API doesn't guarantee any of that, so
// drop malformed rows, dedupe (last write wins) and sort here.
export function normalizeCandles(rawCandles: RawChartCandle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const c of rawCandles) {
    const { time, open, high, low, close, volume } = c;
    if (
      typeof time !== "number" ||
      !Number.isFinite(time) ||
      typeof open !== "number" ||
      !Number.isFinite(open) ||
      typeof high !== "number" ||
      !Number.isFinite(high) ||
      typeof low !== "number" ||
      !Number.isFinite(low) ||
      typeof close !== "number" ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    byTime.set(time, {
      time,
      open,
      high,
      low,
      close,
      volume: typeof volume === "number" && Number.isFinite(volume) ? volume : 0,
    });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Upper bound on candles after filling, in case the provider ignores our time window. */
const MAX_FILLED_CANDLES = 5_000;

/**
 * The provider omits candles for intervals with no trades. Charting
 * libraries space bars by index, not time, so those gaps would squash the
 * chart together and distort the time axis. Real charting tools fill each
 * empty interval with a flat candle at the previous close; so do we.
 * The series is also carried forward to the current interval so a token
 * that stopped trading doesn't look like its chart ends in the past.
 */
export function fillGaps(candles: Candle[], stepSeconds: number, nowSeconds: number): Candle[] {
  if (candles.length === 0) return candles;

  const lastBucket = Math.floor(nowSeconds / stepSeconds) * stepSeconds;
  const last = candles[candles.length - 1];
  const span = (Math.max(lastBucket, last.time) - candles[0].time) / stepSeconds + 1;
  if (span > MAX_FILLED_CANDLES) return candles;

  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i++) {
    const current = candles[i];
    out.push(current);
    const nextTime = i + 1 < candles.length ? candles[i + 1].time : lastBucket + stepSeconds;
    for (let t = current.time + stepSeconds; t < nextTime; t += stepSeconds) {
      out.push({ time: t, open: current.close, high: current.close, low: current.close, close: current.close, volume: 0 });
    }
  }
  return out;
}
