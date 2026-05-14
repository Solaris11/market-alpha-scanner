"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import {
  buildInstitutionalDashboard,
  institutionalDashboardMetricLine,
  institutionalDashboardScoreLabel,
  type InstitutionalDashboardCluster,
  type InstitutionalDashboardMetric,
  type InstitutionalDashboardMode,
  type InstitutionalDashboardOpportunityMap,
  type InstitutionalHeatmap,
  type InstitutionalHeatmapCell,
} from "@/lib/trading/institutional-dashboard";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { formatNumber } from "@/lib/ui/formatters";
import { GlassPanel } from "../terminal/ui/GlassPanel";
import { SectionTitle } from "../terminal/ui/SectionTitle";
import { UnifiedIntelligenceConsole } from "../terminal/UnifiedIntelligenceConsole";

const DASHBOARD_MODES: Array<{ key: InstitutionalDashboardMode; label: string; meta: string }> = [
  { key: "institutional", label: "Institutional", meta: "quality and pressure" },
  { key: "conservative", label: "Conservative", meta: "lower fragility" },
  { key: "aggressive", label: "Aggressive", meta: "risk accepted" },
  { key: "macro", label: "Macro", meta: "regime focused" },
  { key: "volatility", label: "Volatility", meta: "shock zones" },
  { key: "watchlist", label: "Watchlist", meta: "saved symbols" },
];
const DEFERRED_PANEL_STYLE: CSSProperties = {
  containIntrinsicSize: "680px",
  contentVisibility: "auto",
};

export function InstitutionalDashboardWorkspace({
  initialProfile,
  marketCondition,
  rows,
  workflowEvolution,
}: {
  initialProfile?: UserPersonalizationProfile | null;
  marketCondition?: string | null;
  rows: OpportunityViewModel[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
}) {
  const [mode, setMode] = useState<InstitutionalDashboardMode>("institutional");
  const deferredMode = useDeferredValue(mode);
  const { watchlist } = useLocalWatchlist();
  const dashboard = useMemo(
    () => buildInstitutionalDashboard({
      mode: deferredMode,
      personalizationProfile: initialProfile ?? null,
      rows,
      watchlistSymbols: watchlist,
      workflowEvolution: workflowEvolution ?? null,
    }),
    [deferredMode, initialProfile, rows, watchlist, workflowEvolution],
  );
  const modeUpdating = deferredMode !== mode;

  return (
    <div className="space-y-5">
      <GlassPanel className="overflow-hidden border-cyan-300/15 bg-cyan-400/[0.02] p-5 sm:p-6" id="overview">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Institutional Dashboard</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Market Intelligence Console</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
              {dashboard.marketState.summary || `${marketCondition ?? dashboard.marketState.label} across the latest scanner universe.`}
            </p>
            {modeUpdating ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Updating dashboard view...</p> : null}
          </div>
          <div className="grid min-w-[280px] grid-cols-2 gap-2 sm:grid-cols-3">
            <HeaderMetric label="Universe" value={dashboard.universeCount.toLocaleString()} />
            <HeaderMetric label="Visible" value={dashboard.visibleCount.toLocaleString()} />
            <HeaderMetric label="State" value={dashboard.marketState.label} />
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {DASHBOARD_MODES.map((item) => (
            <button
              className={`min-h-14 rounded-xl border px-3 py-3 text-left transition ${mode === item.key ? "border-cyan-300/45 bg-cyan-400/10 text-cyan-50 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/25 hover:bg-white/[0.055]"}`}
              key={item.key}
              onClick={() => setMode(item.key)}
              type="button"
            >
              <div className="text-sm font-black">{item.label}</div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500">{item.meta}</div>
            </button>
          ))}
        </div>
      </GlassPanel>

      <div id="activity">
        <UnifiedIntelligenceConsole
          marketCondition={marketCondition ?? dashboard.marketState.label}
          personalizationProfile={initialProfile ?? null}
          rows={rows}
          surface="dashboard"
          workflowEvolution={workflowEvolution ?? null}
        />
      </div>

      <MarketMetrics metrics={dashboard.marketState.metrics} />

      <div className="grid gap-5" id="workspace">
        <ClusterBoard clusters={dashboard.clusters} />
      </div>

      <HeatmapBoard heatmaps={dashboard.heatmaps} />

      <OpportunityMapPanel opportunityMap={dashboard.opportunityMap} />

      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Trust Boundary" title="Probabilistic Market Structure" meta="research only" />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {dashboard.limitations.map((limitation) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-400" key={limitation}>
              {limitation}
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-black text-slate-50">{value}</div>
    </div>
  );
}

function MarketMetrics({ metrics }: { metrics: InstitutionalDashboardMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <GlassPanel className="p-4" key={metric.key}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="min-h-8 break-words text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={metric.label}>{metric.label}</div>
              <div className={`mt-2 text-sm font-bold ${toneTextClass(metric.tone)}`}>{institutionalDashboardScoreLabel(metric.score, metric.inverse)}</div>
            </div>
            <div className="font-mono text-2xl font-black text-slate-50">{metric.score}</div>
          </div>
          <MetricBar metric={metric} />
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{metric.detail}</p>
        </GlassPanel>
      ))}
    </div>
  );
}

