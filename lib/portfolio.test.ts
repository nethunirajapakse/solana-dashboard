import { describe, expect, it } from "vitest";
import { isDust, shareOfTotal, sortHoldings } from "@/lib/portfolio";
import type { WalletTokenBalance } from "@/types/solana";

const h = (symbol: string, amount: number, valueUsd: number | null): WalletTokenBalance => ({
  mint: symbol,
  name: symbol,
  symbol,
  amount,
  valueUsd,
});

describe("isDust", () => {
  it("treats unpriced and sub-$1 holdings as dust", () => {
    expect(isDust(h("A", 5, null))).toBe(true);
    expect(isDust(h("B", 5, 0.99))).toBe(true);
    expect(isDust(h("C", 5, 1))).toBe(false);
    expect(isDust(h("D", 5, 250))).toBe(false);
  });
});

describe("sortHoldings", () => {
  const list = [h("A", 10, 5), h("B", 1, 500), h("C", 99, null)];

  it("sorts by value descending with unpriced last", () => {
    expect(sortHoldings(list, { key: "valueUsd", dir: "desc" }).map((x) => x.symbol)).toEqual(["B", "A", "C"]);
  });

  it("sorts by balance ascending and does not mutate", () => {
    expect(sortHoldings(list, { key: "amount", dir: "asc" }).map((x) => x.symbol)).toEqual(["B", "A", "C"]);
    expect(list.map((x) => x.symbol)).toEqual(["A", "B", "C"]);
  });
});

describe("shareOfTotal", () => {
  it("computes a percentage", () => {
    expect(shareOfTotal(25, 100)).toBe(25);
  });

  it("returns null when it cannot be computed (no divide-by-zero)", () => {
    expect(shareOfTotal(null, 100)).toBeNull();
    expect(shareOfTotal(25, null)).toBeNull();
    expect(shareOfTotal(25, 0)).toBeNull();
  });
});
