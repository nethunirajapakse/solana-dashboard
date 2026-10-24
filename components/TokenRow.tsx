import Link from "next/link";
import type { TrendingToken } from "@/types/solana";
import { formatUsd, formatPercent } from "@/lib/format";
import TokenAvatar from "@/components/TokenAvatar";
import WatchButton from "@/components/WatchButton";

export function changeClass(value: number | null): string {
  if (value === null || value === 0) return "";
  return value > 0 ? "change-up" : "change-down";
}

export default function TokenRow({
  token,
  index,
}: {
  token: TrendingToken;
  index: number;
}) {
  return (
    <div className="ledger-row" role="row">
      <div className="ledger-index" role="cell">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="token-identity" role="cell">
        <TokenAvatar image={token.image} symbol={token.symbol} />
        <div style={{ minWidth: 0 }}>
          {/* Stretched link: the whole row is clickable, but the watch
              button stays a separate, valid (non-nested) control. */}
          <Link href={`/token/${token.mint}`} className="row-link">
            <span className="token-name">{token.name}</span>
          </Link>
          <div className="token-symbol">{token.symbol}</div>
        </div>
      </div>

      <div className="mono-cell" data-label="Price" role="cell">
        {formatUsd(token.priceUsd)}
      </div>

      <div className={`mono-cell ${changeClass(token.change1h)}`} data-label="1h" role="cell">
        {formatPercent(token.change1h)}
      </div>

      <div className={`mono-cell ${changeClass(token.change24h)}`} data-label="24h" role="cell">
        {formatPercent(token.change24h)}
      </div>

      <div className="mono-cell" data-label="Mkt Cap" role="cell">
        {formatUsd(token.marketCapUsd, { compact: true })}
      </div>

      <div className="row-action" role="cell">
        <WatchButton token={token} />
      </div>
    </div>
  );
}
