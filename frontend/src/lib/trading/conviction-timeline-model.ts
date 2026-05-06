import "server-only";

import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { ConvictionTimelineGroup, ConvictionTimelineModel } from "@/lib/trading/conviction-timeline-types";
import { formatDateUtc, utcTimestampMs } from "@/lib/ui/date-formatters";
import { cleanText, formatNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

type TimelineGroup = {
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  point: SignalHistoryPoint;
  scoreDelta: number;
};

export function buildConvictionTimelineModel(points: SignalHistoryPoint[]): ConvictionTimelineModel {
  return {
    dominantDecisionLabel: label(dominantValue(points, (point) => point.final_decision)),
    dominantEntryLabel: label(dominantValue(points, (point) => point.entry_status)),
    groups: collapsePoints(points).slice(-10).reverse().map(toViewGroup),
    observationCount: points.length,
    sparklinePath: buildSparklinePath(points),
    trendLabel: trend(points),
  };
}

function toViewGroup(group: TimelineGroup): ConvictionTimelineGroup {
  const decision = label(group.point.final_decision);
  return {
    dateLabel: group.count > 1 ? `${formatDateUtc(group.firstTimestamp)} - ${formatDateUtc(group.lastTimestamp)}` : formatDateUtc(group.lastTimestamp),
    decision,
    detailLabel: `${label(group.point.rating)} - ${label(group.point.recommendation_quality)}`,
    entryStatusLabel: label(group.point.entry_status),
    key: `${group.firstTimestamp}-${group.lastTimestamp}-${signature(group.point)}`,
    repeatLabel: group.count > 1 ? `${decision} x${group.count}` : null,
    scoreArrow: arrow(group.scoreDelta),
    scoreLabel: formatNumber(group.point.final_score),
    scoreTone: group.scoreDelta > 0 ? "up" : group.scoreDelta < 0 ? "down" : "flat",
  };
}

function collapsePoints(points: SignalHistoryPoint[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  const chronological = [...points].sort((left, right) => utcTimestampMs(left.timestamp) - utcTimestampMs(right.timestamp));

  for (const point of chronological) {
    const last = groups.at(-1);
    if (last && signature(last.point) === signature(point)) {
      const currentScore = score(point);
      const previousScore = score(last.point);
      last.count += 1;
      last.lastTimestamp = point.timestamp;
      last.scoreDelta = currentScore !== null && previousScore !== null ? currentScore - previousScore : 0;
      last.point = point;
    } else {
      groups.push({ count: 1, firstTimestamp: point.timestamp, lastTimestamp: point.timestamp, point, scoreDelta: 0 });
    }
  }

  return groups;
}

function dominantValue(points: SignalHistoryPoint[], select: (point: SignalHistoryPoint) => unknown): string {
  const counts = new Map<string, number>();
  for (const point of points) {
    const value = clean(select(point)).toUpperCase();
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "N/A";
}

function trend(points: SignalHistoryPoint[]): string {
  const scored = points.map(score).filter((value): value is number => value !== null);
  if (scored.length < 2) return "flat";
  const delta = scored.at(-1)! - scored[0];
  if (delta > 2) return "improving";
  if (delta < -2) return "weakening";
  return "flat";
}

function buildSparklinePath(points: SignalHistoryPoint[]): string | null {
  const values = points.map(score).filter((value): value is number => value !== null).slice(-24);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 42 - ((value - min) / span) * 34;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function signature(point: SignalHistoryPoint): string {
  return [point.final_decision, point.recommendation_quality, point.rating, point.entry_status, point.action].map((value) => clean(value).toUpperCase()).join("|");
}

function score(point: SignalHistoryPoint): number | null {
  return typeof point.final_score === "number" && Number.isFinite(point.final_score) ? point.final_score : null;
}

function arrow(delta: number): string {
  if (delta > 0.25) return "↑";
  if (delta < -0.25) return "↓";
  return "→";
}

function clean(value: unknown): string {
  return cleanText(value, "N/A");
}

function label(value: unknown): string {
  return humanizeLabel(clean(value));
}
