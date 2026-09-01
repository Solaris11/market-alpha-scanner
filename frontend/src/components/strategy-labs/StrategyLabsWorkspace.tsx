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
  SimulatedPortfolioAllocationPoint,
  SimulatedPortfolioCapitalScenario,
  SimulatedPortfolioClosedTrade,
  SimulatedPortfolioDecisionReview,
  SimulatedPortfolioEquityPoint,
  SimulatedPortfolioExposureBucket,
  SimulatedPortfolioInstitutionalRealism,
  SimulatedPortfolioLifecyclePhase,
  SimulatedPortfolioLearningTimelinePoint,
  SimulatedPortfolioMode,
  SimulatedPortfolioModeResult,
  SimulatedPortfolioModelRevision,
  SimulatedPortfolioOpenPosition,
  SimulatedPortfolioReviewItem,
  SimulatedPortfolioRiskConcentration,
  SimulatedPortfolioRiskMapCell,
  SimulatedPortfolioStrategyMemory,
  SimulatedPortfolioTone,
} from "@/lib/trading/simulated-ai-portfolio";
import { strategyFamilyLabel } from "@/lib/trading/strategy-intelligence";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import {
  CinematicClusterMosaic,
  CinematicHeatMatrix,
  CinematicTimeline,
  type CinematicCluster,
  type CinematicHeatCell,
  type CinematicTimelineItem,
} from "@/components/visual/CinematicIntelligencePanels";
import dynamic from "next/dynamic";
import { IconInsightRail, PosterGauge, ScoreFactorStrip, type ScoreFactor, type VisualTone } from "@/components/visual/MiniVisuals";
import type {
  PosterFactor,
  PosterHeatCell,
  PosterVisualTone,
} from "@/components/visual/PosterDataVisuals";
import { SymbolLogo } from "@/components/visual/SymbolLogo";
import { trackAnalyticsEvent, trackFirstUsefulAction } from "@/lib/client/analytics";

// Loaded on demand. PosterDataVisuals bundles three charting runtimes -
// @visx (radial gauge), recharts (trend/movement/factor bars) and @nivo/heatmap -
// so a static import puts all three in the initial /strategy-labs client bundle.
// Every one of these renders below the fold in an analytics panel.
const POSTER = () => import("@/components/visual/PosterDataVisuals");
const PosterFactorBars = dynamic(() => POSTER().then((mod) => mod.PosterFactorBars), { ssr: false });
const PosterHeatmapChart = dynamic(() => POSTER().then((mod) => mod.PosterHeatmapChart), { ssr: false });
const PosterMovementBars = dynamic(() => POSTER().then((mod) => mod.PosterMovementBars), { ssr: false });
const PosterRadialGauge = dynamic(() => POSTER().then((mod) => mod.PosterRadialGauge), { ssr: false });
const PosterTrendChart = dynamic(() => POSTER().then((mod) => mod.PosterTrendChart), { ssr: false });

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
    trackAnalyticsEvent("strategy_usage", { action: "open", mode: "balanced" }, { source: "strategy_labs" });
    trackFirstUsefulAction("strategy_labs_review", { mode: "balanced" }, { source: "strategy_labs" });
  }, []);

  function selectMode(nextMode: SimulatedPortfolioMode, source: string): void {
    setMode(nextMode);
    trackAnalyticsEvent("strategy_usage", { action: "select_mode", mode: nextMode }, { source });
    trackFirstUsefulAction("strategy_labs_mode", { mode: nextMode }, { source });
  }

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

        <div className="border-t border-white/10 p-4 sm:p-5">
          <StrategyCinematicSimulationSystem result={active} system={system} />
        </div>

        <div className="border-t border-violet-300/14 p-4 sm:p-5">
          <AdaptivePortfolioIntelligenceLab result={active} system={system} />
        </div>

        <div className="border-t border-cyan-300/14 p-4 sm:p-5">
          <InstitutionalStrategyRealismSystem realism={active.institutionalRealism} result={active} />
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
                    onClick={() => selectMode(item, "strategy_labs_tabs")}
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
            <StrategyTemplateGrid activeMode={mode} modes={system.modes} onSelectMode={(nextMode) => selectMode(nextMode, "strategy_labs_templates")} />
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

function strategyFactor(label: string, value: number | null, tone: VisualTone): ScoreFactor {
  return { label, tone, value };
}