function MetricBar({ metric }: { metric: InstitutionalDashboardMetric }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
      <div className={`h-full rounded-full ${toneBarClass(metric.tone)}`} style={{ width: `${Math.max(5, Math.min(100, metric.score))}%` }} />
    </div>
  );
}

function ClusterBoard({ clusters }: { clusters: InstitutionalDashboardCluster[] }) {
  return (
    <GlassPanel className="p-5" style={DEFERRED_PANEL_STYLE}>
      <SectionTitle eyebrow="Opportunity Clusters" title="Market Structure" meta={`${clusters.length} active`} />
      <div className="mt-4 space-y-3">
        {clusters.length ? clusters.map((cluster) => (
          <div className={`rounded-2xl border p-4 ${clusterClass(cluster.type)}`} key={cluster.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-50">{cluster.label}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{cluster.detail}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl font-black text-slate-50">{cluster.score}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">strength</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cluster.leaders.map((symbol) => <SymbolChip key={symbol} symbol={symbol} />)}
            </div>
          </div>
        )) : (
          <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">
            No dominant institutional cluster is confirmed in the visible universe.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

function HeatmapBoard({ heatmaps }: { heatmaps: InstitutionalHeatmap[] }) {
  const [primaryHeatmap, ...secondaryHeatmaps] = heatmaps;
  if (!primaryHeatmap) {
    return (
      <GlassPanel className="p-5" style={DEFERRED_PANEL_STYLE}>
        <SectionTitle eyebrow="Market Heatmaps" title="Pressure Maps" meta="no visible maps" />
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">
          No visible rows match this dashboard view yet.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5" style={DEFERRED_PANEL_STYLE}>
      <SectionTitle eyebrow="Market Heatmaps" title="Pressure Maps" meta={`${heatmaps.length} views`} />
      <div className="mt-4">
        <HeatmapSection heatmap={primaryHeatmap} featured />
      </div>
      {secondaryHeatmaps.length ? (
        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">More heatmaps</summary>
          <div className="mt-4 space-y-5">
            {secondaryHeatmaps.map((heatmap) => <HeatmapSection heatmap={heatmap} key={heatmap.kind} />)}
          </div>
        </details>
      ) : null}
    </GlassPanel>
  );
}

function HeatmapSection({ featured = false, heatmap }: { featured?: boolean; heatmap: InstitutionalHeatmap }) {
  return (
    <section>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-black text-slate-50">{heatmap.title}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{heatmap.description}</p>
        </div>
        {featured ? <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Primary map</div> : null}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {heatmap.cells.length ? heatmap.cells.map((cell) => <HeatmapCell cell={cell} key={cell.key} />) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400 md:col-span-2 xl:col-span-4">
            No visible rows match this map layer.
          </div>
        )}
      </div>
    </section>
  );
}

function HeatmapCell({ cell }: { cell: InstitutionalHeatmapCell }) {
  return (
    <div className={`min-h-40 rounded-xl border p-4 ${cellClass(cell.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-50">{cell.label}</div>
          <div className="mt-1 text-[11px] text-slate-500">{cell.count} symbols</div>
        </div>
        <div className="font-mono text-2xl font-black text-slate-50">{cell.score}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${toneBarClass(cell.tone)}`} style={{ width: `${Math.max(5, Math.min(100, cell.score))}%` }} />
      </div>
      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">{cell.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {cell.symbols.slice(0, 5).map((symbol) => <SymbolChip key={symbol} symbol={symbol} />)}
      </div>
    </div>
  );
}

function OpportunityMapPanel({ opportunityMap }: { opportunityMap: InstitutionalDashboardOpportunityMap }) {
  const groups = [
    { items: opportunityMap.strongest, key: "strongest", title: "Strongest Opportunities" },
    { items: opportunityMap.bestAsymmetry, key: "asymmetry", title: "Best Asymmetry" },
    { items: opportunityMap.institutionalQuality, key: "institutional", title: "Institutional Quality" },
    { items: opportunityMap.shockOpportunities, key: "shock", title: "Shock Opportunity Zones" },
    { items: opportunityMap.improving, key: "improving", title: "Improving Opportunities" },
    { items: opportunityMap.highestFragility, key: "fragility", title: "Highest Fragility" },
    { items: opportunityMap.deteriorating, key: "deteriorating", title: "Deteriorating Opportunities" },
  ];
  const priorityGroups = groups.slice(0, 4);
  const secondaryGroups = groups.slice(4);

  return (
    <GlassPanel className="p-5" style={DEFERRED_PANEL_STYLE}>
      <SectionTitle eyebrow="Live Opportunity Map" title="Where Attention Is Concentrated" meta="meta-ranked" />
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {priorityGroups.map((group) => <OpportunityMapGroup group={group} key={group.key} />)}
      </div>
      {secondaryGroups.length ? (
        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Secondary map layers</summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {secondaryGroups.map((group) => <OpportunityMapGroup group={group} key={group.key} />)}
          </div>
        </details>
      ) : null}
    </GlassPanel>
  );
}

function OpportunityMapGroup({ group }: { group: { items: InstitutionalDashboardOpportunityMap["strongest"]; key: string; title: string } }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">{group.title}</div>
      <div className="mt-3 space-y-2">
        {group.items.length ? group.items.slice(0, 4).map((item) => (
          <Link className="block rounded-lg border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={`/symbol/${item.symbol}`} key={`${group.key}-${item.symbol}-${item.category}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-base font-black text-slate-50">{item.symbol}</div>
                <div className="mt-1 truncate text-xs text-slate-400">{item.category}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-base font-black text-cyan-100">{formatNumber(item.metaOpportunityScore, 0)}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">score</div>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{institutionalDashboardMetricLine(item)}</p>
          </Link>
        )) : <p className="text-sm leading-6 text-slate-400">No symbol currently qualifies for this map layer.</p>}
      </div>
    </div>
  );
}

function SymbolChip({ symbol }: { symbol: string }) {
  return (
    <Link className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-black text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100" href={`/symbol/${symbol}`}>
      {symbol}
    </Link>
  );
}

function toneTextClass(tone: InstitutionalHeatmapCell["tone"]): string {
  if (tone === "constructive") return "text-emerald-200";
  if (tone === "risk") return "text-rose-200";
  if (tone === "mixed") return "text-amber-200";
  return "text-slate-300";
}

function toneBarClass(tone: InstitutionalHeatmapCell["tone"]): string {
  if (tone === "constructive") return "bg-emerald-300";
  if (tone === "risk") return "bg-rose-300";
  if (tone === "mixed") return "bg-amber-300";
  return "bg-slate-300";
}

function cellClass(tone: InstitutionalHeatmapCell["tone"]): string {
  if (tone === "constructive") return "border-emerald-300/20 bg-emerald-400/[0.055]";
  if (tone === "risk") return "border-rose-300/20 bg-rose-400/[0.055]";
  if (tone === "mixed") return "border-amber-300/18 bg-amber-400/[0.045]";
  return "border-white/10 bg-white/[0.035]";
}

function clusterClass(type: InstitutionalDashboardCluster["type"]): string {
  if (type === "risk") return "border-rose-300/20 bg-rose-400/[0.055]";
  if (type === "shock") return "border-fuchsia-300/20 bg-fuchsia-400/[0.055]";
  if (type === "rotation") return "border-amber-300/18 bg-amber-400/[0.045]";
  if (type === "macro") return "border-sky-300/18 bg-sky-400/[0.045]";
  return "border-emerald-300/18 bg-emerald-400/[0.045]";
}
