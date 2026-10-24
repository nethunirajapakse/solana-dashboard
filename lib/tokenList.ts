// Pure helpers for the trending table: filtering and sorting.

import type { TrendingToken } from "@/types/solana";

export type SortKey = "priceUsd" | "change1h" | "change24h" | "marketCapUsd";
export type SortDir = "asc" | "desc";

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** Case-insensitive match on name, symbol, or mint prefix. */
export function filterTokens(tokens: TrendingToken[], query: string): TrendingToken[] {
  const q = query.trim().toLowerCase();
  if (!q) return tokens;
  return tokens.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.mint.toLowerCase().startsWith(q)
  );
}

/** Sort a copy. Tokens with no value for the key always go last, whichever direction. */
export function sortTokens(tokens: TrendingToken[], sort: SortState | null): TrendingToken[] {
  if (!sort) return tokens;
  const { key, dir } = sort;
  const sign = dir === "asc" ? 1 : -1;
  return [...tokens].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  });
}

/** Click cycle for a column header: off -> desc -> asc -> off. */
export function nextSort(current: SortState | null, key: SortKey): SortState | null {
  if (!current || current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return null;
}
