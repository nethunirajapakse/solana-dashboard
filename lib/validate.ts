// Solana addresses are base58-encoded 32-byte public keys, which in
// practice renders out to 32-44 base58 characters. This isn't a full
// checksum validation (that would require decoding to bytes), but it's
// enough to catch typos, EVM addresses, and empty input before we ever
// hit the API.
const BASE58_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(address: string): boolean {
  return BASE58_ADDRESS_RE.test(address.trim());
}
