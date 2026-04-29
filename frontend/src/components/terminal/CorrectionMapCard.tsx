import { buildCorrectionMap, formatCorrectionZone } from "@/lib/trading/correction-map";
import type { RankingRow } from "@/lib/types";
import { cleanText, formatMoney, formatPercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function CorrectionMapCard({ row }: { row: RankingRow }) {
  const map = buildCorrectionMap(row);
  const decision = cleanText(row.final_decision, "").toUpperCase();
  if (decision === "ENTER" || decision === "EXIT") return null;

  if (decision === "AVOID" && (map.zoneLow === null || map.zoneHigh === null)) {
    return (
      <GlassPanel className="p-6">
        <SectionTitle eyebrow="Entry Timing" title="Correction Map" />
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300">
          No actionable correction zone yet.
        </div>
      </GlassPanel>
    );
  }

  if (!map.isActionable || map.zoneLow === null || map.zoneHigh === null) return null;

  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Entry Timing" title="Correction Map" />
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <CorrectionMetric label="Current Price" value={formatMoney(map.currentPrice)} />
        <CorrectionMetric label="Correction Trigger" value={formatMoney(map.triggerPrice)} />
        <CorrectionMetric label="Estimated Pullback Zone" value={formatCorrectionZone(map)} />
        <CorrectionMetric label="Distance to Pullback Zone" value={distanceLabel(map.distancePct)} />
        <CorrectionMetric label="Confidence" value={map.confidence} />
      </div>
      <div className="mt-5 space-y-2 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
        <div>{triggerCopy(map.triggerPrice, map.triggerAlreadyReached)}</div>
        <div>Estimated pullback zone: {formatCorrectionZone(map)}.</div>
        <div>Wait for price to cool down before entry.</div>
      </div>
    </GlassPanel>
  );
}

function triggerCopy(price: number | null, alreadyReached: boolean): string {
  if (price === null) return "Correction trigger is not available yet.";
  return alreadyReached ? `Correction trigger was already reached at ${formatMoney(price)}; correction risk is elevated.` : `If price pushes above ${formatMoney(price)}, correction risk increases.`;
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
