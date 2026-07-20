"use client";

import { useEffect, useState } from "react";
import { TrendingToken } from "@/types/solana";
import TokenRow from "@/components/TokenRow";

type LoadState = "loading" | "error" | "ready";

export default function TrendingPage() {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const res = await fetch("/api/trending?timeframe=1h");
        const body = await res.json();

        if (!res.ok) {
          throw new Error(body?.error ?? "Failed to load trending tokens.");
        }

        if (!cancelled) {
          setTokens(body.tokens);
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
  }, []);

  return (
    <>
      <div className="eyebrow">Live feed · Solana mainnet</div>
      <h1 className="page-title">Trending tokens</h1>
      <p className="page-subtitle">
        Ranked by trading volume over the last hour, via the SolanaTracker
        Data API.
      </p>

      {state === "loading" && <TrendingSkeleton />}

      {state === "error" && (
        <div className="state-block error">
          Couldn&apos;t load trending tokens: {errorMessage}
        </div>
      )}

      {state === "ready" && tokens.length === 0 && (
        <div className="state-block">No trending tokens right now.</div>
      )}

      {state === "ready" && tokens.length > 0 && (
        <div className="ledger">
          <div className="ledger-head">
            <span>#</span>
            <span>Token</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>24h</span>
            <span style={{ textAlign: "right" }}>Mkt Cap</span>
          </div>
          {tokens.map((token, i) => (
            <TokenRow key={token.mint} token={token} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

function TrendingSkeleton() {
  return (
    <div className="ledger">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
