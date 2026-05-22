"use client";

import Link from "next/link";
import { ArrowRight, BrainCircuit, Gauge, History, Layers3, RotateCcw, Search, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadDiscoveryWorkflowState, type DiscoveryWorkflowState } from "@/components/discovery/discovery-workflow-storage";
import { readChartWorkflowWorkspace, type ChartWorkflowWorkspace } from "@/components/terminal/chart-workflow-storage";
import {
  readEcosystemContinuityStorage,
  type EcosystemContinuityStorageState,
} from "@/lib/client/ecosystem-continuity-storage";
import { trackAnalyticsEvent, trackFirstUsefulAction } from "@/lib/client/analytics";
import type {
  EcosystemAdaptivePriority,
  EcosystemContinuationItem,
  EcosystemContinuitySystem,
  EcosystemContinuityTone,
  EcosystemCrossSystemThread,
  EcosystemRestoreReadiness,
  EcosystemSessionPersistence,
} from "@/lib/trading/ecosystem-continuity";

type Props = {
  system: EcosystemContinuitySystem;
};

type DeviceContinuityState = {
  chartWorkspaces: Array<{ symbol: string; workspace: ChartWorkflowWorkspace }>;
  discovery: DiscoveryWorkflowState | null;
  routeMemory: EcosystemContinuityStorageState | null;
};

const TONE: Record<EcosystemContinuityTone, { bg: string; border: string; glow: string; text: string }> = {
  amber: { bg: "bg-amber-400/[0.08]", border: "border-amber-300/25", glow: "shadow-[0_0_32px_rgba(251,191,36,0.10)]", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-400/[0.08]", border: "border-cyan-300/25", glow: "shadow-[0_0_32px_rgba(34,211,238,0.11)]", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-400/[0.08]", border: "border-emerald-300/25", glow: "shadow-[0_0_32px_rgba(52,211,153,0.10)]", text: "text-emerald-100" },
  rose: { bg: "bg-rose-400/[0.08]", border: "border-rose-300/25", glow: "shadow-[0_0_32px_rgba(251,113,133,0.10)]", text: "text-rose-100" },
  slate: { bg: "bg-white/[0.045]", border: "border-white/10", glow: "shadow-black/10", text: "text-slate-100" },
  violet: { bg: "bg-violet-400/[0.08]", border: "border-violet-300/25", glow: "shadow-[0_0_32px_rgba(167,139,250,0.10)]", text: "text-violet-100" },
};

