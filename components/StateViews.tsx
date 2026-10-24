// Loading / error / empty blocks shared by every page, so each screen
// handles all three states the same way. Errors are announced to screen
// readers (role="alert") and offer a retry.

import type { ReactNode } from "react";

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBlock({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block error" role="alert">
      <div>
        {title}: {message}
      </div>
      {onRetry && (
        <button type="button" className="ghost-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ children }: { children: ReactNode }) {
  return <div className="state-block">{children}</div>;
}

export function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="ledger" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}
