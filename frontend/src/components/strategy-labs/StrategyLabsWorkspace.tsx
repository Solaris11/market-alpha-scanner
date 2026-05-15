"use client";

import Link from "next/link";
import {
  BookOpenCheck,
  Brain,
  CalendarClock,
  ChevronRight,
  FlaskConical,
  Gauge,
  LineChart,
  ListChecks,
  NotebookPen,
  PlayCircle,
  Scale,
  ShieldAlert,
  Target,
} from "lucide-react";
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
import { IconInsightRail, PosterGauge, ScoreFactorStrip } from "@/components/visual/MiniVisuals";
import { SymbolLogo } from "@/components/visual/SymbolLogo";
import { trackFirstUsefulAction } from "@/lib/client/analytics";

const MODE_ORDER: SimulatedPortfolioMode[] = ["conservative", "balanced", "aggressive"];

type StrategyTemplateCopy = {
  accent: string;
  invalidates: string;
  label: string;
  worksPoorly: string;
};

const TEMPLATE_COPY: Record<SimulatedPortfolioMode, StrategyTemplateCopy> = {
  aggressive: {
    accent: "from-rose-500/15 via-violet-500/10 to-cyan-500/10",
    invalidates: "Fragility extreme, chase risk expanding, or evidence freshness deteriorates.",
    label: "Momentum research sleeve",
    worksPoorly: "Weak breadth, reversal-heavy tape, or shock pressure without confirmation.",
  },
  balanced: {
    accent: "from-cyan-500/15 via-emerald-500/10 to-violet-500/10",
    invalidates: "Mode score falls below threshold, macro support fades, or risk/reward turns mixed.",
    label: "Core balanced sleeve",
    worksPoorly: "Choppy markets where neither trend quality nor risk control has a clear edge.",
  },
  conservative: {
    accent: "from-emerald-500/15 via-cyan-500/10 to-amber-500/10",
    invalidates: "Fragility breaches the cap, drawdown pressure grows, or evidence becomes too thin.",
    label: "Risk-first quality sleeve",
    worksPoorly: "Fast momentum tapes where patience avoids many early but higher-volatility moves.",
  },
};

