// The JSON contract between our API routes and the browser (v1).
//
// Every route responds with one of these envelopes or an ApiError. The
// client parses each response with the matching schema, so a drifting
// server shape fails loudly in one place instead of rendering `undefined`.
// Each schema is checked against the interfaces in types/solana.ts with
// `satisfies`, so the compile-time and runtime types cannot diverge.

import { z } from "zod";
import type {
  Candle,
  PriceQuote,
  TokenDetails,
  TrendingToken,
  WalletData,
} from "@/types/solana";
import { TRENDING_TIMEFRAMES } from "@/types/solana";

const nullableNumber = z.number().nullable();

export const TrendingTokenSchema = z.object({
  mint: z.string(),
  name: z.string(),
  symbol: z.string(),
  image: z.string().nullable(),
  priceUsd: nullableNumber,
  change1h: nullableNumber,
  change24h: nullableNumber,
  marketCapUsd: nullableNumber,
  liquidityUsd: nullableNumber,
}) satisfies z.ZodType<TrendingToken>;

export const TokenDetailsSchema = z.object({
  mint: z.string(),
  name: z.string(),
  symbol: z.string(),
  image: z.string().nullable(),
  priceUsd: nullableNumber,
  change24h: nullableNumber,
  marketCapUsd: nullableNumber,
  liquidityUsd: nullableNumber,
}) satisfies z.ZodType<TokenDetails>;

export const WalletDataSchema = z.object({
  address: z.string(),
  solBalance: z.number(),
  solValueUsd: nullableNumber,
  totalValueUsd: nullableNumber,
  tokens: z.array(
    z.object({
      mint: z.string(),
      name: z.string().nullable(),
      symbol: z.string().nullable(),
      amount: z.number(),
      valueUsd: nullableNumber,
    })
  ),
}) satisfies z.ZodType<WalletData>;

export const PriceQuoteSchema = z.object({
  mint: z.string(),
  priceUsd: nullableNumber,
  change24h: nullableNumber,
  marketCapUsd: nullableNumber,
  liquidityUsd: nullableNumber,
}) satisfies z.ZodType<PriceQuote>;

export const CandleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
}) satisfies z.ZodType<Candle>;

// `fetchedAt` is when the server last got this data from the provider
// (epoch ms), so the UI can say how fresh it is - cached responses
// are older than the request that returned them.
const fetchedAt = z.number();

export const TrendingResponseSchema = z.object({
  timeframe: z.enum(TRENDING_TIMEFRAMES),
  tokens: z.array(TrendingTokenSchema),
  fetchedAt,
});
export type TrendingResponse = z.infer<typeof TrendingResponseSchema>;

export const TokenResponseSchema = z.object({
  token: TokenDetailsSchema,
  fetchedAt,
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const WalletResponseSchema = z.object({
  wallet: WalletDataSchema,
  fetchedAt,
});
export type WalletResponse = z.infer<typeof WalletResponseSchema>;

export const PricesResponseSchema = z.object({
  prices: z.record(z.string(), PriceQuoteSchema),
  fetchedAt,
});
export type PricesResponse = z.infer<typeof PricesResponseSchema>;

export const CandlesResponseSchema = z.object({
  candles: z.array(CandleSchema),
  fetchedAt,
});
export type CandlesResponse = z.infer<typeof CandlesResponseSchema>;

export const ApiErrorSchema = z.object({ error: z.string() });
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
