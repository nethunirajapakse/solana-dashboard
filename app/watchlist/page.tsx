"use client";

import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { usePersistedList } from "@/hooks/usePersistedList";
import { PricesResponseSchema } from "@/lib/contracts";
import { formatPercent, formatUsd } from "@/lib/format";
import { MAX_WATCHLIST, watchlist } from "@/lib/stores";
import Freshness from "@/components/Freshness";
import TokenAvatar from "@/components/TokenAvatar";
import WatchButton from "@/components/WatchButton";
import { changeClass } from "@/components/TokenRow";
import { EmptyBlock, ErrorBlock } from "@/components/StateViews";

const REFRESH_MS = 60_000;

export default function WatchlistPage() {
  const items = usePersistedList(watchlist);

  // One batched request for the whole list (not one per token).
  const url =
    items.length > 0
      ? `/api/prices?mints=${items.map((t) => t.mint).join(",")}`
      : null;

  const { status, data, error, isRefreshing, refetch } = useApi(
    url,
    PricesResponseSchema,
    { refreshMs: REFRESH_MS }
  );

  return (
    <>
      <div className="eyebrow">Your list</div>
      <h1 className="page-title">Watchlist</h1>
      <p className="page-subtitle">
        Tokens you&apos;re following, with live prices. Saved in this browser
        only ({items.length}/{MAX_WATCHLIST}).
      </p>

      {items.length === 0 ? (
        <EmptyBlock>
          <p style={{ margin: "0 0 12px" }}>Your watchlist is empty.</p>
          <Link href="/" className="install-link">
            Browse trending tokens and star the ones you want to follow →
          </Link>
        </EmptyBlock>
      ) : (
        <>
          <div className="toolbar">
            <span />
            <Freshness
              updatedAt={data?.fetchedAt ?? null}
              isRefreshing={isRefreshing}
              error={status === "ready" ? error : null}
              onRefresh={refetch}
            />
          </div>

          {status === "error" && (
            <ErrorBlock title="Couldn't load prices" message={error ?? ""} onRetry={refetch} />
          )}

          {/* Rows come from the saved list, so they render instantly and
              never flash away while prices load or if the request fails. */}
          <div className="ledger ledger--watch" role="table" aria-label="Watchlist" style={status === "error" ? { marginTop: 12 } : undefined}>
            <div className="ledger-head" role="row">
              <span role="columnheader">Token</span>
              <span role="columnheader" style={{ textAlign: "right" }}>Price</span>
              <span role="columnheader" style={{ textAlign: "right" }}>24h</span>
              <span role="columnheader" style={{ textAlign: "right" }}>Mkt Cap</span>
              <span role="columnheader" className="visually-hidden">Remove</span>
            </div>
            {items.map((item) => {
              const quote = data?.prices[item.mint];
              const loading = status === "loading";
              return (
                <div className="ledger-row" role="row" key={item.mint}>
                  <div className="token-identity" role="cell">
                    <TokenAvatar image={item.image} symbol={item.symbol} />
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/token/${item.mint}`} className="row-link">
                        <span className="token-name">{item.name}</span>
                      </Link>
                      <div className="token-symbol">{item.symbol}</div>
                    </div>
                  </div>
                  <div className={`mono-cell${loading ? " pending" : ""}`} data-label="Price" role="cell">
                    {loading ? "…" : formatUsd(quote?.priceUsd ?? null)}
                  </div>
                  <div
                    className={`mono-cell ${changeClass(quote?.change24h ?? null)}${loading ? " pending" : ""}`}
                    data-label="24h"
                    role="cell"
                  >
                    {loading ? "…" : formatPercent(quote?.change24h ?? null)}
                  </div>
                  <div className={`mono-cell${loading ? " pending" : ""}`} data-label="Mkt Cap" role="cell">
                    {loading ? "…" : formatUsd(quote?.marketCapUsd ?? null, { compact: true })}
                  </div>
                  <div className="row-action" role="cell">
                    <WatchButton token={item} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
