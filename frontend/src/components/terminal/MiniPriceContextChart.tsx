"use client";

import { useMemo, useState } from "react";
import { cleanText, formatMoney } from "@/lib/ui/formatters";
import { SymbolChart, type ChartCandle } from "./SymbolChart";

type MiniTimeframe = "1D" | "1W" | "1M" | "6M" | "1Y";

const TIMEFRAMES: Array<{ days: number; label: MiniTimeframe }> = [
  { days: 1, label: "1D" },
  { days: 7, label: "1W" },
  { days: 31, label: "1M" },
  { days: 183, label: "6M" },
  { days: 366, label: "1Y" },
];

export function MiniPriceContextChart({
  candles,
  entryContext,
  height = 280,
  symbol,
}: {
  candles: ChartCandle[];
  entryContext?: string | null;
  height?: number;
  symbol: string;
}) {
  const [timeframe, setTimeframe] = useState<MiniTimeframe>("6M");
  const selected = TIMEFRAMES.find((item) => item.label === timeframe) ?? TIMEFRAMES[3];
  const filtered = useMemo(() => filterCandles(candles, selected.days), [candles, selected.days]);
  const chartCandles = filtered.length >= 2 ? filtered : candles.slice(-Math.min(candles.length, 80));
  const latest = chartCandles.at(-1)?.close ?? candles.at(-1)?.close ?? null;
  const usingFallbackRange = filtered.length < 2 && candles.length > 0;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-slate-50">{symbol.toUpperCase()}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Mini price context</div>
        </div>
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((item) => (
            <button
              className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${
                item.label === timeframe ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/40 hover:text-cyan-100"
              }`}
              key={item.label}
              onClick={() => setTimeframe(item.label)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <SymbolChart candles={chartCandles} height={height} showHeaderBadge={false} symbol={symbol} />
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <MiniMetric label="Latest" value={latest === null ? "N/A" : formatMoney(latest)} />
        <MiniMetric label="Entry context" value={cleanText(entryContext, "No active entry context")} />
      </div>
      {usingFallbackRange ? <div className="mt-2 text-[11px] text-slate-500">Selected range is limited; showing available scanner history.</div> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/35 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[12px] font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function filterCandles(candles: ChartCandle[], days: number): ChartCandle[] {
  if (!candles.length) return [];
  const sorted = [...candles].sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
  const latestTime = Date.parse(sorted.at(-1)?.time ?? "");
  if (!Number.isFinite(latestTime)) return sorted.slice(-80);
  const cutoff = latestTime - days * 24 * 60 * 60 * 1000;
  return sorted.filter((candle) => {
    const time = Date.parse(candle.time);
    return Number.isFinite(time) && time >= cutoff;
  });
}
