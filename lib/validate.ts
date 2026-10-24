// Solana addresses (wallets and token mints) are base58-encoded 32-byte
// public keys. A regex alone accepts strings that are the right shape but
// can never be a key (e.g. 44 characters that decode to 33 bytes), so we
// actually decode and check the byte length.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_INDEX = new Map<string, number>(
  [...ALPHABET].map((char, i) => [char, i])
);

/** Number of bytes a base58 string decodes to, or null if it isn't base58. */
export function base58DecodedLength(input: string): number | null {
  if (input.length === 0) return null;

  const bytes: number[] = []; // little-endian magnitude
  for (const char of input) {
    let carry = ALPHABET_INDEX.get(char);
    if (carry === undefined) return null;

    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Each leading "1" is a leading zero byte.
  let leadingZeros = 0;
  for (const char of input) {
    if (char !== "1") break;
    leadingZeros++;
  }

  return bytes.length + leadingZeros;
}

export function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim();
  // Cheap length gate first so we never decode attacker-sized input.
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  return base58DecodedLength(trimmed) === 32;
}

/** Parse a comma-separated list of mints, dropping blanks and duplicates. */
export function parseMintList(raw: string | null, max: number): string[] | null {
  if (!raw) return null;
  const mints = [...new Set(raw.split(",").map((m) => m.trim()).filter(Boolean))];
  if (mints.length === 0 || mints.length > max) return null;
  return mints.every(isValidSolanaAddress) ? mints : null;
}
