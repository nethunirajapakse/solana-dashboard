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

  // Very small token prices need more precision than the default 2dp,
  // otherwise everything under $0.01 renders as "$0.00".
  const maximumFractionDigits = value < 1 ? 6 : 2;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
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
