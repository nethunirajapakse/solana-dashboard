"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  PriceScaleMode,
  TickMarkType,
  createChart,
} from "lightweight-charts";
import type {
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/types/solana";
import { formatChartPrice, formatVolume } from "@/lib/format";

// Renders OHLC candles + volume with TradingView's lightweight-charts. The
// library measures and paints into a real DOM node, so this component must
// only ever run in the browser - TokenChart loads it via next/dynamic ssr:false.

const UP = "#4fd1ae";
const DOWN = "#ff6b6b";
const UP_VOLUME = "rgba(79, 209, 174, 0.35)";
const DOWN_VOLUME = "rgba(255, 107, 107, 0.35)";

/**
 * How many bar slots the first view spans. It adapts to the data: a token
 * with 30 candles gets a tighter view than one with 500, so the chart looks
 * filled, while the slot count is clamped so a brand-new token (2 candles)
 * doesn't turn into a few enormous bars.
 */
const MIN_SLOTS = 30;
const MAX_SLOTS = 100;
const visibleSlots = (candleCount: number) =>
  Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, Math.ceil(candleCount * 1.25)));
/** Candles never get wider than this, however few there are. */
const MAX_BAR_SPACING = 22;
/** Empty bar slots to the right of the latest candle. */
const RIGHT_PADDING_BARS = 5;

// Times are Unix seconds (UTC). Show them in the viewer's own timezone.
const local = (time: Time, options: Intl.DateTimeFormatOptions) =>
  new Date((time as number) * 1000).toLocaleString([], options);

function tickMark(time: Time, type: TickMarkType): string {
  switch (type) {
    case TickMarkType.Year:
      return local(time, { year: "numeric" });
    case TickMarkType.Month:
      return local(time, { month: "short" });
    case TickMarkType.DayOfMonth:
      return local(time, { day: "numeric", month: "short" });
    default:
      return local(time, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
}

/**
 * Axis/crosshair label. The autoscale margins push the visible range
 * slightly below zero for tokens priced near zero; negative prices are
 * meaningless here, so those ticks are left blank instead of "-0.00".
 */
function axisPrice(price: number): string {
  if (price < 0) return "";
  if (price < 1e-12) return "0";
  return formatChartPrice(price);
}

/** Decimal step small enough to represent this token's prices on the axis. */
function minMoveFor(candles: Candle[]): number {
  let min = Infinity;
  for (const c of candles) if (c.low > 0 && c.low < min) min = c.low;
  if (!Number.isFinite(min)) return 0.01;
  const exponent = Math.floor(Math.log10(min)) - 3;
  return Math.max(10 ** exponent, 1e-12);
}

export default function CandlestickChart({
  candles,
  resetKey,
  logScale = false,
}: {
  candles: Candle[];
  /** When this changes the visible range is reset to the latest bars. */
  resetKey: string;
  /** Logarithmic price axis: keeps early-vs-now moves readable on tokens that grew 100x. */
  logScale?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const byTimeRef = useRef<Map<number, Candle>>(new Map());
  const positionedKeyRef = useRef<string | null>(null);

  // The candle under the crosshair (null -> show the latest candle).
  const [hovered, setHovered] = useState<Candle | null>(null);

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
        barSpacing: 10,
        minBarSpacing: 1,
        maxBarSpacing: MAX_BAR_SPACING,
        rightOffset: RIGHT_PADDING_BARS,
        tickMarkFormatter: tickMark,
      },
      localization: {
        timeFormatter: (time: Time) =>
          local(time, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
        priceFormatter: axisPrice,
      },
      crosshair: {
        vertLine: { color: "#7c9cff", labelBackgroundColor: "#7c9cff" },
        horzLine: { color: "#7c9cff", labelBackgroundColor: "#7c9cff" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
      // Custom formatter: the built-in one rounds micro-prices to "0.00".
      priceFormat: { type: "custom", formatter: axisPrice, minMove: 0.01 },
    });
    // Leave the bottom of the pane for volume bars.
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "", // own overlay scale, independent of price
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chart.subscribeCrosshairMove((param) => {
      setHovered(param.time ? byTimeRef.current.get(param.time as number) ?? null : null);
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      positionedKeyRef.current = null;
    };
  }, []);

  // Push new data whenever the fetched candles change (new interval, or a refresh).
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    byTimeRef.current = new Map(candles.map((c) => [c.time, c]));

    candleSeries.applyOptions({
      priceFormat: { type: "custom", formatter: axisPrice, minMove: minMoveFor(candles) },
    });

    const candleData: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volumeData: HistogramData<UTCTimestamp>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? UP_VOLUME : DOWN_VOLUME,
    }));
    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    // Position once per token/interval; background refreshes keep the
    // user's zoom and scroll. We show a fixed number of bar slots rather
    // than fitting all data: with few candles (a new token) fitContent
    // would stretch them into a handful of enormous bars.
    if (positionedKeyRef.current !== resetKey) {
      const n = candles.length;
      chart.timeScale().setVisibleLogicalRange({
        from: n - visibleSlots(n),
        to: n - 1 + RIGHT_PADDING_BARS,
      });
      positionedKeyRef.current = resetKey;
    }
  }, [candles, resetKey]);

  useEffect(() => {
    candleSeriesRef.current?.priceScale().applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [logScale]);

  const shown = hovered ?? candles[candles.length - 1];
  const change = shown && shown.open > 0 ? ((shown.close - shown.open) / shown.open) * 100 : null;
  const tone = shown && shown.close >= shown.open ? "change-up" : "change-down";

  return (
    <div>
      <div className="chart-legend" aria-live="off">
        {shown && (
          <>
            <span>
              O <b>{formatChartPrice(shown.open)}</b>
            </span>
            <span>
              H <b>{formatChartPrice(shown.high)}</b>
            </span>
            <span>
              L <b>{formatChartPrice(shown.low)}</b>
            </span>
            <span>
              C <b>{formatChartPrice(shown.close)}</b>
            </span>
            {change !== null && (
              <span className={tone}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
            <span>
              Vol <b>{formatVolume(shown.volume)}</b>
            </span>
          </>
        )}
      </div>
      <div
        ref={containerRef}
        className="chart-canvas"
        role="img"
        aria-label="Candlestick price chart with volume"
      />
    </div>
  );
}
