"use client";

import { useNow } from "@/hooks/useNow";
import { formatAgo } from "@/lib/format";

/**
 * "Updated 12s ago" + refresh button. `updatedAt` should be the time the
 * SERVER last got the data from the provider (cached responses are older
 * than the request that returned them), falling back to when we received it.
 */
export default function Freshness({
  updatedAt,
  isRefreshing,
  error,
  onRefresh,
}: {
  updatedAt: number | null;
  isRefreshing: boolean;
  /** A refresh failed but older data is still on screen. */
  error?: string | null;
  onRefresh: () => void;
}) {
  const now = useNow();

  return (
    <div className="freshness">
      {error ? (
        <span className="freshness-warn" role="status">
          Couldn&apos;t refresh{updatedAt ? ` · showing data from ${formatAgo(updatedAt, now)}` : ""}
        </span>
      ) : (
        <span role="status" aria-live="off">
          {isRefreshing ? "Refreshing…" : updatedAt ? `Updated ${formatAgo(updatedAt, now)}` : ""}
        </span>
      )}
      <button
        type="button"
        className="icon-button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh data"
        title="Refresh"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isRefreshing ? "spin" : undefined}
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </div>
  );
}
