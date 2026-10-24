"use client";

import { use, useEffect, useMemo, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { WalletResponseSchema } from "@/lib/contracts";
import { isValidSolanaAddress } from "@/lib/validate";
import {
  explorerUrl,
  formatAmount,
  formatUsd,
  truncateAddress,
} from "@/lib/format";
import { isDust, shareOfTotal, sortHoldings } from "@/lib/portfolio";
import type { HoldingSort, HoldingSortKey } from "@/lib/portfolio";
import { recentWallets } from "@/lib/stores";
import type { WalletData } from "@/types/solana";
import CopyButton from "@/components/CopyButton";
import Freshness from "@/components/Freshness";
import SaveWalletButton from "@/components/SaveWalletButton";
import { ErrorBlock, LoadingBlock, EmptyBlock } from "@/components/StateViews";

const REFRESH_MS = 60_000;

export default function WalletDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const router = useRouter();
  const { address } = use(params);
  const valid = isValidSolanaAddress(address);
  const [searchValue, setSearchValue] = useState("");

  const { status, data, error, isRefreshing, refetch } = useApi(
    valid ? `/api/wallet/${address}` : null,
    WalletResponseSchema,
    { refreshMs: REFRESH_MS }
  );

  // Remember successful lookups so they show up under "Recent" on /wallet.
  useEffect(() => {
    if (status === "ready") recentWallets.add({ address, visitedAt: Date.now() });
  }, [status, address]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (!isValidSolanaAddress(trimmed)) return;
    router.push(`/wallet/${trimmed}`);
  }

  return (
    <>
      <div className="eyebrow">Wallet lookup</div>
      <h1 className="page-title">
        {status === "ready" ? truncateAddress(address, 6) : "Wallet"}
      </h1>
      <p className="page-subtitle" style={{ wordBreak: "break-all", marginBottom: 12 }}>
        {address}
      </p>

      {valid && (
        <div className="action-row">
          <CopyButton value={address} label="Copy wallet address" />
          <a
            className="ghost-button small"
            href={explorerUrl("account", address)}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Solscan ↗
          </a>
          <SaveWalletButton address={address} />
          <span className="action-spacer" />
          <Freshness
            updatedAt={data?.fetchedAt ?? null}
            isRefreshing={isRefreshing}
            error={status === "ready" ? error : null}
            onRefresh={refetch}
          />
        </div>
      )}

      <form className="search-form" onSubmit={handleSearchSubmit}>
        <input
          className="search-input"
          placeholder="Look up a different address"
          aria-label="Look up a different Solana address"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          spellCheck={false}
        />
        <button className="search-button" type="submit">
          Look up
        </button>
      </form>

      {!valid && (
        <div className="state-block error" role="alert">
          &quot;{truncateAddress(address, 10)}&quot; isn&apos;t a valid Solana
          wallet address.
        </div>
      )}

      {status === "loading" && <LoadingBlock label="Loading wallet data…" />}

      {status === "error" && (
        <ErrorBlock title="Couldn't load this wallet" message={error ?? ""} onRetry={refetch} />
      )}

      {status === "ready" && data && <WalletSummary wallet={data.wallet} />}
    </>
  );
}

function WalletSummary({ wallet }: { wallet: WalletData }) {
  const [sort, setSort] = useState<HoldingSort>({ key: "valueUsd", dir: "desc" });
  const [hideDust, setHideDust] = useState(false);

  const dustCount = useMemo(() => wallet.tokens.filter(isDust).length, [wallet.tokens]);
  const rows = useMemo(() => {
    const base = hideDust ? wallet.tokens.filter((t) => !isDust(t)) : wallet.tokens;
    return sortHoldings(base, sort);
  }, [wallet.tokens, hideDust, sort]);

  function toggleSort(key: HoldingSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

  const sortHeader = (key: HoldingSortKey, label: string) => (
    <span
      role="columnheader"
      aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      style={{ textAlign: "right" }}
    >
      <button
        type="button"
        className={`sort-button${sort.key === key ? " active" : ""}`}
        onClick={() => toggleSort(key)}
      >
        {label}
        <span aria-hidden="true">
          {sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
        </span>
      </button>
    </span>
  );

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">SOL balance</div>
          <div className="summary-value">{formatAmount(wallet.solBalance)} SOL</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">SOL value</div>
          <div className="summary-value">{formatUsd(wallet.solValueUsd)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total portfolio value</div>
          <div className="summary-value">{formatUsd(wallet.totalValueUsd)}</div>
        </div>
      </div>

      <div className="section-row">
        <div className="section-heading" style={{ margin: 0 }}>
          Token holdings ({rows.length}
          {rows.length !== wallet.tokens.length ? ` of ${wallet.tokens.length}` : ""})
        </div>
        {dustCount > 0 && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={hideDust}
              onChange={(e) => setHideDust(e.target.checked)}
            />
            Hide unpriced / under $1 ({dustCount})
          </label>
        )}
      </div>

      {wallet.tokens.length === 0 ? (
        <EmptyBlock>No SPL token balances found.</EmptyBlock>
      ) : rows.length === 0 ? (
        <EmptyBlock>Every token here is unpriced or under $1.</EmptyBlock>
      ) : (
        <div className="ledger ledger--wallet" role="table" aria-label="Token holdings">
          <div className="ledger-head" role="row">
            <span role="columnheader">Token</span>
            {sortHeader("amount", "Balance")}
            {sortHeader("valueUsd", "Value")}
            <span role="columnheader" style={{ textAlign: "right" }}>Share</span>
          </div>
          {rows.map((holding) => {
            const share = shareOfTotal(holding.valueUsd, wallet.totalValueUsd);
            return (
              <div key={holding.mint} className="ledger-row" role="row">
                <div className="token-identity" role="cell">
                  <div className="token-avatar-fallback" aria-hidden="true">
                    {(holding.symbol ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/token/${holding.mint}`} className="row-link">
                      <span className="token-name">{holding.name ?? "Unknown token"}</span>
                    </Link>
                    <div className="token-symbol">
                      {holding.symbol ?? truncateAddress(holding.mint)}
                    </div>
                  </div>
                </div>
                <div className="mono-cell" data-label="Balance" role="cell">
                  {formatAmount(holding.amount)}
                </div>
                <div className="mono-cell" data-label="Value" role="cell">
                  {formatUsd(holding.valueUsd)}
                </div>
                <div className="mono-cell" data-label="Share" role="cell">
                  {share === null ? "—" : `${share < 0.1 ? "<0.1" : share.toFixed(1)}%`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
