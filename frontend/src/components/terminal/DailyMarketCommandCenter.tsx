"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeInfo,
  BarChart3,
  CalendarClock,
  ExternalLink,
  Flame,
  Globe2,
  LineChart,
  Newspaper,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import { PosterGauge, ScoreFactorStrip, VisualMetricRail, type VisualTone } from "@/components/visual/MiniVisuals";
import type {
  DailyCommandRankedItem,
  DailyCommandTone,
  DailyCompanyEventTimeline,
  DailyCrossAssetEventRelationship,
  DailyDevelopmentCategory,
  DailyEventDomainTimeline,
  DailyEventCalendarItem,
  DailyInformationEvolutionPoint,
  DailyInformationProviderCoverage,
  DailyMacroEventTimelineItem,
  DailyMacroEventStory,
  DailyMarketCommandModel,
  DailyMarketDevelopment,
  DailyMarketChange,
  DailyMoneyFlowSector,
  DailyMoneyFlowTheme,
  DailyNewsEcosystemSummary,
  DailyProviderOperationalState,
  DailyProviderStrategyAudit,
  DailySectorNewsCluster,
} from "@/lib/trading/daily-market-command";

type Props = {
  model: DailyMarketCommandModel;
};

const FILTERS: DailyDevelopmentCategory[] = ["All", "My Watchlist", "Macro", "Earnings", "Analyst", "Dividend", "Rates", "Geopolitical", "Crypto", "Energy", "High Impact"];
const PROVIDER_STATES: DailyProviderOperationalState[] = ["active", "delayed", "stale", "outage", "partial-outage", "calendar-only", "limited"];

const TONE: Record<DailyCommandTone, { bg: string; border: string; glow: string; ring: string; text: string }> = {
  amber: { bg: "bg-amber-400/[0.075]", border: "border-amber-300/25", glow: "shadow-[0_0_32px_rgba(251,191,36,0.11)]", ring: "ring-amber-300/15", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-400/[0.075]", border: "border-cyan-300/25", glow: "shadow-[0_0_32px_rgba(34,211,238,0.11)]", ring: "ring-cyan-300/15", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-400/[0.075]", border: "border-emerald-300/25", glow: "shadow-[0_0_32px_rgba(52,211,153,0.11)]", ring: "ring-emerald-300/15", text: "text-emerald-100" },
  rose: { bg: "bg-rose-400/[0.075]", border: "border-rose-300/25", glow: "shadow-[0_0_32px_rgba(251,113,133,0.11)]", ring: "ring-rose-300/15", text: "text-rose-100" },
  violet: { bg: "bg-violet-400/[0.075]", border: "border-violet-300/25", glow: "shadow-[0_0_32px_rgba(167,139,250,0.11)]", ring: "ring-violet-300/15", text: "text-violet-100" },
};