export function EcosystemContinuityPanel({ system }: Props) {
  const [deviceState, setDeviceState] = useState<DeviceContinuityState | null>(null);

  useEffect(() => {
    try {
      const storage = window.localStorage;
      const routeMemory = readEcosystemContinuityStorage(storage);
      const discovery = loadDiscoveryWorkflowState(storage);
      const chartWorkspaces = system.recentSymbols
        .slice(0, 6)
        .map((symbol) => {
          const workspace = readChartWorkflowWorkspace(symbol);
          return workspace ? { symbol, workspace } : null;
        })
        .filter((item): item is { symbol: string; workspace: ChartWorkflowWorkspace } => Boolean(item));
      setDeviceState({ chartWorkspaces, discovery, routeMemory });
    } catch {
      setDeviceState({ chartWorkspaces: [], discovery: null, routeMemory: null });
    }
  }, [system.recentSymbols]);

  const deviceSummary = useMemo(() => buildDeviceSummary(deviceState), [deviceState]);

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-cyan-300/16 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.18),transparent_28rem),radial-gradient(circle_at_88%_12%,rgba(167,139,250,0.15),transparent_25rem),linear-gradient(135deg,rgba(2,6,23,0.97),rgba(15,23,42,0.82))] p-4 shadow-2xl shadow-black/30 ring-1 ring-cyan-300/10 sm:p-5"
      id="ecosystem-continuity"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(167,139,250,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-60" />
      <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Ecosystem continuity</span>
            <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">Workspace memory</span>
          </div>
          <h2 className="mt-3 max-w-5xl text-3xl font-black tracking-tight text-white sm:text-5xl">
            {system.headline}
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 sm:text-base">{system.summary}</p>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-500">{system.guardrail}</p>
        </div>

        <div className={`rounded-[1.6rem] border ${TONE[system.tone].border} ${TONE[system.tone].bg} ${TONE[system.tone].glow} p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Continuity score</div>
              <div className={`mt-2 font-mono text-5xl font-black ${TONE[system.tone].text}`}>{system.continuityScore}</div>
            </div>
            <div className="visual-icon-tile h-12 w-12 text-cyan-100">
              <Workflow className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/22 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Active workspace</div>
            <div className="mt-1 text-lg font-black text-slate-50">{system.activeWorkspaceLabel}</div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {system.continuationItems.slice(0, 6).map((item) => <ContinuationCard item={item} key={item.id} />)}
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Continue where you left off</div>
              <div className="mt-1 text-lg font-black text-slate-50">Device restore bridge</div>
            </div>
            <RotateCcw className="h-5 w-5 text-violet-200" />
          </div>
          <div className="mt-4 grid gap-2">
            {deviceSummary.map((item) => <DeviceSummaryRow item={item} key={item.label} />)}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.032] p-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-violet-200" />
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Adaptive priority engine</div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {system.adaptivePriorities.map((priority) => <PriorityCard key={priority.id} priority={priority} />)}
        </div>
      </div>

      <div className="relative z-10 mt-4 grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-200" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Restore readiness</div>
          </div>
          <div className="mt-4 grid gap-2">
            {system.restoreReadiness.map((item) => <ReadinessRow item={item} key={item.label} />)}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Intelligence threads</div>
              <div className="mt-1 text-lg font-black text-slate-50">Cross-system cognition map</div>
            </div>
            <Layers3 className="h-5 w-5 text-emerald-200" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {system.crossSystemThreads.slice(0, 6).map((thread) => <ThreadCard key={thread.id} thread={thread} />)}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-cyan-200" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Intelligence breadcrumbs</div>
          </div>
          <div className="mt-4 flex flex-wrap items-stretch gap-2">
            {system.breadcrumbs.map((crumb, index) => <BreadcrumbPill crumb={crumb} index={index} key={`${crumb.label}:${crumb.href}`} />)}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-amber-200" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Persistence boundaries</div>
          </div>
          <div className="mt-4 grid gap-2">
            {system.sessionPersistence.slice(0, 4).map((item) => <PersistenceRow item={item} key={item.context} />)}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 rounded-[1.5rem] border border-amber-300/14 bg-amber-300/[0.045] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Remaining continuity limits</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {system.limitations.map((limitation) => (
            <div className="rounded-2xl border border-amber-300/14 bg-black/18 p-3 text-xs leading-5 text-slate-300" key={limitation}>{limitation}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContinuationCard({ item }: { item: EcosystemContinuationItem }) {
  const tone = TONE[item.tone];
  return (
    <Link
      className={`tv-tap-motion min-w-0 rounded-[1.4rem] border ${tone.border} ${tone.bg} ${tone.glow} p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-white/[0.065] focus:outline-none focus:ring-2 focus:ring-cyan-300/40`}
      data-analytics-id={`ecosystem-continuation-${item.id}`}
      data-symbol={item.symbol ?? undefined}
      href={item.href}
      onClick={() => {
        trackFirstUsefulAction("ecosystem_continuity_resume", { routeGroup: item.routeGroup, source: item.sourceLabel }, { source: "ecosystem_continuity", symbol: item.symbol ?? undefined });
        trackAnalyticsEvent("workflow_continuity", { resume: item.id, routeGroup: item.routeGroup }, { source: "ecosystem_continuity", symbol: item.symbol ?? undefined });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.sourceLabel}</div>
          <div className="mt-1 line-clamp-2 text-base font-black leading-5 text-slate-50">{item.title}</div>
        </div>
        {item.score !== null ? <div className={`font-mono text-2xl font-black ${tone.text}`}>{Math.round(item.score)}</div> : <RotateCcw className={`h-5 w-5 ${tone.text}`} />}
      </div>
      <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-slate-400">{item.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border ${tone.border} bg-black/22 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tone.text}`}>{item.routeGroup}</span>
        {item.symbol ? <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 font-mono text-[10px] font-black text-cyan-100">{item.symbol}</span> : null}
      </div>
    </Link>
  );
}

