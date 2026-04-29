import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber, formatPercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

function positiveReasons(row: RankingRow) {
  const reasons: string[] = [];
  if ((finiteNumber(row.final_score) ?? 0) >= 75) reasons.push("High scanner score relative to the current universe");
  if ((finiteNumber(row.technical_score) ?? finiteNumber(row.final_score) ?? 0) >= 70) reasons.push("Technical trend is constructive");
  if ((finiteNumber(row.risk_reward) ?? 0) >= 2) reasons.push("Risk/reward clears a favorable threshold");
  if (String(row.recommendation_quality ?? "").toUpperCase() === "TRADE_READY") reasons.push("Quality gate is cleared");
  if (cleanText(row.market_regime, "")) reasons.push(`Market regime context: ${cleanText(row.market_regime)}`);
  return reasons.length ? reasons : ["No strong positive setup drivers are available yet"];
}

function blockers(row: RankingRow) {
  const decision = String(row.final_decision ?? "").toUpperCase();
  const quality = String(row.recommendation_quality ?? "").toUpperCase();
  const entry = String(row.entry_status ?? "").toUpperCase();
  const reasons: string[] = [];
  if (decision === "WAIT_PULLBACK") reasons.push("Price is not at the preferred entry area yet");
  if (decision === "AVOID") reasons.push("System blocks new aggressive entries");
  if (decision === "EXIT") reasons.push("Sell or invalidation signal is active");
  if (entry.includes("OVEREXTENDED")) reasons.push("Price is extended relative to the entry zone");
  if (entry.includes("STOP RISK")) reasons.push("Price is too close to the invalidation area");
  if (quality === "LOW_EDGE") reasons.push("Historical or quality gate edge is too low");
  if ((finiteNumber(row.risk_reward) ?? 99) < 1.5) reasons.push("Risk/reward is not attractive enough");
  if (finiteNumber(row.entry_distance_pct) !== null && (finiteNumber(row.entry_distance_pct) ?? 0) > 0) reasons.push(`Entry is ${formatPercent(row.entry_distance_pct)} away`);
  return reasons.length ? reasons : ["No major blocker detected"];
}

export function WhyDecisionCard({ row }: { row: RankingRow }) {
  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Decision Logic" title="Why This Decision?" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ReasonList tone="positive" title="Why it could work" items={positiveReasons(row)} />
        <ReasonList tone="warning" title="Why not enter now" items={blockers(row)} />
      </div>
    </GlassPanel>
  );
}

function ReasonList({ items, title, tone }: { items: string[]; title: string; tone: "positive" | "warning" }) {
  const color = tone === "positive" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100";
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <div className="text-sm font-semibold text-slate-50">{title}</div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => <li className="flex gap-2" key={item}><span>•</span><span>{item}</span></li>)}
      </ul>
    </div>
  );
}
