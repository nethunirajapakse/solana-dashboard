import { describe, expect, it } from "vitest";
import { base58DecodedLength, isValidSolanaAddress, parseMintList } from "@/lib/validate";

const WALLET = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
const WSOL = "So11111111111111111111111111111111111111112";
const SYSTEM_PROGRAM = "11111111111111111111111111111111"; // 32 leading zero bytes
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

describe("base58DecodedLength", () => {
  it("matches a known test vector ('Hello World!' is 12 bytes)", () => {
    expect(base58DecodedLength("2NEpo7TZRRrLZSi2U")).toBe(12);
  });

  it("counts each leading '1' as a zero byte", () => {
    expect(base58DecodedLength("111")).toBe(3);
    expect(base58DecodedLength(SYSTEM_PROGRAM)).toBe(32);
  });

  it("returns null for empty input or characters outside the alphabet", () => {
    expect(base58DecodedLength("")).toBeNull();
    for (const bad of ["0", "O", "I", "l", "abc+def", "has space"]) {
      expect(base58DecodedLength(bad)).toBeNull();
    }
  });
});

describe("isValidSolanaAddress", () => {
  it.each([WALLET, WSOL, SYSTEM_PROGRAM, TOKEN_PROGRAM])("accepts %s", (address) => {
    expect(isValidSolanaAddress(address)).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(isValidSolanaAddress(`  ${WALLET}\n`)).toBe(true);
  });

  it("rejects empty, too short and too long input", () => {
    expect(isValidSolanaAddress("")).toBe(false);
    expect(isValidSolanaAddress(WALLET.slice(0, 31))).toBe(false);
    expect(isValidSolanaAddress(WALLET + "1")).toBe(false);
  });

  it("rejects EVM addresses and non-base58 characters", () => {
    expect(isValidSolanaAddress("0x52908400098527886E0F7030069857D2E4169EE7")).toBe(false);
    expect(isValidSolanaAddress(WALLET.replace("5Q54", "0Q54"))).toBe(false);
  });

  it("rejects a right-length string that does not decode to 32 bytes", () => {
    // 44 chars passes the old length+alphabet regex but decodes to 33 bytes.
    const shapedLikeAnAddress = "z".repeat(44);
    expect(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(shapedLikeAnAddress)).toBe(true);
    expect(isValidSolanaAddress(shapedLikeAnAddress)).toBe(false);
  });
});

describe("parseMintList", () => {
  it("parses, trims and de-duplicates", () => {
    expect(parseMintList(` ${WALLET}, ${WSOL} ,${WALLET}`, 5)).toEqual([WALLET, WSOL]);
  });

  it("returns null for missing, empty, oversized or invalid lists", () => {
    expect(parseMintList(null, 5)).toBeNull();
    expect(parseMintList("", 5)).toBeNull();
    expect(parseMintList(" , ,", 5)).toBeNull();
    expect(parseMintList(`${WALLET},${WSOL}`, 1)).toBeNull();
    expect(parseMintList(`${WALLET},not-an-address`, 5)).toBeNull();
  });
});
