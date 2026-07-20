import { TrendingToken, WalletData } from "@/types/solana";

const BASE_URL = "https://data.solanatracker.io";
const SOL_MINT = "So11111111111111111111111111111111111111112";

function getApiKey(): string {
  const key = process.env.SOLANA_TRACKER_API_KEY;
  if (!key) {
    throw new Error(
      "SOLANA_TRACKER_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  return key;
}

async function trackerFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": getApiKey() },
    // Trending/price data goes stale fast - don't let Next.js cache it.
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `SolanaTracker request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // response wasn't JSON - fall back to the generic message above
    }
    throw new Error(message);
  }

  return res.json();
}

// --- Trending tokens -------------------------------------------------

// The raw /tokens/trending/:timeframe response is an array of objects like:
// { token: { name, symbol, mint, image }, pools: [{ price: { usd }, liquidity: { usd }, marketCap: { usd } }],
//   events: { "24h": { priceChangePercentage } } }
// Different tokens can have missing pools/events, so every field below is
// read defensively rather than assumed to exist.
interface RawTrendingEntry {
  token?: {
    name?: string;
    symbol?: string;
    mint?: string;
    image?: string;
  };
  pools?: Array<{
    price?: { usd?: number };
    liquidity?: { usd?: number };
    marketCap?: { usd?: number };
  }>;
  events?: {
    "24h"?: { priceChangePercentage?: number };
  };
}

function normalizeTrendingToken(raw: RawTrendingEntry): TrendingToken | null {
  const mint = raw.token?.mint;
  if (!mint) return null;

  const primaryPool = raw.pools?.[0];

  return {
    mint,
    name: raw.token?.name ?? "Unknown token",
    symbol: raw.token?.symbol ?? "?",
    image: raw.token?.image ?? null,
    priceUsd: primaryPool?.price?.usd ?? null,
    change24h: raw.events?.["24h"]?.priceChangePercentage ?? null,
    marketCapUsd: primaryPool?.marketCap?.usd ?? null,
    liquidityUsd: primaryPool?.liquidity?.usd ?? null,
  };
}

export async function fetchTrendingTokens(
  timeframe: string = "1h"
): Promise<TrendingToken[]> {
  const raw = (await trackerFetch(
    `/tokens/trending/${timeframe}`
  )) as RawTrendingEntry[];

  if (!Array.isArray(raw)) return [];

  return raw
    .map(normalizeTrendingToken)
    .filter((t): t is TrendingToken => t !== null);
}

// --- Wallet portfolio --------------------------------------------------

// Raw /wallet/:address response:
// { total: number, tokens: [{ token: { mint, name, symbol }, balance: number, value: number }] }
interface RawWalletHolding {
  token?: {
    mint?: string;
    name?: string;
    symbol?: string;
  };
  balance?: number;
  value?: number;
}

interface RawWalletResponse {
  total?: number;
  tokens?: RawWalletHolding[];
}

export async function fetchWalletPortfolio(
  address: string
): Promise<WalletData> {
  const raw = (await trackerFetch(`/wallet/${address}`)) as RawWalletResponse;

  const holdings = raw.tokens ?? [];

  const solHolding = holdings.find((h) => h.token?.mint === SOL_MINT);
  const splTokens = holdings.filter((h) => h.token?.mint !== SOL_MINT);

  return {
    address,
    solBalance: solHolding?.balance ?? 0,
    solValueUsd: solHolding?.value ?? null,
    totalValueUsd: raw.total ?? null,
    tokens: splTokens
      .filter((h) => !!h.token?.mint)
      .map((h) => ({
        mint: h.token!.mint as string,
        name: h.token?.name ?? null,
        symbol: h.token?.symbol ?? null,
        amount: h.balance ?? 0,
        valueUsd: h.value ?? null,
      })),
  };
}
