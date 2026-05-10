import Link from "next/link";
import type { ReactNode } from "react";
import type { BetaCohortDashboardModel, BetaCohortMetric, BetaSupportMacro } from "@/lib/beta-cohort";
import { humanizeLabel } from "@/lib/ui/labels";

type Tone = "bad" | "default" | "good" | "warn";

export function BetaCohortDashboard({ model }: { model: BetaCohortDashboardModel }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {model.topMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <section className={`rounded-2xl border p-5 shadow-2xl shadow-black/25 backdrop-blur-xl ${readinessClass(model.readiness.status)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Cohort Gate</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50">{model.readiness.label}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Controlled 25-user beta is capped until onboarding, support pressure, LLM spend, route performance, and product confusion stay inside guardrails.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/55 px-4 py-2 text-sm font-semibold text-slate-100">
            {model.cap.label} · {model.cap.remainingSeats} seats left
          </div>
        </div>
        <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-300 md:grid-cols-2">
          {model.readiness.reasons.map((reason) => <li className="rounded-xl border border-white/10 bg-slate-950/35 p-3" key={reason}>{reason}</li>)}
        </ul>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Panel subtitle="Activation and retention metrics for the selected analytics window." title="Beta Funnel">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {model.funnel.map((metric) => <MetricCard compact key={metric.label} metric={metric} />)}
          </div>
        </Panel>

        <Panel subtitle="These are the operational reviews required before sending more invites." title="Daily Operating Rhythm">
          <Checklist items={model.operations.dailyOpsReview} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ActionLink href="/admin/monitoring" label="LLM & Route Monitoring" />
            <ActionLink href="/admin/support" label="Support Queue" />
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel subtitle="Recent feedback is intentionally short and privacy-sanitized." title="Feedback, Bugs, and Confusion Points">
          {model.recentFeedback.length ? (
            <div className="space-y-2">
              {model.recentFeedback.map((item) => (
                <article className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={`${item.createdAt}-${item.feedbackType}-${item.pagePath}-${item.message}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">{humanizeLabel(item.feedbackType)}</span>
                    <span className="text-xs text-slate-500">{item.pagePath ?? "unknown page"}</span>
                    {item.symbol ? <span className="font-mono text-xs text-slate-400">{item.symbol}</span> : null}
                    <span className="text-xs text-slate-500">{item.createdAt ? formatDate(item.createdAt) : "unknown time"}</span>
                  </div>
                  {item.message ? <p className="mt-2 text-sm leading-6 text-slate-300">{item.message}</p> : <p className="mt-2 text-sm leading-6 text-slate-500">No note supplied.</p>}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState>No feedback has been submitted in this range.</EmptyState>
          )}
        </Panel>

        <Panel subtitle="Use these canned responses to keep support clear, calm, and non-advisory." title="Support Macros">
          <div className="space-y-2">
            {model.supportMacros.map((macro) => <SupportMacroCard key={macro.id} macro={macro} />)}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Retention Metrics Plan">
          <Checklist items={model.retentionPlan} />
        </Panel>
        <Panel title="Escalation Process">
          <Checklist items={model.escalationProcess} />
        </Panel>
        <Panel title="Rollback Conditions">
          <Checklist items={model.rollbackConditions} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Support Review">
          <Checklist items={model.operations.supportReview} />
        </Panel>
        <Panel title="LLM Cost Tracking">
          <Checklist items={model.operations.llmCostTracking} />
        </Panel>
        <Panel title="Route Performance Tracking">
          <Checklist items={model.operations.routePerformanceTracking} />
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({ compact = false, metric }: { compact?: boolean; metric: BetaCohortMetric }) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClass(metric.tone)}`}>
      <div className="text-[10px] font-black uppercase leading-4 tracking-[0.18em] text-slate-400">{metric.label}</div>
      <div className={`${compact ? "text-xl" : "text-2xl"} mt-2 font-mono font-black text-slate-50`}>{metric.value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{metric.meta}</div>
    </div>
  );
}

function Panel({ children, subtitle, title }: { children: ReactNode; subtitle?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-slate-300">
      {items.map((item) => (
        <li className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SupportMacroCard({ macro }: { macro: BetaSupportMacro }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
      <summary className="cursor-pointer font-semibold text-slate-100">
        {macro.title} <span className="ml-2 text-xs font-normal text-slate-500">{humanizeLabel(macro.category)}</span>
      </summary>
      <div className="mt-2 text-xs leading-5 text-slate-500">Trigger: {macro.trigger}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{macro.response}</p>
    </details>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15" href={href}>
      {label}
    </Link>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm text-slate-500">{children}</div>;
}

function readinessClass(status: BetaCohortDashboardModel["readiness"]["status"]): string {
  if (status === "blocked") return "border-rose-300/25 bg-rose-400/[0.08]";
  if (status === "needs_attention") return "border-amber-300/25 bg-amber-400/[0.08]";
  return "border-emerald-300/25 bg-emerald-400/[0.08]";
}

function toneClass(tone: Tone): string {
  if (tone === "bad") return "border-rose-300/25 bg-rose-400/[0.08]";
  if (tone === "good") return "border-emerald-300/25 bg-emerald-400/[0.08]";
  if (tone === "warn") return "border-amber-300/25 bg-amber-400/[0.08]";
  return "border-white/10 bg-white/[0.03]";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
