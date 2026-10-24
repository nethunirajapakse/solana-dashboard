"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isValidSolanaAddress } from "@/lib/validate";
import { truncateAddress } from "@/lib/format";
import { usePersistedList } from "@/hooks/usePersistedList";
import { recentWallets, savedWallets } from "@/lib/stores";
import SavedWalletRow from "@/components/SavedWalletRow";

export default function WalletSearchPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const saved = usePersistedList(savedWallets);
  const recents = usePersistedList(recentWallets);

  const trimmed = value.trim();
  const isValid = trimmed.length === 0 || isValidSolanaAddress(trimmed);
  const showError = touched && !isValid;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValidSolanaAddress(trimmed)) return;
    router.push(`/wallet/${trimmed}`);
  }

  // Recents that are already saved would just be noise.
  const savedAddresses = new Set(saved.map((w) => w.address));
  const recentOnly = recents.filter((r) => !savedAddresses.has(r.address));

  return (
    <>
      <div className="eyebrow">Wallet lookup</div>
      <h1 className="page-title">Check a Solana wallet</h1>
      <p className="page-subtitle">
        Paste any wallet address to see its SOL balance and token holdings.
      </p>

      <form className="search-form" onSubmit={handleSubmit} noValidate>
        <input
          className={`search-input${showError ? " invalid" : ""}`}
          placeholder="e.g. 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"
          aria-label="Solana wallet address"
          aria-invalid={showError}
          aria-describedby={showError ? "wallet-error" : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoFocus
        />
        <button className="search-button" type="submit">
          Look up
        </button>
      </form>
      {showError && (
        <div className="field-error" id="wallet-error" role="alert">
          That doesn&apos;t look like a valid Solana address.
        </div>
      )}

      {saved.length > 0 && (
        <section aria-labelledby="saved-heading">
          <div className="section-heading" id="saved-heading">
            Saved wallets ({saved.length})
          </div>
          <ul className="wallet-list">
            {saved.map((w) => (
              <SavedWalletRow key={w.address} wallet={w} />
            ))}
          </ul>
        </section>
      )}

      {recentOnly.length > 0 && (
        <section aria-labelledby="recent-heading">
          <div className="section-heading" id="recent-heading">
            Recent lookups
          </div>
          <ul className="wallet-list">
            {recentOnly.map((r) => (
              <li className="wallet-item" key={r.address}>
                <div className="wallet-item-main">
                  <Link href={`/wallet/${r.address}`} className="wallet-address">
                    {truncateAddress(r.address, 10)}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
