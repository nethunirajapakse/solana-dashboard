"use client";

import { useEffect } from "react";

// Route-level error boundary: a render crash shows a recoverable message
// instead of a blank page.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="state-block error" role="alert">
      <h1 className="page-title" style={{ fontSize: 20 }}>
        Something went wrong
      </h1>
      <p>This page hit an unexpected error. Your watchlist and saved wallets are safe.</p>
      <button type="button" className="ghost-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