export function StrategyLabsWorkspace({ system }: { system: SimulatedAiPortfolioSystem }) {
  const [mode, setMode] = useState<SimulatedPortfolioMode>("balanced");
  const active = system.modes[mode];
  const generatedAt = useMemo(() => formatDateTime(system.generatedAt), [system.generatedAt]);

  useEffect(() => {
    trackFirstUsefulAction("strategy_labs_review", { mode: "balanced" }, { source: "strategy_labs" });
  }, []);

  return (
    <div className="space-y-5 pb-24 sm:pb-8">
      <section className="poster-panel poster-panel-lab overflow-hidden rounded-3xl border border-violet-300/22 shadow-2xl shadow-black/30 ring-1 ring-white/5" id="guide">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Strategy Labs</div>
              <h1 className="poster-display-title mt-2 text-3xl sm:text-5xl">Strategy <span className="poster-word-violet">Labs</span></h1>
              <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">
                Transparent model portfolios built from TradeVeto intelligence. Simulation only. No real-money execution.
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:w-[420px]">
              <Badge label="Mode" value={active.config.label} />
              <Badge label="Evidence" value={system.primaryHorizon} />
              <Badge label="Updated" value={generatedAt} />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <IconInsightRail
            items={[
              { copy: "Replay-backed simulations", icon: <FlaskConical className="h-6 w-6" />, label: "Research Lab", tone: "violet" },
              { copy: "Equity and drawdown curves", icon: <LineChart className="h-6 w-6" />, label: "Performance", tone: "cyan" },
              { copy: "Mode score and risk policy", icon: <Gauge className="h-6 w-6" />, label: "Quality", tone: "emerald" },
              { copy: "Scenario-aware outcomes", icon: <Target className="h-6 w-6" />, label: "Scenarios", tone: "amber" },
              { copy: "Simulation, not advice", icon: <ShieldAlert className="h-6 w-6" />, label: "Risk Boundary", tone: "rose" },
            ]}
          />
        </div>

        <div className="border-t border-white/10 p-4 pt-0 sm:p-5 sm:pt-0">
          <BeginnerStrategyGuide result={active} primaryHorizon={system.primaryHorizon} />
        </div>

        <div className="grid gap-4 p-4 pt-0 sm:p-5 sm:pt-0 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Simulation Mode</div>
              <div className="grid gap-1 border-l border-white/10" role="tablist" aria-label="Simulation mode">
                {MODE_ORDER.map((item) => (
                  <button
                    aria-selected={item === mode}
                    className={`border-l-2 px-3 py-3 text-left transition ${
                      item === mode
                        ? "border-cyan-300 bg-cyan-400/[0.08] text-cyan-50"
                        : "border-transparent text-slate-300 hover:border-white/25 hover:bg-white/[0.04]"
                    }`}
                    key={item}
                    onClick={() => setMode(item)}
                    role="tab"
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{system.modes[item].config.label}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-xs">{system.modes[item].stats.strategyQualityScore}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{system.modes[item].config.riskPolicy}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">Research Boundary</div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                Simulation only. No broker orders, no promised returns, and WAIT / AVOID guardrails still apply.
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-4" id="results">
            <SummaryPanel result={active} />
            <PortfolioCurve points={active.equityCurve} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]" id="builder">
        <div className="min-w-0 space-y-5">
          <Panel eyebrow="Starter templates" title="Choose a Strategy Starting Point">
            <StrategyTemplateGrid activeMode={mode} modes={system.modes} onSelectMode={setMode} />
          </Panel>

          <Panel eyebrow="Visual Strategy Builder" title={`${active.config.label} Flow`}>
            <StrategyBuilderFlow primaryHorizon={system.primaryHorizon} result={active} />
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel eyebrow="Simulation Trust Layer" title="Evidence and Assumptions">
            <StrategyTrustPanel limitations={system.limitations} primaryHorizon={system.primaryHorizon} result={active} />
          </Panel>

          <Panel eyebrow="Paper Trading Bridge" title="Practice Without Live Billing">
            <PaperTradingBridge mode={mode} />
          </Panel>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]" id="strategies">
        <div className="min-w-0 space-y-5">
          <Panel eyebrow="Current Model Portfolio" title={`${active.config.label} Open Model Sleeve`}>
            <CurrentPositions positions={active.openPositions} />
          </Panel>

          <Panel eyebrow="Replay Review" title="How Recent Simulated Signals Behaved">
            <SimulationReplayPanel trades={active.closedTrades} />
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

function BeginnerStrategyGuide({ primaryHorizon, result }: { primaryHorizon: string; result: SimulatedPortfolioModeResult }) {
  const steps = [
    {
      copy: "Pick a template that matches how much fragility and volatility you are willing to study.",
      icon: <BookOpenCheck className="h-5 w-5" />,
      label: "Choose a sleeve",
    },
    {
      copy: `Review the ${primaryHorizon} completed evidence, drawdown, win rate, and volatility before trusting the result.`,
      icon: <Scale className="h-5 w-5" />,
      label: "Check evidence",
    },
    {
      copy: "Move only research ideas into Paper Trading. Strategy Labs does not place trades or promise outcomes.",
      icon: <NotebookPen className="h-5 w-5" />,
      label: "Practice safely",
    },
  ];

  return (
    <div className="grid gap-3 rounded-3xl border border-violet-300/14 bg-slate-950/45 p-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={step.label}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
              {step.icon}
            </span>
            <div>
              <div className="font-mono text-xs font-black text-cyan-200">0{index + 1}</div>
              <div className="text-sm font-black text-slate-50">{step.label}</div>
            </div>
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{step.copy}</p>
        </div>
      ))}
      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-4 sm:col-span-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">Current Template</div>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {result.config.label} mode uses score at or above {result.config.minModeScore}, fragility at or below {result.config.maxFragilityScore}, and caps simulated allocation at {result.config.maxAllocationPct}%.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 md:min-w-[430px]">
            <SmallMetric label="Evidence" value={`${result.stats.closedTradeCount.toLocaleString()} trades`} />
            <SmallMetric label="Win rate" value={formatPct(result.stats.winRatePct)} />
            <SmallMetric label="Drawdown" value={formatPct(result.stats.maxDrawdownPct)} />
            <SmallMetric label="Quality" value={`${result.stats.strategyQualityScore}/100`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyTemplateGrid({
  activeMode,
  modes,
  onSelectMode,
}: {
  activeMode: SimulatedPortfolioMode;
  modes: Record<SimulatedPortfolioMode, SimulatedPortfolioModeResult>;
  onSelectMode: (mode: SimulatedPortfolioMode) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {MODE_ORDER.map((mode) => {
        const result = modes[mode];
        const copy = TEMPLATE_COPY[mode];
        const selected = activeMode === mode;
        return (
          <button
            aria-pressed={selected}
            className={`min-w-0 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:bg-cyan-400/[0.05] ${
              selected ? "border-cyan-300/45 bg-cyan-400/[0.08] shadow-lg shadow-cyan-950/25" : "border-white/10 bg-white/[0.03]"
            }`}
            key={mode}
            onClick={() => onSelectMode(mode)}
            type="button"
          >
            <div className={`rounded-2xl bg-gradient-to-br ${copy.accent} p-3`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{copy.label}</div>
                  <div className="mt-1 text-lg font-black text-slate-50">{result.config.label}</div>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/65 px-2 py-1 font-mono text-xs text-slate-200">
                  {result.stats.strategyQualityScore}/100
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">{result.config.description}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <SmallMetric label="Min score" value={`${result.config.minModeScore}/100`} />
              <SmallMetric label="Max fragility" value={`${result.config.maxFragilityScore}/100`} />
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
              <div><span className="font-semibold text-slate-200">Works poorly:</span> {copy.worksPoorly}</div>
              <div><span className="font-semibold text-slate-200">Invalidates:</span> {copy.invalidates}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StrategyBuilderFlow({ primaryHorizon, result }: { primaryHorizon: string; result: SimulatedPortfolioModeResult }) {
  const stats = result.stats;
  const steps = [
    {
      caption: "Current symbols must clear the mode quality score before this sleeve studies them.",
      icon: <Gauge className="h-5 w-5" />,
      label: "Score gate",
      value: `${result.config.minModeScore}/100`,
    },
    {
      caption: "High fragility blocks or reduces simulated exposure before upside is considered.",
      icon: <ShieldAlert className="h-5 w-5" />,
      label: "Fragility cap",
      value: `${result.config.maxFragilityScore}/100`,
    },
    {
      caption: "Allocation is bounded by the selected research sleeve, not manually optimized after the fact.",
      icon: <Scale className="h-5 w-5" />,
      label: "Allocation range",
      value: `${result.config.baseAllocationPct}-${result.config.maxAllocationPct}%`,
    },
    {
      caption: "The simulator reads only completed outcome windows for this evidence horizon.",
      icon: <CalendarClock className="h-5 w-5" />,
      label: "Evidence horizon",
      value: primaryHorizon,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={step.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">{step.icon}</span>
              {index < steps.length - 1 ? <ChevronRight className="hidden h-5 w-5 text-slate-600 md:block" /> : null}
            </div>
            <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{step.label}</div>
            <div className="mt-1 font-mono text-xl font-black text-slate-50">{step.value}</div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{step.caption}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Risk-first interpretation</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{result.config.riskPolicy}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricBar caption="Higher is better after risk controls." label="Quality" tone="violet" value={stats.strategyQualityScore} />
            <MetricBar caption="Completed simulated winners only." label="Win rate" tone="emerald" value={stats.winRatePct} />
            <MetricBar caption="Lower drawdown means cleaner behavior." label="Drawdown safety" tone="amber" value={normalizeDrawdownSafety(stats.maxDrawdownPct)} />
          </div>
        </div>
        <div className="rounded-2xl border border-violet-300/18 bg-violet-400/[0.055] p-4">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-violet-200" />
            <div className="text-sm font-black text-slate-50">Assumptions stay visible</div>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            <li>- Simulated outcomes use completed evidence only.</li>
            <li>- Open model sleeves start at the latest scanner mark.</li>
            <li>- This view is for research practice, not prediction.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StrategyTrustPanel({
  limitations,
  primaryHorizon,
  result,
}: {
  limitations: string[];
  primaryHorizon: string;
  result: SimulatedPortfolioModeResult;
}) {
  const status = evidenceStatusFor(result.stats.closedTradeCount);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl border ${status.className}`}>
            <ListChecks className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-black text-slate-50">{status.label}</div>
            <div className="text-xs leading-5 text-slate-400">{status.copy}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <SmallMetric label="Closed evidence" value={`${result.stats.closedTradeCount.toLocaleString()} trades`} />
          <SmallMetric label="Horizon" value={primaryHorizon} />
          <SmallMetric label="Average hold" value={result.stats.averageHoldDays === null ? "N/A" : `${result.stats.averageHoldDays.toFixed(1)}D`} />
          <SmallMetric label="Volatility" value={formatPct(result.stats.volatilityPct)} />
        </div>
      </div>

      <details className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <summary className="cursor-pointer text-sm font-black text-cyan-100">Show simulation boundaries</summary>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
          {limitations.map((line) => <li key={line}>- {line}</li>)}
        </ul>
      </details>
    </div>
  );
}

function PaperTradingBridge({ mode }: { mode: SimulatedPortfolioMode }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.06] p-4">
        <div className="flex items-center gap-3">
          <PlayCircle className="h-5 w-5 text-emerald-200" />
          <div className="text-sm font-black text-slate-50">Move from simulation to practice</div>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Send one research idea into Paper Trading, record entry, stop, target, and notes, then review it with replay context.
        </p>
      </div>
      <Link
        className="flex items-center justify-between rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-50 transition hover:border-cyan-200/45 hover:bg-cyan-400/15"
        href={`/paper?strategy=${mode}`}
      >
        Open Paper Trading
        <ChevronRight className="h-4 w-4" />
      </Link>
      <p className="text-xs leading-5 text-slate-500">
        Paper Trading remains separate from live billing and brokerage execution.
      </p>
    </div>
  );
}

function SimulationReplayPanel({ trades }: { trades: SimulatedPortfolioClosedTrade[] }) {
  const recentTrades = trades.slice(0, 5);
  if (!recentTrades.length) {
    return <EmptyState message="No completed simulated trades are available for replay review yet. The lab will fill in when enough closed evidence exists." />;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {recentTrades.map((trade) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3" key={trade.id}>
            <Link className="flex items-center gap-2 font-mono text-sm font-black text-slate-50 hover:text-cyan-200" href={`/symbol/${trade.symbol}`}>
              <SymbolLogo size="sm" symbol={trade.symbol} />
              {trade.symbol}
            </Link>
            <div className={`mt-3 font-mono text-lg font-black ${toneClass(trade.realizedReturnPct)}`}>{formatPct(trade.realizedReturnPct)}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">{trade.horizonDays}D outcome</div>
            <div className="mt-3 h-2 rounded-full bg-slate-800">
              <div
                className={`h-2 rounded-full ${trade.realizedReturnPct >= 0 ? "bg-emerald-300" : "bg-rose-300"}`}
                style={{ width: `${Math.max(12, Math.min(100, 50 + Math.abs(trade.realizedReturnPct) * 2))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {recentTrades.slice(0, 3).map((trade) => (
          <details className="rounded-2xl border border-white/10 bg-slate-950/50 p-4" key={`${trade.id}:detail`}>
            <summary className="cursor-pointer text-sm font-black text-cyan-100">
              Replay {trade.symbol}: {trade.entryDate} to {trade.exitDate}
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <ReasonBlock items={trade.entryReasons} title="Entry context" />
              <ReasonBlock items={trade.exitReasons} title="Exit context" />
            </div>
          </details>
        ))}
      </div>
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
    <div className="rounded-2xl border border-cyan-300/14 bg-white/[0.035] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Performance Snapshot</div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{result.summary}</p>
        </div>
        <div className="grid shrink-0 gap-2 sm:grid-cols-[132px_1fr] lg:w-[330px]">
          <PosterGauge label="Quality" score={stats.strategyQualityScore} tone="violet" />
          <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
            <div className="text-xs font-semibold text-slate-300">{stats.closedTradeCount.toLocaleString()} closed simulated trades</div>
            <ScoreFactorStrip
              className="mt-3 h-28"
              emptyMessage="No completed simulation factors are available yet."
              factors={[
                { label: "Quality", tone: "violet", value: stats.strategyQualityScore },
                { label: "Win rate", tone: "emerald", value: stats.winRatePct },
                { label: "Return", tone: stats.simulatedReturnPct !== null && stats.simulatedReturnPct < 0 ? "rose" : "cyan", value: normalizeSignedPct(stats.simulatedReturnPct) },
                { label: "Drawdown safety", tone: "amber", value: normalizeDrawdownSafety(stats.maxDrawdownPct) },
                { label: "Volatility control", tone: "cyan", value: normalizeVolatilityControl(stats.volatilityPct) },
              ]}
              label="Simulation factors"
            />
          </div>
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
              <div className="flex items-center gap-3">
                <SymbolLogo size="sm" symbol={position.symbol} />
                <div>
                  <Link className="font-mono text-2xl font-black text-slate-50 hover:text-cyan-200" href={`/symbol/${position.symbol}`}>
                    {position.symbol}
                  </Link>
                  <div className="mt-1 text-xs font-semibold text-cyan-200">{strategyFamilyLabel(position.strategyFamily)}</div>
                </div>
              </div>
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
          <details className="mt-3 rounded-xl border border-white/10 bg-slate-950/45 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
              Why included / exit plan
            </summary>
            <ReasonBlock title="Why included" items={position.entryReasons} />
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm leading-6 text-slate-300">{position.exitPlan}</div>
          </details>
        </article>
      ))}
    </div>
  );
}

function ClosedTrades({ trades }: { trades: SimulatedPortfolioClosedTrade[] }) {
  if (!trades.length) {
    return <EmptyState message="No closed simulated trades are available for this mode yet. Strategy history needs more completed outcomes before the chart is useful." />;
  }
  return (
    <div className="space-y-3">
      {trades.slice(0, 12).map((trade) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={trade.id}>
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link className="font-mono text-xl font-black text-slate-50 hover:text-cyan-200" href={`/symbol/${trade.symbol}`}>
                  {trade.symbol}
                </Link>
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

function MetricBar({
  caption,
  label,
  tone,
  value,
}: {
  caption: string;
  label: string;
  tone: "amber" | "cyan" | "emerald" | "rose" | "violet";
  value: number | null | undefined;
}) {
  const normalized = value === null || value === undefined || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  const colorClass: Record<typeof tone, string> = {
    amber: "bg-amber-300",
    cyan: "bg-cyan-300",
    emerald: "bg-emerald-300",
    rose: "bg-rose-300",
    violet: "bg-violet-300",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className="font-mono text-xs font-black text-slate-100">{normalized === null ? "N/A" : `${Math.round(normalized)}/100`}</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-800">
        <div className={`h-2 rounded-full ${colorClass[tone]}`} style={{ width: `${normalized ?? 0}%` }} />
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{caption}</p>
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

function evidenceStatusFor(count: number): { className: string; copy: string; label: string } {
  if (count >= 50) {
    return {
      className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
      copy: "Enough completed samples to study behavior, still not a prediction.",
      label: "Mature evidence",
    };
  }
  if (count >= 12) {
    return {
      className: "border-cyan-300/25 bg-cyan-400/10 text-cyan-200",
      copy: "Useful directional evidence, but uncertainty remains visible.",
      label: "Developing evidence",
    };
  }
  if (count > 0) {
    return {
      className: "border-amber-300/25 bg-amber-400/10 text-amber-100",
      copy: "Small sample. Read patterns cautiously and paper test first.",
      label: "Limited evidence",
    };
  }
  return {
    className: "border-slate-500/30 bg-slate-800/55 text-slate-300",
    copy: "No completed simulation sample is available for this mode yet.",
    label: "No completed evidence",
  };
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

function normalizeSignedPct(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, 50 + value));
}

function normalizeDrawdownSafety(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, 100 - Math.abs(value)));
}

function normalizeVolatilityControl(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, 100 - Math.abs(value)));
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
