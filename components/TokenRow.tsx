import { TrendingToken } from "@/types/solana";
import { formatUsd, formatPercent } from "@/lib/format";

export default function TokenRow({
  token,
  index,
}: {
  token: TrendingToken;
  index: number;
}) {
  const changeClass =
    token.change24h === null
      ? ""
      : token.change24h >= 0
      ? "change-up"
      : "change-down";

  return (
    <div className="ledger-row">
      <div className="ledger-index">{String(index + 1).padStart(2, "0")}</div>

      <div className="token-identity">
        {token.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={token.image}
            alt=""
            className="token-avatar"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="token-avatar-fallback">
            {token.symbol.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="token-name">{token.name}</div>
          <div className="token-symbol">{token.symbol}</div>
        </div>
      </div>

      <div className="mono-cell" data-label="Price">
        {formatUsd(token.priceUsd)}
      </div>

      <div className={`mono-cell ${changeClass}`} data-label="24h">
        {formatPercent(token.change24h)}
      </div>

      <div className="mono-cell" data-label="Mkt Cap">
        {formatUsd(token.marketCapUsd, { compact: true })}
      </div>
    </div>
  );
}