function PriorityCard({ priority }: { priority: EcosystemAdaptivePriority }) {
  const tone = TONE[priority.tone];
  return (
    <Link
      className={`tv-tap-motion min-w-0 rounded-[1.4rem] border ${tone.border} ${tone.bg} ${tone.glow} p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-white/[0.065] focus:outline-none focus:ring-2 focus:ring-cyan-300/40`}
      data-analytics-id={`ecosystem-priority-${priority.id}`}
      href={priority.href}
      onClick={() => {
        trackFirstUsefulAction("ecosystem_continuity_priority", { priority: priority.id }, { source: "ecosystem_continuity" });
        trackAnalyticsEvent("workflow_continuity", { priority: priority.id, to: priority.href }, { source: "ecosystem_continuity" });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{priority.sourceLabel}</div>
          <div className="mt-1 line-clamp-2 text-base font-black leading-5 text-slate-50">{priority.title}</div>
        </div>
        {priority.score !== null ? <div className={`font-mono text-2xl font-black ${tone.text}`}>{Math.round(priority.score)}</div> : <Search className={`h-5 w-5 ${tone.text}`} />}
      </div>
      <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-slate-400">{priority.detail}</p>
    </Link>
  );
}

function ThreadCard({ thread }: { thread: EcosystemCrossSystemThread }) {
  const tone = TONE[thread.tone];
  return (
    <div className={`rounded-[1.4rem] border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{thread.evidenceLabel}</div>
          <div className="mt-1 line-clamp-2 font-black text-slate-50">{thread.title}</div>
        </div>
        <ArrowRight className={`h-4 w-4 shrink-0 ${tone.text}`} />
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{thread.detail}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {thread.symbols.map((symbol) => (
          <span className="rounded-full border border-white/10 bg-black/22 px-2 py-0.5 font-mono text-[10px] font-black text-cyan-100" key={symbol}>{symbol}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {thread.links.map((link) => (
          <Link
            className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
            data-analytics-id={`ecosystem-thread-${thread.id}-${link.system}`}
            href={link.href}
            key={`${thread.id}:${link.href}`}
            onClick={() => trackAnalyticsEvent("workflow_continuity", { thread: thread.id, to: link.system }, { source: "ecosystem_thread" })}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReadinessRow({ item }: { item: EcosystemRestoreReadiness }) {
  const tone = TONE[item.tone];
  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
          <div className={`mt-1 font-mono text-lg font-black ${tone.text}`}>{item.value}</div>
        </div>
        <span className={`rounded-full border ${tone.border} bg-black/22 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${tone.text}`}>{item.status}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
    </div>
  );
}

function DeviceSummaryRow({ item }: { item: { detail: string; label: string; tone: EcosystemContinuityTone; value: string } }) {
  const tone = TONE[item.tone];
  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
        <div className={`font-mono text-sm font-black ${tone.text}`}>{item.value}</div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
    </div>
  );
}

function BreadcrumbPill({ crumb, index }: { crumb: EcosystemContinuitySystem["breadcrumbs"][number]; index: number }) {
  const tone = TONE[crumb.tone];
  return (
    <Link
      className={`group flex min-w-[150px] flex-1 items-center gap-3 rounded-2xl border ${tone.border} ${tone.bg} p-3 transition hover:border-cyan-300/45 hover:bg-white/[0.06]`}
      data-analytics-id={`ecosystem-breadcrumb-${crumb.label}`}
      href={crumb.href}
      onClick={() => trackAnalyticsEvent("workflow_continuity", { breadcrumb: crumb.label, index }, { source: "ecosystem_breadcrumb" })}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tone.border} bg-black/25 font-mono text-xs font-black ${tone.text}`}>{index + 1}</span>
      <span className="min-w-0">
        <span className="block font-black text-slate-50">{crumb.label}</span>
        <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">{crumb.detail}</span>
      </span>
    </Link>
  );
}

function PersistenceRow({ item }: { item: EcosystemSessionPersistence }) {
  const tone = TONE[item.tone];
  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black text-slate-50">{item.context}</div>
          <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.sourceLabel}</div>
        </div>
        <span className={`rounded-full border ${tone.border} bg-black/22 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${tone.text}`}>{item.status}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
    </div>
  );
}

function buildDeviceSummary(state: DeviceContinuityState | null): Array<{ detail: string; label: string; tone: EcosystemContinuityTone; value: string }> {
  if (!state) {
    return [
      {
        detail: "Device-local continuity is checked after hydration so server and client rendering stay stable.",
        label: "Device bridge",
        tone: "slate",
        value: "checking",
      },
    ];
  }

  const routes = state.routeMemory?.recentRoutes ?? [];
  const discovery = state.discovery;
  const compareSymbols = discovery?.compareSymbols ?? [];
  const chartWorkspaces = state.chartWorkspaces;
  return [
    {
      detail: routes[0] ? `Last captured route was ${routes[0].path}.` : "No previous route has been captured on this device yet.",
      label: "Last route",
      tone: routes[0] ? "emerald" : "amber",
      value: routes[0]?.group ?? "none",
    },
    {
      detail: discovery?.updatedAt ? `Discovery restores ${discovery.filter}, ${discovery.sort} sort, ${discovery.timeframe}, and ${discovery.density} density.` : "No discovery workflow has been saved on this device yet.",
      label: "Scanner state",
      tone: discovery?.updatedAt ? "violet" : "amber",
      value: discovery?.updatedAt ? discovery.density : "none",
    },
    {
      detail: compareSymbols.length ? `Compare set restores ${compareSymbols.join(", ")}.` : "No active compare set is stored on this device.",
      label: "Compare set",
      tone: compareSymbols.length ? "cyan" : "amber",
      value: compareSymbols.length ? `${compareSymbols.length}` : "none",
    },
    {
      detail: chartWorkspaces.length ? `Chart workspaces found for ${chartWorkspaces.map((item) => item.symbol).join(", ")}.` : "No per-symbol chart workspace has been captured for current anchors yet.",
      label: "Chart layouts",
      tone: chartWorkspaces.length ? "emerald" : "amber",
      value: chartWorkspaces.length ? `${chartWorkspaces.length}` : "none",
    },
  ];
}
