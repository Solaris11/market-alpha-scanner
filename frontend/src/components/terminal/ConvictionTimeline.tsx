import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import { formatDateUtc, utcTimestampMs } from "@/lib/ui/date-formatters";
import { cleanText, formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "./DecisionBadge";
import { EmptyState } from "./ui/EmptyState";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

type TimelineGroup = {
  point: SignalHistoryPoint;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  scoreDelta: number;
};

function clean(value: unknown) {
  return cleanText(value, "N/A");
}

function score(point: SignalHistoryPoint) {
  return typeof point.final_score === "number" && Number.isFinite(point.final_score) ? point.final_score : null;
}

function signature(point: SignalHistoryPoint) {
  return [point.final_decision, point.recommendation_quality, point.rating, point.entry_status, point.action].map((value) => clean(value).toUpperCase()).join("|");
}

function collapsePoints(points: SignalHistoryPoint[]) {
  const groups: TimelineGroup[] = [];
  const chronological = [...points].sort((left, right) => utcTimestampMs(left.timestamp) - utcTimestampMs(right.timestamp));

  for (const point of chronological) {
    const last = groups.at(-1);
    if (last && signature(last.point) === signature(point)) {
      last.count += 1;
      last.lastTimestamp = point.timestamp;
      const currentScore = score(point);
      const previousScore = score(last.point);
      last.scoreDelta = currentScore !== null && previousScore !== null ? currentScore - previousScore : 0;
      last.point = point;
    } else {
      groups.push({ point, count: 1, firstTimestamp: point.timestamp, lastTimestamp: point.timestamp, scoreDelta: 0 });
    }
  }

  return groups;
}

function dominantDecision(points: SignalHistoryPoint[]) {
  const counts = new Map<string, number>();
  for (const point of points) {
    const decision = clean(point.final_decision).toUpperCase();
    counts.set(decision, (counts.get(decision) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "N/A";
}

function dominantEntry(points: SignalHistoryPoint[]) {
  const counts = new Map<string, number>();
  for (const point of points) {
    const entry = clean(point.entry_status).toUpperCase();
    counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "N/A";
}

function trend(points: SignalHistoryPoint[]) {
  const scored = points.map(score).filter((value): value is number => value !== null);
  if (scored.length < 2) return "flat";
  const delta = scored.at(-1)! - scored[0];
  if (delta > 2) return "improving";
  if (delta < -2) return "weakening";
  return "flat";
}

function arrow(delta: number) {
  if (delta > 0.25) return "↑";
  if (delta < -0.25) return "↓";
  return "→";
}

function dateRange(group: TimelineGroup) {
  return group.count > 1 ? `${formatDateUtc(group.firstTimestamp)} - ${formatDateUtc(group.lastTimestamp)}` : formatDateUtc(group.lastTimestamp);
}

function Sparkline({ points }: { points: SignalHistoryPoint[] }) {
  const values = points.map(score).filter((value): value is number => value !== null).slice(-24);
  if (values.length < 2) return <div className="h-12 rounded-xl border border-dashed border-white/10 bg-white/[0.03]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const path = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 42 - ((value - min) / span) * 34;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg aria-hidden className="h-12 w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 48">
      <path d={path} fill="none" stroke="rgb(34 211 238)" strokeLinecap="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ConvictionTimeline({ points }: { points: SignalHistoryPoint[] }) {
  if (!points.length) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Signal Memory" title="Conviction Timeline" />
        <div className="mt-4"><EmptyState title="No signal history yet" message="History will populate this timeline after saved scanner runs are available." /></div>
      </GlassPanel>
    );
  }

  const groups = collapsePoints(points).slice(-10).reverse();
  const trendLabel = trend(points);

  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Signal Memory" title="Conviction Timeline" meta={`${points.length} observations`} />
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-slate-500">Trend</div>
              <div className="mt-1 font-semibold capitalize text-slate-100">{trendLabel}</div>
            </div>
            <div>
              <div className="text-slate-500">Dominant Signal</div>
              <div className="mt-1 font-semibold text-slate-100">{dominantDecision(points).replaceAll("_", " ")}</div>
            </div>
            <div>
              <div className="text-slate-500">Entry Quality</div>
              <div className="mt-1 font-semibold text-slate-100">{dominantEntry(points).replaceAll("_", " ")}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="mb-1 text-xs text-slate-500">Score path</div>
          <Sparkline points={points} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((group) => (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs md:grid-cols-[170px_90px_1fr_120px]" key={`${group.firstTimestamp}-${group.lastTimestamp}-${signature(group.point)}`}>
            <div className="min-w-0">
              <DecisionBadge value={group.point.final_decision} />
              {group.count > 1 ? <div className="mt-2 font-mono text-[11px] text-cyan-200">{clean(group.point.final_decision).toUpperCase()} x{group.count}</div> : null}
            </div>
            <div className="font-mono text-slate-100">
              <span className={group.scoreDelta > 0 ? "text-emerald-300" : group.scoreDelta < 0 ? "text-rose-300" : "text-slate-400"}>{arrow(group.scoreDelta)}</span>{" "}
              {formatNumber(group.point.final_score)}
            </div>
            <div className="min-w-0 text-slate-400">
              <div className="truncate text-slate-200">{clean(group.point.entry_status).replaceAll("_", " ")}</div>
              <div className="mt-1 truncate text-slate-500">{clean(group.point.rating)} · {clean(group.point.recommendation_quality).replaceAll("_", " ")}</div>
            </div>
            <div className="text-right text-slate-500">{dateRange(group)}</div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
