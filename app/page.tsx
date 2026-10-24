"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { TrendingResponseSchema } from "@/lib/contracts";
import { filterTokens, nextSort, sortTokens } from "@/lib/tokenList";
import type { SortKey, SortState } from "@/lib/tokenList";
import { TIMEFRAME_TABS } from "@/types/solana";
import type { TrendingTimeframe } from "@/types/solana";
import TokenRow from "@/components/TokenRow";
import Freshness from "@/components/Freshness";
import { EmptyBlock, ErrorBlock, SkeletonRows } from "@/components/StateViews";

// Matches the server's cache lifetime (TTL.trending): refreshing faster
// would only return the same cached data and cost nothing but noise.
const REFRESH_MS = 120_000;

const SORTABLE: { key: SortKey; label: string }[] = [
  { key: "priceUsd", label: "Price" },
  { key: "change1h", label: "1h" },
  { key: "change24h", label: "24h" },
  { key: "marketCapUsd", label: "Mkt Cap" },
];

export default function TrendingPage() {
  const [timeframe, setTimeframe] = useState<TrendingTimeframe>("1h");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  const { status, data, error, isRefreshing, refetch } = useApi(
    `/api/trending?timeframe=${timeframe}`,
    TrendingResponseSchema,
    { refreshMs: REFRESH_MS }
  );

  const visible = useMemo(
    () => (data ? sortTokens(filterTokens(data.tokens, query), sort) : []),
    [data, query, sort]
  );

  return (
    <>
      <div className="eyebrow">Live feed · Solana mainnet</div>
      <h1 className="page-title">Trending tokens</h1>
      <p className="page-subtitle">
        Ranked by activity over the selected window, via the SolanaTracker Data
        API. Star a token to add it to your watchlist.
      </p>

      <div className="toolbar">
        <div className="interval-tabs" role="tablist" aria-label="Trending window">
          {TIMEFRAME_TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={timeframe === value}
              className={`interval-tab ${timeframe === value ? "active" : ""}`}
              onClick={() => setTimeframe(value)}
            >
              {value}
            </button>
          ))}
        </div>

        <input
          className="filter-input"
          type="search"
          placeholder="Filter by name, symbol or mint"
          aria-label="Filter tokens"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />

        <Freshness
          updatedAt={data?.fetchedAt ?? null}
          isRefreshing={isRefreshing}
          error={status === "ready" ? error : null}
          onRefresh={refetch}
        />
      </div>

      {status === "loading" && <SkeletonRows />}

      {status === "error" && (
        <ErrorBlock title="Couldn't load trending tokens" message={error ?? ""} onRetry={refetch} />
      )}

      {status === "ready" && data && data.tokens.length === 0 && (
        <EmptyBlock>No trending tokens right now.</EmptyBlock>
      )}

      {status === "ready" && data && data.tokens.length > 0 && visible.length === 0 && (
        <EmptyBlock>
          No tokens match &quot;{query.trim()}&quot; in this window.
        </EmptyBlock>
      )}

      {status === "ready" && visible.length > 0 && (
        <div className="ledger ledger--trending" role="table" aria-label="Trending tokens">
          <div className="ledger-head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Token</span>
            {SORTABLE.map(({ key, label }) => {
              const active = sort?.key === key;
              return (
                <span
                  key={key}
                  role="columnheader"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  style={{ textAlign: "right" }}
                >
                  <button
                    type="button"
                    className={`sort-button${active ? " active" : ""}`}
                    onClick={() => setSort(nextSort(sort, key))}
                    title={`Sort by ${label}`}
                  >
                    {label}
                    <span aria-hidden="true">
                      {active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                    </span>
                  </button>
                </span>
              );
            })}
            <span role="columnheader" className="visually-hidden">
              Watch
            </span>
          </div>
          {visible.map((token, i) => (
            <TokenRow key={token.mint} token={token} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
