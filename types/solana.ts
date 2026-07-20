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
