"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  Clock3,
  DatabaseZap,
  GitBranch,
  Layers3,
  Map,
  Network,
  Orbit,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { motion } from "motion/react";
import {
  HeatDots,
  MiniCandleStrip,
  MiniSparkline,
  PosterGauge,
  ScoreFactorStrip,
  SignalFlowVisual,
  VisualMetricRail,
  type ScoreFactor,
  type VisualTone,
} from "@/components/visual/MiniVisuals";
import type {
  CrossWorkspaceCognition,
  InstitutionalSuperplatformSystem,
  InstitutionalWorkspaceId,
  InstitutionalWorkspaceModel,
  IntelligenceMapLink,
  IntelligenceMapNode,
  IntelligenceTimelineTrack,
  PersistentMarketContext,
  ResearchWorkflowPrompt,
} from "@/lib/trading/institutional-superplatform";
import { humanizeInsightText } from "@/lib/ui/labels";

const STORAGE_KEY = "tradeveto_institutional_superplatform_workspace";

const toneClass: Record<VisualTone, { border: string; glow: string; icon: string; soft: string; text: string }> = {
  amber: {
    border: "border-amber-300/25",
    glow: "shadow-[0_0_34px_rgba(251,191,36,0.13)]",
    icon: "bg-amber-300/12 text-amber-100 ring-amber-200/20",
    soft: "bg-amber-300/10",
    text: "text-amber-100",
  },
  cyan: {
    border: "border-cyan-300/25",
    glow: "shadow-[0_0_36px_rgba(34,211,238,0.15)]",
    icon: "bg-cyan-300/12 text-cyan-100 ring-cyan-200/20",
    soft: "bg-cyan-300/10",
    text: "text-cyan-100",
  },
  emerald: {
    border: "border-emerald-300/25",
    glow: "shadow-[0_0_34px_rgba(52,211,153,0.13)]",
    icon: "bg-emerald-300/12 text-emerald-100 ring-emerald-200/20",
    soft: "bg-emerald-300/10",
    text: "text-emerald-100",
  },
  rose: {
    border: "border-rose-300/25",
    glow: "shadow-[0_0_38px_rgba(251,113,133,0.16)]",
    icon: "bg-rose-300/12 text-rose-100 ring-rose-200/20",
    soft: "bg-rose-300/10",
    text: "text-rose-100",
  },
  violet: {
    border: "border-violet-300/25",
    glow: "shadow-[0_0_36px_rgba(167,139,250,0.15)]",
    icon: "bg-violet-300/12 text-violet-100 ring-violet-200/20",
    soft: "bg-violet-300/10",
    text: "text-violet-100",
  },
};

const workspaceIcon: Record<InstitutionalWorkspaceId, typeof Activity> = {
  ai_momentum: BrainCircuit,
  custom_intelligence: Sparkles,
  earnings: Clock3,
  long_term_investment: BriefcaseBusiness,
  macro: Orbit,
  risk_monitoring: ShieldAlert,
  swing_trading: BarChart3,
  watchlist_operations: RadioTower,
};

