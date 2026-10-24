import { describe, expect, it } from "vitest";
import {
  explorerUrl,
  formatChartPrice,
  formatVolume,
  formatAgo,
  formatAmount,
  formatPercent,
  formatUsd,
  truncateAddress,
} from "@/lib/format";

describe("formatUsd", () => {
  it("renders null/NaN as an em dash", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(Number.NaN)).toBe("—");
  });

  it("uses two decimals from $1 up", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(1)).toBe("$1.00");
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("keeps cents for ordinary sub-dollar prices", () => {
    expect(formatUsd(0.5)).toBe("$0.50");
    expect(formatUsd(0.1234)).toBe("$0.1234");
  });

  it("keeps significant digits for micro-prices instead of rounding to zero", () => {
    expect(formatUsd(0.00001234)).toBe("$0.00001234");
    expect(formatUsd(0.000000021934)).toBe("$0.00000002193");
  });

  it("flags values too small to display", () => {
    expect(formatUsd(1e-15)).toBe("<$0.000000000001");
  });

  it("compacts large values on request", () => {
    expect(formatUsd(2_500_000, { compact: true })).toBe("$2.50M");
    expect(formatUsd(999, { compact: true })).toBe("$999.00");
  });
});

describe("formatPercent", () => {
  it("signs positive values and handles missing data", () => {
    expect(formatPercent(12.345)).toBe("+12.35%");
    expect(formatPercent(-3)).toBe("-3.00%");
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatAmount / truncateAddress / explorerUrl", () => {
  it("scales precision with magnitude", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(0.123456789)).toBe("0.123457");
    expect(formatAmount(12.34567)).toBe("12.3457");
    expect(formatAmount(1234567.891)).toBe("1,234,567.89");
  });

  it("truncates long addresses only", () => {
    expect(truncateAddress("abcdefghijklmnop", 4)).toBe("abcd...mnop");
    expect(truncateAddress("short", 4)).toBe("short");
  });

  it("builds Solscan URLs", () => {
    expect(explorerUrl("account", "abc")).toBe("https://solscan.io/account/abc");
    expect(explorerUrl("token", "abc")).toBe("https://solscan.io/token/abc");
  });
});

describe("formatAgo", () => {
  const now = 1_000_000_000;
  it("describes recency", () => {
    expect(formatAgo(now - 2_000, now)).toBe("just now");
    expect(formatAgo(now - 12_000, now)).toBe("12s ago");
    expect(formatAgo(now - 3 * 60_000, now)).toBe("3m ago");
    expect(formatAgo(now - 2 * 3_600_000, now)).toBe("2h ago");
  });

  it("never goes negative if clocks disagree", () => {
    expect(formatAgo(now + 60_000, now)).toBe("just now");
  });
});

describe("chart formatters", () => {
  it("keeps micro-price precision on the axis (never '0.00')", () => {
    expect(formatChartPrice(0.001057)).toBe("0.001057");
    expect(formatChartPrice(0.00000321)).toBe("0.000003210".replace(/0+$/, ""));
    expect(formatChartPrice(1234.5)).toBe("1,234.50");
  });

  it("never prints nonsense for zero, negative or sub-floor axis ticks", () => {
    expect(formatChartPrice(0)).toBe("0");
    expect(formatChartPrice(-0.0001)).toBe("0");
    expect(formatChartPrice(1e-15)).toBe("0");
  });

  it("compacts volume", () => {
    expect(formatVolume(0)).toBe("0");
    expect(formatVolume(1234)).toBe("1.23K");
    expect(formatVolume(5_600_000)).toBe("5.6M");
  });
});