function StrategyCinematicSimulationSystem({
  result,
  system,
}: {
  result: SimulatedPortfolioModeResult;
  system: SimulatedAiPortfolioSystem;
}) {
  const stats = result.stats;
  const modeItems = MODE_ORDER.map((mode) => {
    const modeResult = system.modes[mode];
    return {
      detail: `${modeResult.stats.closedTradeCount.toLocaleString()} closed samples - drawdown ${formatPct(modeResult.stats.maxDrawdownPct)}`,
      label: modeResult.config.label,
      tone: mode === result.mode ? "cyan" as const : mode === "conservative" ? "emerald" as const : mode === "aggressive" ? "rose" as const : "violet" as const,
      value: `${modeResult.stats.strategyQualityScore}/100`,
    };
  });
  const clusters: CinematicCluster[] = [
    {
      emptyMessage: "Simulation needs completed evidence before the strategy curve is meaningful.",
      eyebrow: "Strategy ecosystem",
      factors: [
        strategyFactor("Quality", stats.strategyQualityScore, "violet"),
        strategyFactor("Closed Evidence", stats.closedTradeCount ? Math.min(100, stats.closedTradeCount * 2) : null, "cyan"),
        strategyFactor("Return", normalizeSignedPct(stats.simulatedReturnPct), stats.simulatedReturnPct !== null && stats.simulatedReturnPct < 0 ? "rose" : "emerald"),
      ],
      footer: "Simulation only. No broker orders or guaranteed outcomes.",
      icon: <FlaskConical className="h-6 w-6" />,
      items: result.openPositions.slice(0, 6).map((position) => ({
        detail: `${strategyFamilyLabel(position.strategyFamily)} - ${position.exitPlan}`,
        href: `/symbol/${encodeURIComponent(position.symbol)}`,
        label: position.symbol,
        tone: position.unrealizedPnlPct >= 0 ? "emerald" : "rose",
        value: formatPct(position.unrealizedPnlPct),
      })),
      metric: `${stats.strategyQualityScore}/100`,
      metricLabel: "strategy quality",
      score: stats.strategyQualityScore,
      summary: `${result.config.label} studies score gate ${result.config.minModeScore}, fragility cap ${result.config.maxFragilityScore}, and max simulated allocation ${result.config.maxAllocationPct}%.`,
      title: `${result.config.label} Strategy Ecosystem`,
      tone: "violet",
      updatedAt: formatDateTime(system.generatedAt),
      values: result.equityCurve.map((point) => point.value),
    },
    {
      emptyMessage: "Closed trades are required for drawdown and volatility behavior.",
      eyebrow: "Risk simulation",
      factors: [
        strategyFactor("Drawdown Safety", normalizeDrawdownSafety(stats.maxDrawdownPct), "amber"),
        strategyFactor("Volatility Control", normalizeVolatilityControl(stats.volatilityPct), "cyan"),
        strategyFactor("Cash Buffer", stats.cashPct, "emerald"),
      ],
      icon: <ShieldAlert className="h-6 w-6" />,
      items: [
        { detail: "Maximum observed simulated decline.", label: "Max drawdown", tone: "amber", value: formatPct(stats.maxDrawdownPct) },
        { detail: "Observed simulated volatility for this sleeve.", label: "Volatility", tone: "cyan", value: formatPct(stats.volatilityPct) },
        { detail: "Unallocated simulated portfolio buffer.", label: "Cash buffer", tone: "emerald", value: `${stats.cashPct.toFixed(1)}%` },
      ],
      metric: formatPct(stats.maxDrawdownPct),
      metricLabel: "max drawdown",
      score: normalizeDrawdownSafety(stats.maxDrawdownPct),
      summary: "Risk controls stay visible before performance claims, matching TradeVeto's wait-first research posture.",
      title: "Drawdown and Volatility Control",
      tone: "amber",
      values: [normalizeDrawdownSafety(stats.maxDrawdownPct), normalizeVolatilityControl(stats.volatilityPct), stats.cashPct],
    },
    {
      emptyMessage: "Replay-linked closed trade evidence will populate after completed simulated outcomes exist.",
      eyebrow: "Replay evidence",
      factors: [
        strategyFactor("Closed Trades", stats.closedTradeCount ? Math.min(100, stats.closedTradeCount * 2) : null, "cyan"),
        strategyFactor("Win Rate", stats.winRatePct, "emerald"),
      ],
      icon: <PlayCircle className="h-6 w-6" />,
      items: result.closedTrades.slice(0, 6).map((trade) => ({
        detail: `${trade.entryDate} to ${trade.exitDate} - ${strategyFamilyLabel(trade.strategyFamily)}`,
        href: `/symbol/${encodeURIComponent(trade.symbol)}`,
        label: trade.symbol,
        tone: trade.realizedReturnPct >= 0 ? "emerald" : "rose",
        value: formatPct(trade.realizedReturnPct),
      })),
      metric: stats.closedTradeCount.toLocaleString(),
      metricLabel: "closed evidence",
      score: stats.closedTradeCount ? Math.min(100, stats.closedTradeCount * 2) : null,
      summary: "Closed simulated trades anchor the replay layer. Empty states remain explicit when evidence is limited.",
      title: "Replay-Backed Evidence Cluster",
      tone: "cyan",
      values: result.closedTrades.map((trade) => trade.realizedReturnPct),
    },
    {
      emptyMessage: "Mode comparisons require simulation payloads.",
      eyebrow: "Mode comparison",
      factors: [
        strategyFactor("Conservative", system.modes.conservative.stats.strategyQualityScore, "emerald"),
        strategyFactor("Balanced", system.modes.balanced.stats.strategyQualityScore, "cyan"),
        strategyFactor("Aggressive", system.modes.aggressive.stats.strategyQualityScore, "rose"),
      ],
      icon: <Scale className="h-6 w-6" />,
      items: modeItems,
      metric: result.config.label,
      metricLabel: "active mode",
      score: stats.strategyQualityScore,
      summary: "Strategy sleeves are compared side by side so users can see how risk appetite changes simulated behavior.",
      title: "Strategy Sleeve Comparison",
      tone: "cyan",
      values: MODE_ORDER.map((mode) => system.modes[mode].stats.strategyQualityScore),
    },
  ];
  const heatCells: CinematicHeatCell[] = [
    { detail: "Active strategy quality score.", label: "Quality", tone: "violet", value: stats.strategyQualityScore },
    { detail: "Completed simulated trades in this sleeve.", label: "Evidence", tone: "cyan", value: stats.closedTradeCount ? Math.min(100, stats.closedTradeCount * 2) : null },
    { detail: "Win rate from completed simulated trades.", label: "Win rate", tone: "emerald", value: stats.winRatePct },
    { detail: "Safety score derived from max drawdown.", label: "Drawdown safety", tone: "amber", value: normalizeDrawdownSafety(stats.maxDrawdownPct) },
    { detail: "Control score derived from observed volatility.", label: "Volatility control", tone: "cyan", value: normalizeVolatilityControl(stats.volatilityPct) },
    { detail: "Simulated current allocation exposure.", label: "Allocation", tone: "rose", value: stats.totalCurrentAllocationPct },
  ];
  const timelineItems: CinematicTimelineItem[] = result.closedTrades.slice(0, 7).map((trade) => ({
    detail: `${strategyFamilyLabel(trade.strategyFamily)} closed at ${formatPct(trade.realizedReturnPct)} with mode score ${trade.modeScore}/100.`,
    href: `/symbol/${encodeURIComponent(trade.symbol)}`,
    label: `${trade.symbol} simulation closed`,
    timestamp: trade.exitDate,
    tone: trade.realizedReturnPct >= 0 ? "emerald" : "rose",
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <CinematicClusterMosaic
        clusters={clusters}
        eyebrow="Quant lab intelligence"
        summary="A denser strategy-lab layer showing simulation ecosystem, risk controls, replay evidence, and mode comparison from the validated simulation payload."
        title="Strategy Simulation Operating System"
      />
      <div className="grid gap-4">
        <CinematicHeatMatrix cells={heatCells} title="Strategy Evidence Heat" />
        <CinematicTimeline emptyMessage="No replay-backed simulated trade timeline is available for this sleeve yet." items={timelineItems} title="Simulation Replay Timeline" />
      </div>
    </div>
  );
}

function AdaptivePortfolioIntelligenceLab({
  result,
  system,
}: {
  result: SimulatedPortfolioModeResult;
  system: SimulatedAiPortfolioSystem;
}) {
  const learning = result.learning;
  const stats = result.stats;
  const latestEquity = result.equityCurve[result.equityCurve.length - 1]?.value ?? system.startingCapital;
  const deployedCapital = result.openPositions.reduce((sum, position) => sum + position.investedAmount, 0);
  const reviewItems = decisionReviewItems(learning.decisionReview);

  return (
    <section
      className="tv-superplatform-panel relative overflow-hidden rounded-[2.15rem] border border-violet-300/22 bg-[radial-gradient(circle_at_7%_0%,rgba(167,139,250,0.2),transparent_30rem),radial-gradient(circle_at_84%_10%,rgba(34,211,238,0.16),transparent_28rem),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.82))] p-4 shadow-2xl shadow-violet-950/20 sm:p-5"
      id="portfolio-intelligence-lab"
    >
      <div className="pointer-events-none absolute inset-0 tv-superplatform-atmosphere" />
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(360px,0.76fr)]">
        <div className="min-w-0 rounded-[1.75rem] border border-cyan-300/16 bg-slate-950/62 p-4 shadow-xl shadow-black/25">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-200">Adaptive Portfolio Intelligence Lab</div>
              <h2 className="mt-2 max-w-4xl text-2xl font-black tracking-tight text-white sm:text-4xl">
                The {result.config.label} engine is learning from simulated capital behavior.
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{learning.adjustmentSummary}</p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 text-xs lg:w-[340px]">
              <SmallMetric label="Start capital" value={formatMoney(system.startingCapital)} />
              <SmallMetric label="Latest equity" tone={latestEquity - system.startingCapital} value={formatMoney(latestEquity)} />
              <SmallMetric label="Deployed now" value={formatMoney(deployedCapital)} />
              <SmallMetric label="Cash buffer" value={`${stats.cashPct.toFixed(1)}%`} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[0.72fr_1fr_1fr]">
            <PosterRadialGauge label="Portfolio quality" score={stats.strategyQualityScore} tone="violet" />
            <PosterTrendChart label="Confidence evolution" tone="cyan" values={learning.confidenceTrend} />
            <PosterMovementBars tone="amber" values={learning.riskTrend} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {learning.portfolioStories.map((story) => (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={story}>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Portfolio story</div>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-300">{story}</p>
              </div>
            ))}
          </div>
          <CapitalScenarioStrip scenarios={result.capitalScenarios} />
          <AllocationHistorySystem points={result.allocationHistory} />
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/62 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">Learning signal map</div>
            <PosterHeatmapChart cells={riskMapCells(learning.heatmap)} className="mt-3" emptyMessage="No portfolio learning heatmap is available yet." />
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/62 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Strategy revision notes</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {learning.lessons.slice(0, 4).map((lesson) => <li key={lesson}>- {lesson}</li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <TradeLedgerPreview trades={result.closedTrades} />
        <div className="grid gap-4">
          <DecisionReviewGrid items={reviewItems} />
          <RiskConcentrationSystem concentrations={result.riskConcentration} />
          <AllocationExposureSystem buckets={learning.exposureBuckets} />
        </div>
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <LearningTimelineSystem points={learning.learningTimeline} />
        <div className="rounded-[1.75rem] border border-violet-300/16 bg-violet-400/[0.055] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">Portfolio-aware rules</div>
          <PosterFactorBars
            className="mt-3"
            factors={[
              { label: "Cash buffer", tone: "emerald", value: stats.cashPct },
              { label: "Allocation", tone: "violet", value: stats.totalCurrentAllocationPct },
              { label: "Drawdown safety", tone: "amber", value: normalizeDrawdownSafety(stats.maxDrawdownPct) },
              { label: "Volatility control", tone: "cyan", value: normalizeVolatilityControl(stats.volatilityPct) },
              { label: "Win rate", tone: "emerald", value: stats.winRatePct },
            ]}
            label="Portfolio control stack"
          />
        </div>
      </div>
    </section>
  );
}

function InstitutionalStrategyRealismSystem({
  realism,
  result,
}: {
  realism: SimulatedPortfolioInstitutionalRealism;
  result: SimulatedPortfolioModeResult;
}) {
  const latestRevision = realism.modelRevisions[0] ?? null;
  const latestLifecycle = realism.lifecycle.at(-1) ?? null;
  const latestMemory = realism.strategyMemory[0] ?? null;
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_26rem),radial-gradient(circle_at_85%_5%,rgba(251,191,36,0.12),transparent_22rem),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.8))] p-4 shadow-2xl shadow-black/25 sm:p-5">
      <div className="pointer-events-none absolute inset-0 tv-cinematic-noise opacity-40" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Institutional strategy realism</div>
          <h2 className="mt-2 max-w-4xl text-2xl font-black tracking-tight text-white sm:text-4xl">
            Realistic lifecycle, allocation memory, drawdown pressure, and model revision evidence.
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            This layer is derived from completed simulated trades, portfolio equity checkpoints, open model sleeves, and strategy-family history. It does not invent fills or broker activity.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 text-xs lg:w-[430px]">
          <SmallMetric label="Lifecycle events" value={realism.lifecycle.length.toLocaleString()} />
          <SmallMetric label="Model revisions" value={realism.modelRevisions.length.toLocaleString()} />
          <SmallMetric label="Strategy memories" value={realism.strategyMemory.length.toLocaleString()} />
          <SmallMetric label="Drawdown episodes" value={realism.drawdownEpisodes.length.toLocaleString()} />
        </div>
      </div>

      <div className="relative mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <PortfolioLifecyclePanel lifecycle={realism.lifecycle} />
        <div className="grid gap-4">
          <DrawdownStoryPanel episodes={realism.drawdownEpisodes} />
          <ModelRevisionPanel revisions={realism.modelRevisions} />
        </div>
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <StrategyMemoryPanel memories={realism.strategyMemory} />
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">Credibility checkpoint</div>
          <div className="mt-3 space-y-3">
            <ContextPill label="Latest lifecycle checkpoint" value={latestLifecycle ? `${latestLifecycle.label}: ${latestLifecycle.detail}` : "No lifecycle checkpoint is available yet."} />
            <ContextPill label="Latest model revision" value={latestRevision ? `${latestRevision.label}: ${latestRevision.toPolicy}` : "No model revision has been triggered by completed evidence yet."} />
            <ContextPill label="Largest memory bucket" value={latestMemory ? `${latestMemory.label}: ${latestMemory.sampleCount} sample(s), ${formatPct(latestMemory.averageReturnPct)} average return.` : "No strategy-family memory bucket is populated yet."} />
            <ContextPill label="Simulation boundary" value={`${result.config.label} remains simulation-only. It models portfolio behavior from completed evidence and never places orders.`} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioLifecyclePanel({ lifecycle }: { lifecycle: SimulatedPortfolioLifecyclePhase[] }) {
  if (!lifecycle.length) return <EmptyState message="No institutional lifecycle checkpoints are available yet. Completed simulated trades are required before allocation, P/L, and revision history can be shown." />;
  const pnlValues = lifecycle.map((phase) => phase.realizedPnl);
  return (
    <div className="rounded-[1.75rem] border border-cyan-300/16 bg-slate-950/62 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Portfolio lifecycle</div>
          <h3 className="mt-1 text-xl font-black text-white">What the model opened, closed, and revised</h3>
        </div>
        <div className="text-xs text-slate-500">{lifecycle.length} lifecycle checkpoint(s)</div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[0.82fr_1fr]">
        <PosterTrendChart label="Lifecycle P/L path" tone="cyan" values={pnlValues} />
        <div className="grid gap-2">
          {lifecycle.slice(-8).map((phase) => (
            <div className={`rounded-2xl border p-3 ${reviewToneClass(phase.tone)}`} key={`${phase.type}:${phase.date}:${phase.label}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-50">{phase.label}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{phase.date} - {phase.type}</div>
                </div>
                <div className={`shrink-0 font-mono text-xs font-black ${toneClass(phase.realizedPnl)}`}>{formatMoney(phase.realizedPnl)}</div>
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{phase.detail}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <SmallMetric label="Allocation" value={`${phase.allocationPct.toFixed(1)}%`} />
                <SmallMetric label="Cash" value={`${phase.cashPct.toFixed(1)}%`} />
                <SmallMetric label="Capital" value={formatMoney(phase.capital)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DrawdownStoryPanel({ episodes }: { episodes: SimulatedPortfolioInstitutionalRealism["drawdownEpisodes"] }) {
  return (
    <div className="rounded-[1.75rem] border border-amber-300/16 bg-amber-400/[0.045] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">Drawdown storytelling</div>
      {episodes.length ? (
        <div className="mt-3 grid gap-2">
          {episodes.map((episode) => (
            <div className={`rounded-2xl border p-3 ${reviewToneClass(episode.tone)}`} key={`${episode.peakDate}:${episode.troughDate}:${episode.depthPct}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-50">{episode.peakDate} {"->"} {episode.troughDate}</div>
                  <div className="mt-1 text-xs text-slate-500">{episode.recoveryDate ? `Recovered: ${episode.recoveryDate}` : "Recovery still open in evidence window"}</div>
                </div>
                <div className="font-mono text-sm font-black text-amber-100">{formatPct(episode.depthPct)}</div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{episode.detail}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-100/85">{episode.lesson}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState message="No meaningful portfolio drawdown episode was detected from the current simulated equity curve." />
        </div>
      )}
    </div>
  );
}

function ModelRevisionPanel({ revisions }: { revisions: SimulatedPortfolioModelRevision[] }) {
  return (
    <div className="rounded-[1.75rem] border border-violet-300/16 bg-violet-400/[0.055] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">Model evolution and revisions</div>
      {revisions.length ? (
        <div className="mt-3 grid gap-2">
          {revisions.slice(0, 5).map((revision) => (
            <div className={`rounded-2xl border p-3 ${reviewToneClass(revision.tone)}`} key={`${revision.date}:${revision.label}:${revision.evidence}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-50">{revision.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{revision.date}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {revision.symbols.map((symbol) => (
                    <span className="rounded-full border border-white/10 bg-slate-950/55 px-2 py-1 font-mono text-[10px] text-cyan-100" key={symbol}>{symbol}</span>
                  ))}
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{revision.evidence}</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <ContextPill label="Prior rule" value={revision.fromPolicy} />
                <ContextPill label="Revised behavior" value={revision.toPolicy} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState message="No completed evidence has forced a strategy revision yet. The model keeps its published rules visible instead of fabricating learning." />
        </div>
      )}
    </div>
  );
}

function StrategyMemoryPanel({ memories }: { memories: SimulatedPortfolioStrategyMemory[] }) {
  if (!memories.length) return <EmptyState message="No historical strategy-family memory is available yet." />;
  const heatCells: PosterHeatCell[] = memories.slice(0, 8).map((memory) => ({
    detail: `${memory.sampleCount} sample(s), ${memory.symbolCount} symbol(s), ${formatMoney(memory.totalPnl)} P/L.`,
    label: memory.label,
    tone: posterToneForPortfolio(memory.tone),
    value: memory.averageReturnPct === null ? null : Math.max(0, Math.min(100, 50 + memory.averageReturnPct * 8)),
  }));
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/62 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Historical strategy memory</div>
          <h3 className="mt-1 text-xl font-black text-white">What the lab remembers by strategy family</h3>
        </div>
        <div className="text-xs text-slate-500">{memories.length} strategy memory bucket(s)</div>
      </div>
      <PosterHeatmapChart cells={heatCells} className="mt-3" emptyMessage="No strategy memory heatmap is available yet." />
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {memories.slice(0, 6).map((memory) => (
          <div className={`rounded-2xl border p-3 ${reviewToneClass(memory.tone)}`} key={memory.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-50">{memory.label}</div>
                <div className="mt-1 text-xs text-slate-500">{memory.sampleCount} sample(s), {memory.symbolCount} symbol(s)</div>
              </div>
              <div className={`shrink-0 font-mono text-sm font-black ${toneClass(memory.totalPnl)}`}>{formatMoney(memory.totalPnl)}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
              <SmallMetric label="Avg return" value={formatPct(memory.averageReturnPct)} />
              <SmallMetric label="Loss rate" value={formatPct(memory.lossRatePct)} />
              <SmallMetric label="Worst DD" value={formatPct(memory.worstDrawdownPct)} />
            </div>
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">{memory.latestLesson}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapitalScenarioStrip({ scenarios }: { scenarios: SimulatedPortfolioCapitalScenario[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-3">
      <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Starting capital scenarios</div>
      <div className="grid gap-2 sm:grid-cols-3">
        {scenarios.map((scenario) => (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3" key={scenario.label}>
            <div className="text-xs font-black text-slate-50">{scenario.label}</div>
            <div className={`mt-1 font-mono text-lg font-black ${toneClass(scenario.realizedPnl)}`}>{formatMoney(scenario.latestEquity)}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <SmallMetric label="Deployed" value={formatMoney(scenario.deployedAmount)} />
              <SmallMetric label="Cash" value={formatMoney(scenario.cashAmount)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllocationHistorySystem({ points }: { points: SimulatedPortfolioAllocationPoint[] }) {
  if (!points.length) return <EmptyState message="No allocation history is available yet. Strategy Labs will show deployment changes when completed simulated trades exist." />;
  const deployedValues = points.map((point) => point.deployedPct);
  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.045] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Allocation history</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">How model capital moved through completed evidence</div>
        </div>
        <div className="text-xs text-slate-500">{points.length} allocation checkpoint(s)</div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.35fr]">
        <PosterTrendChart label="Deployment path" tone="cyan" values={deployedValues} />
        <div className="grid gap-2 sm:grid-cols-2">
          {points.slice(-4).map((point) => (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3" key={`${point.date}:${point.label}:${point.topSymbol ?? "cash"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-slate-100">{point.label}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{point.date}</div>
                </div>
                <div className={`shrink-0 font-mono text-xs font-black ${toneClass(point.realizedPnl)}`}>{formatMoney(point.realizedPnl)}</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <SmallMetric label="Deployed" value={`${point.deployedPct.toFixed(1)}%`} />
                <SmallMetric label="Cash" value={`${point.cashPct.toFixed(1)}%`} />
              </div>
              {point.topSymbol ? <div className="mt-2 text-xs text-slate-400">Primary symbol: <span className="font-mono text-cyan-100">{point.topSymbol}</span></div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TradeLedgerPreview({ trades }: { trades: SimulatedPortfolioClosedTrade[] }) {
  const [selectedTrade, setSelectedTrade] = useState<SimulatedPortfolioClosedTrade | null>(null);

  return (
    <div className="rounded-[1.75rem] border border-cyan-300/16 bg-slate-950/62 p-4" id="trade-review">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">What the system bought and sold</div>
          <h3 className="mt-1 text-xl font-black text-white">Simulated trade ledger</h3>
        </div>
        <div className="text-xs text-slate-500">{trades.length ? `${trades.length.toLocaleString()} visible closed simulations` : "Waiting for completed outcomes"}</div>
      </div>
      {trades.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {trades.slice(0, 6).map((trade) => (
            <button
              className="tv-tap-motion min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-400/[0.06]"
              data-stable-overlay-trigger="true"
              key={trade.id}
              onClick={() => setSelectedTrade(trade)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <SymbolLogo size="sm" symbol={trade.symbol} />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-lg font-black text-slate-50">{trade.symbol}</div>
                    <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{trade.entryDate} to {trade.exitDate}</div>
                  </div>
                </div>
                <span className={`shrink-0 font-mono text-sm font-black ${toneClass(trade.realizedPnl)}`}>{formatMoney(trade.realizedPnl)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <SmallMetric label="Invested" value={formatMoney(trade.investedAmount)} />
                <SmallMetric label="Return" tone={trade.realizedReturnPct} value={formatPct(trade.realizedReturnPct)} />
                <SmallMetric label="Entry conf." value={`${trade.confidenceAtEntry}/100`} />
                <SmallMetric label="Exit conf." value={`${trade.confidenceAtExit}/100`} />
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{trade.autopsy.replayContext}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-100/85">{trade.learning.lesson}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState message="No completed simulated trades are available yet. The portfolio ledger will appear when validated outcomes exist. Open sleeves remain simulation-only research, not broker or paper orders." />
        </div>
      )}

      {selectedTrade ? <TradeDetailOverlay onClose={() => setSelectedTrade(null)} trade={selectedTrade} /> : null}
    </div>
  );
}

function TradeDetailOverlay({ onClose, trade }: { onClose: () => void; trade: SimulatedPortfolioClosedTrade }) {
  return (
    <StableDetailOverlay analyticsSurface="strategy_trade_review" closeLabel="Close simulated trade review" eyebrow="Replay-backed simulated trade" onClose={onClose} open size="lg" title={`${trade.symbol} decision review`}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center gap-3">
            <SymbolLogo size="md" symbol={trade.symbol} />
            <div>
              <div className="font-mono text-2xl font-black text-slate-50">{trade.symbol}</div>
              <div className="text-xs text-slate-500">{strategyFamilyLabel(trade.strategyFamily)}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <SmallMetric label="Entry date" value={trade.entryDate} />
            <SmallMetric label="Exit date" value={trade.exitDate} />
            <SmallMetric label="Entry price" value={formatMoney(trade.entryPrice)} />
            <SmallMetric label="Exit price" value={formatMoney(trade.exitPrice)} />
            <SmallMetric label="Invested" value={formatMoney(trade.investedAmount)} />
            <SmallMetric label="Allocation" value={`${trade.allocationPct.toFixed(1)}%`} />
            <SmallMetric label="Units" value={trade.positionUnits === null ? "N/A" : trade.positionUnits.toFixed(2)} />
            <SmallMetric label="Mode score" value={`${trade.modeScore}/100`} />
            <SmallMetric label="PnL" tone={trade.realizedPnl} value={formatMoney(trade.realizedPnl)} />
            <SmallMetric label="Return" tone={trade.realizedReturnPct} value={formatPct(trade.realizedReturnPct)} />
            <SmallMetric label="Capital before" value={formatMoney(trade.capitalBefore)} />
            <SmallMetric label="Capital after" tone={trade.realizedPnl} value={formatMoney(trade.capitalAfter)} />
          </div>
        </div>
        <div className="space-y-3">
          <ReasonBlock items={trade.entryReasons} title="Why the system entered" />
          <ReasonBlock items={trade.exitReasons} title="Why the system exited" />
        </div>
        <div className="rounded-2xl border border-cyan-300/16 bg-cyan-400/[0.045] p-4 lg:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Buy / sell lifecycle</div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {trade.lifecycle.map((step) => (
              <div className={`rounded-2xl border p-3 ${reviewToneClass(step.tone)}`} key={`${step.label}:${step.date}:${step.value}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{step.label}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-300">{step.date}</div>
                  </div>
                  <div className="font-mono text-xs font-black text-slate-100">{step.value}</div>
                </div>
                <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 lg:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Trade autopsy</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{trade.autopsy.replayContext}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <ReasonBlock items={trade.autopsy.whatWorked} title="What worked" />
            <ReasonBlock items={trade.autopsy.whatFailed} title="What failed or stayed fragile" />
            <div className="mt-3 rounded-xl border border-violet-300/18 bg-violet-400/[0.06] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">System learned</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{trade.autopsy.systemLearned}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-300/18 bg-violet-400/[0.06] p-4 lg:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-100">What the strategy learned</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{trade.learning.lesson}</p>
          <p className="mt-2 text-sm leading-6 text-cyan-100">{trade.learning.adjustment}</p>
          <div className="mt-4 grid gap-2 text-sm lg:grid-cols-3">
            <ContextPill label="Macro context" value={trade.macroReason} />
            <ContextPill label="Event context" value={trade.eventReason} />
            <ContextPill label="Risk state" value={trade.riskState} />
          </div>
        </div>
      </div>
    </StableDetailOverlay>
  );
}

function DecisionReviewGrid({ items }: { items: SimulatedPortfolioReviewItem[] }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/62 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">AI self-evaluation</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div className={`rounded-2xl border p-3 ${reviewToneClass(item.tone)}`} key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                <div className="mt-1 truncate text-sm font-black text-slate-50">{item.symbol ?? "Limited evidence"}</div>
              </div>
              <div className="shrink-0 font-mono text-sm font-black text-slate-100">{item.value}</div>
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskConcentrationSystem({ concentrations }: { concentrations: SimulatedPortfolioRiskConcentration[] }) {
  if (!concentrations.length) return <EmptyState message="No risk concentration evidence is available yet." />;
  const factors: PosterFactor[] = concentrations.map((item) => ({
    detail: item.detail,
    label: item.label,
    tone: posterToneForPortfolio(item.tone),
    value: item.score,
  }));
  return (
    <div className="rounded-[1.75rem] border border-amber-300/16 bg-amber-400/[0.045] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">Risk concentration tracking</div>
      <PosterFactorBars className="mt-3" factors={factors} label="Concentration pressure" />
      <div className="mt-3 grid gap-2">
        {concentrations.slice(0, 4).map((item) => (
          <div className={`rounded-2xl border p-3 ${reviewToneClass(item.tone)}`} key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-50">{item.label}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
              </div>
              <div className="shrink-0 font-mono text-xs font-black text-slate-100">{item.score === null ? "Limited" : `${Math.round(item.score)}`}</div>
            </div>
            {item.symbols.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.symbols.map((symbol) => (
                  <span className="rounded-full border border-white/10 bg-slate-950/55 px-2 py-1 font-mono text-[10px] font-black text-cyan-100" key={symbol}>{symbol}</span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function AllocationExposureSystem({ buckets }: { buckets: SimulatedPortfolioExposureBucket[] }) {
  if (!buckets.length) return <EmptyState message="No allocation or exposure buckets are available yet." />;
  const factors: PosterFactor[] = buckets.slice(0, 7).map((bucket) => ({
    detail: `${bucket.symbolCount} symbol(s), ${formatMoney(bucket.pnl)} realized PnL.`,
    label: bucket.label,
    tone: posterToneForPortfolio(bucket.tone),
    value: bucket.allocationPct,
  }));
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/62 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Allocation and exposure intelligence</div>
      <PosterFactorBars className="mt-3" factors={factors} label="Exposure buckets" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {buckets.slice(0, 4).map((bucket) => (
          <div className={`rounded-2xl border p-3 ${reviewToneClass(bucket.tone)}`} key={`${bucket.type}:${bucket.label}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-black text-slate-50">{bucket.label}</span>
              <span className="font-mono text-xs font-black text-slate-100">{bucket.allocationPct.toFixed(1)}%</span>
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              {bucket.symbolCount} symbol(s), return {formatPct(bucket.returnPct)}, PnL {formatMoney(bucket.pnl)}.
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearningTimelineSystem({ points }: { points: SimulatedPortfolioLearningTimelinePoint[] }) {
  return (
    <div className="rounded-[1.75rem] border border-cyan-300/16 bg-slate-950/62 p-4" id="strategy-learning">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Strategy learning timeline</div>
          <h3 className="mt-1 text-xl font-black text-white">How the engine revised its behavior</h3>
        </div>
        <div className="text-xs text-slate-500">{points.length ? `${points.length} revision checkpoints` : "Waiting for closed evidence"}</div>
      </div>
      {points.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {points.map((point) => (
            <div className={`rounded-2xl border p-3 ${reviewToneClass(point.tone)}`} key={`${point.date}:${point.label}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{point.date}</div>
                  <div className="mt-1 text-sm font-black text-slate-50">{point.label}</div>
                </div>
                <div className="font-mono text-xs font-black text-cyan-100">{point.confidenceScore}/100</div>
              </div>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{point.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <SmallMetric label="Risk" value={`${point.riskScore}/100`} />
                <SmallMetric label="Allocation" value={`${point.allocationPct.toFixed(1)}%`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState message="No strategy learning timeline is available until completed simulated trades exist. The lab is showing open-sleeve exposure and limited-evidence controls instead of inventing revisions." />
        </div>
      )}
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
            <SmallMetric label="Invested" value={formatMoney(position.investedAmount)} />
            <SmallMetric label="Units" value={position.positionUnits === null ? "N/A" : position.positionUnits.toFixed(2)} />
            <SmallMetric label="Entry Confidence" value={`${position.confidenceAtEntry}/100`} />
            <SmallMetric label="Risk State" value={position.riskState} />
            <SmallMetric label="Sector" value={position.sector.replace(/_/g, " ")} />
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
              <SmallMetric label="Invested" value={formatMoney(trade.investedAmount)} />
              <SmallMetric label="Units" value={trade.positionUnits === null ? "N/A" : trade.positionUnits.toFixed(2)} />
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
            <SmallMetric label="Entry price" value={formatMoney(trade.entryPrice)} />
            <SmallMetric label="Exit price" value={formatMoney(trade.exitPrice)} />
            <SmallMetric label="Entry conf." value={`${trade.confidenceAtEntry}/100`} />
            <SmallMetric label="Exit conf." value={`${trade.confidenceAtExit}/100`} />
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

function decisionReviewItems(review: SimulatedPortfolioDecisionReview): SimulatedPortfolioReviewItem[] {
  return [
    review.bestDecision,
    review.weakestDecision,
    review.unnecessaryRisk,
    review.strongestExit,
    review.weakestExit,
    review.patienceWin,
    review.missedOpportunity,
  ];
}

function riskMapCells(cells: SimulatedPortfolioRiskMapCell[]): PosterHeatCell[] {
  return cells.map((cell) => ({
    detail: cell.detail,
    label: cell.label,
    tone: posterToneForPortfolio(cell.tone),
    value: cell.value,
  }));
}

function posterToneForPortfolio(tone: SimulatedPortfolioTone): PosterVisualTone {
  if (tone === "good") return "emerald";
  if (tone === "risk") return "rose";
  if (tone === "warn") return "amber";
  return "cyan";
}

function reviewToneClass(tone: SimulatedPortfolioTone): string {
  if (tone === "good") return "border-emerald-300/18 bg-emerald-400/[0.055]";
  if (tone === "risk") return "border-rose-300/18 bg-rose-400/[0.055]";
  if (tone === "warn") return "border-amber-300/18 bg-amber-400/[0.055]";
  return "border-cyan-300/14 bg-cyan-400/[0.045]";
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