export function InstitutionalSuperplatformPanel({
  compact = false,
  system,
}: {
  compact?: boolean;
  system: InstitutionalSuperplatformSystem;
}) {
  const [selectedId, setSelectedId] = useState<InstitutionalWorkspaceId>(system.activeWorkspaceId);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && system.workspaces.some((workspace) => workspace.id === stored)) {
        setSelectedId(stored as InstitutionalWorkspaceId);
        return;
      }
    } catch {
      // Local workspace persistence is optional; server-rendered context remains authoritative.
    }
    setSelectedId(system.activeWorkspaceId);
  }, [system.activeWorkspaceId, system.workspaces]);

  const selectedWorkspace = useMemo(
    () => system.workspaces.find((workspace) => workspace.id === selectedId) ?? system.workspaces[0],
    [selectedId, system.workspaces],
  );

  const onSelectWorkspace = (workspaceId: InstitutionalWorkspaceId) => {
    setSelectedId(workspaceId);
    try {
      window.localStorage.setItem(STORAGE_KEY, workspaceId);
    } catch {
      // Keep the interaction functional even when storage is unavailable.
    }
  };

  const style = toneClass[system.tone];
  const factors: ScoreFactor[] = [
    { detail: system.context.summary, label: "Operating", tone: system.tone, value: system.operatingScore },
    { detail: "Persistent market regime context shared across workspaces.", label: "Regime", tone: system.context.tone, value: system.context.regimeScore },
    { detail: "Cross-workspace relationships detected from watchlist, macro, risk, and sector context.", label: "Cognition", tone: system.crossWorkspaceCognition[0]?.tone ?? "cyan", value: system.crossWorkspaceCognition[0]?.score ?? null },
    { detail: "Market memory and workflow history available to the operating layer.", label: "Memory", tone: system.memoryPersistence[3]?.tone ?? "violet", value: system.context.replayEnvironmentScore },
  ];

  return (
    <section className={`tv-superplatform-panel relative overflow-hidden rounded-[2.35rem] border ${style.border} bg-[radial-gradient(circle_at_11%_4%,rgba(59,130,246,0.2),transparent_30rem),radial-gradient(circle_at_84%_8%,rgba(20,184,166,0.13),transparent_28rem),radial-gradient(circle_at_64%_82%,rgba(168,85,247,0.16),transparent_27rem),linear-gradient(135deg,rgba(2,6,23,0.99),rgba(15,23,42,0.86))] p-4 ${style.glow} sm:p-5`}>
      <div className="pointer-events-none absolute inset-0 tv-superplatform-atmosphere" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.52fr)_minmax(350px,0.72fr)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.3 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-3">
            <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-[1.1rem] ring-1 ${style.icon}`}>
              <span className="absolute inset-0 rounded-[1.1rem] tv-superplatform-pulse" />
              <Layers3 className="relative h-6 w-6" />
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200">Institutional superplatform</div>
              <h2 className="mt-1 max-w-4xl break-words text-2xl font-black leading-[0.98] tracking-tight text-white sm:text-4xl xl:text-[2.65rem] 2xl:text-5xl">{system.headline}</h2>
            </div>
          </div>
          <p className="mt-4 max-w-5xl text-sm leading-6 text-slate-300">{humanizeInsightText(system.summary)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border ${style.border} ${style.soft} px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] ${style.text}`}>
              {system.operatingState}
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
              {formatTimestamp(system.generatedAt)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/48 p-4">
              <PosterGauge label="operating score" score={system.operatingScore} tone={system.tone} />
            </div>
            <div className="grid gap-3">
              <ScoreFactorStrip factors={factors} label="Persistent operating context" />
              <VisualMetricRail metrics={factors.map((factor) => ({ label: factor.label, tone: factor.tone, value: factor.value ?? null }))} />
            </div>
          </div>

          <div className="mt-4">
            <SignalFlowVisual
              items={[
                { icon: <Layers3 className="h-5 w-5" />, label: "Workspaces", tone: system.tone },
                { icon: <Map className="h-5 w-5" />, label: "Market map", tone: "cyan" },
                { icon: <Waypoints className="h-5 w-5" />, label: "Timeline memory", tone: "violet" },
              ]}
            />
          </div>
        </motion.div>

        <PersistentContextCard context={system.context} />
        <WorkspaceSwitcher
          compact={compact}
          onSelect={onSelectWorkspace}
          selectedId={selectedWorkspace?.id ?? system.activeWorkspaceId}
          workspaces={system.workspaces}
        />
      </div>

      {selectedWorkspace ? (
        <div className="relative mt-4">
          <WorkspaceCockpit workspace={selectedWorkspace} />
        </div>
      ) : null}

      <div className="relative mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <IntelligenceMap nodes={system.intelligenceMapNodes} links={system.intelligenceMapLinks} />
        <TimelineBoard tracks={system.timeline} />
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(310px,0.7fr)]">
        <CognitionBoard items={system.crossWorkspaceCognition} />
        <ResearchBoard prompts={system.advancedResearch} />
        <MemoryBoard prompts={system.memoryPersistence} />
      </div>

      <details className="relative mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Superplatform grounding boundary</summary>
        <p className="mt-2 text-xs leading-5 text-slate-400">{system.guardrail}</p>
      </details>
    </section>
  );
}

