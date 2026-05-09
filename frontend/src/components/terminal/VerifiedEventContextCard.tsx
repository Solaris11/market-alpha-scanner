import {
  buildVerifiedEventContext,
  eventReasonLabel,
  eventTone,
  formatSignedAdjustment,
  type VerifiedEventContextSummary,
} from "@/lib/trading/verified-event-intelligence";
import type { RankingRow } from "@/lib/types";
import { humanizeLabel } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function VerifiedEventContextCard({ row }: { row: RankingRow }) {
  const context = buildVerifiedEventContext(row);
  const tone = eventTone(context);
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Verified Events" title="Event + Macro Intelligence" meta={context.compactLabel} />
      <p className="mt-3 text-sm leading-6 text-slate-400">{context.summary}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Event Risk" tone={scoreTone(context.riskScore, true)} value={`${Math.round(context.riskScore)}/100`} />
        <Metric label="Shock Pressure" tone={scoreTone(context.shockPressureScore, true)} value={`${Math.round(context.shockPressureScore)}/100`} />
        <Metric label="Conviction Adj." tone={adjustmentTone(context.convictionAdjustment)} value={formatSignedAdjustment(context.convictionAdjustment)} />
        <Metric label="Fragility Adj." tone={context.fragilityAdjustment >= 2.5 ? "risk" : context.fragilityAdjustment > 0 ? "mixed" : "good"} value={formatSignedAdjustment(context.fragilityAdjustment)} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3 md:grid-cols-2">
          <EventPanel context={context} tone={tone} />
          <ReasonPanel context={context} />
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Recent Confirmed Events</div>
            {context.recentEvents.length ? (
              <div className="mt-3 space-y-3">
                {context.recentEvents.map((event) => (
                  <a
                    className="block rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/35"
                    href={event.sourceUrl || undefined}
                    key={`${event.source}:${event.title}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                      <span>{event.source}</span>
                      <span className="text-slate-600">/</span>
                      <span>{humanizeLabel(event.eventType)}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-200">{event.title}</div>
                    <div className="mt-2 text-[11px] text-slate-500">{event.publishedAt ? formatDate(event.publishedAt) : "recent"} · {humanizeLabel(event.scope)}</div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">No symbol-specific verified event matched this setup yet. Broad macro context still contributes when available.</p>
            )}
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.08] p-4 text-sm leading-6 text-slate-300">
            Verified event context uses trusted source metadata and bounded adjustments. It is not a macro forecast or financial advice.
          </div>
        </aside>
      </div>
    </GlassPanel>
  );
}

function EventPanel({ context, tone }: { context: VerifiedEventContextSummary; tone: "support" | "mixed" | "risk" | "muted" }) {
  const pill = tone === "support"
    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
    : tone === "risk"
      ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
      : tone === "mixed"
        ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
        : "border-white/10 bg-white/[0.04] text-slate-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Event-Aware Risk Context</div>
      <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${pill}`}>{context.label}</div>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Macro pressure adjustment {formatSignedAdjustment(context.macroPressureAdjustment)}. Event pressure score {Math.round(context.eventPressureScore)}/100.
      </p>
    </div>
  );
}

function ReasonPanel({ context }: { context: VerifiedEventContextSummary }) {
  const reasons = context.reasonCodes.slice(0, 6);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Reason Codes</div>
      {reasons.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {reasons.map((code) => (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300" key={code}>{eventReasonLabel(code)}</span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-400">No event reason code is active for this symbol yet.</p>
      )}
      <div className="mt-3 text-xs leading-5 text-slate-500">
        Sources: {context.sourcesUsed.length ? context.sourcesUsed.slice(0, 5).join(", ") : "verified feeds unavailable"}.
      </div>
    </div>
  );
}

function Metric({ label, tone, value }: { label: string; tone: "good" | "mixed" | "risk"; value: string }) {
  const color = tone === "good" ? "text-emerald-200" : tone === "risk" ? "text-rose-200" : "text-amber-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

function scoreTone(score: number, reverse = false): "good" | "mixed" | "risk" {
  const value = reverse ? 100 - score : score;
  if (value >= 65) return "good";
  if (value < 45) return "risk";
  return "mixed";
}

function adjustmentTone(value: number): "good" | "mixed" | "risk" {
  if (value > 0.75) return "good";
  if (value < -0.75) return "risk";
  return "mixed";
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone: "UTC", year: "numeric" }).format(timestamp);
}
