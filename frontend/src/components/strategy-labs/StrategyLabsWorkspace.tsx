"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  SimulatedAiPortfolioSystem,
  SimulatedPortfolioClosedTrade,
  SimulatedPortfolioEquityPoint,
  SimulatedPortfolioMode,
  SimulatedPortfolioModeResult,
  SimulatedPortfolioOpenPosition,
} from "@/lib/trading/simulated-ai-portfolio";
import { strategyFamilyLabel } from "@/lib/trading/strategy-intelligence";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { trackFirstUsefulAction } from "@/lib/client/analytics";

const MODE_ORDER: SimulatedPortfolioMode[] = ["conservative", "balanced", "aggressive"];

export function StrategyLabsWorkspace({ system }: { system: SimulatedAiPortfolioSystem }) {
  const [mode, setMode] = useState<SimulatedPortfolioMode>("balanced");
  const active = system.modes[mode];
  const generatedAt = useMemo(() => formatDateTime(system.generatedAt), [system.generatedAt]);

  useEffect(() => {
    trackFirstUsefulAction("strategy_labs_review", { mode: "balanced" }, { source: "strategy_labs" });
  }, []);

  return (
    <div className="space-y-5 pb-24 sm:pb-8">
      <section className="overflow-hidden rounded-3xl border border-cyan-300/18 bg-slate-950/75 shadow-2xl shadow-black/30 ring-1 ring-white/5">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Strategy Labs</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Simulated AI Portfolio Engine</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Transparent model portfolios built from TradeVeto scanner, strategy, macro, event, shock, and risk/reward intelligence. Simulation only. No real-money execution.
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:w-[420px]">
              <Badge label="Mode" value={active.config.label} />
              <Badge label="Evidence" value={system.primaryHorizon} />
              <Badge label="Updated" value={generatedAt} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Simulation Mode</div>
              <div className="grid gap-2">
                {MODE_ORDER.map((item) => (
                  <button
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      item === mode
                        ? "border-cyan-300/45 bg-cyan-400/12 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.14)]"
                        : "border-white/10 bg-slate-950/55 text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.05]"
                    }`}
                    key={item}
                    onClick={() => setMode(item)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{system.modes[item].config.label}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-xs">{system.modes[item].stats.strategyQualityScore}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{system.modes[item].config.riskPolicy}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">Research Boundary</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                These portfolios are simulated research sleeves. They do not place broker orders, do not promise returns, and do not replace the core WAIT / AVOID risk guardrails.
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <SummaryPanel result={active} />
            <PortfolioCurve points={active.equityCurve} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Panel eyebrow="Current Model Portfolio" title={`${active.config.label} Open Model Sleeve`}>
            <CurrentPositions positions={active.openPositions} />
          </Panel>

          <ResponsiveAdvancedDetails
            eyebrow="Trade history"
            summary="Open this when you want the full simulated trade log."
            title="Why simulated trades entered and exited"
          >
            <Panel eyebrow="Transparent History" title="Simulated Entry / Exit Log">
              <ClosedTrades trades={active.closedTrades} />
            </Panel>
          </ResponsiveAdvancedDetails>
        </div>

        <div className="space-y-5">
          <Panel eyebrow="Risk Policy" title="Mode Rules">
            <div className="space-y-3 text-sm leading-6 text-slate-300">
              <p>{active.config.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <SmallMetric label="Min score" value={`${active.config.minModeScore}/100`} />
                <SmallMetric label="Max fragility" value={`${active.config.maxFragilityScore}/100`} />
                <SmallMetric label="Base allocation" value={`${active.config.baseAllocationPct}%`} />
                <SmallMetric label="Max allocation" value={`${active.config.maxAllocationPct}%`} />
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Limitations" title="What This Does Not Prove">
            <ul className="space-y-2 text-sm leading-6 text-slate-400">
              {system.limitations.map((line) => <li key={line}>- {line}</li>)}
            </ul>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function SummaryPanel({ result }: { result: SimulatedPortfolioModeResult }) {
  const stats = result.stats;
  const cards = [
    { label: "Sim Return", tone: stats.simulatedReturnPct, value: formatPct(stats.simulatedReturnPct) },
    { label: "Benchmark", tone: stats.benchmarkReturnPct, value: formatPct(stats.benchmarkReturnPct) },
    { label: "Realized PnL", tone: stats.realizedPnl, value: formatMoney(stats.realizedPnl) },
    { label: "Unrealized PnL", tone: stats.unrealizedPnl, value: formatMoney(stats.unrealizedPnl) },
    { label: "Win Rate", value: formatPct(stats.winRatePct) },
    { label: "Avg Hold", value: stats.averageHoldDays === null ? "N/A" : `${stats.averageHoldDays.toFixed(1)}D` },
    { label: "Volatility", value: formatPct(stats.volatilityPct) },
    { label: "Max Drawdown", tone: stats.maxDrawdownPct === null ? null : -stats.maxDrawdownPct, value: formatPct(stats.maxDrawdownPct) },
    { label: "Strategy Quality", value: `${stats.strategyQualityScore}/100` },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Performance Snapshot</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{result.summary}</p>
        </div>
        <div className="shrink-0 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
          {stats.closedTradeCount.toLocaleString()} closed simulated trades
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/65 p-3" key={card.label}>
            <div className="truncate text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500" title={card.label}>{card.label}</div>
            <div className={`mt-1 truncate font-mono text-lg font-black ${toneClass(card.tone)}`}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioCurve({ points }: { points: SimulatedPortfolioEquityPoint[] }) {
  if (points.length < 2) {
    return <EmptyState message="Not enough completed evidence to draw a simulated portfolio curve yet." />;
  }
  const width = 760;
  const height = 230;
  const padding = 18;
  const values = points.flatMap((point) => [point.value, point.benchmarkValue]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const yFor = (value: number) => padding + (height - padding * 2) - ((value - min) / range) * (height - padding * 2);
  const xFor = (index: number) => points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  const pathFor = (field: "benchmarkValue" | "value") => points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(point[field]).toFixed(2)}`).join(" ");
  const latest = points[points.length - 1];
  const first = points[0];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Portfolio Curve</div>
          <div className="mt-1 font-mono text-2xl font-black text-slate-50">{formatMoney(latest?.value ?? null)}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-cyan-100">Model portfolio</span>
          <span className="rounded-full border border-slate-500/30 bg-slate-800/50 px-3 py-1 text-slate-300">Benchmark proxy</span>
        </div>
      </div>
      <svg aria-label="Simulated portfolio equity curve" className="mt-4 h-56 w-full overflow-visible" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="strategy-lab-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,211,238,0.20)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </linearGradient>
        </defs>
        <path d={`${pathFor("value")} L ${width} ${height} L 0 ${height} Z`} fill="url(#strategy-lab-fill)" opacity="0.85" />
        <path d={pathFor("benchmarkValue")} fill="none" stroke="rgba(148,163,184,0.55)" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={pathFor("value")} fill="none" stroke="rgb(34,211,238)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <SmallMetric label="Start" value={formatMoney(first?.value ?? null)} />
        <SmallMetric label="Latest" value={formatMoney(latest?.value ?? null)} />
        <SmallMetric label="Samples" value={`${Math.max(0, points.length - 1).toLocaleString()} trades`} />
      </div>
    </div>
  );
}

function CurrentPositions({ positions }: { positions: SimulatedPortfolioOpenPosition[] }) {
  if (!positions.length) {
    return <EmptyState message="No current symbols clear this mode's simulation gate. This is a risk-control outcome, not a broken state." />;
  }
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {positions.map((position) => (
        <article className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4" key={`${position.symbol}:${position.strategyFamily}`}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-2xl font-black text-slate-50">{position.symbol}</div>
              <div className="mt-1 text-xs font-semibold text-cyan-200">{strategyFamilyLabel(position.strategyFamily)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs">
              <SmallMetric label="Allocation" value={`${position.allocationPct.toFixed(1)}%`} />
              <SmallMetric label="Mode Score" value={`${position.modeScore}/100`} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <SmallMetric label="Entry Mark" value={formatMoney(position.entryMarkPrice)} />
            <SmallMetric label="Current Mark" value={formatMoney(position.currentPrice)} />
            <SmallMetric label="Unrealized" value={formatMoney(position.unrealizedPnl)} />
            <SmallMetric label="Unrealized %" value={formatPct(position.unrealizedPnlPct)} />
          </div>
          <ReasonBlock title="Why included" items={position.entryReasons} />
          <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm leading-6 text-slate-300">{position.exitPlan}</div>
        </article>
      ))}
    </div>
  );
}

function ClosedTrades({ trades }: { trades: SimulatedPortfolioClosedTrade[] }) {
  if (!trades.length) {
    return <EmptyState message="No closed simulated trades are available for this mode yet. The engine needs completed forward-return evidence." />;
  }
  return (
    <div className="space-y-3">
      {trades.slice(0, 12).map((trade) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={trade.id}>
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-mono text-xl font-black text-slate-50">{trade.symbol}</div>
                <span className="rounded-full border border-white/10 bg-slate-950/65 px-2 py-1 text-xs font-semibold text-slate-300">{strategyFamilyLabel(trade.strategyFamily)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">{trade.entryDate} to {trade.exitDate} | {trade.horizonDays}D hold</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs sm:grid-cols-4 lg:min-w-[360px]">
              <SmallMetric label="Return" tone={trade.realizedReturnPct} value={formatPct(trade.realizedReturnPct)} />
              <SmallMetric label="PnL" tone={trade.realizedPnl} value={formatMoney(trade.realizedPnl)} />
              <SmallMetric label="Allocation" value={`${trade.allocationPct.toFixed(1)}%`} />
              <SmallMetric label="Score" value={`${trade.modeScore}/100`} />
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ReasonBlock items={trade.entryReasons} title="Why entered" />
            <ReasonBlock items={trade.exitReasons} title="Why exited" />
          </div>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-300 lg:grid-cols-3">
            <ContextPill label="Macro" value={trade.macroReason} />
            <ContextPill label="Event" value={trade.eventReason} />
            <ContextPill label="Risk/Reward" value={trade.riskRewardReason} />
          </div>
        </article>
      ))}
    </div>
  );
}

function Panel({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
  return (
    <section className="min-w-0 rounded-3xl border border-white/10 bg-slate-950/65 p-4 shadow-xl shadow-black/20 ring-1 ring-white/5 sm:p-5">
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</div>
        <h2 className="mt-1 text-lg font-semibold text-slate-50">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ReasonBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-300">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function ContextPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm leading-5 text-slate-300">{value}</div>
    </div>
  );
}

function SmallMetric({ label, tone, value }: { label: string; tone?: number | null; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/55 p-3">
      <div className="truncate text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-bold ${toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="truncate text-[10px] font-black uppercase tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100" title={value}>{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-8 text-center text-sm leading-6 text-slate-400">
      {message}
    </div>
  );
}

function toneClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-slate-100";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 0, style: "currency" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
}
