// The app's persisted, per-browser lists. Versioned keys (":v1") so a
// future shape change can migrate or ignore old data safely.

import { z } from "zod";
import { createPersistedList } from "@/lib/persistedList";

export const WatchedTokenSchema = z.object({
  mint: z.string(),
  name: z.string(),
  symbol: z.string(),
  image: z.string().nullable(),
  addedAt: z.number(),
});
export type WatchedToken = z.infer<typeof WatchedTokenSchema>;

export const MAX_WATCHLIST = 50;
export const watchlist = createPersistedList<WatchedToken>({
  key: "solana-dashboard:watchlist:v1",
  schema: WatchedTokenSchema,
  idOf: (t) => t.mint,
  max: MAX_WATCHLIST,
  onFull: "reject",
});

export const MAX_LABEL_LENGTH = 40;
export const SavedWalletSchema = z.object({
  address: z.string(),
  label: z.string().max(MAX_LABEL_LENGTH),
  savedAt: z.number(),
});
export type SavedWallet = z.infer<typeof SavedWalletSchema>;

export const savedWallets = createPersistedList<SavedWallet>({
  key: "solana-dashboard:saved-wallets:v1",
  schema: SavedWalletSchema,
  idOf: (w) => w.address,
  max: 25,
  onFull: "reject",
});

export const RecentWalletSchema = z.object({
  address: z.string(),
  visitedAt: z.number(),
});
export type RecentWallet = z.infer<typeof RecentWalletSchema>;

export const recentWallets = createPersistedList<RecentWallet>({
  key: "solana-dashboard:recent-wallets:v1",
  schema: RecentWalletSchema,
  idOf: (w) => w.address,
  max: 8,
  onFull: "evict-oldest",
  bumpExisting: true,
});
