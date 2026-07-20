"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Candle, ChartInterval, CHART_INTERVALS } from "@/types/solana";

// lightweight-charts needs the DOM, so keep it out of the SSR pass entirely.
const CandlestickChart = dynamic(() => import("./CandlestickChart"), {
  ssr: false,
  loading: () => <div className="chart-state">Loading chart…</div>,
});

type LoadState = "loading" | "error" | "ready";

export default function TokenChart({ mint }: { mint: string }) {
  const [interval, setInterval] = useState<ChartInterval>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const res = await fetch(`/api/chart/${mint}?interval=${interval}`);
        const body = await res.json();

        if (!res.ok) {
          throw new Error(body?.error ?? "Failed to load chart data.");
        }

        if (!cancelled) {
          setCandles(body.candles);
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
  }, [mint, interval]);

  return (
    <div className="chart-panel">
      <div className="chart-toolbar">
        <span className="chart-title">Price chart · USD</span>
        <div className="interval-tabs" role="tablist" aria-label="Chart interval">
          {CHART_INTERVALS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={interval === value}
              className={`interval-tab ${interval === value ? "active" : ""}`}
              onClick={() => setInterval(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {state === "loading" && (
        <div className="chart-state">
          <div className="spinner" />
          Loading {interval} candles…
        </div>
      )}

      {state === "error" && (
        <div className="chart-state error">
          Couldn&apos;t load the chart: {errorMessage}
        </div>
      )}

      {state === "ready" && candles.length === 0 && (
        <div className="chart-state">No chart data for this interval yet.</div>
      )}

      {state === "ready" && candles.length > 0 && (
        <CandlestickChart candles={candles} />
      )}
    </div>
  );
}
