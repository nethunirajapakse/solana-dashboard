"use client";

import { use, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WalletData } from "@/types/solana";
import { isValidSolanaAddress } from "@/lib/validate";
import { formatAmount, formatUsd, truncateAddress } from "@/lib/format";

type LoadState = "loading" | "error" | "ready" | "invalid";

export default function WalletDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const router = useRouter();
  const { address } = use(params);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (!isValidSolanaAddress(address)) {
      setState("invalid");
      return;
    }

    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const res = await fetch(`/api/wallet/${address}`);
        const body = await res.json();

        if (!res.ok) {
          throw new Error(body?.error ?? "Failed to load wallet.");
        }

        if (!cancelled) {
          setWallet(body);
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
  }, [address]);

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
        {state === "ready" ? truncateAddress(address, 6) : "Wallet"}
      </h1>
      <p className="page-subtitle" style={{ wordBreak: "break-all" }}>
        {address}
      </p>

      <form className="search-form" onSubmit={handleSearchSubmit}>
        <input
          className="search-input"
          placeholder="Look up a different address"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          spellCheck={false}
        />
        <button className="search-button" type="submit">
          Look up
        </button>
      </form>

      {state === "invalid" && (
        <div className="state-block error">
          &quot;{truncateAddress(address, 10)}&quot; isn&apos;t a valid Solana
          wallet address.
        </div>
      )}

      {state === "loading" && (
        <div className="state-block">
          <div className="spinner" />
          Loading wallet data…
        </div>
      )}

      {state === "error" && (
        <div className="state-block error">
          Couldn&apos;t load this wallet: {errorMessage}
        </div>
      )}

      {state === "ready" && wallet && <WalletSummary wallet={wallet} />}
    </>
  );
}

function WalletSummary({ wallet }: { wallet: WalletData }) {
  return (
    <>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">SOL balance</div>
          <div className="summary-value">
            {formatAmount(wallet.solBalance)} SOL
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">SOL value</div>
          <div className="summary-value">{formatUsd(wallet.solValueUsd)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total portfolio value</div>
          <div className="summary-value">
            {formatUsd(wallet.totalValueUsd)}
          </div>
        </div>
      </div>

      <div className="section-heading">
        Token holdings ({wallet.tokens.length})
      </div>

      {wallet.tokens.length === 0 ? (
        <div className="state-block">No SPL token balances found.</div>
      ) : (
        <div className="ledger">
          <div
            className="ledger-head"
            style={{ gridTemplateColumns: "1fr 130px 110px" }}
          >
            <span>Token</span>
            <span style={{ textAlign: "right" }}>Balance</span>
            <span style={{ textAlign: "right" }}>Value</span>
          </div>
          {wallet.tokens.map((holding) => (
            <Link
              key={holding.mint}
              href={`/token/${holding.mint}`}
              className="ledger-row"
              style={{ gridTemplateColumns: "1fr 130px 110px" }}
            >
              <div className="token-identity">
                <div className="token-avatar-fallback">
                  {(holding.symbol ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="token-name">
                    {holding.name ?? "Unknown token"}
                  </div>
                  <div className="token-symbol">
                    {holding.symbol ?? truncateAddress(holding.mint)}
                  </div>
                </div>
              </div>
              <div className="mono-cell" data-label="Balance">
                {formatAmount(holding.amount)}
              </div>
              <div className="mono-cell" data-label="Value">
                {formatUsd(holding.valueUsd)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
