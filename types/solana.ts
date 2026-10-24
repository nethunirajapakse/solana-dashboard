// Normalized shapes used by the UI. We deliberately flatten the raw
// SolanaTracker response into something simple, because the raw response
// nests price/liquidity info inside a `pools` array whose shape can vary
// slightly between tokens (some pools omit fields entirely).
//
// The runtime (zod) schemas that enforce these shapes at the API boundary
// live in lib/contracts.ts and are type-checked against these interfaces.

export interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  priceUsd: number | null;
  change1h: number | null;
  change24h: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
}

export interface WalletTokenBalance {
  mint: string;
  name: string | null;
  symbol: string | null;
  amount: number;
  valueUsd: number | null;
}

export interface WalletData {
  address: string;
  solBalance: number;
  solValueUsd: number | null;
  totalValueUsd: number | null;
  tokens: WalletTokenBalance[];
}

// Single-token detail view (token page header / stats).
export interface TokenDetails {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  priceUsd: number | null;
  change24h: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
}

// Lightweight live quote used by the watchlist (one batched upstream call
// for the whole list instead of one call per token).
export interface PriceQuote {
  mint: string;
  priceUsd: number | null;
  change24h: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
}

// Timeframes accepted by SolanaTracker's /tokens/trending/:timeframe.
// The API route rejects anything outside this list - the value is
// interpolated into an upstream URL path, so it must never be free text.
export const TRENDING_TIMEFRAMES = [
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "3h",
  "4h",
  "5h",
  "6h",
  "12h",
  "24h",
] as const;
export type TrendingTimeframe = (typeof TRENDING_TIMEFRAMES)[number];

// The subset surfaced as tabs in the UI.
export const TIMEFRAME_TABS: readonly TrendingTimeframe[] = [
  "5m",
  "1h",
  "6h",
  "24h",
];

export function isTrendingTimeframe(value: string): value is TrendingTimeframe {
  return (TRENDING_TIMEFRAMES as readonly string[]).includes(value);
}

// Intervals offered by the chart UI. SolanaTracker's /chart endpoint
// supports more (1s..1mn), but these are the ones we expose - the API
// route rejects anything outside this list.
export const CHART_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type ChartInterval = (typeof CHART_INTERVALS)[number];

export function isChartInterval(value: string): value is ChartInterval {
  return (CHART_INTERVALS as readonly string[]).includes(value);
}

// One OHLC candle. `time` is a Unix timestamp in seconds, which is what
// both the SolanaTracker chart API and lightweight-charts expect.
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Traded volume in the candle (0 for synthetic gap-fill candles). */
  volume: number;
}

// Max mints per /api/prices call (upstream allows 100; we stay well under).
export const MAX_PRICE_MINTS = 50;
