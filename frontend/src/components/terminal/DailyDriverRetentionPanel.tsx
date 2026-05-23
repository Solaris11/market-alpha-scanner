"use client";

import Link from "next/link";
import {
  BellRing,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  History,
  ListChecks,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";
import { trackAnalyticsEvent, trackFirstUsefulAction } from "@/lib/client/analytics";
import type { AnalyticsEventName } from "@/lib/analytics-policy";
import type {
  DailyDriverAction,
  DailyDriverContextItem,
  DailyDriverFunnelStage,
  DailyDriverHabitLoop,
  DailyDriverRetentionModel,
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

export function DailyDriverRetentionPanel({ model }: Props) {
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

function recordAction(action: DailyDriverAction): void {
  const habitLoopEvent = habitLoopEventForAction(action);
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

function habitLoopEventForAction(action: DailyDriverAction): AnalyticsEventName | null {
  if (action.key === "morning_brief") return "morning_workflow_start";
  if (action.key === "save_scanner") return "scanner_return";
  if (action.key === "review_replay") return "replay_return";
  if (action.key === "create_alert") return "alert_return";
  if (action.key === "create_watchlist" || action.key === "review_watchlist") return "watchlist_return";
  if (action.key === "strategy_review" || action.key === "workflow_restore") return "personalized_intelligence_return";
  return null;
}

function toneToVisual(tone: DailyDriverTone): VisualTone {
  if (tone === "slate") return "cyan";
  return tone;
}
