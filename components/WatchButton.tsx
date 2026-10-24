"use client";

import { useEffect, useRef, useState } from "react";
import { usePersistedList } from "@/hooks/usePersistedList";
import { MAX_WATCHLIST, watchlist } from "@/lib/stores";

interface Props {
  token: { mint: string; name: string; symbol: string; image: string | null };
  /** "icon" for table rows, "full" (icon + text) for headers. */
  variant?: "icon" | "full";
}

export default function WatchButton({ token, variant = "icon" }: Props) {
  const items = usePersistedList(watchlist);
  const watching = items.some((t) => t.mint === token.mint);
  const [full, setFull] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function toggle() {
    if (watching) {
      watchlist.remove(token.mint);
      return;
    }
    const result = watchlist.add({
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      image: token.image,
      addedAt: Date.now(),
    });
    if (!result.ok) {
      setFull(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFull(false), 3000);
    }
  }

  const label = watching
    ? `Remove ${token.name} from watchlist`
    : `Add ${token.name} to watchlist`;

  return (
    <button
      type="button"
      className={`watch-button${watching ? " on" : ""}${variant === "full" ? " full" : ""}`}
      onClick={toggle}
      aria-pressed={watching}
      aria-label={label}
      title={full ? `Watchlist is full (${MAX_WATCHLIST})` : label}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={watching ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
      </svg>
      {variant === "full" && (
        <span>{full ? "Watchlist full" : watching ? "Watching" : "Watch"}</span>
      )}
    </button>
  );
}
