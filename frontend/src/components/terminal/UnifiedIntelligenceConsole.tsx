"use client";

import Link from "next/link";
import { Activity, AlertTriangle, BarChart3, Bell, Eye, Gauge, RotateCcw, ShieldAlert, Target, Zap } from "lucide-react";
import { useMemo } from "react";
import { ScoreFactorStrip, type ScoreFactor, VisualMetricRail } from "@/components/visual/MiniVisuals";
import { InteractiveInsightZoneGrid, ShowcaseIntelligenceOrbit, type InteractiveInsightZoneItem } from "@/components/visual/InteractiveVisualIntelligence";
import { SymbolLogo } from "@/components/visual/SymbolLogo";
import { useWorkspacePreferences } from "@/hooks/useWorkspacePreferences";
import {
  buildUnifiedIntelligenceConsole,
  type UnifiedConsoleBriefing,
  type UnifiedConsoleItem,
  type UnifiedConsoleMetric,
} from "@/lib/trading/unified-intelligence-console";
import { buildZoneIntelligenceGraph } from "@/lib/trading/intelligence-graph";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import { moduleLabel, WORKSPACE_MODE_LABELS, type WorkspaceModuleId, type WorkspacePreferences } from "@/lib/trading/workspace-preferences";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function UnifiedIntelligenceConsole({
  marketCondition,
  personalizationProfile,
  rows,
  surface = "terminal",
  workspacePreferences,
  workflowEvolution,
}: {
  marketCondition?: string | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  surface?: "dashboard" | "terminal";
  workspacePreferences?: WorkspacePreferences | null;
  workflowEvolution?: WorkflowEvolutionSummary | null;
}) {
  const { preferences } = useWorkspacePreferences(workspacePreferences);
  const consoleModel = useMemo(
    () => buildUnifiedIntelligenceConsole({ marketCondition, personalizationProfile, rows, workflowEvolution }),
    [marketCondition, personalizationProfile, rows, workflowEvolution],
  );
  const compact = surface === "terminal";

  if (!rows.length) {
    return (
      <GlassPanel className="p-5" data-onboarding-target="what-matters-now">
        <SectionTitle eyebrow="Unified Console" title="What Matters Most Now" meta="waiting for scanner rows" />
        <p className="mt-3 text-sm leading-6 text-slate-400">The unified console appears after scanner rows are available.</p>
      </GlassPanel>
    );
  }

  const focusItems = consoleModel.whatMattersMost.slice(0, compact ? 3 : 5);
  const primaryFocus = focusItems[0] ?? consoleModel.summary;
  const secondaryFocus = focusItems.slice(1);
  const metricsToShow = consoleModel.metrics.slice(0, compact ? 4 : 6);
  const zones = applyWorkspacePreferencesToZones(buildSimpleHomeZones(consoleModel), preferences);

  if (compact) {
    return <SimpleHomeConsole consoleModel={consoleModel} workspacePreferences={preferences} />;
  }

  return (
    <GlassPanel className="overflow-hidden border-cyan-300/15 bg-cyan-400/[0.025] p-4 sm:p-5" data-onboarding-target="what-matters-now">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.82fr)]">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Unified Decision Console</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">What Matters Most Now</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(consoleModel.summary)}</p>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-500">{humanizeInsightText(consoleModel.personalizedSummary)}</p>
          <PersonalFocusStrip preferences={preferences} />

          <div className="mt-5 rounded-xl border border-cyan-300/20 bg-slate-950/45 p-4 shadow-[0_0_0_1px_rgba(103,232,249,0.04)]">
            <div className="text-[10px] font-black uppercase leading-4 tracking-[0.22em] text-cyan-200">Primary focus</div>
            <p className="mt-2 text-base leading-7 text-slate-100">{humanizeInsightText(primaryFocus)}</p>
          </div>

          {secondaryFocus.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {secondaryFocus.map((line, index) => (
                <div className="min-w-0 rounded-lg border border-white/10 bg-slate-950/30 p-3" key={line}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 font-mono text-[11px] font-black text-cyan-100">{index + 2}</div>
                    <p className="line-clamp-3 text-xs leading-5 text-slate-300">{humanizeInsightText(line)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {metricsToShow.map((metric) => <ConsoleMetricTile key={metric.key} metric={metric} />)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <PriorityQueue items={consoleModel.attentionQueue} />
        <ContextStack
          bestAsymmetry={consoleModel.bestAsymmetry}
          compact={compact}
          eventPressure={consoleModel.eventPressure}
          fragilityRising={consoleModel.fragilityRising}
          macroLabel={consoleModel.macroRegime.label}
          macroSummary={consoleModel.macroRegime.summary}
          shockConditionsAligning={consoleModel.shockConditionsAligning}
        />
      </div>

      <div className="mt-5">
        <SimpleAttentionStatusMatrix consoleModel={consoleModel} />
      </div>

      <div className="mt-5">
        <ShowcaseIntelligenceOrbit
          summary="Market state, replay, risk pressure, setup quality, macro context, shock intelligence, watchlist changes, and decision reasoning stay connected in one live research surface."
          title="One System. What Matters Now."
          zones={zones}
        />
      </div>

      <div className="mt-5">
        <InteractiveInsightZoneGrid
          eyebrow="Clickable intelligence zones"
          summary="Open a zone to inspect the scored factors, related symbols, source data, and what to monitor next."
          title="Explore Intelligence Zones"
          zones={zones}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <BriefingList empty="No material changes are available yet." items={consoleModel.biggestChanges} limit={compact ? 3 : 4} title="Biggest Changes" />
        <BriefingList empty="No watchlist-specific change is available yet." items={consoleModel.watchlistChanges} limit={compact ? 3 : 4} title="Watchlist Changes" />
        <BriefingList empty="No new revisit signal is available yet." items={consoleModel.whatChangedSinceLastVisit} limit={compact ? 3 : 4} title="Since Last Visit" />
      </div>

      <details className="mt-4 rounded-lg border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">Grounding boundary</summary>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Summary text uses scored TradeVeto data only. AI output must stay grounded in {consoleModel.llmSummaryPacket.topAttentionSymbols.length} attention symbols, verified risks, and recorded changes.
        </p>
      </details>
    </GlassPanel>
  );
}

function SimpleHomeConsole({ consoleModel, workspacePreferences }: { consoleModel: ReturnType<typeof buildUnifiedIntelligenceConsole>; workspacePreferences: WorkspacePreferences }) {
  const opportunities = consoleModel.topOpportunities.slice(0, 3);
  const risks = consoleModel.topRisks.slice(0, 3);
  const changes = consoleModel.biggestChanges.slice(0, 3);
  const shocks = consoleModel.shockConditionsAligning.slice(0, 3);
  const watchlist = consoleModel.watchlistChanges.slice(0, 3);
  const headline = consoleModel.whatMattersMost[0] ?? consoleModel.summary;
  const watchNext = [
    opportunities[0]?.actionContext,
    risks[0]?.riskLabel,
    shocks[0]?.actionContext,
  ].filter((item): item is string => Boolean(item));
  const zones = applyWorkspacePreferencesToZones(buildSimpleHomeZones(consoleModel), workspacePreferences);

  return (
    <GlassPanel className="poster-scanline overflow-hidden border-cyan-300/20 bg-cyan-400/[0.035] p-4 sm:p-5" data-onboarding-target="what-matters-now">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Unified Simple Console</div>
          <h1 className="poster-display-title mt-2 text-3xl tracking-tight text-slate-50 sm:text-5xl">What Matters <span className="poster-word-cyan">Now</span></h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{humanizeInsightText(headline)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SimpleStatusPill label="Market State" value={humanizeInsightText(consoleModel.macroRegime.label)} />
            <SimpleStatusPill label="Workspace" value={WORKSPACE_MODE_LABELS[workspacePreferences.workspaceMode]} />
            <SimpleStatusPill label="Risk Style" value={humanizeInsightText(workspacePreferences.preferredRiskStyle)} />
            <SimpleStatusPill label="Updated" value={new Date(consoleModel.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
          </div>
          <PersonalFocusStrip preferences={workspacePreferences} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {consoleModel.metrics.slice(0, 4).map((metric) => (
            <SimpleMetricRow key={metric.key} metric={metric} />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <InteractiveInsightZoneGrid
          eyebrow="Clickable intelligence zones"
          summary="Tap a zone to see the scored factors, source data, and the reason it appears here."
          title="Explore What Matters"
          zones={zones}
        />
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <SimpleOpportunityList empty="No clear opportunity leader is available yet." items={opportunities} title="Best Opportunities" />
        <SimpleRiskList empty="No dominant danger item is visible yet." items={risks} title="Dangerous Now" />
        <SimpleMarketStateCard label={consoleModel.macroRegime.label} summary={consoleModel.macroRegime.summary} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <SimpleBriefingCard empty="No major change is available yet." items={changes} title="What Changed" />
        <SimpleBriefingCard empty="No large-move setup is standing out yet." items={shocks} title="Large-Move Watch" />
        <SimpleBriefingCard empty="Add watchlist symbols to see personalized changes here." items={watchlist} title="Watchlist Changes" />
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">What should I watch?</div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {watchNext.length ? watchNext.slice(0, 3).map((item) => (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-300" key={item}>{humanizeInsightText(item)}</p>
          )) : (
            <p className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-400 md:col-span-3">Wait for fresher scanner rows, cleaner opportunity ranking, or watchlist changes before digging into advanced panels.</p>
          )}
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-200">
          <span>Advanced intelligence details</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">expand</span>
        </summary>
        <div className="mt-4 grid gap-4">
          <PriorityQueue items={consoleModel.attentionQueue} />
          <div className="grid gap-3 lg:grid-cols-2">
            <BriefingList empty="No verified event pressure is standing out." items={consoleModel.eventPressure} limit={3} title="Event Pressure" />
            <BriefingList empty="No dominant fragility escalation is visible." items={consoleModel.fragilityRising} limit={3} title="Fragility Rising" />
            <BriefingList empty="No clear upside/downside leader is confirmed yet." items={consoleModel.bestAsymmetry} limit={3} title="Best Upside / Downside Balance" />
            <BriefingList empty="No new revisit signal is available yet." items={consoleModel.whatChangedSinceLastVisit} limit={3} title="Since Last Visit" />
          </div>
          <details className="rounded-lg border border-white/10 bg-slate-950/35 p-3">
            <summary className="cursor-pointer text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500">Grounding boundary</summary>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Summary text uses scored TradeVeto data only. AI output must stay grounded in {consoleModel.llmSummaryPacket.topAttentionSymbols.length} attention symbols, verified risks, and recorded changes.
            </p>
          </details>
        </div>
      </details>
    </GlassPanel>
  );
}

function SimpleAttentionStatusMatrix({ consoleModel }: { consoleModel: ReturnType<typeof buildUnifiedIntelligenceConsole> }) {
  const metricByKey = new Map(consoleModel.metrics.map((metric) => [metric.key, metric]));
  const attention = metricByKey.get("attention");
  const decision = metricByKey.get("decision");
  const risk = metricByKey.get("risk");
  const fragility = metricByKey.get("fragility");
  const opportunity = metricByKey.get("opportunity");
  const dangerousCount = consoleModel.topRisks.length;
  const watchCount = consoleModel.shockConditionsAligning.length + consoleModel.watchlistChanges.length;
  const favorableCount = consoleModel.topOpportunities.length;
  const neutralCount = Math.max(0, consoleModel.attentionQueue.length - dangerousCount - favorableCount);
  const cards = [
    {
      border: "border-rose-300/25",
      count: dangerousCount,
      label: "Dangerous",
      summary: consoleModel.topRisks[0]?.riskLabel ?? "No dominant risk item is visible yet.",
      text: "text-rose-100",
    },
    {
      border: "border-amber-300/25",
      count: watchCount,
      label: "Watch Closely",
      summary: consoleModel.shockConditionsAligning[0]?.label ?? consoleModel.watchlistChanges[0]?.label ?? "No high-priority watch change yet.",
      text: "text-amber-100",
    },
    {
      border: "border-cyan-300/25",
      count: neutralCount,
      label: "Neutral",
      summary: consoleModel.macroRegime.summary,
      text: "text-cyan-100",
    },
    {
      border: "border-emerald-300/25",
      count: favorableCount,
      label: "Favorable",
      summary: consoleModel.topOpportunities[0]?.reasonForAttention ?? "No clear setup leader is available yet.",
      text: "text-emerald-100",
    },
  ];

  return (
    <section className="rounded-3xl border border-cyan-300/16 bg-slate-950/45 p-4 shadow-2xl shadow-cyan-950/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">What Matters Now</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Unified attention system</h2>
        </div>
        <div className="text-xs leading-5 text-slate-500">Counts and scores come from the current scanner, workflow, and watchlist context.</div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div className={`min-w-0 rounded-2xl border ${card.border} bg-white/[0.035] p-4`} key={card.label}>
            <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${card.text}`}>{card.label}</div>
            <div className="mt-3 font-mono text-4xl font-black text-slate-50">{card.count}</div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{humanizeInsightText(card.summary)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ScoreFactorStrip
          factors={[
            metricFactor(attention, "cyan"),
            metricFactor(opportunity, "emerald"),
            metricFactor(decision, "cyan"),
            metricFactor(risk, "rose"),
            metricFactor(fragility, "amber"),
          ].filter((factor): factor is ScoreFactor => Boolean(factor))}
          label="Attention score drivers"
        />
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Living status</div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">{humanizeInsightText(consoleModel.macroRegime.label)}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{humanizeInsightText(consoleModel.personalizedSummary)}</p>
            </div>
            <div className="relative h-14 w-14 shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.18)]">
              <span className="absolute inset-3 rounded-full bg-cyan-300/25" />
              <span className="absolute inset-5 rounded-full bg-cyan-100" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const ZONE_MODULE_BY_ID: Record<string, WorkspaceModuleId> = {
  "best-setups": "best_setups",
  dangerous: "dangerous",
  "macro-pressure": "macro",
  "market-state": "what_matters_now",
  "replay-context": "replay",
  "risk-review": "dangerous",
  "shock-watch": "shock_watch",
  "volatility-pressure": "shock_watch",
  watchlist: "watchlist",
  "what-changed": "what_matters_now",
};

function applyWorkspacePreferencesToZones(zones: InteractiveInsightZoneItem[], preferences: WorkspacePreferences): InteractiveInsightZoneItem[] {
  const hidden = new Set(preferences.hiddenModules);
  const moduleRank = new Map(preferences.moduleOrder.map((moduleId, index) => [moduleId, index]));
  return zones
    .filter((zone) => {
      const moduleId = ZONE_MODULE_BY_ID[zone.id];
      return !moduleId || !hidden.has(moduleId);
    })
    .map((zone) => {
      const moduleId = ZONE_MODULE_BY_ID[zone.id];
      const favorite = moduleId ? preferences.favoriteModules.includes(moduleId) : false;
      if (!favorite) return zone;
      return {
        ...zone,
        eyebrow: zone.eyebrow ?? "Personal focus",
        summary: `${zone.summary} · favorited in your workspace`,
      };
    })
    .sort((left, right) => {
      const leftModule = ZONE_MODULE_BY_ID[left.id];
      const rightModule = ZONE_MODULE_BY_ID[right.id];
      const leftRank = leftModule ? moduleRank.get(leftModule) ?? 99 : 99;
      const rightRank = rightModule ? moduleRank.get(rightModule) ?? 99 : 99;
      return leftRank - rightRank;
    });
}

function PersonalFocusStrip({ preferences }: { preferences: WorkspacePreferences }) {
  const favoriteModules = preferences.favoriteModules.slice(0, 4);
  const favoriteSymbols = preferences.favoriteSymbols.slice(0, 5);
  if (!favoriteModules.length && !favoriteSymbols.length && !preferences.mobileLastViewedSymbol) return null;

  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/12 bg-slate-950/35 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <span className="text-cyan-300">Personal focus</span>
        <span>{WORKSPACE_MODE_LABELS[preferences.workspaceMode]}</span>
        {preferences.preferredTimeframes.length ? <span>{preferences.preferredTimeframes.join(" / ")}</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {favoriteModules.map((moduleId) => (
          <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black text-cyan-100" key={moduleId}>
            {moduleLabel(moduleId)}
          </span>
        ))}
        {favoriteSymbols.map((symbol) => (
          <Link className="rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1.5 font-mono text-[11px] font-black text-emerald-100 transition hover:border-emerald-200/60 hover:text-white" href={`/symbol/${symbol}`} key={symbol}>
            {symbol}
          </Link>
        ))}
        {preferences.mobileLastViewedSymbol ? (
          <Link className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-black text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100" href={`/symbol/${preferences.mobileLastViewedSymbol}`}>
            Last viewed: {preferences.mobileLastViewedSymbol}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function buildSimpleHomeZones(consoleModel: ReturnType<typeof buildUnifiedIntelligenceConsole>): InteractiveInsightZoneItem[] {
  const metricByKey = new Map(consoleModel.metrics.map((metric) => [metric.key, metric]));
  const generatedAt = new Date(consoleModel.generatedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  const best = consoleModel.topOpportunities[0] ?? null;
  const risk = consoleModel.topRisks[0] ?? null;
  const topShock = consoleModel.shockConditionsAligning[0] ?? null;
  const topChange = consoleModel.biggestChanges[0] ?? null;
  const topWatchlist = consoleModel.watchlistChanges[0] ?? null;
  const topEvent = consoleModel.eventPressure[0] ?? null;
  const topFragility = consoleModel.fragilityRising[0] ?? null;
  const topReplay = consoleModel.bestAsymmetry[0] ?? consoleModel.whatChangedSinceLastVisit[0] ?? null;
  const attentionMetric = metricByKey.get("attention");
  const opportunityMetric = metricByKey.get("opportunity");
  const decisionMetric = metricByKey.get("decision");
  const riskMetric = metricByKey.get("risk");
  const fragilityMetric = metricByKey.get("fragility");
  const asymmetryMetric = metricByKey.get("asymmetry");

  const zones: InteractiveInsightZoneItem[] = [
    {
      bullets: [
        consoleModel.macroRegime.summary,
        `Attention is ${metricByKey.get("attention")?.score ?? "not scored"} across current opportunity, risk, and workflow inputs.`,
        topChange ? topChange.label : "No material market-state change is available in this snapshot.",
      ],
      dataSource: "Unified console metrics, scanner rows, workflow evolution",
      detailSummary: consoleModel.macroRegime.summary,
      detailTitle: "Market State Detail",
      eyebrow: "Regime",
      factors: [
        metricFactor(attentionMetric, "cyan"),
        metricFactor(decisionMetric, "cyan"),
        metricFactor(riskMetric, "rose"),
        metricFactor(fragilityMetric, "amber"),
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      icon: <Gauge className="h-6 w-6" />,
      id: "market-state",
      label: "Market State",
      metric: `${attentionMetric?.score ?? "N/A"}`,
      monitorNext: [
        consoleModel.macroRegime.summary,
        topChange?.actionContext,
        risk?.actionContext,
      ].filter((item): item is string => Boolean(item)),
      relatedSymbols: uniqueSymbols([
        ...itemSymbols(consoleModel.attentionQueue),
        ...briefingSymbols(consoleModel.biggestChanges),
      ]),
      summary: consoleModel.macroRegime.label,
      tone: "cyan",
      updatedAt: generatedAt,
    },
    {
      bullets: best ? [best.reasonForAttention, best.actionContext, best.detail] : ["No top setup is available in this snapshot."],
      dataSource: "Meta opportunity priority queue",
      detailSummary: best ? `${best.symbol} leads the current setup stack. ${best.reasonForAttention}` : "No setup has enough current quality to lead the queue.",
      detailTitle: "Best Setups Detail",
      emptyMessage: "No best-setup row has enough scored factors yet.",
      eyebrow: "Opportunity",
      factors: best ? itemFactors(best, "opportunity") : [],
      href: best?.href ?? "/opportunities",
      icon: <Target className="h-6 w-6" />,
      id: "best-setups",
      label: "Best Setups",
      metric: `${consoleModel.topOpportunities.length}`,
      monitorNext: best ? [best.actionContext, best.detail] : ["Wait for enough scanner evidence before treating a setup as a research candidate."],
      relatedSymbols: itemSymbols(consoleModel.topOpportunities),
      summary: best ? `${best.symbol}: ${best.reasonForAttention}` : "No clear setup leader yet.",
      tone: "emerald",
      updatedAt: generatedAt,
    },
    {
      bullets: topShock ? [topShock.label, topShock.actionContext] : ["No large-move setup is standing out yet."],
      dataSource: "Shock pattern intelligence and current scanner rows",
      detailSummary: topShock ? topShock.label : "TradeVeto is not showing a high-quality large-move watch item in this snapshot.",
      detailTitle: "Shock Watch Detail",
      emptyMessage: "Shock watch uses pattern-level evidence. No scored shock factor is available for this snapshot.",
      factors: [
        metricFactor(metricByKey.get("risk"), "rose"),
        metricFactor(metricByKey.get("fragility"), "amber"),
        metricFactor(metricByKey.get("attention"), "violet"),
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      href: "/opportunities?tab=shock",
      icon: <Zap className="h-6 w-6" />,
      id: "shock-watch",
      label: "Shock Watch",
      metric: `${consoleModel.shockConditionsAligning.length}`,
      monitorNext: topShock ? [topShock.actionContext, "Check chase risk, event pressure, and fragility before treating large-move context as actionable research."] : ["No elevated large-move context is validated in this snapshot."],
      relatedSymbols: briefingSymbols(consoleModel.shockConditionsAligning),
      summary: topShock ? topShock.label : "No elevated large-move context.",
      tone: "violet",
      updatedAt: generatedAt,
    },
    {
      bullets: risk ? [risk.riskLabel, risk.actionContext, risk.reasonForAttention] : ["No dominant dangerous-now item is visible yet."],
      dataSource: "Danger queue, fragility, risk pressure, and timing quality",
      detailSummary: risk ? `${risk.symbol} is the top current risk item. ${risk.riskLabel}` : "No current item is dominating the risk queue.",
      detailTitle: "Dangerous Now Detail",
      emptyMessage: "No dangerous-now row has enough scored factors yet.",
      factors: risk ? itemFactors(risk, "risk") : [],
      href: risk?.href ?? "/opportunities",
      icon: <AlertTriangle className="h-6 w-6" />,
      id: "dangerous",
      label: "Dangerous Now",
      metric: `${consoleModel.topRisks.length}`,
      monitorNext: risk ? [risk.actionContext, risk.detail, "Wait for risk pressure, timing, or invalidation context to improve before forcing a setup."] : ["No dominant risk item is active in the current queue."],
      relatedSymbols: itemSymbols(consoleModel.topRisks),
      summary: risk ? `${risk.symbol}: ${risk.riskLabel}` : "No dominant danger item.",
      tone: "amber",
      updatedAt: generatedAt,
    },
    {
      bullets: topWatchlist ? [topWatchlist.label, topWatchlist.actionContext] : ["Add symbols to the watchlist to see tracked changes."],
      dataSource: "Watchlist evolution and workflow memory",
      detailSummary: topWatchlist ? topWatchlist.label : "No watchlist-specific change is available yet.",
      detailTitle: "Watchlist Detail",
      factors: [
        metricFactor(metricByKey.get("attention"), "cyan"),
        metricFactor(metricByKey.get("decision"), "cyan"),
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      href: "/opportunities?tab=watchlist",
      icon: <Bell className="h-6 w-6" />,
      id: "watchlist",
      label: "Watchlist Intelligence",
      metric: `${consoleModel.watchlistChanges.length}`,
      monitorNext: topWatchlist ? [topWatchlist.actionContext] : ["Add or revisit watchlist symbols to see setup evolution and risk changes."],
      relatedSymbols: briefingSymbols(consoleModel.watchlistChanges),
      summary: topWatchlist ? topWatchlist.label : "No tracked change yet.",
      tone: "rose",
      updatedAt: generatedAt,
    },
    {
      bullets: consoleModel.biggestChanges.length
        ? consoleModel.biggestChanges.slice(0, 5).map((item) => `${item.label} ${item.actionContext}`)
        : ["No recent workflow change is available in this snapshot."],
      dataSource: "Workflow evolution, scanner deltas, and fallback current rows",
      detailSummary: topChange ? topChange.label : "No material changes are available yet.",
      detailTitle: "What Changed Detail",
      factors: [
        metricFactor(metricByKey.get("attention"), "cyan"),
        metricFactor(metricByKey.get("opportunity"), "emerald"),
        metricFactor(metricByKey.get("risk"), "rose"),
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      href: "/history",
      icon: <Eye className="h-6 w-6" />,
      id: "what-changed",
      label: "What Changed",
      metric: `${consoleModel.biggestChanges.length}`,
      monitorNext: consoleModel.biggestChanges.length
        ? consoleModel.biggestChanges.slice(0, 4).map((item) => item.actionContext)
        : ["No scan-to-scan or workflow change has enough evidence to display yet."],
      relatedSymbols: briefingSymbols(consoleModel.biggestChanges),
      summary: topChange ? topChange.label : "No material change yet.",
      tone: "cyan",
      updatedAt: generatedAt,
    },
    {
      bullets: risk
        ? [risk.riskLabel, risk.actionContext, risk.reasonForAttention, topFragility?.label ?? "No separate fragility escalation is visible."]
        : ["No dominant risk review item is visible yet."],
      dataSource: "Risk metric, fragility metric, top risk queue",
      detailSummary: riskMetric ? riskMetric.detail : "Risk review needs enough scored rows to show a reliable pressure view.",
      detailTitle: "Risk Review Detail",
      emptyMessage: "Risk review does not have enough scored evidence yet.",
      eyebrow: "Risk",
      factors: [
        metricFactor(riskMetric, "rose"),
        metricFactor(fragilityMetric, "amber"),
        risk ? { detail: risk.riskLabel, label: "Top Risk", tone: "rose", value: risk.riskScore } : null,
        risk ? { detail: risk.urgencyLabel, label: "Urgency", tone: "amber", value: risk.urgencyScore } : null,
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      href: risk?.href ?? "/opportunities",
      icon: <ShieldAlert className="h-6 w-6" />,
      id: "risk-review",
      label: "Risk Review",
      metric: `${riskMetric?.score ?? risk?.riskScore ?? "N/A"}`,
      monitorNext: [
        risk?.actionContext,
        topFragility?.actionContext,
        "Look for lower risk pressure, cleaner invalidation, or stronger confirmation before treating a setup as higher quality.",
      ].filter((item): item is string => Boolean(item)),
      relatedSymbols: uniqueSymbols([...itemSymbols(consoleModel.topRisks), ...briefingSymbols(consoleModel.fragilityRising)]),
      summary: risk ? `${risk.symbol}: ${risk.riskLabel}` : riskMetric?.detail ?? "Risk context is still limited.",
      tone: "rose",
      updatedAt: generatedAt,
    },
    {
      bullets: [
        topShock ? topShock.label : "No elevated shock-watch item is currently validated.",
        topFragility ? topFragility.label : "No separate fragility escalation is visible.",
        riskMetric ? riskMetric.detail : "Risk pressure metric is not scored in this snapshot.",
      ],
      dataSource: "Shock watch, fragility, and risk-pressure metrics",
      detailSummary: topShock
        ? `Volatility pressure is elevated enough to surface ${topShock.label}.`
        : "Volatility pressure is not showing a validated shock-watch leader in this snapshot.",
      detailTitle: "Volatility Pressure Detail",
      emptyMessage: "No validated volatility-pressure factor is available yet.",
      eyebrow: "Pressure",
      factors: [
        metricFactor(riskMetric, "rose"),
        metricFactor(fragilityMetric, "amber"),
        metricFactor(attentionMetric, "violet"),
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      href: "/opportunities?tab=shock",
      icon: <Activity className="h-6 w-6" />,
      id: "volatility-pressure",
      label: "Volatility Pressure",
      metric: `${consoleModel.shockConditionsAligning.length}`,
      monitorNext: [
        topShock?.actionContext,
        topFragility?.actionContext,
        "Treat large-move visuals as limited evidence unless supporting shock, fragility, and event context are present.",
      ].filter((item): item is string => Boolean(item)),
      relatedSymbols: uniqueSymbols([...briefingSymbols(consoleModel.shockConditionsAligning), ...briefingSymbols(consoleModel.fragilityRising)]),
      summary: topShock ? topShock.label : "No validated volatility expansion leader.",
      tone: "violet",
      updatedAt: generatedAt,
    },
    {
      bullets: [
        consoleModel.macroRegime.summary,
        topEvent ? topEvent.label : "No verified event-pressure briefing is dominant.",
        topFragility ? topFragility.label : "No fragility briefing is dominant.",
      ],
      dataSource: "Macro regime summary, event pressure, fragility briefings",
      detailSummary: consoleModel.macroRegime.summary,
      detailTitle: "Macro Pressure Detail",
      emptyMessage: "Macro pressure has no scored supporting factors in this snapshot.",
      eyebrow: "Macro",
      factors: [
        metricFactor(attentionMetric, "cyan"),
        metricFactor(riskMetric, "rose"),
        metricFactor(fragilityMetric, "amber"),
        metricFactor(asymmetryMetric, "emerald"),
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      href: "/intelligence/macro-regime",
      icon: <BarChart3 className="h-6 w-6" />,
      id: "macro-pressure",
      label: "Macro Pressure",
      metric: `${riskMetric?.score ?? "N/A"}`,
      monitorNext: [
        topEvent?.actionContext,
        topFragility?.actionContext,
        "Compare opportunity quality against the current regime before assuming a setup can follow through.",
      ].filter((item): item is string => Boolean(item)),
      relatedSymbols: uniqueSymbols([...briefingSymbols(consoleModel.eventPressure), ...briefingSymbols(consoleModel.fragilityRising)]),
      summary: topEvent ? topEvent.label : consoleModel.macroRegime.label,
      tone: "amber",
      updatedAt: generatedAt,
    },
    {
      bullets: topReplay
        ? [topReplay.label, topReplay.actionContext, "Replay context is shown only when the current console has recorded asymmetry or change evidence."]
        : ["No replay-adjacent context is available in this console snapshot."],
      dataSource: "Best asymmetry briefings and workflow change context",
      detailSummary: topReplay
        ? topReplay.label
        : "Replay context is limited because no historical/asymmetry briefing is available in this snapshot.",
      detailTitle: "Replay Context Detail",
      emptyMessage: "No validated replay factor is exposed for this snapshot.",
      eyebrow: "Replay",
      factors: [
        metricFactor(asymmetryMetric, "emerald"),
        metricFactor(opportunityMetric, "emerald"),
        metricFactor(decisionMetric, "cyan"),
      ].filter((factor): factor is ScoreFactor => Boolean(factor)),
      href: "/history",
      icon: <RotateCcw className="h-6 w-6" />,
      id: "replay-context",
      label: "Replay Context",
      metric: `${consoleModel.bestAsymmetry.length}`,
      monitorNext: topReplay ? [topReplay.actionContext, "Open history or symbol detail when enough replay context is available."] : ["Wait for validated replay or asymmetry context before relying on historical comparison."],
      relatedSymbols: uniqueSymbols([...briefingSymbols(consoleModel.bestAsymmetry), ...briefingSymbols(consoleModel.whatChangedSinceLastVisit)]),
      summary: topReplay ? topReplay.label : "Insufficient replay context.",
      tone: "cyan",
      updatedAt: generatedAt,
    },
  ];

  return zones.map((zone) => ({
    ...zone,
    relationshipGraph: buildZoneIntelligenceGraph({
      dataSource: zone.dataSource,
      factors: zone.factors,
      focus: zone.label,
      lastUpdated: zone.updatedAt,
      relatedSymbols: zone.relatedSymbols,
      summary: zone.detailSummary,
      title: zone.detailTitle,
    }),
  }));
}

function metricFactor(metric: UnifiedConsoleMetric | undefined, tone: ScoreFactor["tone"]): ScoreFactor | null {
  if (!metric) return null;
  return {
    detail: metric.detail,
    label: metric.label,
    tone,
    value: metric.score,
  };
}

function itemFactors(item: UnifiedConsoleItem, mode: "opportunity" | "risk"): ScoreFactor[] {
  if (mode === "risk") {
    return [
      { detail: item.riskLabel, label: "Risk", tone: "rose", value: item.riskScore },
      { detail: item.urgencyLabel, label: "Urgency", tone: "amber", value: item.urgencyScore },
      { detail: item.reasonForAttention, label: "Attention", tone: "cyan", value: item.attentionPriorityScore },
      { detail: item.actionContext, label: "Timing", tone: "amber", value: item.timingQualityScore },
    ];
  }

  return [
    { detail: item.reasonForAttention, label: "Opportunity", tone: "emerald", value: item.opportunityScore },
    { detail: item.actionContext, label: "Timing", tone: "amber", value: item.timingQualityScore },
    { detail: item.reasonForAttention, label: "Attention", tone: "cyan", value: item.attentionPriorityScore },
    { detail: item.detail, label: "Decision", tone: "cyan", value: item.decisionQualityScore },
  ];
}

function itemSymbols(items: UnifiedConsoleItem[]): string[] {
  return uniqueSymbols(items.map((item) => item.symbol));
}

function briefingSymbols(items: UnifiedConsoleBriefing[]): string[] {
  return uniqueSymbols(items.map((item) => item.symbol).filter((symbol): symbol is string => Boolean(symbol)));
}

function uniqueSymbols(symbols: string[]): string[] {
  const normalized = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, 12);
}

function SimpleStatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/15 bg-slate-950/35 px-3 py-1.5 text-[11px] text-slate-300">
      <span className="shrink-0 font-black uppercase tracking-[0.12em] text-cyan-300">{label}</span>
      <span className="min-w-0 truncate font-semibold text-slate-100">{value}</span>
    </span>
  );
}

function SimpleMetricRow({ metric }: { metric: UnifiedConsoleMetric }) {
  const tone = metric.inverse
    ? metric.score >= 70 ? "text-rose-200" : metric.score <= 45 ? "text-emerald-200" : "text-amber-200"
    : metric.score >= 70 ? "text-emerald-200" : metric.score >= 50 ? "text-amber-200" : "text-slate-300";
  const visualTone = metric.inverse
    ? metric.score >= 70 ? "rose" : metric.score <= 45 ? "emerald" : "amber"
    : metric.score >= 70 ? "emerald" : metric.score >= 50 ? "amber" : "cyan";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_64px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="min-w-0">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500" title={metric.label}>{metric.label}</div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(metric.detail)}</p>
        <div className="mt-2">
          <VisualMetricRail metrics={[{ label: metric.label, tone: visualTone, value: metric.score }]} />
        </div>
      </div>
      <div className={`text-right font-mono text-2xl font-black ${tone}`}>{formatNumber(metric.score, 0)}</div>
    </div>
  );
}

function SimpleMarketStateCard({ label, summary }: { label: string; summary: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Market State</div>
      <div className="mt-2 text-xl font-semibold text-slate-50">{humanizeInsightText(label)}</div>
      <p className="mt-2 line-clamp-5 text-sm leading-6 text-slate-400">{humanizeInsightText(summary)}</p>
    </div>
  );
}

function SimpleOpportunityList({ empty, items, title }: { empty: string; items: UnifiedConsoleItem[]; title: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item, index) => (
          <Link className="block rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-emerald-300/35 hover:bg-white/[0.05]" href={item.href} key={item.key}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <SymbolLogo size="sm" symbol={item.symbol} />
                <div className="font-mono text-base font-black text-slate-50">{index + 1}. {item.symbol}</div>
              </div>
              <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-100">{item.attentionPriorityScore}</div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.reasonForAttention)}</p>
            <ScoreFactorStrip
              className="mt-2"
              factors={[
                { label: "Attention", tone: "cyan", value: item.attentionPriorityScore },
                { label: "Opportunity", tone: "emerald", value: item.opportunityScore },
                { label: "Timing", tone: "amber", value: item.timingQualityScore },
                { label: "Decision", tone: "cyan", value: item.decisionQualityScore },
              ]}
              label="Why it ranks"
            />
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function SimpleRiskList({ empty, items, title }: { empty: string; items: UnifiedConsoleItem[]; title: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item, index) => (
          <Link className="block rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-amber-300/35 hover:bg-white/[0.05]" href={item.href} key={item.key}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <SymbolLogo size="sm" symbol={item.symbol} />
                <div className="font-mono text-base font-black text-slate-50">{index + 1}. {item.symbol}</div>
              </div>
              <div className={priorityClass(item.attentionPriority)}>{item.urgencyLabel}</div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.riskLabel)}</p>
            <ScoreFactorStrip
              className="mt-2"
              factors={[
                { label: "Risk", tone: "rose", value: item.riskScore },
                { label: "Urgency", tone: "amber", value: item.urgencyScore },
                { label: "Attention", tone: "cyan", value: item.attentionPriorityScore },
                { label: "Timing", tone: "amber", value: item.timingQualityScore },
              ]}
              label="Why risk is visible"
            />
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function SimpleBriefingCard({ empty, items, title }: { empty: string; items: UnifiedConsoleBriefing[]; title: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">{title}</div>
        <div className="font-mono text-[11px] text-slate-500">{items.length}</div>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <BriefingRow item={item} key={`${title}:${item.symbol ?? item.label}`} />
        )) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function ConsoleMetricTile({ metric }: { metric: UnifiedConsoleMetric }) {
  const status = metric.inverse
    ? metric.score >= 70 ? "Elevated" : metric.score <= 45 ? "Contained" : "Mixed"
    : metric.score >= 70 ? "Strong" : metric.score >= 50 ? "Mixed" : "Limited";
  const tone = metric.inverse
    ? metric.score >= 70 ? "text-rose-200" : metric.score <= 45 ? "text-emerald-200" : "text-amber-200"
    : metric.score >= 70 ? "text-emerald-200" : metric.score >= 50 ? "text-amber-200" : "text-slate-300";
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="min-h-8 break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={metric.label}>{metric.label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className={`min-w-0 text-sm font-bold ${tone}`}>{status}</div>
        <div className="shrink-0 font-mono text-2xl font-black text-slate-50">{formatNumber(metric.score, 0)}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${metric.inverse ? "bg-amber-300" : "bg-cyan-300"}`} style={{ width: `${Math.max(6, Math.min(100, metric.score))}%` }} />
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(metric.detail)}</p>
    </div>
  );
}

function PriorityQueue({ items }: { items: UnifiedConsoleItem[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <SectionTitle eyebrow="Attention Priority" title="Unified Priority Queue" meta="opportunity + risk" />
      <div className="mt-3 grid gap-2">
        {items.slice(0, 6).map((item, index) => (
          <Link className="block min-w-0 rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.05]" href={item.href} key={item.key}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-base font-black text-slate-50">{index + 1}. {item.symbol}</span>
                  <span className={priorityClass(item.attentionPriority)}>{item.urgencyLabel}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400">{item.decision}</span>
                </div>
                <div className="mt-1 truncate text-xs text-cyan-100" title={item.category}>{item.category}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.reasonForAttention)}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-right">
                <div className="font-mono text-2xl font-black text-cyan-100">{item.attentionPriorityScore}</div>
                <div className="text-[10px] uppercase leading-4 tracking-normal text-slate-500">attention</div>
                <div className="mt-1 truncate text-[11px] text-slate-400" title={item.metricLabel}>{item.metricLabel}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ContextStack({
  bestAsymmetry,
  compact,
  eventPressure,
  fragilityRising,
  macroLabel,
  macroSummary,
  shockConditionsAligning,
}: {
  bestAsymmetry: UnifiedConsoleBriefing[];
  compact: boolean;
  eventPressure: UnifiedConsoleBriefing[];
  fragilityRising: UnifiedConsoleBriefing[];
  macroLabel: string;
  macroSummary: string;
  shockConditionsAligning: UnifiedConsoleBriefing[];
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <div className="text-[10px] font-black uppercase leading-4 tracking-normal text-cyan-300">Market State</div>
        <div className="mt-2 text-lg font-semibold text-slate-50">{humanizeInsightText(macroLabel)}</div>
        <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{humanizeInsightText(macroSummary)}</p>
      </div>
      <BriefingList empty="No large-move setup is standing out yet." items={shockConditionsAligning} limit={compact ? 2 : 4} title="Large-Move Setups" />
      <BriefingList empty="No verified event pressure is standing out." items={eventPressure} limit={compact ? 2 : 4} title="Event Pressure" />
      {!compact ? <BriefingList empty="No dominant fragility escalation is visible." items={fragilityRising} limit={3} title="Fragility Rising" /> : null}
      {!compact ? <BriefingList empty="No clear upside/downside leader is confirmed yet." items={bestAsymmetry} limit={3} title="Best Upside / Downside Balance" /> : null}
    </div>
  );
}

function BriefingList({ empty, items, limit = 4, title }: { empty: string; items: UnifiedConsoleBriefing[]; limit?: number; title: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-cyan-300" title={title}>{title}</div>
        <div className="font-mono text-[11px] text-slate-500">{items.length}</div>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? items.slice(0, limit).map((item) => (
          <BriefingRow item={item} key={`${title}:${item.symbol ?? item.label}`} />
        )) : <p className="text-xs leading-5 text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function BriefingRow({ item }: { item: UnifiedConsoleBriefing }) {
  const content = (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs leading-5 text-slate-300">{humanizeInsightText(item.label)}</p>
        <span className={briefingPriorityClass(item.priority)}>{item.priority}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(item.actionContext)}</p>
    </div>
  );
  return item.symbol ? <Link href={`/symbol/${item.symbol}`}>{content}</Link> : content;
}

function priorityClass(priority: UnifiedConsoleItem["attentionPriority"]): string {
  const base = "rounded-full border px-2 py-1 text-[10px] font-black uppercase leading-4 tracking-normal";
  if (priority === "critical") return `${base} border-rose-300/30 bg-rose-400/10 text-rose-100`;
  if (priority === "high") return `${base} border-amber-300/30 bg-amber-400/10 text-amber-100`;
  if (priority === "medium") return `${base} border-cyan-300/25 bg-cyan-400/10 text-cyan-100`;
  return `${base} border-white/10 bg-white/[0.04] text-slate-300`;
}

function briefingPriorityClass(priority: UnifiedConsoleBriefing["priority"]): string {
  const base = "shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase leading-4 tracking-normal";
  if (priority === "high") return `${base} border-rose-300/30 bg-rose-400/10 text-rose-100`;
  if (priority === "medium") return `${base} border-amber-300/30 bg-amber-400/10 text-amber-100`;
  return `${base} border-white/10 bg-white/[0.04] text-slate-400`;
}
