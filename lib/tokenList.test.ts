import { describe, expect, it } from "vitest";
import { filterTokens, nextSort, sortTokens } from "@/lib/tokenList";
import type { TrendingToken } from "@/types/solana";

function token(over: Partial<TrendingToken>): TrendingToken {
  return {
    mint: "M",
    name: "Name",
    symbol: "SYM",
    image: null,
    priceUsd: 1,
    change1h: 0,
    change24h: 0,
    marketCapUsd: 1,
    liquidityUsd: 1,
    ...over,
  };
}

const A = token({ mint: "AAAA1", name: "Alpha Coin", symbol: "ALP", priceUsd: 3, change24h: -5 });
const B = token({ mint: "BBBB2", name: "Beta", symbol: "BTA", priceUsd: 1, change24h: 20 });
const C = token({ mint: "CCCC3", name: "Gamma", symbol: "GMA", priceUsd: null, change24h: null });
const ALL = [A, B, C];

describe("filterTokens", () => {
  it("returns everything for a blank query", () => {
    expect(filterTokens(ALL, "   ")).toBe(ALL);
  });

  it("matches name, symbol (case-insensitive) and mint prefix", () => {
    expect(filterTokens(ALL, "alpha")).toEqual([A]);
    expect(filterTokens(ALL, "bta")).toEqual([B]);
    expect(filterTokens(ALL, "cccc")).toEqual([C]);
    expect(filterTokens(ALL, "ccc3")).toEqual([]); // mint match is a prefix, not a substring
    expect(filterTokens(ALL, "nope")).toEqual([]);
  });
});

describe("sortTokens", () => {
  it("keeps API order when no sort is active, and never mutates input", () => {
    expect(sortTokens(ALL, null)).toBe(ALL);
    sortTokens(ALL, { key: "priceUsd", dir: "asc" });
    expect(ALL).toEqual([A, B, C]);
  });

  it("sorts ascending and descending", () => {
    expect(sortTokens(ALL, { key: "change24h", dir: "desc" }).map((t) => t.symbol)).toEqual(["BTA", "ALP", "GMA"]);
    expect(sortTokens(ALL, { key: "change24h", dir: "asc" }).map((t) => t.symbol)).toEqual(["ALP", "BTA", "GMA"]);
  });

  it("puts tokens with no value last in both directions", () => {
    expect(sortTokens(ALL, { key: "priceUsd", dir: "desc" }).at(-1)).toBe(C);
    expect(sortTokens(ALL, { key: "priceUsd", dir: "asc" }).at(-1)).toBe(C);
  });
});

describe("nextSort", () => {
  it("cycles desc -> asc -> off for one column, and resets for a new column", () => {
    const first = nextSort(null, "priceUsd");
    expect(first).toEqual({ key: "priceUsd", dir: "desc" });
    const second = nextSort(first, "priceUsd");
    expect(second).toEqual({ key: "priceUsd", dir: "asc" });
    expect(nextSort(second, "priceUsd")).toBeNull();
    expect(nextSort(second, "change24h")).toEqual({ key: "change24h", dir: "desc" });
  });
});
