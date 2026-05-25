"use client";

import Link from "next/link";
import {
  Activity,
  BellRing,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  Gauge,
  History,
  ListChecks,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { trackActivationMilestone, trackAnalyticsEvent, trackFirstUsefulAction, type ActivationMilestone } from "@/lib/client/analytics";
import type { AnalyticsEventName } from "@/lib/analytics-policy";
import type {
  DailyDriverAction,
  DailyDriverActivationMilestone,
  DailyDriverAdaptivePriority,
  DailyDriverChangeSignal,
  DailyDriverContinuationItem,
  DailyDriverContextItem,
  DailyDriverFunnelStage,
  DailyDriverHabitLoop,
  DailyDriverMorningWorkflowItem,
  DailyDriverNotificationQualityControl,
  DailyDriverRetentionModel,
  DailyDriverRetentionTarget,
  DailyDriverReturnLoop,
  DailyDriverStatus,
  DailyDriverTelemetrySignal,
  DailyDriverTone,
} from "@/lib/trading/daily-driver-retention";
import { PosterGauge, ScoreFactorStrip, type VisualTone } from "@/components/visual/MiniVisuals";

type Props = {
  model: DailyDriverRetentionModel;
};

const TONE: Record<DailyDriverTone, { bg: string; border: string; glow: string; text: string }> = {
  amber: { bg: "bg-amber-400/[0.075]", border: "border-amber-300/25", glow: "shadow-[0_0_28px_rgba(251,191,36,0.10)]", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-400/[0.075]", border: "border-cyan-300/25", glow: "shadow-[0_0_28px_rgba(34,211,238,0.10)]", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-400/[0.075]", border: "border-emerald-300/25", glow: "shadow-[0_0_28px_rgba(52,211,153,0.10)]", text: "text-emerald-100" },
  rose: { bg: "bg-rose-400/[0.075]", border: "border-rose-300/25", glow: "shadow-[0_0_28px_rgba(251,113,133,0.10)]", text: "text-rose-100" },
  slate: { bg: "bg-white/[0.045]", border: "border-white/10", glow: "shadow-black/10", text: "text-slate-100" },
  violet: { bg: "bg-violet-400/[0.075]", border: "border-violet-300/25", glow: "shadow-[0_0_28px_rgba(167,139,250,0.10)]", text: "text-violet-100" },
};

const ACTION_ICON: Record<DailyDriverAction["key"], ComponentType<{ className?: string }>> = {
  create_alert: BellRing,
  create_watchlist: ListChecks,
  morning_brief: Gauge,
  review_replay: History,
  review_watchlist: ListChecks,
  save_scanner: Search,
  strategy_review: BrainCircuit,
  workflow_restore: RotateCcw,
};

const MORNING_ICON: Record<DailyDriverMorningWorkflowItem["key"], ComponentType<{ className?: string }>> = {
  ai_digest: BrainCircuit,
  macro_updates: Sparkles,
  overnight_events: BellRing,
  overnight_summary: Gauge,
  risk_changes: ShieldAlert,
  scanner_changes: Search,
  watchlist_movement: ListChecks,
};

const DAILY_COMPLETION_KEY = "tv_daily_driver_morning_completion_days";

export function DailyDriverRetentionPanel({ model }: Props) {
  const habit = useDailyHabitCompletion();
  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_14%_0%,rgba(34,211,238,0.16),transparent_28rem),radial-gradient(circle_at_88%_18%,rgba(16,185,129,0.13),transparent_24rem),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.78))] p-4 shadow-2xl shadow-black/30 ring-1 ring-cyan-300/10 sm:p-5"
      id="daily-driver-retention"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-60" />
      <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Daily driver system</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">Retention loop</span>
          </div>
          <h2 className="mt-3 max-w-5xl text-3xl font-black tracking-tight text-white sm:text-5xl">
            Turn today's market read into a repeat workflow
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 sm:text-base">{model.summary}</p>
          <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-500">{model.proofBoundary}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-4">
          <PosterGauge label="Activation readiness" score={model.activationScore} tone={toneToVisual(model.activationScore >= 75 ? "emerald" : model.activationScore >= 55 ? "cyan" : "amber")} />
        </div>
      </div>

      <div className="relative z-10 mt-5">
        <MorningWorkflowDeck habit={habit} items={model.morningWorkflow} />
      </div>

      <div className="relative z-10 mt-4 grid gap-4 xl:grid-cols-4">
        <ActivationMilestoneDeck items={model.activationMilestones} />
        <ReturnLoopDeck loops={model.returnLoops} />
        <ContinuationWorkflowDeck items={model.continuationWorkflows} />
        <NotificationQualityDeck items={model.notificationQuality} />
      </div>

      <div className="relative z-10 mt-4 grid gap-4 xl:grid-cols-3">
        <AdaptivePriorityDeck items={model.adaptivePriorities} />
        <ChangeVisualizationDeck items={model.changeVisualization} />
        <RetentionTargetDeck targets={model.retentionTargets} telemetry={model.telemetry} />
      </div>

      <div className="relative z-10 mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {model.primaryActions.map((action) => <DailyActionTile action={action} key={action.key} />)}
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/42 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Funnel health</div>
              <div className="mt-1 text-lg font-black text-slate-50">Activation to repeat use</div>
            </div>
            <ShieldAlert className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="mt-4">
            <ScoreFactorStrip
              factors={model.funnel.map((stage) => ({
                detail: stage.targetLabel,
                label: stage.label,
                tone: toneToVisual(stage.tone),
                value: stage.value,
              }))}
              label="Daily-driver funnel"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 grid gap-4 xl:grid-cols-3">
        <HabitLoopDeck loops={model.habitLoops} />
        <ContextDeck items={model.continuity} title="Workflow continuity" />
        <ContextDeck items={model.personalization} title="Personalization memory" />
      </div>

      <div className="relative z-10 mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-200" />
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Remaining retention proof gaps</div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {model.blockers.slice(0, 4).map((blocker) => (
            <div className="rounded-2xl border border-amber-300/14 bg-amber-300/[0.045] p-3 text-xs leading-5 text-slate-300" key={blocker}>{blocker}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

type DailyHabitCompletionState = {
  completedToday: boolean;
  completeToday: () => void;
  lastCompletedDay: string | null;
  loaded: boolean;
  streakDays: number;
};

function MorningWorkflowDeck({ habit, items }: { habit: DailyHabitCompletionState; items: DailyDriverMorningWorkflowItem[] }) {
  return (
    <div className="rounded-[1.6rem] border border-cyan-300/16 bg-slate-950/42 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Morning recovery workflow</div>
          <div className="mt-1 text-lg font-black text-slate-50">Open with the same command checks every day</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
            {habit.loaded ? `${habit.streakDays}d streak` : "streak"}
          </span>
          <button
            className="tv-tap-motion inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-300/15 focus:outline-none focus:ring-2 focus:ring-emerald-300/35 disabled:cursor-default disabled:opacity-70"
            data-analytics-id="daily-morning-complete"
            disabled={habit.completedToday}
            onClick={habit.completeToday}
            type="button"
          >
            <CalendarCheck className="h-4 w-4" />
            {habit.completedToday ? "Completed today" : "Complete briefing"}
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
        {items.map((item) => <MorningWorkflowTile item={item} key={item.key} />)}
      </div>
    </div>
  );
}

function MorningWorkflowTile({ item }: { item: DailyDriverMorningWorkflowItem }) {
  const tone = TONE[item.tone];
  const Icon = MORNING_ICON[item.key];
  return (
    <Link
      className={`tv-tap-motion min-w-0 rounded-[1.25rem] border ${tone.border} ${tone.bg} p-3 transition hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/40`}
      data-analytics-id={`daily-morning-${item.key}`}
      href={item.href}
      onClick={() => recordMorningWorkflow(item)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.metricLabel}</div>
          <div className="mt-1 line-clamp-2 font-black leading-5 text-slate-50">{item.label}</div>
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${tone.border} bg-black/22 ${tone.text}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-slate-400">{item.detail}</p>
    </Link>
  );
}

function DailyActionTile({ action }: { action: DailyDriverAction }) {
  const tone = TONE[action.tone];
  const Icon = ACTION_ICON[action.key];
  return (
    <Link
      className={`tv-tap-motion min-w-0 rounded-[1.4rem] border ${tone.border} ${tone.bg} ${tone.glow} p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-white/[0.065] focus:outline-none focus:ring-2 focus:ring-cyan-300/40`}
      data-analytics-id={`daily-driver-${action.key}`}
      data-symbol={action.symbol ?? undefined}
      href={action.href}
      onClick={() => recordAction(action)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{action.continuityLabel}</div>
          <div className="mt-1 line-clamp-2 text-base font-black leading-5 text-slate-50">{action.label}</div>
        </div>
        <div className={`visual-icon-tile h-10 w-10 shrink-0 ${tone.text}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-slate-400">{action.detail}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border ${tone.border} bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tone.text}`}>{action.metricLabel}</span>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{action.status}</span>
      </div>
    </Link>
  );
}

function ActivationMilestoneDeck({ items }: { items: DailyDriverActivationMilestone[] }) {
  return (
    <CompactProofDeck
      eyebrow="Activation ladder"
      icon={<Target className="h-5 w-5 text-emerald-200" />}
      rows={items.map((item) => ({
        detail: item.detail,
        href: item.href,
        key: item.key,
        label: item.label,
        metric: item.targetLabel,
        status: item.status,
        tone: item.tone,
        tracking: () => recordActivationMilestone(item),
      }))}
      title="First-session useful actions"
    />
  );
}

function recordActivationMilestone(item: DailyDriverActivationMilestone): void {
  const milestone = milestoneForActivationItem(item.key);
  trackActivationMilestone(milestone, { activationStep: item.key, status: item.status }, { source: "daily_driver_activation" });
  if (item.eventName === "first_useful_action") {
    trackFirstUsefulAction(item.key, { activationStep: item.key }, { source: "daily_driver_activation" });
  }
}

function milestoneForActivationItem(key: DailyDriverActivationMilestone["key"]): ActivationMilestone {
  if (key === "first_alert") return "alert";
  if (key === "first_compare") return "compare";
  if (key === "first_replay") return "replay";
  if (key === "first_scanner") return "scanner";
  if (key === "first_symbol_investigation") return "symbol_investigation";
  return "watchlist";
}

function ReturnLoopDeck({ loops }: { loops: DailyDriverReturnLoop[] }) {
  return (
    <CompactProofDeck
      eyebrow="Return loops"
      icon={<RotateCcw className="h-5 w-5 text-cyan-200" />}
      rows={loops.map((loop) => ({
        detail: loop.detail,
        href: loop.href,
        key: loop.eventName,
        label: loop.label,
        metric: loop.targetLabel,
        status: loop.status,
        tone: loop.tone,
        tracking: () => trackAnalyticsEvent(loop.eventName, { returnLoop: loop.key }, { source: "daily_driver_return_loop" }),
      }))}
      title="Measured comeback paths"
    />
  );
}

function ContinuationWorkflowDeck({ items }: { items: DailyDriverContinuationItem[] }) {
  return (
    <CompactProofDeck
      eyebrow="Continuation"
      icon={<History className="h-5 w-5 text-violet-200" />}
      rows={items.map((item) => ({
        detail: item.detail,
        href: item.href,
        key: item.key,
        label: item.label,
        metric: item.value,
        status: item.status,
        tone: item.tone,
        tracking: () => trackAnalyticsEvent("workflow_continuity", { continuation: item.key, status: item.status }, { source: "daily_driver_continuation" }),
      }))}
      title="Continue where left off"
    />
  );
}

function NotificationQualityDeck({ items }: { items: DailyDriverNotificationQualityControl[] }) {
  return (
    <CompactProofDeck
      eyebrow="Notification quality"
      icon={<BellRing className="h-5 w-5 text-amber-200" />}
      rows={items.map((item) => ({
        detail: item.detail,
        href: "/alerts",
        key: item.key,
        label: item.label,
        metric: item.targetLabel,
        status: item.status,
        tone: item.tone,
        tracking: () => trackAnalyticsEvent(item.eventName, { qualityControl: item.key }, { source: "daily_driver_notification_quality" }),
      }))}
      title="Fatigue and usefulness"
    />
  );
}

type CompactProofRow = {
  detail: string;
  href: string;
  key: string;
  label: string;
  metric: string;
  status: DailyDriverStatus;
  tone: DailyDriverTone;
  tracking: () => void;
};

function CompactProofDeck({ eyebrow, icon, rows, title }: { eyebrow: string; icon: ReactNode; rows: CompactProofRow[]; title: string }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/42 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{eyebrow}</div>
          <div className="mt-1 text-lg font-black text-slate-50">{title}</div>
        </div>
        {icon}
      </div>
      <div className="mt-4 grid gap-2">
        {rows.slice(0, 6).map((row) => {
          const tone = TONE[row.tone];
          return (
            <Link
              className={`block rounded-2xl border ${tone.border} ${tone.bg} p-3 transition hover:border-cyan-300/45 hover:bg-white/[0.055]`}
              data-analytics-id={`daily-proof-${row.key}`}
              href={row.href}
              key={row.key}
              onClick={row.tracking}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-1 font-semibold text-slate-100">{row.label}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{row.detail}</div>
                </div>
                <span className={`shrink-0 rounded-full border ${tone.border} bg-black/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${tone.text}`}>{row.status}</span>
              </div>
              <div className="mt-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{row.metric}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function AdaptivePriorityDeck({ items }: { items: DailyDriverAdaptivePriority[] }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/42 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Personalized intelligence</div>
          <div className="mt-1 text-lg font-black text-slate-50">Adaptive return priority</div>
        </div>
        <BrainCircuit className="h-5 w-5 text-violet-200" />
      </div>
      <div className="mt-4 grid gap-2">
        {items.slice(0, 5).map((item) => <AdaptivePriorityRow item={item} key={item.key} />)}
      </div>
    </div>
  );
}

function AdaptivePriorityRow({ item }: { item: DailyDriverAdaptivePriority }) {
  const tone = TONE[item.tone];
  return (
    <Link
      className={`block rounded-2xl border ${tone.border} ${tone.bg} p-3 transition hover:border-cyan-300/45 hover:bg-white/[0.055]`}
      data-analytics-id={`daily-adaptive-${item.key}`}
      data-symbol={item.symbol ?? undefined}
      href={item.href}
      onClick={() => {
        trackAnalyticsEvent("personalized_intelligence_return", {
          adaptivePriority: item.key,
          rank: item.rank,
          routeGroup: item.workflow,
          score: item.score,
        }, { source: "daily_driver_adaptive", symbol: item.symbol ?? undefined });
        trackAnalyticsEvent("workflow_continuity", {
          adaptivePriority: item.key,
          from: "terminal",
          to: item.workflow,
        }, { source: "daily_driver_adaptive", symbol: item.symbol ?? undefined });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.priorityLabel}</div>
          <div className="mt-1 line-clamp-1 font-black text-slate-50">{item.label}</div>
        </div>
        <span className={`rounded-full border ${tone.border} bg-black/20 px-2.5 py-1 font-mono text-xs font-black ${tone.text}`}>{item.score}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
      <div className="mt-2 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{item.proofEvent}</div>
    </Link>
  );
}

function ChangeVisualizationDeck({ items }: { items: DailyDriverChangeSignal[] }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/42 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Since last session</div>
          <div className="mt-1 text-lg font-black text-slate-50">Daily change visualization</div>
        </div>
        <Activity className="h-5 w-5 text-cyan-200" />
      </div>
      <div className="mt-4 grid gap-2">
        {items.slice(0, 6).map((item) => <ChangeSignalRow item={item} key={item.key} />)}
      </div>
    </div>
  );
}

function ChangeSignalRow({ item }: { item: DailyDriverChangeSignal }) {
  const tone = TONE[item.tone];
  return (
    <Link
      className={`block rounded-2xl border ${tone.border} ${tone.bg} p-3 transition hover:border-cyan-300/45 hover:bg-white/[0.055]`}
      data-analytics-id={`daily-change-${item.type}`}
      data-symbol={item.symbol ?? undefined}
      href={item.href}
      onClick={() => {
        trackAnalyticsEvent("workflow_continuity", {
          changeType: item.type,
          from: "terminal",
          to: item.symbol ? "symbol" : "scanner",
        }, { source: "daily_driver_change", symbol: item.symbol ?? undefined });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.metricLabel}</div>
          <div className="mt-1 line-clamp-1 font-black text-slate-50">{item.label}</div>
        </div>
        <span className={`rounded-full border ${tone.border} bg-black/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${tone.text}`}>{item.type}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
    </Link>
  );
}

function RetentionTargetDeck({ targets, telemetry }: { targets: DailyDriverRetentionTarget[]; telemetry: DailyDriverTelemetrySignal[] }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/42 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Proof gates</div>
          <div className="mt-1 text-lg font-black text-slate-50">Retention targets and telemetry</div>
        </div>
        <Target className="h-5 w-5 text-emerald-200" />
      </div>
      <div className="mt-4 grid gap-2">
        {targets.map((target) => <RetentionTargetRow target={target} key={target.key} />)}
      </div>
      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Instrumented events</div>
        <div className="mt-2 grid gap-1.5">
          {telemetry.slice(0, 5).map((item) => <TelemetrySignalRow item={item} key={item.eventName} />)}
        </div>
      </div>
    </div>
  );
}

function RetentionTargetRow({ target }: { target: DailyDriverRetentionTarget }) {
  const tone = TONE[target.tone];
  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{target.evidenceLabel}</div>
          <div className="mt-1 line-clamp-1 font-black text-slate-50">{target.label}</div>
        </div>
        <span className={`rounded-full border ${tone.border} bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tone.text}`}>{target.targetLabel}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{target.detail}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{target.currentLabel}</span>
        <span className={`rounded-full border ${tone.border} bg-black/20 px-2 py-0.5 text-[10px] font-semibold ${tone.text}`}>{target.status}</span>
      </div>
    </div>
  );
}

function TelemetrySignalRow({ item }: { item: DailyDriverTelemetrySignal }) {
  const tone = TONE[item.tone];
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/18 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-slate-200">{item.label}</div>
        <div className="truncate font-mono text-[10px] text-slate-500">{item.eventName}</div>
      </div>
      <span className={`shrink-0 rounded-full border ${tone.border} bg-black/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${tone.text}`}>{item.status}</span>
    </div>
  );
}

function HabitLoopDeck({ loops }: { loops: DailyDriverHabitLoop[] }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/42 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Habit loops</div>
          <div className="mt-1 text-lg font-black text-slate-50">Repeatable daily actions</div>
        </div>
        <RotateCcw className="h-5 w-5 text-emerald-200" />
      </div>
      <div className="mt-4 grid gap-2">
        {loops.map((loop) => <HabitLoopRow loop={loop} key={loop.key} />)}
      </div>
    </div>
  );
}

function HabitLoopRow({ loop }: { loop: DailyDriverHabitLoop }) {
  const tone = TONE[loop.tone];
  return (
    <Link
      className={`rounded-2xl border ${tone.border} ${tone.bg} p-3 transition hover:border-cyan-300/45 hover:bg-white/[0.055]`}
      data-analytics-id={`daily-habit-${loop.key}`}
      href={loop.href}
      onClick={() => {
        trackAnalyticsEvent("workflow_continuity", { from: "terminal", habitLoop: loop.key, to: loop.key }, { source: "daily_driver" });
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-slate-100">{loop.title}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{loop.detail}</div>
        </div>
        <CheckCircle2 className={`h-4 w-4 shrink-0 ${tone.text}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{loop.proofEvent}</span>
        <span className={`rounded-full border ${tone.border} bg-black/20 px-2 py-0.5 text-[10px] font-semibold ${tone.text}`}>{loop.nextActionLabel}</span>
      </div>
    </Link>
  );
}

function ContextDeck({ items, title }: { items: DailyDriverContextItem[]; title: string }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/42 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{title}</div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => <ContextRow item={item} key={`${title}:${item.label}`} />)}
      </div>
    </div>
  );
}

function ContextRow({ item }: { item: DailyDriverContextItem }) {
  const tone = TONE[item.tone];
  const content = (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
          <div className={`mt-1 font-mono text-lg font-black ${tone.text}`}>{item.value}</div>
        </div>
        <Gauge className={`h-4 w-4 ${tone.text}`} />
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.detail}</p>
    </div>
  );
  return item.href ? (
    <Link className="block transition hover:-translate-y-0.5" data-analytics-id={`daily-context-${item.label}`} href={item.href}>
      {content}
    </Link>
  ) : content;
}

function recordMorningWorkflow(item: DailyDriverMorningWorkflowItem): void {
  trackActivationMilestone(activationMilestoneForWorkflow(item.workflow), {
    check: item.key,
    routeGroup: item.workflow,
  }, { source: "daily_driver_morning" });
  trackAnalyticsEvent("morning_workflow_start", {
    check: item.key,
    routeGroup: item.workflow,
  }, { source: "daily_driver_morning" });
  trackAnalyticsEvent("workflow_continuity", {
    from: "terminal",
    morningCheck: item.key,
    to: item.workflow,
  }, { source: "daily_driver_morning" });
  const returnEvent = returnEventForMorningItem(item);
  if (returnEvent) {
    trackAnalyticsEvent(returnEvent, {
      check: item.key,
      routeGroup: item.workflow,
    }, { source: "daily_driver_morning" });
  }
}

function returnEventForMorningItem(item: DailyDriverMorningWorkflowItem): AnalyticsEventName | null {
  if (item.key === "watchlist_movement") return "watchlist_return";
  if (item.key === "scanner_changes") return "scanner_return";
  if (item.key === "overnight_events") return "feed_engagement";
  if (item.key === "ai_digest" || item.key === "risk_changes" || item.key === "macro_updates") return "personalized_intelligence_return";
  return null;
}

function recordAction(action: DailyDriverAction): void {
  const habitLoopEvent = habitLoopEventForAction(action);
  trackActivationMilestone(activationMilestoneForWorkflow(action.workflow), {
    action: action.key,
    status: action.status,
  }, { source: "daily_driver", symbol: action.symbol ?? undefined });
  trackAnalyticsEvent("workflow_continuity", {
    action: action.key,
    from: "terminal",
    to: action.workflow,
  }, { source: "daily_driver", symbol: action.symbol ?? undefined });
  if (habitLoopEvent) {
    trackAnalyticsEvent(habitLoopEvent, {
      action: action.key,
      routeGroup: action.workflow,
      status: action.status,
    }, { source: "daily_driver_action", symbol: action.symbol ?? undefined });
  }
  if (action.firstUsefulAction) {
    trackFirstUsefulAction(action.key, {
      surface: "daily_driver_retention",
      workflow: action.workflow,
    }, { source: "daily_driver", symbol: action.symbol ?? undefined });
  }
}

function activationMilestoneForWorkflow(workflow: DailyDriverAction["workflow"]): ActivationMilestone {
  if (workflow === "alerts") return "alert";
  if (workflow === "replay") return "replay";
  if (workflow === "scanner") return "scanner";
  if (workflow === "strategy") return "strategy";
  if (workflow === "terminal" || workflow === "macro") return "morning_command";
  return "watchlist";
}

function habitLoopEventForAction(action: DailyDriverAction): AnalyticsEventName | null {
  if (action.key === "morning_brief") return "morning_workflow_start";
  if (action.key === "save_scanner") return "scanner_return";
  if (action.key === "review_replay") return "replay_return";
  if (action.key === "create_alert") return "alert_return";
  if (action.key === "create_watchlist" || action.key === "review_watchlist") return "watchlist_return";
  if (action.key === "strategy_review") return "strategy_return";
  if (action.key === "workflow_restore") return "personalized_intelligence_return";
  return null;
}

function useDailyHabitCompletion(): DailyHabitCompletionState {
  const today = useMemo(() => localDateKey(new Date()), []);
  const [completionDays, setCompletionDays] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCompletionDays(readCompletionDays(today));
    setLoaded(true);
  }, [today]);

  const streakDays = useMemo(() => consecutiveDayStreak(completionDays, today), [completionDays, today]);
  const completedToday = completionDays.includes(today);
  const lastCompletedDay = completionDays[completionDays.length - 1] ?? null;

  return {
    completedToday,
    completeToday: () => {
      setCompletionDays((current) => {
        if (current.includes(today)) return current;
        const next = [...current, today].slice(-90);
        writeCompletionDays(next);
        const nextStreak = consecutiveDayStreak(next, today);
        trackAnalyticsEvent("morning_workflow_complete", {
          completedDay: today,
          streakDays: nextStreak,
        }, { source: "daily_driver_morning" });
        trackAnalyticsEvent("workflow_continuity", {
          action: "morning_workflow_complete",
          from: "terminal",
          streakDays: nextStreak,
          to: "terminal",
        }, { source: "daily_driver_morning" });
        return next;
      });
    },
    lastCompletedDay,
    loaded,
    streakDays,
  };
}

function readCompletionDays(today: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DAILY_COMPLETION_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const days = parsed
      .map((value) => String(value ?? "").trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today);
    return [...new Set(days)].sort().slice(-90);
  } catch {
    return [];
  }
}

function writeCompletionDays(days: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DAILY_COMPLETION_KEY, JSON.stringify(days));
  } catch {
    // Local habit completion is a retention aid; telemetry and navigation must not depend on storage.
  }
}

function consecutiveDayStreak(days: string[], today: string): number {
  const daySet = new Set(days);
  let cursor = today;
  let streak = 0;
  while (daySet.has(cursor)) {
    streak += 1;
    const previous = previousLocalDate(cursor);
    if (!previous) break;
    cursor = previous;
  }
  return streak;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousLocalDate(value: string): string | null {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function toneToVisual(tone: DailyDriverTone): VisualTone {
  if (tone === "slate") return "cyan";
  return tone;
}
