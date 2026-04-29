import { buildCorrectionMap, formatCorrectionZone } from "@/lib/trading/correction-map";
import type { RankingRow } from "@/lib/types";
import { formatPercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function CorrectionMapCard({ row }: { row: RankingRow }) {
  const map = buildCorrectionMap(row);
  if (!map.isActionable || map.zoneLow === null || map.zoneHigh === null) return null;

  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Entry Timing" title="Estimated Correction" />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <CorrectionMetric label="Price Range" value={formatCorrectionZone(map)} />
        <CorrectionMetric label="Distance" value={distanceLabel(map.distancePct)} />
        <CorrectionMetric label="Confidence" value={map.confidence} />
      </div>
    </GlassPanel>
  );
}

function distanceLabel(value: number | null): string {
  if (value === null) return "N/A";
  if (Math.abs(value) < 0.0001) return "At zone";
  return value < 0 ? `${formatPercent(Math.abs(value), 1)} below` : `${formatPercent(value, 1)} above`;
}

function CorrectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}
