"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MAX_LABEL_LENGTH, savedWallets } from "@/lib/stores";
import type { SavedWallet } from "@/lib/stores";
import { truncateAddress } from "@/lib/format";

const AUTOSAVE_DELAY_MS = 500;

/**
 * A saved wallet with an inline, autosaving label. Typing saves after a
 * short pause (and on blur / when leaving the page), with a visible
 * "Saved" confirmation - no save button to forget to press.
 */
export default function SavedWalletRow({ wallet }: { wallet: SavedWallet }) {
  const [label, setLabel] = useState(wallet.label);
  const [justSaved, setJustSaved] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const address = wallet.address;

  function flush() {
    window.clearTimeout(timer.current);
    if (pending.current === null) return;
    savedWallets.update(address, { label: pending.current });
    pending.current = null;
    setJustSaved(true);
  }

  function onChange(value: string) {
    setLabel(value);
    setJustSaved(false);
    pending.current = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  // Don't lose an edit the user made right before navigating away.
  useEffect(() => {
    const pendingRef = pending;
    const timerRef = timer;
    return () => {
      window.clearTimeout(timerRef.current);
      if (pendingRef.current !== null) {
        savedWallets.update(address, { label: pendingRef.current });
        pendingRef.current = null;
      }
    };
  }, [address]);

  return (
    <li className="wallet-item">
      <div className="wallet-item-main">
        <input
          className="label-input"
          value={label}
          maxLength={MAX_LABEL_LENGTH}
          placeholder="Add a name (e.g. Main wallet)"
          aria-label={`Name for wallet ${truncateAddress(address, 6)}`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={flush}
          spellCheck={false}
        />
        <Link href={`/wallet/${address}`} className="wallet-address">
          {truncateAddress(address, 8)}
        </Link>
      </div>
      <span className="saved-flag" role="status" aria-live="polite">
        {justSaved ? "Saved ✓" : ""}
      </span>
      <button
        type="button"
        className="ghost-button small"
        onClick={() => savedWallets.remove(address)}
        aria-label={`Remove saved wallet ${wallet.label || truncateAddress(address, 6)}`}
      >
        Remove
      </button>
    </li>
  );
}
