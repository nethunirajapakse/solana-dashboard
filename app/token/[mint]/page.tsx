"use client";

import { use, useEffect, useState } from "react";
import { TokenDetails } from "@/types/solana";
import { isValidSolanaAddress } from "@/lib/validate";
import { formatPercent, formatUsd, truncateAddress } from "@/lib/format";
import TokenChart from "@/components/TokenChart";

type LoadState = "loading" | "error" | "ready" | "invalid";

export default function TokenDetailPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);

  const [token, setToken] = useState<TokenDetails | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isValidSolanaAddress(mint)) {
      setState("invalid");
      return;
    }

    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const res = await fetch(`/api/token/${mint}`);
        const body = await res.json();

        if (!res.ok) {
          throw new Error(body?.error ?? "Failed to load token.");
        }

        if (!cancelled) {
          setToken(body);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : "Something went wrong."
          );
          setState("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mint]);

  return (
    <>
      <div className="eyebrow">Token · Solana mainnet</div>

      {state === "ready" && token ? (
        <TokenHeader token={token} />
      ) : (
        <>
          <h1 className="page-title">Token</h1>
          <p className="page-subtitle" style={{ wordBreak: "break-all" }}>
            {mint}
          </p>
        </>
      )}

      {state === "invalid" && (
        <div className="state-block error">
          &quot;{truncateAddress(mint, 10)}&quot; isn&apos;t a valid Solana
          token mint address.
        </div>
      )}

      {state === "loading" && (
        <div className="state-block">
          <div className="spinner" />
          Loading token data…
        </div>
      )}

      {state === "error" && (
        <div className="state-block error">
          Couldn&apos;t load this token: {errorMessage}
        </div>
      )}

      {state === "ready" && token && (
        <>
          <TokenStats token={token} />
          <TokenChart mint={mint} />
        </>
      )}
    </>
  );
}

function TokenHeader({ token }: { token: TokenDetails }) {
  return (
    <div className="token-header">
      {token.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={token.image}
          alt=""
          className="token-avatar token-avatar-large"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="token-avatar-fallback token-avatar-large">
          {token.symbol.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title">{token.name}</h1>
        <div className="token-header-meta">
          <span className="token-symbol-badge">{token.symbol}</span>
          <span className="token-mint" title={token.mint}>
            {truncateAddress(token.mint, 6)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TokenStats({ token }: { token: TokenDetails }) {
  const changeClass =
    token.change24h === null
      ? ""
      : token.change24h >= 0
      ? "change-up"
      : "change-down";

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="summary-label">Price</div>
        <div className="summary-value">{formatUsd(token.priceUsd)}</div>
      </div>
      <div className="summary-card">
        <div className="summary-label">24h change</div>
        <div className={`summary-value ${changeClass}`}>
          {formatPercent(token.change24h)}
        </div>
      </div>
      <div className="summary-card">
        <div className="summary-label">Market cap</div>
        <div className="summary-value">
          {formatUsd(token.marketCapUsd, { compact: true })}
        </div>
      </div>
    </div>
  );
}