function PersistentContextCard({ context }: { context: PersistentMarketContext }) {
  const style = toneClass[context.tone];
  const metrics = [
    { label: "Regime", tone: context.tone, value: context.regimeScore },
    { label: "Volatility", tone: (context.volatilityScore ?? 50) >= 65 ? "rose" as const : "cyan" as const, value: context.volatilityScore },
    { label: "Macro", tone: (context.macroPressureScore ?? 50) >= 58 ? "emerald" as const : "amber" as const, value: context.macroPressureScore },
    { label: "Replay", tone: "violet" as const, value: context.replayEnvironmentScore },
  ];
  return (
    <motion.div
      className={`rounded-[1.7rem] border ${style.border} bg-slate-950/42 p-4`}
      initial={{ opacity: 0, y: 18 }}
      transition={{ delay: 0.04, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, amount: 0.32 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Header icon={<Activity className="h-4 w-4" />} label="Persistent market context" tone={context.tone} />
      <h3 className="mt-3 text-xl font-black text-white">{context.label}</h3>
      <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{humanizeInsightText(context.summary)}</p>
      <div className="mt-4">
        <MiniSparkline label="Persistent context" tone={context.tone} values={context.values} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map((metric) => (
          <div className={`rounded-2xl border ${toneClass[metric.tone].border} bg-slate-950/45 p-3`} key={metric.label}>
            <div className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">{metric.label}</div>
            <div className={`mt-1 font-mono text-lg font-black ${toneClass[metric.tone].text}`}>{metric.value === null ? "Limited" : `${metric.value}/100`}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function WorkspaceSwitcher({
  compact,
  onSelect,
  selectedId,
  workspaces,
}: {
  compact: boolean;
  onSelect: (workspaceId: InstitutionalWorkspaceId) => void;
  selectedId: InstitutionalWorkspaceId;
  workspaces: InstitutionalWorkspaceModel[];
}) {
  const visibleWorkspaces = compact ? workspaces.slice(0, 5) : workspaces;
  return (
    <motion.div
      className="rounded-[1.7rem] border border-violet-300/18 bg-violet-400/[0.045] p-4"
      initial={{ opacity: 0, y: 18 }}
      transition={{ delay: 0.08, duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, amount: 0.32 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Header icon={<DatabaseZap className="h-4 w-4" />} label="Persistent workspaces" tone="violet" />
      <div className="mt-3 grid max-h-[30rem] gap-2 overflow-y-auto pr-1">
        {visibleWorkspaces.map((workspace) => {
          const Icon = workspaceIcon[workspace.id];
          const active = selectedId === workspace.id;
          const style = toneClass[workspace.tone];
          return (
            <button
              className={`group rounded-2xl border p-3 text-left transition ${active ? `${style.border} ${style.soft} ${style.glow}` : "border-white/10 bg-slate-950/42 hover:border-cyan-300/25 hover:bg-white/[0.04]"}`}
              key={workspace.id}
              onClick={() => onSelect(workspace.id)}
              type="button"
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${style.icon}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-white">{workspace.title}</span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-slate-400">{workspace.headline}</span>
                </span>
                <span className={`ml-auto font-mono text-sm font-black ${style.text}`}>{workspace.score === null ? "LTD" : workspace.score}</span>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function WorkspaceCockpit({ workspace }: { workspace: InstitutionalWorkspaceModel }) {
  const style = toneClass[workspace.tone];
  return (
    <motion.section
      className={`rounded-[1.9rem] border ${style.border} bg-slate-950/45 p-4 ${style.glow}`}
      initial={{ opacity: 0, scale: 0.985, y: 12 }}
      key={workspace.id}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
        <div>
          <div className={`text-[10px] font-black uppercase tracking-[0.28em] ${style.text}`}>{workspace.layout}</div>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{workspace.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{humanizeInsightText(workspace.summary)}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <PosterGauge label="workspace" score={workspace.score} tone={workspace.tone} />
            <div className="grid gap-2">
              <MiniSparkline label={`${workspace.title} context`} tone={workspace.tone} values={workspace.values} />
              <Link className={`inline-flex min-h-10 items-center justify-center rounded-2xl border ${style.border} ${style.soft} px-4 text-xs font-black uppercase tracking-[0.16em] ${style.text} transition hover:bg-white/[0.06]`} href={workspace.primaryHref}>
                Open linked surface
              </Link>
            </div>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <ChipGroup title="Symbols" tone={workspace.tone} values={workspace.symbols.length ? workspace.symbols : ["Limited"]} />
          <ChipGroup title="Modules" tone="cyan" values={workspace.intelligenceModules} />
          <ChipGroup title="Overlays" tone="violet" values={workspace.overlays} />
          <ChipGroup title="Compare" tone="amber" values={workspace.compareViews} />
          <ChipGroup title="Filters" tone={workspace.tone} values={workspace.filters} />
          <ChipGroup title="Preserved" tone="emerald" values={[...workspace.preferredTimeframes, workspace.riskSetting, ...workspace.preservedContext.slice(0, 2)]} />
        </div>
      </div>
    </motion.section>
  );
}

function IntelligenceMap({ links, nodes }: { links: IntelligenceMapLink[]; nodes: IntelligenceMapNode[] }) {
  return (
    <section className="rounded-[1.7rem] border border-cyan-300/16 bg-cyan-400/[0.035] p-4">
      <Header icon={<Map className="h-4 w-4" />} label="Living market intelligence map" tone="cyan" />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {nodes.map((node) => (
          <article className={`rounded-3xl border ${toneClass[node.tone].border} bg-slate-950/42 p-3`} key={node.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">{node.title}</h3>
                <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(node.detail)}</p>
              </div>
              <div className={`font-mono text-lg font-black ${toneClass[node.tone].text}`}>{node.score === null ? "LTD" : node.score}</div>
            </div>
            <MiniCandleStrip className="mt-3" tone={node.tone} values={node.values} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {node.symbols.slice(0, 5).map((symbol) => <SymbolPill key={symbol} symbol={symbol} tone={node.tone} />)}
            </div>
          </article>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {links.map((link) => (
          <div className={`rounded-2xl border ${toneClass[link.tone].border} bg-slate-950/38 p-3`} key={link.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-white">{link.title}</div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(link.detail)}</p>
              </div>
              <div className={`font-mono text-sm font-black ${toneClass[link.tone].text}`}>{link.strength === null ? "Linked" : link.strength}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelineBoard({ tracks }: { tracks: IntelligenceTimelineTrack[] }) {
  return (
    <section className="rounded-[1.7rem] border border-violet-300/16 bg-violet-400/[0.035] p-4">
      <Header icon={<Waypoints className="h-4 w-4" />} label="Persistent intelligence timeline" tone="violet" />
      <div className="mt-3 grid gap-3">
        {tracks.map((track) => (
          <article className={`rounded-3xl border ${toneClass[track.tone].border} bg-slate-950/42 p-3`} key={track.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">{track.title}</h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{humanizeInsightText(track.detail)}</p>
              </div>
              <HeatDots active={Math.max(1, Math.round((track.points.at(-1) ?? 30) / 12))} tone={track.tone} />
            </div>
            <MiniSparkline className="mt-3" label={track.title} tone={track.tone} values={track.points} />
          </article>
        ))}
      </div>
    </section>
  );
}

function CognitionBoard({ items }: { items: CrossWorkspaceCognition[] }) {
  return (
    <PanelFrame icon={<GitBranch className="h-4 w-4" />} title="Cross-workspace AI cognition" tone="amber">
      {items.map((item) => (
        <InfoCard detail={item.detail} key={item.id} meta={item.workspaces.join(" -> ")} score={item.score} title={item.title} tone={item.tone} />
      ))}
    </PanelFrame>
  );
}

function ResearchBoard({ prompts }: { prompts: ResearchWorkflowPrompt[] }) {
  return (
    <PanelFrame icon={<BrainCircuit className="h-4 w-4" />} title="Advanced research mode" tone="cyan">
      {prompts.map((prompt) => (
        <InfoCard detail={prompt.detail} key={prompt.id} meta={prompt.query} title={prompt.query} tone={prompt.tone} />
      ))}
    </PanelFrame>
  );
}

function MemoryBoard({ prompts }: { prompts: ResearchWorkflowPrompt[] }) {
  return (
    <PanelFrame icon={<Network className="h-4 w-4" />} title="Persistent intelligence memory" tone="violet">
      {prompts.map((prompt) => (
        <InfoCard detail={prompt.detail} key={prompt.id} meta={prompt.query} title={prompt.query} tone={prompt.tone} />
      ))}
    </PanelFrame>
  );
}

function PanelFrame({ children, icon, title, tone }: { children: ReactNode; icon: ReactNode; title: string; tone: VisualTone }) {
  return (
    <section className={`rounded-[1.7rem] border ${toneClass[tone].border} bg-slate-950/38 p-4`}>
      <Header icon={icon} label={title} tone={tone} />
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function InfoCard({ detail, meta, score, title, tone }: { detail: string; meta: string; score?: number | null; title: string; tone: VisualTone }) {
  return (
    <article className={`rounded-2xl border ${toneClass[tone].border} bg-slate-950/42 p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.13em] ${toneClass[tone].text}`}>{meta}</div>
          <h3 className="mt-1 text-sm font-black text-white">{title}</h3>
        </div>
        {score !== undefined ? <div className={`font-mono text-sm font-black ${toneClass[tone].text}`}>{score === null ? "LTD" : score}</div> : null}
      </div>
      <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-400">{humanizeInsightText(detail)}</p>
    </article>
  );
}

function ChipGroup({ title, tone, values }: { title: string; tone: VisualTone; values: string[] }) {
  return (
    <div className={`rounded-2xl border ${toneClass[tone].border} bg-slate-950/42 p-3`}>
      <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${toneClass[tone].text}`}>{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.slice(0, 7).map((value) => (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-300" key={`${title}-${value}`}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function Header({ icon, label, tone }: { icon: ReactNode; label: string; tone: VisualTone }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-8 w-8 place-items-center rounded-xl ring-1 ${toneClass[tone].icon}`}>{icon}</span>
      <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${toneClass[tone].text}`}>{label}</div>
    </div>
  );
}

function SymbolPill({ symbol, tone }: { symbol: string; tone: VisualTone }) {
  return (
    <Link className={`rounded-full border ${toneClass[tone].border} ${toneClass[tone].soft} px-2.5 py-1 text-[10px] font-black ${toneClass[tone].text}`} href={`/symbol/${symbol}`}>
      {symbol}
    </Link>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Data timestamp limited";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data timestamp limited";
  return `Updated ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
