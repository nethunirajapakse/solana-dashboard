"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isValidSolanaAddress } from "@/lib/validate";

export default function WalletSearchPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const isValid = trimmed.length === 0 || isValidSolanaAddress(trimmed);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValidSolanaAddress(trimmed)) return;
    router.push(`/wallet/${trimmed}`);
  }

  return (
    <>
      <div className="eyebrow">Wallet lookup</div>
      <h1 className="page-title">Check a Solana wallet</h1>
      <p className="page-subtitle">
        Paste any wallet address to see its SOL balance and token holdings.
      </p>

      <form className="search-form" onSubmit={handleSubmit}>
        <input
          className={`search-input${
            touched && !isValid ? " invalid" : ""
          }`}
          placeholder="e.g. 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoFocus
        />
        <button className="search-button" type="submit">
          Look up
        </button>
      </form>
      {touched && !isValid && (
        <div className="field-error">
          That doesn&apos;t look like a valid Solana address.
        </div>
      )}
    </>
  );
}
