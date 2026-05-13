"use client";

import type { ReactNode } from "react";
import { Activity, Bitcoin, CircleDollarSign, Droplets, Landmark, LineChart, Mountain, Waves } from "lucide-react";
import { InteractivePriceChart } from "@/components/charts/InteractivePriceChart";
import type { MarketChartHubItem } from "@/lib/interactive-chart-data";

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
  if (!charts.length) return null;

  return (
    <section className="rounded-3xl border border-cyan-300/16 bg-slate-950/45 p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Market Chart Hub</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Clickable Market Context</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Validated cross-asset charts for the current market-state read. Click any chart for timeframe controls, source details, and TradeVeto interpretation.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Current regime</div>
          <div className="mt-1 font-mono font-black text-cyan-100">{marketCondition}</div>
          {updatedAt ? <div className="mt-1 text-[11px] text-slate-500">Updated {updatedAt}</div> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {charts.map((item) => (
          <div className="relative" key={item.symbol}>
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
