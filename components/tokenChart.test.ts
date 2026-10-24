import { describe, expect, it } from "vitest";
import { shouldDefaultToLog } from "@/components/TokenChart";
import type { Candle } from "@/types/solana";

const candle = (low: number, high: number): Candle => ({ time: 0, open: low, high, low, close: high, volume: 0 });

describe("shouldDefaultToLog", () => {
  it("is off for ordinary price ranges", () => {
    expect(shouldDefaultToLog([candle(1, 1.4), candle(0.9, 1.2)])).toBe(false);
    expect(shouldDefaultToLog([])).toBe(false);
  });

  it("turns on once a token has moved 50x or more (fresh launches)", () => {
    expect(shouldDefaultToLog([candle(0.000002853, 0.000533)])).toBe(true);
    expect(shouldDefaultToLog([candle(1, 49), candle(2, 3)])).toBe(false);
    expect(shouldDefaultToLog([candle(1, 50)])).toBe(true);
  });

  it("ignores zero lows instead of dividing by zero", () => {
    expect(shouldDefaultToLog([candle(0, 5), candle(1, 2)])).toBe(false);
  });
});
