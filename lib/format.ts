export function formatUsd(value: number | null, opts?: { compact?: boolean }): string {
  if (value === null || Number.isNaN(value)) return "—";

  if (opts?.compact && value >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }

  // Sub-dollar token prices need significant digits, not fixed decimals:
  // $0.00001234 must not render as "$0.000012" (or worse, "$0.00").
  if (value > 0 && value < 1) return formatSmallUsd(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

const MIN_DISPLAYABLE_USD = 1e-12;

function formatSmallUsd(value: number): string {
  if (value < MIN_DISPLAYABLE_USD) return `<$${MIN_DISPLAYABLE_USD.toFixed(12)}`;

  // Keep 4 significant digits after the leading zeros.
  const leadingZeros = -Math.floor(Math.log10(value)) - 1;
  const decimals = Math.min(12, leadingZeros + 4);
  const fixed = value.toFixed(decimals);

  // Trim trailing zeros but always keep cents ("$0.50", not "$0.5000").
  const [whole, frac = ""] = fixed.split(".");
  let trimmed = frac.replace(/0+$/, "");
  if (trimmed.length < 2) trimmed = trimmed.padEnd(2, "0");
  return `$${whole}.${trimmed}`;
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatAmount(value: number): string {
  if (value === 0) return "0";
  const maximumFractionDigits = value < 1 ? 6 : value < 1000 ? 4 : 2;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(
    value
  );
}

export function truncateAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** "just now", "12s ago", "3m ago", "2h ago". `now` is injectable for tests. */
export function formatAgo(timestampMs: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestampMs) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function explorerUrl(kind: "account" | "token", id: string): string {
  return `https://solscan.io/${kind}/${id}`;
}

/** Price without the "$", for chart axes and OHLC readouts (keeps micro-price precision). */
export function formatChartPrice(value: number): string {
  // A linear axis can extend past zero; a price below the display floor is just "0".
  if (!(value > MIN_DISPLAYABLE_USD)) return "0";
  return formatUsd(value).replace("$", "");
}

/** Compact volume, e.g. 1.2K / 3.4M. */
export function formatVolume(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}
