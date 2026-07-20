"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";
import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { Candle } from "@/types/solana";

// Renders OHLC candles with TradingView's lightweight-charts. The library
// measures and paints into a real DOM node, so this component must only
// ever run in the browser - TokenChart loads it via next/dynamic ssr:false.
export default function CandlestickChart({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Create the chart once. autoSize lets lightweight-charts track the
  // container with its own ResizeObserver, so no manual resize wiring.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b98a5",
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(33, 43, 56, 0.55)" },
        horzLines: { color: "rgba(33, 43, 56, 0.55)" },
      },
      rightPriceScale: { borderColor: "#212b38" },
      timeScale: {
        borderColor: "#212b38",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "#7c9cff", labelBackgroundColor: "#7c9cff" },
        horzLine: { color: "#7c9cff", labelBackgroundColor: "#7c9cff" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#4fd1ae",
      downColor: "#ff6b6b",
      borderVisible: false,
      wickUpColor: "#4fd1ae",
      wickDownColor: "#ff6b6b",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push new data whenever the fetched candles change (e.g. new interval).
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const data: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="chart-canvas" />;
}
