"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useApi } from "@/hooks/useApi";
import { CandlesResponseSchema } from "@/lib/contracts";
import { CHART_INTERVALS } from "@/types/solana";
import type { Candle, ChartInterval } from "@/types/solana";

/**
 * Tokens that move 50x+ (typical for a fresh launch) are unreadable on a
 * linear axis: everything early is squashed against the bottom. Default
 * those to a logarithmic axis; the user can still flip it.
 */
const AUTO_LOG_RATIO = 50;
export function shouldDefaultToLog(candles: Candle[]): boolean {
  let min = Infinity;
  let max = 0;
  for (const c of candles) {
    if (c.low > 0 && c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  return Number.isFinite(min) && max / min >= AUTO_LOG_RATIO;
}

// lightweight-charts needs the DOM, so keep it out of the SSR pass entirely.
const CandlestickChart = dynamic(() => import("./CandlestickChart"), {
  ssr: false,
  loading: () => <div className="chart-state">Loading chart…</div>,
});

export default function TokenChart({ mint }: { mint: string }) {
  const [interval, setInterval] = useState<ChartInterval>("15m");
  // A manual log/linear choice, remembered only for the token+interval it was made on.
  const [logChoice, setLogChoice] = useState<{ key: string; log: boolean } | null>(null);

  const { status, data, error, refetch } = useApi(
    `/api/chart/${mint}?interval=${interval}`,
    CandlesResponseSchema,
    { refreshMs: 60_000 }
  );

  const resetKey = `${mint}:${interval}`;
  const autoLog = data ? shouldDefaultToLog(data.candles) : false;
  const isLog = logChoice?.key === resetKey ? logChoice.log : autoLog;

  return (
    <div className="chart-panel">
      <div className="chart-toolbar">
        <span className="chart-title">Price chart · USD</span>
        <div className="chart-controls">
          <button
            type="button"
            className={`interval-tab ${isLog ? "active" : ""}`}
            aria-pressed={isLog}
            title="Logarithmic price scale: equal percentage moves take equal height"
            onClick={() => setLogChoice({ key: resetKey, log: !isLog })}
          >
            Log
          </button>
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
      </div>

      {status === "loading" && (
        <div className="chart-state" role="status">
          <div className="spinner" aria-hidden="true" />
          Loading {interval} candles…
        </div>
      )}

      {status === "error" && (
        <div className="chart-state error" role="alert">
          <div>Couldn&apos;t load the chart: {error}</div>
          <button type="button" className="ghost-button" onClick={refetch}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && data && data.candles.length === 0 && (
        <div className="chart-state">No chart data for this interval yet.</div>
      )}

      {status === "ready" && data && data.candles.length > 0 && (
        <CandlestickChart
          candles={data.candles}
          // Re-fit the view only when the user switches token/interval -
          // not on background refreshes, which would reset their zoom.
          resetKey={resetKey}
          logScale={isLog}
        />
      )}
    </div>
  );
}
