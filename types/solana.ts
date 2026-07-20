// Normalized shapes used by the UI. We deliberately flatten the raw
// SolanaTracker response into something simple, because the raw response
// nests price/liquidity info inside a `pools` array whose shape can vary
// slightly between tokens (some pools omit fields entirely).

export interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  priceUsd: number | null;
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

export interface ApiErrorBody {
  error: string;
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

// Intervals offered by the chart UI. SolanaTracker's /chart endpoint
// supports more (1s..1mn), but these are the ones we expose - the API
// route rejects anything outside this list.
export const CHART_INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const;
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
}
