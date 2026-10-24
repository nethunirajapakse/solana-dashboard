"use client";

// One data-fetching hook for every page, replacing four copies of the same
// effect. It gives each screen the same behaviour:
//   - typed: responses are parsed with a zod schema (the API contract)
//   - cancellable: switching tabs/pages aborts the in-flight request
//   - honest states: loading / error / ready, plus "refreshing" and
//     "refresh failed but showing last good data"
//   - retryable and (optionally) auto-refreshing while the tab is visible

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { ApiErrorSchema } from "@/lib/contracts";

export type ApiStatus = "idle" | "loading" | "ready" | "error";

interface Slot<T> {
  url: string;
  /** Which refresh tick this result answers (see isRefreshing). */
  tick: number;
  data?: T;
  error?: string;
  /** When `data` was last successfully received (epoch ms). */
  receivedAt?: number;
}

export interface UseApiResult<T> {
  status: ApiStatus;
  data: T | undefined;
  /** Set on failure. If `data` is also set, a refresh failed and `data` is stale. */
  error: string | null;
  isRefreshing: boolean;
  receivedAt: number | null;
  refetch: () => void;
}

interface Options {
  /** Re-fetch this often while the tab is visible. */
  refreshMs?: number;
}

export function useApi<S extends z.ZodType>(
  url: string | null,
  schema: S,
  { refreshMs }: Options = {}
): UseApiResult<z.output<S>> {
  type T = z.output<S>;
  const [tick, setTick] = useState(0);
  const [slot, setSlot] = useState<Slot<T> | null>(null);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        const json: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          const parsedError = ApiErrorSchema.safeParse(json);
          throw new Error(
            parsedError.success ? parsedError.data.error : `Request failed (${res.status}).`
          );
        }

        const data = schema.parse(json) as T;
        setSlot({ url, tick, data, receivedAt: Date.now() });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof TypeError
            ? "Network error. Check your connection and try again."
            : err instanceof Error && err.name !== "ZodError"
            ? err.message
            : "The server sent a response this app couldn't understand.";
        // Keep the last good data for this URL so a failed refresh doesn't blank the screen.
        setSlot((prev) => ({
          url,
          tick,
          error: message,
          data: prev?.url === url ? prev.data : undefined,
          receivedAt: prev?.url === url ? prev.receivedAt : undefined,
        }));
      }
    })();

    return () => controller.abort();
  }, [url, tick, schema]);

  // Auto-refresh only while the tab is visible; catch up when it returns.
  useEffect(() => {
    if (!url || !refreshMs) return;

    let lastRun = Date.now();
    const run = () => {
      lastRun = Date.now();
      setTick((t) => t + 1);
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, refreshMs);

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun >= refreshMs) run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, refreshMs]);

  const current = slot && slot.url === url ? slot : null;

  let status: ApiStatus = "idle";
  if (url) {
    if (!current) status = "loading";
    else if (current.data === undefined && current.error) status = "error";
    else status = "ready";
  }

  return {
    status,
    data: current?.data,
    error: current?.error ?? null,
    isRefreshing: current !== null && current.tick < tick,
    receivedAt: current?.receivedAt ?? null,
    refetch,
  };
}