export function DailyMarketCommandCenter({ model }: Props) {
  const [filter, setFilter] = useState<DailyDevelopmentCategory>("All");
  const [selectedDevelopment, setSelectedDevelopment] = useState<DailyMarketDevelopment | null>(null);
  const filteredDevelopments = useMemo(() => filterDevelopments(model.developments, filter), [filter, model.developments]);
  const moneyFlowMetrics = model.moneyFlow.sectors.slice(0, 5).map((sector) => ({
    label: sector.sector,
    tone: sector.tone as VisualTone,
    value: sector.score,
  }));
  const heroTone: DailyCommandTone = (model.hero.attentionScore ?? 0) >= 72 ? "rose" : (model.hero.attentionScore ?? 0) >= 58 ? "amber" : "cyan";

  return (
    <section
      className={`relative overflow-hidden rounded-[2.1rem] border ${TONE[heroTone].border} bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.18),transparent_31rem),radial-gradient(circle_at_85%_8%,rgba(244,63,94,0.14),transparent_28rem),radial-gradient(circle_at_46%_100%,rgba(16,185,129,0.10),transparent_30rem),linear-gradient(135deg,rgba(2,6,23,0.97),rgba(15,23,42,0.78))] p-4 shadow-2xl shadow-black/40 sm:p-5`}
      id="daily-market-command"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.045)_1px,transparent_1px)] bg-[size:48px_48px] opacity-60" />
      <div className="pointer-events-none absolute -right-20 top-8 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative z-10">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_390px]">
          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/42 p-4 ring-1 ring-cyan-300/10 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Today&apos;s command center</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Market first</span>
              {model.generatedAt ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Updated {formatDate(model.generatedAt)}</span> : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
              <MobileCommandChip label="Setup" tone="emerald" value={model.bestSetups[0]?.symbol ?? "Limited"} />
              <MobileCommandChip label="Risk" tone="rose" value={model.crashRisk[0]?.symbol ?? "Limited"} />
              <MobileCommandChip label="Flow" tone="amber" value={model.moneyFlow.sectors[0]?.sector ?? "Limited"} />
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl xl:text-6xl">
                  What deserves attention right now
                </h1>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300 sm:text-base">
                  {model.hero.narrative}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="tv-tap-motion inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/12 px-4 text-sm font-black text-cyan-50 shadow-[0_0_26px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/70 hover:bg-cyan-300/18" href="/discover">
                    Open full scanner
                    <Search className="h-4 w-4" />
                  </Link>
                  <Link className="tv-tap-motion inline-flex min-h-11 items-center gap-2 rounded-full border border-violet-300/25 bg-violet-300/10 px-4 text-sm font-black text-violet-50 transition hover:border-violet-200/60 hover:bg-violet-300/15" href="/discover#compare">
                    Compare candidates
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="hidden rounded-3xl border border-white/10 bg-black/25 p-4 sm:block">
                <PosterGauge label="Attention" score={model.hero.attentionScore} tone={heroTone} />
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HeroBrief icon={<Globe2 className="h-5 w-5" />} label="Market State" tone="cyan" value={model.hero.marketState} />
              <HeroBrief icon={<Sparkles className="h-5 w-5" />} label="Opportunity" tone="emerald" value={model.hero.dominantOpportunity} />
              <HeroBrief icon={<ShieldAlert className="h-5 w-5" />} label="Danger" tone="rose" value={model.hero.dominantRisk} />
              <HeroBrief icon={<BarChart3 className="h-5 w-5" />} label="Money Flow" tone="amber" value={model.hero.moneyFlow} />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">First research target</div>
                  <div className="mt-1 font-mono text-3xl font-black text-white">{model.bestSetups[0]?.symbol ?? "Limited"}</div>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-200" />
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{model.bestSetups[0]?.whyItRanks ?? "No validated top setup is available yet."}</p>
            </div>
            <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-400/[0.06] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-200">First risk review</div>
                  <div className="mt-1 font-mono text-3xl font-black text-white">{model.crashRisk[0]?.symbol ?? "Limited"}</div>
                </div>
                <TrendingDown className="h-8 w-8 text-rose-200" />
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{model.crashRisk[0]?.whyItRanks ?? "No validated crash-risk ranking is available yet."}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <RankedListPanel icon={<Radar className="h-5 w-5" />} items={model.bestSetups} limitedMessage="No validated best-setup ranking is available." title="Top 5 Best Setups" tone="emerald" />
          <RankedListPanel icon={<Zap className="h-5 w-5" />} items={model.breakoutCandidates} limitedMessage="No validated expansion-potential ranking is available." title="Highest Expansion Potential" tone="violet" />
          <RankedListPanel icon={<AlertTriangle className="h-5 w-5" />} items={model.crashRisk} limitedMessage="No validated downside/crash-risk ranking is available." title="Highest Downside / Crash Risk" tone="rose" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="rounded-[1.75rem] border border-cyan-300/16 bg-slate-950/42 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Where money is flowing</div>
                <h2 className="mt-1 text-2xl font-black text-slate-50">Leadership, pressure, and breadth</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{model.moneyFlow.breadthLabel}</p>
              </div>
              <LineChart className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="mt-4">
              {moneyFlowMetrics.length ? <VisualMetricRail metrics={moneyFlowMetrics} /> : <LimitedState message="Sector money-flow evidence is limited in this snapshot." />}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {model.moneyFlow.sectors.slice(0, 6).map((sector) => <MoneyFlowSectorCard key={sector.sector} sector={sector} />)}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/42 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Today&apos;s most important changes</div>
                <h2 className="mt-1 text-2xl font-black text-slate-50">What changed today</h2>
              </div>
              <Flame className="h-5 w-5 text-amber-200" />
            </div>
            <div className="mt-4 grid gap-2">
              {model.whatChangedToday.length ? model.whatChangedToday.map((item) => <ChangeRow item={item} key={`${item.symbol ?? "market"}:${item.label}:${item.metricLabel}`} />) : <LimitedState message="No scan-to-scan change fields are available yet." />}
            </div>
            <div className="mt-4 grid gap-2">
              {model.moneyFlow.themes.slice(0, 4).map((theme) => <MoneyFlowThemeCard key={theme.label} theme={theme} />)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[1.75rem] border border-cyan-300/16 bg-slate-950/42 p-4" id="daily-market-developments">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Daily market developments</div>
                <h2 className="mt-1 text-2xl font-black text-slate-50">News, macro, earnings, and watchlist impact</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Source-linked items only. TradeVeto shows limited-data states instead of inventing market-moving news.
                </p>
              </div>
              <Newspaper className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((item) => (
                <button
                  className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition ${filter === item ? "border-cyan-200/60 bg-cyan-300/16 text-cyan-50" : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/30 hover:text-cyan-100"}`}
                  key={item}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
            <NewsEcosystemStrip summary={model.newsEcosystem} />
            <ProviderCoverageGrid providers={model.providerCoverage} />
            <ProviderStrategyAuditGrid audits={model.providerCoverageMatrix} />
            <MacroStorylineDeck stories={model.macroStorylines} />
            <MacroEventTimelineDeck items={model.macroEventTimeline} />
            <EventDomainTimelineDeck timelines={model.eventDomainTimelines} />
            <SectorNewsClusterDeck clusters={model.sectorNews} />
            <InformationEvolutionRail points={model.newsEvolution} />
            <CrossAssetRelationshipDeck relationships={model.crossAssetRelationships} />
            <CompanyEventTimelineDeck timelines={model.companyTimelines} />
            <div className="mt-4 grid gap-2">
              {filteredDevelopments.length ? filteredDevelopments.slice(0, 7).map((item) => (
                <button
                  className={`rounded-2xl border p-3 text-left transition hover:border-cyan-300/40 hover:bg-white/[0.055] ${TONE[item.tone].border} ${TONE[item.tone].bg}`}
                  data-stable-overlay-trigger="true"
                  key={item.id}
                  onClick={() => setSelectedDevelopment(item)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        <span>{item.source}</span>
                        <span>{formatDate(item.timestamp)}</span>
                        <span>{sourceHost(item.sourceUrl)}</span>
                        <span className={TONE[item.tone].text}>{item.urgency} urgency</span>
                        <span>{item.category}</span>
                        <span>{item.priorityScore}/100 priority</span>
                        {item.watchlistImpact ? <span className="text-cyan-200">watchlist impact</span> : null}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-100">{item.headline}</div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.whyItMatters}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <DevelopmentMicroContext label="Bullish read" tone="emerald" value={item.bullishImplication} />
                    <DevelopmentMicroContext label="Bearish read" tone="rose" value={item.bearishImplication} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.affectedSymbols.slice(0, 6).map((symbol) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-mono text-[10px] text-slate-300" key={symbol}>{symbol}</span>)}
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.sourceQualityLabel}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.providerAttribution}</span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">{item.freshnessLabel}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.providerState === "active" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>{item.providerStateLabel}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.freshnessSlaLabel}</span>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">{item.uncertaintyLabel}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.symbolRelevanceLabel}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.sectorImpactLabel}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.marketMovingLabel}</span>
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.04] p-5">
                  <div className="flex items-center gap-3">
                    <BadgeInfo className="h-5 w-5 text-cyan-200" />
                    <div className="font-bold text-slate-100">{model.newsEmptyState.message}</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{model.newsEmptyState.integrationNeeded}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/42 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">Next 7 days</div>
                <h2 className="mt-1 text-2xl font-black text-slate-50">Daily events calendar</h2>
              </div>
              <CalendarClock className="h-5 w-5 text-violet-200" />
            </div>
            <div className="mt-4 grid gap-2">
              <CalendarBreakdownRail calendar={model.calendar} />
              {model.calendar.length ? model.calendar.slice(0, 8).map((item) => <CalendarEventRow item={item} key={`${item.symbol}:${item.category}:${item.date}`} />) : <LimitedState message="No validated earnings, dividend, or macro-event dates are available for the next 7 days." />}
            </div>
          </div>
        </div>
      </div>

      <DevelopmentOverlay item={selectedDevelopment} onClose={() => setSelectedDevelopment(null)} />
    </section>
  );
}

function NewsEcosystemStrip({ summary }: { summary: DailyNewsEcosystemSummary }) {
  return (
    <div className="mt-4 rounded-3xl border border-cyan-300/14 bg-cyan-300/[0.045] p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <EcosystemMetric label="Source-linked" tone="cyan" value={`${summary.total}`} />
        <EcosystemMetric label="Watchlist impact" tone="emerald" value={`${summary.watchlistImpactCount}`} />
        <EcosystemMetric label="High impact" tone="rose" value={`${summary.highImpactCount}`} />
        <EcosystemMetric label="Completeness" tone={summary.completenessScore >= 70 ? "emerald" : summary.completenessScore >= 40 ? "amber" : "rose"} value={`${summary.completenessScore}`} />
        <EcosystemMetric label="Source trust" tone={summary.sourceTrust.status === "pass" ? "emerald" : summary.sourceTrust.status === "not-applicable" ? "amber" : "rose"} value={summary.sourceTrust.displayedCardCount ? `${summary.sourceTrust.completenessPct}%` : "N/A"} />
        <EcosystemMetric label="Calendar" tone="violet" value={`${summary.calendarCount}`} />
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{summary.topNarrative}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">{summary.providerCoverage}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${summary.sourceTrust.status === "pass" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}`}>{summary.sourceTrust.completeCardCount}/{summary.sourceTrust.displayedCardCount} source-complete</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{summary.sourceTrust.contextCompletenessPct}% full context</span>
        {summary.sourceNames.slice(0, 5).map((source) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300" key={source}>{source}</span>)}
        {summary.symbolNewsCount ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-100">Symbol news {summary.symbolNewsCount}</span> : null}
        {summary.sectorNewsCount ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">Sector news {summary.sectorNewsCount}</span> : null}
        {summary.ratesInflationCount ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold text-amber-100">Rates {summary.ratesInflationCount}</span> : null}
        {summary.geopoliticalCount ? <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-0.5 text-[10px] font-bold text-rose-100">Geo {summary.geopoliticalCount}</span> : null}
        {summary.analystCount ? <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-0.5 text-[10px] font-bold text-violet-100">Analyst {summary.analystCount}</span> : null}
        {summary.earningsCount ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">Earnings {summary.earningsCount}</span> : null}
        {summary.dividendCount ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-100">Dividends {summary.dividendCount}</span> : null}
        {!summary.total && summary.coverageGaps.length ? summary.coverageGaps.slice(0, 3).map((gap) => <span className="rounded-full border border-dashed border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-400" key={gap}>{gap}</span>) : null}
      </div>
    </div>
  );
}

function ProviderCoverageGrid({ providers }: { providers: DailyInformationProviderCoverage[] }) {
  if (!providers.length) return null;
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {providers.slice(0, 8).map((provider) => (
        <div className={`rounded-2xl border p-3 ${TONE[provider.tone].border} ${TONE[provider.tone].bg}`} key={provider.source}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-50">{provider.source}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{provider.category} provider</div>
            </div>
            <div className={`font-mono text-lg font-black ${TONE[provider.tone].text}`}>{provider.itemCount}</div>
          </div>
          <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{provider.qualityLabel}</div>
          {provider.latestTimestamp ? <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Latest {formatDate(provider.latestTimestamp)}</div> : null}
        </div>
      ))}
    </div>
  );
}

function ProviderStrategyAuditGrid({ audits }: { audits: DailyProviderStrategyAudit[] }) {
  if (!audits.length) return null;
  const stateCounts = providerStateCounts(audits);
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Provider coverage matrix</div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{audits.length} domains</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PROVIDER_STATES.map((state) => (
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300" key={state}>{state.replace("-", " ")} {stateCounts[state]}</span>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {audits.map((audit) => (
          <div className={`rounded-2xl border p-3 ${TONE[audit.tone].border} ${TONE[audit.tone].bg}`} key={audit.domain}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${TONE[audit.tone].text}`}>{audit.operationalState.replace("-", " ")}</div>
                <div className="mt-1 truncate text-sm font-black text-slate-50">{audit.domain.replace(/-/g, " ")}</div>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] font-black text-slate-300">{audit.itemCount}</span>
            </div>
            <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{audit.provider}</div>
            <div className="mt-2 grid gap-1.5">
              <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-slate-300">{audit.freshness}</div>
              <div className={`rounded-xl border px-2 py-1.5 text-[10px] ${audit.freshnessSlaStatus === "within-sla" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : audit.freshnessSlaStatus === "breached" ? "border-rose-300/20 bg-rose-300/10 text-rose-100" : "border-white/10 bg-black/20 text-slate-400"}`}>
                SLA {audit.freshnessSlaStatus.replace("-", " ")}{audit.freshnessSlaMinutes === null ? "" : ` · ${audit.freshnessSlaMinutes}m`}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-slate-400">{audit.latency}</div>
            </div>
            <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-300">{audit.disclosure}</div>
            <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">{audit.sourceTransparency} {audit.freshnessSlaDisclosure} {audit.limitations.join(" ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroStorylineDeck({ stories }: { stories: DailyMacroEventStory[] }) {
  if (!stories.length) return null;
  return (
    <div className="mt-3 grid gap-2 lg:grid-cols-2">
      {stories.slice(0, 4).map((story) => (
        <div className={`rounded-2xl border p-3 ${TONE[story.tone].border} ${TONE[story.tone].bg}`} key={story.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${TONE[story.tone].text}`}>{story.urgency} storyline</div>
              <div className="mt-1 text-sm font-black text-slate-50">{story.label}</div>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] font-black text-slate-300">{story.affectedSymbols.length || story.affectedSectors.length}</span>
          </div>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{story.detail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {story.drivers.slice(0, 4).map((driver) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300" key={driver}>{driver}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function MacroEventTimelineDeck({ items }: { items: DailyMacroEventTimelineItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Macro event timeline</div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{items.length} events</span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {items.slice(0, 6).map((item) => (
          <a
            className={`block rounded-2xl border p-3 transition ${item.sourceUrl ? "hover:border-cyan-300/35 hover:bg-white/[0.055]" : ""} ${TONE[item.tone].border} ${TONE[item.tone].bg}`}
            href={item.sourceUrl ?? undefined}
            key={item.id}
            rel="noreferrer"
            target={item.sourceUrl ? "_blank" : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${TONE[item.tone].text}`}>{formatDate(item.date)} · {item.category}</div>
                <div className="mt-1 line-clamp-2 text-sm font-black text-slate-50">{item.relationshipType}</div>
              </div>
              {item.sourceUrl ? <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" /> : null}
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{item.source}</span>
              {item.affectedSymbols.slice(0, 5).map((symbol) => <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-100" key={symbol}>{symbol}</span>)}
              {item.affectedSectors.slice(0, 3).map((sector) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300" key={sector}>{sector}</span>)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function EventDomainTimelineDeck({ timelines }: { timelines: DailyEventDomainTimeline[] }) {
  if (!timelines.length) return null;
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Provider event timelines</div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{timelines.length} domains</span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {timelines.slice(0, 6).map((timeline) => (
          <div className={`rounded-2xl border p-3 ${TONE[timeline.tone].border} ${TONE[timeline.tone].bg}`} key={timeline.domain}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${TONE[timeline.tone].text}`}>{timeline.domain.replace(/-/g, " ")}</div>
                <div className="mt-1 text-sm font-black text-slate-50">{timeline.label}</div>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] font-black text-slate-300">{timeline.activeSourceCount}/{timeline.itemCount}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">{timeline.activeSourceCount} source-linked</span>
              {timeline.calendarCount ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">{timeline.calendarCount} calendar-only</span> : null}
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{timeline.providerStateSummary}</span>
            </div>
            <div className="mt-3 space-y-2">
              {timeline.items.slice(0, 3).map((item) => (
                <a
                  className={`block rounded-xl border border-white/10 bg-black/20 p-2 ${item.sourceUrl ? "transition hover:border-cyan-300/35 hover:bg-white/[0.055]" : ""}`}
                  href={item.sourceUrl ?? undefined}
                  key={item.id}
                  rel="noreferrer"
                  target={item.sourceUrl ? "_blank" : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-[10px] font-black uppercase tracking-[0.12em] ${TONE[item.tone].text}`}>{formatDate(item.date)} · {item.providerState.replace("-", " ")}</div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
                    </div>
                    {item.sourceUrl ? <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" /> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300">{item.source}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-400">{item.freshnessLabel}</span>
                    {item.watchlistImpact ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">watchlist</span> : null}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorNewsClusterDeck({ clusters }: { clusters: DailySectorNewsCluster[] }) {
  if (!clusters.length) return null;
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Sector news impact map</div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{clusters.length} clusters</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {clusters.slice(0, 6).map((cluster) => (
          <div className={`rounded-2xl border p-3 ${TONE[cluster.tone].border} ${TONE[cluster.tone].bg}`} key={cluster.sector}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-50">{cluster.sector}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.13em] text-slate-500">{cluster.latestSource}</div>
              </div>
              <div className={`font-mono text-lg font-black ${TONE[cluster.tone].text}`}>{cluster.itemCount}</div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{cluster.latestHeadline}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cluster.categories.slice(0, 3).map((category) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300" key={category}>{category}</span>)}
              {cluster.highImpactCount ? <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-0.5 text-[10px] font-bold text-rose-100">High {cluster.highImpactCount}</span> : null}
              {cluster.watchlistImpactCount ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">Watch {cluster.watchlistImpactCount}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InformationEvolutionRail({ points }: { points: DailyInformationEvolutionPoint[] }) {
  if (!points.length) return null;
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Macro/news evolution</div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{points.length} sessions</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {points.slice(0, 6).map((point) => (
          <div className={`rounded-2xl border p-3 ${TONE[point.tone].border} ${TONE[point.tone].bg}`} key={point.date}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${TONE[point.tone].text}`}>{formatDate(point.date)}</div>
                <div className="mt-1 text-sm font-black text-slate-50">{point.itemCount} source-linked items</div>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] font-black text-slate-300">{point.highImpactCount} high</span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{point.latestHeadline}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {point.categories.slice(0, 4).map((category) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-slate-300" key={category}>{category}</span>)}
              {point.watchlistImpactCount ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">Watch {point.watchlistImpactCount}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrossAssetRelationshipDeck({ relationships }: { relationships: DailyCrossAssetEventRelationship[] }) {
  if (!relationships.length) return null;
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Cross-asset event relationships</div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{relationships.length} links</span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {relationships.slice(0, 4).map((relationship) => (
          <div className={`rounded-2xl border p-3 ${TONE[relationship.tone].border} ${TONE[relationship.tone].bg}`} key={relationship.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${TONE[relationship.tone].text}`}>{relationship.urgency} {relationship.category}</div>
                <div className="mt-1 line-clamp-2 text-sm font-black text-slate-50">{relationship.headline}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{relationship.relationshipType}</div>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black text-slate-300">{relationship.source}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{relationship.narrative}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {relationship.linkedMarketProxies.map((symbol) => <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-100" key={symbol}>{symbol}</span>)}
              {relationship.affectedSymbols.slice(0, 5).map((symbol) => <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-mono text-[10px] text-slate-300" key={symbol}>{symbol}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyEventTimelineDeck({ timelines }: { timelines: DailyCompanyEventTimeline[] }) {
  if (!timelines.length) return null;
  return (
    <div className="mt-3 rounded-3xl border border-white/10 bg-black/18 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Company event timelines</div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{timelines.length} symbols</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {timelines.slice(0, 6).map((timeline) => (
          <Link className={`block rounded-2xl border p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055] ${TONE[timeline.tone].border} ${TONE[timeline.tone].bg}`} href={`/symbol/${timeline.symbol}`} key={timeline.symbol}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-lg font-black text-white">{timeline.symbol}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{timeline.sourceCount} linked sources</div>
              </div>
              <span className={`rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black ${TONE[timeline.tone].text}`}>{timeline.timeline.length} events</span>
            </div>
            <div className="mt-2 space-y-2">
              {timeline.timeline.slice(0, 3).map((item) => (
                <div className="border-l border-white/10 pl-2" key={`${timeline.symbol}:${item.timestamp}:${item.detail}`}>
                  <div className={`text-[10px] font-black uppercase tracking-[0.12em] ${TONE[item.tone].text}`}>{formatDate(item.timestamp)} · {item.category}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</div>
                </div>
              ))}
            </div>
            {timeline.nextEvent ? <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-slate-300">Next: {timeline.nextEvent.label}</div> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function EcosystemMetric({ label, tone, value }: { label: string; tone: DailyCommandTone; value: string }) {
  return (
    <div className={`rounded-2xl border p-2 ${TONE[tone].border} ${TONE[tone].bg}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${TONE[tone].text}`}>{value}</div>
    </div>
  );
}

function RankedListPanel({
  icon,
  items,
  limitedMessage,
  title,
  tone,
}: {
  icon: ReactNode;
  items: DailyCommandRankedItem[];
  limitedMessage: string;
  title: string;
  tone: DailyCommandTone;
}) {
  return (
    <div className={`rounded-[1.75rem] border ${TONE[tone].border} ${TONE[tone].bg} p-4 ${TONE[tone].glow}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-slate-950/55 ${TONE[tone].text}`}>{icon}</div>
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${TONE[tone].text}`}>Ranked intelligence</div>
            <h2 className="text-xl font-black text-slate-50">{title}</h2>
          </div>
        </div>
        <Search className="h-4 w-4 text-slate-500" />
      </div>
      <div className="mt-4 grid gap-2">
        {items.length ? items.map((item) => <RankedCommandRow item={item} key={`${title}:${item.symbol}`} />) : <LimitedState message={limitedMessage} />}
      </div>
      {items.length > 0 && items.length < 5 ? <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs text-slate-400">Limited ranked evidence available.</div> : null}
    </div>
  );
}

function RankedCommandRow({ item }: { item: DailyCommandRankedItem }) {
  return (
    <Link className="group block overflow-hidden rounded-2xl border border-white/10 bg-slate-950/48 p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055]" href={item.href}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${TONE[item.tone].border} ${TONE[item.tone].bg} font-mono text-sm font-black ${TONE[item.tone].text}`}>{item.rank}</div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-lg font-black text-white">{item.symbol}</span>
              <span className="truncate text-xs font-semibold text-slate-400">{item.companyName ?? item.sector ?? "Research candidate"}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.whyItRanks}</p>
          </div>
        </div>
        <div className="flex max-w-full shrink-0 items-center gap-2 self-start rounded-full border border-white/10 bg-black/20 px-2 py-1 sm:block sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
          <div className={`font-mono text-base font-black ${TONE[item.tone].text}`}>{item.score}</div>
          <div className="max-w-[9rem] truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">{item.scoreLabel}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MiniStat label="Price" value={item.priceLabel} />
        <MiniStat label="1D" value={item.dailyMoveLabel} />
        <MiniStat label="Macro" value={item.macroLabel} />
      </div>
      <ScoreFactorStrip
        className="mt-3"
        factors={[
          { label: "Score", tone: item.tone, value: item.score },
          { label: "Conviction", tone: "cyan", value: numberFromLabel(item.convictionLabel) },
          { label: "Replay", tone: "violet", value: numberFromLabel(item.replayLabel) },
          { label: "Risk", tone: "rose", value: item.tone === "rose" ? item.score : 100 - item.score },
        ]}
        label="Research context"
      />
    </Link>
  );
}

function MoneyFlowSectorCard({ sector }: { sector: DailyMoneyFlowSector }) {
  return (
    <div className={`rounded-2xl border p-3 ${TONE[sector.tone].border} ${TONE[sector.tone].bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-50">{sector.sector}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">{sector.direction}</div>
        </div>
        <div className={`font-mono text-lg font-black ${TONE[sector.tone].text}`}>{sector.score}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="1D" value={formatMove(sector.averageReturn1d)} />
        <MiniStat label="Opp" value={formatScore(sector.opportunityAverage)} />
        <MiniStat label="Risk" value={formatScore(sector.riskAverage)} />
      </div>
      <div className="mt-2 truncate text-[11px] text-slate-400">{sector.leaders.join(", ") || "Limited leaders"}</div>
    </div>
  );
}

function MoneyFlowThemeCard({ theme }: { theme: DailyMoneyFlowTheme }) {
  return (
    <div className={`rounded-2xl border p-3 ${TONE[theme.tone].border} ${TONE[theme.tone].bg}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-bold text-slate-100">{theme.label}</div>
        <div className={`font-mono text-sm font-black ${TONE[theme.tone].text}`}>{theme.valueLabel}</div>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">{theme.detail}</p>
    </div>
  );
}

function ChangeRow({ item }: { item: DailyMarketChange }) {
  return (
    <Link className={`rounded-2xl border p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055] ${TONE[item.tone].border} ${TONE[item.tone].bg}`} href={item.symbol ? `/symbol/${item.symbol}` : "/history"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.symbol ? <span className="font-mono text-sm font-black text-slate-50">{item.symbol}</span> : null}
            <span className="text-sm font-semibold text-slate-100">{item.label}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
        </div>
        <span className={`rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black ${TONE[item.tone].text}`}>{item.metricLabel}</span>
      </div>
    </Link>
  );
}

function CalendarEventRow({ item }: { item: DailyEventCalendarItem }) {
  return (
    <Link className={`rounded-2xl border p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055] ${TONE[item.tone].border} ${TONE[item.tone].bg}`} href={`/symbol/${item.symbol}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{formatDate(item.date)} · {item.category}</div>
          <div className="mt-1 text-sm font-bold text-slate-100">{item.label}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
        </div>
        <span className={`font-mono text-sm font-black ${TONE[item.tone].text}`}>{item.symbol}</span>
      </div>
    </Link>
  );
}

function CalendarBreakdownRail({ calendar }: { calendar: DailyEventCalendarItem[] }) {
  if (!calendar.length) return null;
  const counts = calendar.reduce<Record<DailyEventCalendarItem["category"], number>>((accumulator, item) => {
    accumulator[item.category] += 1;
    return accumulator;
  }, {
    analyst: 0,
    dividend: 0,
    earnings: 0,
    event: 0,
    geopolitical: 0,
    macro: 0,
    rates: 0,
  });
  const metrics: Array<{ label: string; tone: DailyCommandTone; value: number }> = [
    { label: "Earnings", tone: "cyan" as DailyCommandTone, value: counts.earnings },
    { label: "Rates", tone: "amber" as DailyCommandTone, value: counts.rates },
    { label: "Geo", tone: "rose" as DailyCommandTone, value: counts.geopolitical },
    { label: "Analyst", tone: "violet" as DailyCommandTone, value: counts.analyst },
    { label: "Dividends", tone: "emerald" as DailyCommandTone, value: counts.dividend },
  ].filter((item) => item.value > 0);
  if (!metrics.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div className={`rounded-2xl border p-2 ${TONE[metric.tone].border} ${TONE[metric.tone].bg}`} key={metric.label}>
          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
          <div className={`mt-1 font-mono text-lg font-black ${TONE[metric.tone].text}`}>{metric.value}</div>
        </div>
      ))}
    </div>
  );
}

function DevelopmentOverlay({ item, onClose }: { item: DailyMarketDevelopment | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <StableDetailOverlay analyticsSurface="daily_market_development" closeLabel="Close market development" eyebrow="Daily market development" onClose={onClose} open size="lg" title={item.category}>
      <div className="space-y-4">
        <div className={`rounded-3xl border p-5 ${TONE[item.tone].border} ${TONE[item.tone].bg} ${TONE[item.tone].glow}`}>
          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span>{item.source}</span>
            <span>{formatDate(item.timestamp)}</span>
            <span>{item.urgency} urgency</span>
            <span>{item.impact} impact</span>
            {item.watchlistImpact ? <span className="text-cyan-200">watchlist impact</span> : null}
          </div>
          <h3 className="mt-3 text-2xl font-black leading-tight text-white">{item.headline}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{item.whyItMatters}</p>
          <a className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/60" href={item.sourceUrl} rel="noreferrer" target="_blank">
            Open original source <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailMiniPanel label="Affected symbols" value={item.affectedSymbols.join(", ") || "Limited"} />
          <DetailMiniPanel label="Affected sectors" value={item.affectedSectors.join(", ") || "Limited"} />
          <DetailMiniPanel label="TradeVeto relevance" value={`${item.original.relevance}/100`} />
          <DetailMiniPanel label="Priority score" value={`${item.priorityScore}/100`} />
          <DetailMiniPanel label="Source quality" value={item.sourceQualityLabel} />
          <DetailMiniPanel label="Provider attribution" value={item.providerAttribution} />
          <DetailMiniPanel label="Provider state" value={item.providerStateLabel} />
          <DetailMiniPanel label="Freshness" value={item.freshnessLabel} />
          <DetailMiniPanel label="Freshness SLA" value={item.freshnessSlaLabel} />
          <DetailMiniPanel label="Source completeness" value={item.sourceCompletenessLabel} />
          <DetailMiniPanel label="Feed latency" value={item.latencyLabel} />
          <DetailMiniPanel label="Research type" value={item.researchTypeLabel} />
          <DetailMiniPanel label="Timeline bucket" value={item.timelineBucket} />
          <DetailMiniPanel label="Historical analog" value={item.historicalAnalogLabel} />
          <DetailMiniPanel label="Event tracking" value={item.eventTrackingLabel} />
          <DetailMiniPanel label="Sector impact" value={item.sectorImpactLabel} />
          <DetailMiniPanel label="Market moving read" value={item.marketMovingLabel} />
          <DetailMiniPanel label="Confidence" value={item.confidenceLabel} />
          <DetailMiniPanel label="Macro impact" value={item.macroImpactLabel} />
          <DetailMiniPanel label="Replay linkage" value={item.replayLinkageLabel} />
          <DetailMiniPanel label="Strategy linkage" value={item.strategyLinkageLabel} />
          <DetailMiniPanel label="Watchlist impact" value={item.watchlistImpactReason} />
          <DetailMiniPanel label="Symbol relevance" value={item.symbolRelevanceLabel} />
          <DetailMiniPanel label="Watchlist relevance" value={item.watchlistRelevanceLabel} />
          <DetailMiniPanel label="Uncertainty" value={item.uncertaintyLabel} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ImplicationPanel label="Bullish implication" tone="emerald" value={item.bullishImplication} />
          <ImplicationPanel label="Bearish implication" tone="rose" value={item.bearishImplication} />
          <ImplicationPanel label="Related macro context" tone="cyan" value={item.relatedMacroContext} />
          <ImplicationPanel label="Related replay / memory context" tone="violet" value={item.relatedReplayContext} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Related TradeVeto context</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This item is shown because it has a verified source URL and is connected to affected assets or sectors in the current scanner packet. Interpretations are research context only, not financial advice.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.original.reasonCodes.length ? item.original.reasonCodes.map((code) => (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-300" key={code}>{code.replace(/^EVENT_/, "").replace(/_/g, " ")}</span>
            )) : <span className="text-sm text-slate-500">No reason-code detail available.</span>}
          </div>
        </div>
      </div>
    </StableDetailOverlay>
  );
}

function DevelopmentMicroContext({ label, tone, value }: { label: string; tone: DailyCommandTone; value: string }) {
  return (
    <div className={`min-w-0 rounded-xl border px-2 py-1.5 ${TONE[tone].border} bg-black/15`}>
      <div className={`text-[9px] font-black uppercase tracking-[0.12em] ${TONE[tone].text}`}>{label}</div>
      <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{value}</div>
    </div>
  );
}

function ImplicationPanel({ label, tone, value }: { label: string; tone: DailyCommandTone; value: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${TONE[tone].border} ${TONE[tone].bg}`}>
      <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${TONE[tone].text}`}>{label}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function HeroBrief({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: DailyCommandTone; value: string }) {
  return (
    <div className={`rounded-2xl border p-3 ${TONE[tone].border} ${TONE[tone].bg}`}>
      <div className="flex items-center gap-2">
        <div className={`grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-slate-950/55 ${TONE[tone].text}`}>{icon}</div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-200">{value}</p>
    </div>
  );
}

function MobileCommandChip({ label, tone, value }: { label: string; tone: DailyCommandTone; value: string }) {
  return (
    <div className={`min-w-0 rounded-2xl border p-2 ${TONE[tone].border} ${TONE[tone].bg}`}>
      <div className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-black ${TONE[tone].text}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-2">
      <div className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-[11px] font-bold text-slate-100">{value}</div>
    </div>
  );
}

function DetailMiniPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function LimitedState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
      {message}
    </div>
  );
}

function filterDevelopments(items: DailyMarketDevelopment[], filter: DailyDevelopmentCategory): DailyMarketDevelopment[] {
  if (filter === "All") return items;
  if (filter === "High Impact") return items.filter((item) => item.urgency === "high");
  if (filter === "My Watchlist") return items.filter((item) => item.watchlistImpact);
  return items.filter((item) => item.category === filter);
}

function numberFromLabel(value: string): number | null {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMove(value: number | null): string {
  if (value === null) return "Limited";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatScore(value: number | null): string {
  if (value === null) return "Limited";
  return `${Math.round(value)}/100`;
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(parsed));
}

function sourceHost(value: string): string {
  try {
    return new URL(value).host.replace(/^www\./, "");
  } catch {
    return "source URL";
  }
}

function providerStateCounts(audits: DailyProviderStrategyAudit[]): Record<DailyProviderOperationalState, number> {
  return audits.reduce<Record<DailyProviderOperationalState, number>>((counts, audit) => {
    counts[audit.operationalState] += 1;
    return counts;
  }, {
    active: 0,
    "calendar-only": 0,
    delayed: 0,
    limited: 0,
    outage: 0,
    "partial-outage": 0,
    stale: 0,
  });
}
