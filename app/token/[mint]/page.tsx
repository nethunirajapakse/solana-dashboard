"use client";

import { use } from "react";
import { useApi } from "@/hooks/useApi";
import { TokenResponseSchema } from "@/lib/contracts";
import { isValidSolanaAddress } from "@/lib/validate";
import { explorerUrl, formatPercent, formatUsd, truncateAddress } from "@/lib/format";
import type { TokenDetails } from "@/types/solana";
import TokenChart from "@/components/TokenChart";
import TokenAvatar from "@/components/TokenAvatar";
import WatchButton from "@/components/WatchButton";
import CopyButton from "@/components/CopyButton";
import Freshness from "@/components/Freshness";
import { changeClass } from "@/components/TokenRow";
import { ErrorBlock, LoadingBlock } from "@/components/StateViews";

const REFRESH_MS = 60_000;

export default function TokenDetailPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);
  const valid = isValidSolanaAddress(mint);

  const { status, data, error, isRefreshing, refetch } = useApi(
    valid ? `/api/token/${mint}` : null,
    TokenResponseSchema,
    { refreshMs: REFRESH_MS }
  );

  return (
    <>
      <div className="eyebrow">Token · Solana mainnet</div>

      {status === "ready" && data ? (
        <TokenHeader token={data.token} />
      ) : (
        <>
          <h1 className="page-title">Token</h1>
          <p className="page-subtitle" style={{ wordBreak: "break-all" }}>
            {mint}
          </p>
        </>
      )}

      {!valid && (
        <div className="state-block error" role="alert">
          &quot;{truncateAddress(mint, 10)}&quot; isn&apos;t a valid Solana token
          mint address.
        </div>
      )}

      {status === "loading" && <LoadingBlock label="Loading token data…" />}

      {status === "error" && (
        <ErrorBlock title="Couldn't load this token" message={error ?? ""} onRetry={refetch} />
      )}

      {status === "ready" && data && (
        <>
          <div className="action-row">
            <Freshness
              updatedAt={data.fetchedAt}
              isRefreshing={isRefreshing}
              error={error}
              onRefresh={refetch}
            />
          </div>
          <TokenStats token={data.token} />
          <TokenChart mint={mint} />
        </>
      )}
    </>
  );
}

function TokenHeader({ token }: { token: TokenDetails }) {
  return (
    <div className="token-header">
      <TokenAvatar image={token.image} symbol={token.symbol} large />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 className="page-title">{token.name}</h1>
        <div className="token-header-meta">
          <span className="token-symbol-badge">{token.symbol}</span>
          <span className="token-mint" title={token.mint}>
            {truncateAddress(token.mint, 6)}
          </span>
          <CopyButton value={token.mint} label="Copy token mint address" />
          <a
            className="ghost-button small"
            href={explorerUrl("token", token.mint)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Solscan ↗
          </a>
        </div>
      </div>
      <WatchButton token={token} variant="full" />
    </div>
  );
}

function TokenStats({ token }: { token: TokenDetails }) {
  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="summary-label">Price</div>
        <div className="summary-value">{formatUsd(token.priceUsd)}</div>
      </div>
      <div className="summary-card">
        <div className="summary-label">24h change</div>
        <div className={`summary-value ${changeClass(token.change24h)}`}>
          {formatPercent(token.change24h)}
        </div>
      </div>
      <div className="summary-card">
        <div className="summary-label">Market cap</div>
        <div className="summary-value">
          {formatUsd(token.marketCapUsd, { compact: true })}
        </div>
      </div>
      <div className="summary-card">
        <div className="summary-label">Liquidity</div>
        <div className="summary-value">
          {formatUsd(token.liquidityUsd, { compact: true })}
        </div>
      </div>
    </div>
  );
}
