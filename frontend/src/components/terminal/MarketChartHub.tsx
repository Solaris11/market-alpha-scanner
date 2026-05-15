"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { Activity, Bitcoin, CircleDollarSign, Droplets, Landmark, LineChart, Mountain, Waves } from "lucide-react";
import { InteractivePriceChart } from "@/components/charts/InteractivePriceChart";
import { PosterGauge, ScoreFactorStrip } from "@/components/visual/MiniVisuals";
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
    <section className="rounded-3xl border border-cyan-300/16 bg-slate-950/45 p-4 shadow-2xl shadow-black/20" id="market-charts">
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
      <MarketEnvironmentShowcasePanel marketCondition={marketCondition} rows={comparisonRows} updatedAt={updatedAt} />

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

function MarketEnvironmentShowcasePanel({ marketCondition, rows, updatedAt }: { marketCondition: string; rows: MarketComparisonRow[]; updatedAt?: string | null }) {
  const validated = rows.filter((row) => row.pointCount >= 2 && typeof row.value === "number");
  const improving = validated.filter((row) => row.tone === "up").length;
  const deteriorating = validated.filter((row) => row.tone === "down").length;
  const readiness = validated.length ? Math.round((improving / validated.length) * 100) : null;
  const riskPressure = validated.length ? Math.round((deteriorating / validated.length) * 100) : null;
  const breadthProxy = validated.length ? Math.round(((improving - deteriorating + validated.length) / (validated.length * 2)) * 100) : null;
  const pressureRows = rows.slice(0, 6);

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(300px,0.7fr)]">
      <div className="rounded-3xl border border-cyan-300/14 bg-cyan-400/[0.035] p-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          <PosterGauge label="Regime Readiness" score={readiness} tone={readiness === null ? "cyan" : readiness >= 55 ? "emerald" : readiness >= 35 ? "amber" : "rose"} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Market environment overview</div>
            <h3 className="mt-2 text-xl font-semibold text-slate-50">{marketCondition}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cross-asset context is derived from validated stored closes. TradeVeto uses these charts to frame regime, risk, and macro pressure without drawing inferred market action.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMarketStat label="Validated" value={`${validated.length}/${rows.length}`} />
              <MiniMarketStat label="Constructive" value={String(improving)} />
              <MiniMarketStat label="Deteriorating" value={String(deteriorating)} />
            </div>
          </div>
        </div>
        <ScoreFactorStrip
          className="mt-4"
          factors={[
            { detail: "Share of validated market proxy charts moving constructively over the selected one-month context window.", label: "Readiness", tone: readiness !== null && readiness >= 55 ? "emerald" : "amber", value: readiness },
            { detail: "Share of validated proxy charts moving negatively. Higher values require more caution.", label: "Risk Pressure", tone: riskPressure !== null && riskPressure >= 45 ? "rose" : "cyan", value: riskPressure },
            { detail: "Simple validated cross-asset breadth proxy. This is not a market breadth feed.", label: "Breadth Proxy", tone: breadthProxy !== null && breadthProxy >= 55 ? "emerald" : "amber", value: breadthProxy },
          ]}
          label="Data-backed macro factors"
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Macro pressure drivers</div>
        <div className="mt-3 grid gap-2">
          {pressureRows.length ? pressureRows.map((row) => (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3" key={row.symbol}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-cyan-100">{ICONS[row.symbol] ?? <LineChart className="h-4 w-4" />}</span>
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-black text-slate-100">{row.symbol}</div>
                    <div className="truncate text-[11px] text-slate-500">{row.label}</div>
                  </div>
                </div>
                <div className={row.value === null ? "text-xs font-black text-slate-500" : row.tone === "up" ? "text-xs font-black text-emerald-200" : row.tone === "down" ? "text-xs font-black text-rose-200" : "text-xs font-black text-cyan-200"}>
                  {row.value === null ? "Limited" : `${row.value >= 0 ? "+" : ""}${row.value.toFixed(1)}%`}
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-500">No validated macro proxy rows are available yet.</div>
          )}
        </div>
        {updatedAt ? <div className="mt-3 text-[11px] text-slate-500">Updated {updatedAt}</div> : null}
      </div>
    </div>
  );
}

function MiniMarketStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-black text-slate-50">{value}</div>
    </div>
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
