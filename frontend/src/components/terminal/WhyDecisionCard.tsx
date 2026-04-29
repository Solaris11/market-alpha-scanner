import type { RankingRow } from "@/lib/types";
import { buildWhyNotNow, buildWhyThisTrade } from "@/lib/trading/signal-explainer";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function WhyDecisionCard({ row }: { row: RankingRow }) {
  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Decision Logic" title="Why This Decision?" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ReasonList tone="positive" title="Why This Trade?" items={buildWhyThisTrade(row)} />
        <ReasonList tone="warning" title="Why Not Now?" items={buildWhyNotNow(row)} />
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
