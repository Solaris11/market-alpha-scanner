import type { ConvictionTimelineModel } from "@/lib/trading/conviction-timeline-types";
import { DecisionBadge } from "./DecisionBadge";
import { EmptyState } from "./ui/EmptyState";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

const EMPTY_TIMELINE: ConvictionTimelineModel = {
  dominantDecisionLabel: "N/A",
  dominantEntryLabel: "N/A",
  groups: [],
  observationCount: 0,
  sparklinePath: null,
  trendLabel: "flat",
};

export function ConvictionTimeline({ timeline = EMPTY_TIMELINE }: { timeline?: ConvictionTimelineModel }) {
  if (!timeline.observationCount) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Signal Memory" title="Conviction Timeline" />
        <div className="mt-4"><EmptyState title="No signal history yet" message="History will populate this timeline after saved scanner runs are available." /></div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Signal Memory" title="Conviction Timeline" meta={`${timeline.observationCount} observations`} />
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <SummaryItem label="Trend" value={timeline.trendLabel} capitalize />
            <SummaryItem label="Dominant Signal" value={timeline.dominantDecisionLabel} />
            <SummaryItem label="Entry Quality" value={timeline.dominantEntryLabel} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="mb-1 text-xs text-slate-500">Score path</div>
          <Sparkline path={timeline.sparklinePath} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {timeline.groups.map((group) => (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs md:grid-cols-[170px_90px_1fr_120px]" key={group.key}>
            <div className="min-w-0">
              <DecisionBadge value={group.decision} />
              {group.repeatLabel ? <div className="mt-2 font-mono text-[11px] text-cyan-200">{group.repeatLabel}</div> : null}
            </div>
            <div className="font-mono text-slate-100">
              <span className={scoreToneClass(group.scoreTone)}>{group.scoreArrow}</span> {group.scoreLabel}
            </div>
            <div className="min-w-0 text-slate-400">
              <div className="truncate text-slate-200">{group.entryStatusLabel}</div>
              <div className="mt-1 truncate text-slate-500">{group.detailLabel}</div>
            </div>
            <div className="text-right text-slate-500">{group.dateLabel}</div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function SummaryItem({ capitalize = false, label, value }: { capitalize?: boolean; label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className={`mt-1 font-semibold text-slate-100 ${capitalize ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}

function Sparkline({ path }: { path: string | null }) {
  if (!path) return <div className="h-12 rounded-xl border border-dashed border-white/10 bg-white/[0.03]" />;
  return (
    <svg aria-hidden className="h-12 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 48">
      <path d={path} fill="none" stroke="rgb(34 211 238)" strokeLinecap="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function scoreToneClass(tone: "up" | "down" | "flat") {
  if (tone === "up") return "text-emerald-300";
  if (tone === "down") return "text-rose-300";
  return "text-slate-400";
}
