// Pure helpers for the wallet holdings table.

import type { WalletTokenBalance } from "@/types/solana";

export type HoldingSortKey = "valueUsd" | "amount";
export type HoldingSort = { key: HoldingSortKey; dir: "asc" | "desc" };

export const DUST_THRESHOLD_USD = 1;

/** Unpriced tokens are treated as dust: on Solana they're overwhelmingly spam airdrops. */
export function isDust(holding: WalletTokenBalance): boolean {
  return holding.valueUsd === null || holding.valueUsd < DUST_THRESHOLD_USD;
}

/** Sort a copy; holdings with no value for the key always sort last. */
export function sortHoldings(
  holdings: WalletTokenBalance[],
  sort: HoldingSort
): WalletTokenBalance[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...holdings].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  });
}

/** Share of the portfolio as a percentage, or null if it can't be computed. */
export function shareOfTotal(valueUsd: number | null, totalUsd: number | null): number | null {
  if (valueUsd === null || totalUsd === null || totalUsd <= 0) return null;
  return (valueUsd / totalUsd) * 100;
}
