"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import type { WorkflowChangeItem, WorkflowEvolutionSummary, WorkflowSurface, TriggerMonitor } from "@/lib/trading/workflow-evolution";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function WorkflowEvolutionPanel({
  compact = false,
  summary,
  surface,
}: {
  compact?: boolean;
  summary: WorkflowEvolutionSummary;
  surface: WorkflowSurface;
}) {
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current || !summary.snapshotRows.length) return;
    recorded.current = true;
    void csrfFetch("/api/user/workflow-visit", {
      body: JSON.stringify({ snapshots: summary.snapshotRows, surface }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then((response) => {
        if (response.ok) trackAnalyticsEvent("workflow_visit_recorded", { snapshotCount: summary.snapshotRows.length, surface }, { source: "workflow_evolution" });
      })
      .catch(() => undefined);
  }, [summary.snapshotRows, surface]);

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle eyebrow="Workflow Intelligence" title="What Changed" meta={summary.lastSeenAt ? `Since ${formatDate(summary.lastSeenAt)}` : "Baseline starting"} />
        <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
          Habit loop
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {summary.dailyBrief.slice(0, 3).map((note) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-300" key={note}>
            {note}
          </div>
        ))}
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "lg:grid-cols-2" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
        <div className="space-y-3">
          <ChangeList empty="No material change detected yet." items={summary.whatChanged} title="What changed since last visit" />
          {!compact ? <ChangeList empty="No improving setups above threshold." items={summary.improvingSetups} title="Improving setups" /> : null}
        </div>
        <div className="space-y-3">
          <TriggerList items={summary.triggerMonitors} />
          {!compact ? <MaturityList items={summary.opportunityMaturity} /> : null}
        </div>
      </div>

      {summary.watchlistEvolution.length ? (
        <div className="mt-4">
          <ChangeList empty="No watchlist movement yet." items={summary.watchlistEvolution} title="Watchlist evolution" />
        </div>
      ) : null}

      {summary.deterioratingSetups.length && !compact ? (
        <div className="mt-4">
          <ChangeList empty="No deterioration above threshold." items={summary.deterioratingSetups} title="Fragility or macro risk rising" />
        </div>
      ) : null}
    </GlassPanel>
  );
}

function ChangeList({ empty, items, title }: { empty: string; items: WorkflowChangeItem[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      {items.length ? (
        <div className="mt-2 grid gap-2">
          {items.slice(0, 5).map((item) => (
            <Link className={`rounded-xl border p-3 transition hover:bg-white/[0.06] ${toneClass(item.severity)}`} href={item.symbol === "WORKFLOW" ? "/terminal" : `/symbol/${item.symbol}`} key={`${item.symbol}:${item.changeType}:${item.title}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-sm font-black text-slate-50">{item.symbol}</div>
                <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">{item.metricLabel}</div>
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{item.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function TriggerList({ items }: { items: TriggerMonitor[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Trigger condition monitor</div>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.slice(0, 5).map((item) => (
            <Link className="block rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.06]" href={`/symbol/${item.symbol}`} key={`${item.symbol}:${item.condition}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-sm font-black text-slate-50">{item.symbol}</div>
                <div className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${priorityClass(item.priority)}`}>{item.priority}</div>
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{item.condition}</div>
              <div className="mt-1 text-[11px] text-cyan-100">{item.distanceLabel}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.reason}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-500">No trigger conditions are close enough to monitor yet.</p>
      )}
    </div>
  );
}

function MaturityList({ items }: { items: WorkflowEvolutionSummary["opportunityMaturity"] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Opportunity maturity</div>
      <div className="mt-2 space-y-2">
        {items.slice(0, 5).map((item) => (
          <Link className="block rounded-xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.06]" href={`/symbol/${item.symbol}`} key={`${item.symbol}:${item.maturityState}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-sm font-black text-slate-50">{item.symbol}</div>
              <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">{item.maturityState}</div>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function toneClass(severity: WorkflowChangeItem["severity"]): string {
  if (severity === "warning") return "border-amber-300/20 bg-amber-400/[0.055] hover:border-amber-200/45";
  if (severity === "positive") return "border-emerald-300/20 bg-emerald-400/[0.055] hover:border-emerald-200/45";
  return "border-white/10 bg-white/[0.035] hover:border-cyan-300/35";
}

function priorityClass(priority: TriggerMonitor["priority"]): string {
  if (priority === "high") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  if (priority === "medium") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "last visit";
  return date.toLocaleString("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" });
}
