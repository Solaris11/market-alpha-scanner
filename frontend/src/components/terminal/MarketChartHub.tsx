"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { Activity, Bitcoin, CircleDollarSign, Droplets, Landmark, LineChart, Mountain, Waves } from "lucide-react";
import { InteractivePriceChart } from "@/components/charts/InteractivePriceChart";
import { filterInteractivePricePoints, summarizePriceMove, type MarketChartHubItem } from "@/lib/interactive-chart-data";

type MarketChartHubProps = {
  charts: MarketChartHubItem[];
  marketCondition: string;
  updatedAt?: string | null;
};

const ICONS: Record<string, ReactNode> = {
  BTC: <Bitcoin className="h-4 w-4" />,
  DIA: <Landmark className="h-4 w-4" />,
  GLD: <Mountain className="h-4 w-4" />,
  QQQ: <LineChart className="h-4 w-4" />,
  SPY: <Activity className="h-4 w-4" />,
  TLT: <Waves className="h-4 w-4" />,
  UUP: <CircleDollarSign className="h-4 w-4" />,
  USO: <Droplets className="h-4 w-4" />,
};

const TONES: Record<string, "cyan" | "emerald" | "rose" | "violet"> = {
  BTC: "violet",
  DIA: "cyan",
  GLD: "emerald",
  QQQ: "cyan",
  SPY: "emerald",
  TLT: "violet",
  UUP: "cyan",
  USO: "rose",
};

export function MarketChartHub({ charts, marketCondition, updatedAt }: MarketChartHubProps) {
  const comparisonRows = useMemo(() => buildComparisonRows(charts), [charts]);
  if (!charts.length) return null;

  return (
    <section className="rounded-3xl border border-cyan-300/16 bg-slate-950/45 p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Market Chart Hub</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Clickable Market Context</h2>
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400 sm:line-clamp-none">
            Validated cross-asset charts for the current market-state read. Click any chart for timeframe controls, source details, and TradeVeto interpretation.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Current regime</div>
          <div className="mt-1 font-mono font-black text-cyan-100">{marketCondition}</div>
          {updatedAt ? <div className="mt-1 text-[11px] text-slate-500">Updated {updatedAt}</div> : null}
        </div>
      </div>

      <MarketComparisonStrip rows={comparisonRows} />

      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 2xl:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {charts.map((item) => (
          <div className="relative min-w-[86vw] snap-center md:min-w-0" key={item.symbol}>
            <div className="pointer-events-none absolute left-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-slate-950/75 text-cyan-100 shadow-lg backdrop-blur-xl">
              {ICONS[item.symbol] ?? <LineChart className="h-4 w-4" />}
            </div>
            <InteractivePriceChart
              className="pt-8"
              defaultPeriod="1mo"
              interpretation={item.interpretation}
              label={item.label}
              packet={item.chart}
              relatedSignals={[
                `${item.symbol} is used as a validated cross-asset context proxy.`,
                `Market regime currently reads ${marketCondition}.`,
                "Use this chart with breadth, volatility, and risk pressure rather than as a standalone signal.",
              ]}
              tone={TONES[item.symbol] ?? "cyan"}
              compact
            />
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-slate-500">
        Charts are sourced from stored validated price history. If a timeframe has insufficient points, TradeVeto shows a limited-data state instead of drawing synthetic market action.
      </div>
    </section>
  );
}

type MarketComparisonRow = {
  label: string;
  pointCount: number;
  symbol: string;
  tone: "down" | "flat" | "up";
  value: number | null;
};

function buildComparisonRows(charts: MarketChartHubItem[]): MarketComparisonRow[] {
  return charts.map((item) => {
    const points = filterInteractivePricePoints(item.chart.rows, "1mo");
    const summary = summarizePriceMove(points);
    return {
      label: item.label,
      pointCount: points.length,
      symbol: item.symbol,
      tone: summary.tone,
      value: summary.changePct,
    };
  });
}

function MarketComparisonStrip({ rows }: { rows: MarketComparisonRow[] }) {
  if (!rows.length) return null;
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value ?? 0)), 1);
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Validated comparison mode</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">One-month normalized move using stored close history. Limited rows stay visibly marked instead of inferred.</p>
        </div>
        <div className="text-[11px] text-slate-500">Cross-asset context, not a standalone signal.</div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => {
          const width = `${Math.min(100, Math.max(4, (Math.abs(row.value ?? 0) / maxAbs) * 100))}%`;
          const toneClass = row.value === null ? "bg-slate-500" : row.tone === "up" ? "bg-emerald-300" : row.tone === "down" ? "bg-rose-300" : "bg-cyan-300";
          return (
            <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3" key={row.symbol}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-black text-slate-100">{row.symbol}</span>
                <span className={`text-xs font-black ${row.value === null ? "text-slate-500" : row.tone === "up" ? "text-emerald-200" : row.tone === "down" ? "text-rose-200" : "text-cyan-200"}`}>
                  {row.value === null ? "Limited" : `${row.value >= 0 ? "+" : ""}${row.value.toFixed(1)}%`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className={`h-full rounded-full ${toneClass}`} style={{ width }} />
              </div>
              <div className="mt-2 truncate text-[11px] text-slate-500">{row.pointCount >= 2 ? row.label : "Insufficient validated closes"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
