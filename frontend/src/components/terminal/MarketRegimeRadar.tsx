import type { MarketRegime } from "@/lib/adapters/DataServiceAdapter";
import type { RankingRow } from "@/lib/types";
import { ConfidenceDonut } from "./ConfidenceDonut";
import { SectionTitle } from "./ui/SectionTitle";

function countDecision(rows: RankingRow[], value: string) {
  return rows.filter((row) => String(row.final_decision ?? "").toUpperCase() === value).length;
}

export function MarketRegimeRadar({ regime, researchMode = false, rows }: { regime: MarketRegime; researchMode?: boolean; rows: RankingRow[] }) {
  const enter = countDecision(rows, "ENTER");
  const avoid = countDecision(rows, "AVOID");
  const watch = countDecision(rows, "WATCH");
  const aggressiveValue = researchMode ? "DISABLED" : regime.aggressiveEntriesAllowed ? "RESEARCH_SIGNAL" : "MONITOR_ONLY";
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/45 p-5 ring-1 ring-white/5">
      <SectionTitle eyebrow="Market Regime Radar" title={regime.label} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(260px,1fr)_minmax(360px,1.1fr)]">
        <ConfidenceRing confidence={regime.confidence} />
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <RegimeInfoCard title="Active Trade Mode" value={aggressiveValue} tone={researchMode ? "amber" : regime.aggressiveEntriesAllowed ? "green" : "amber"} />
          <RegimeInfoCard title="Breadth" value={regime.breadth} tone={toneFor(regime.breadth)} />
          <RegimeInfoCard title="Leadership" value={regime.leadership} tone="cyan" />
          <RegimePillList items={regime.strongestSectors} title="Strongest" tone="green" />
          <RegimePillList items={regime.weakestSectors} title="Weakest" tone="red" />
        </div>
      </div>
      {researchMode ? (
        <div className="mt-4 grid grid-cols-1 gap-2 text-center text-xs text-slate-400 sm:grid-cols-3">
          <div className="rounded-xl bg-white/[0.04] p-2">Mode <span className="font-mono text-amber-200">RESEARCH</span></div>
          <div className="rounded-xl bg-white/[0.04] p-2">Action <span className="font-mono text-amber-200">NO_TRADE</span></div>
          <div className="rounded-xl bg-white/[0.04] p-2">Rows <span className="font-mono text-slate-100">{rows.length}</span></div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs text-slate-400 sm:grid-cols-4">
          <div className="rounded-xl bg-white/[0.04] p-2">Research <span className="font-mono text-emerald-300">{enter}</span></div>
          <div className="rounded-xl bg-white/[0.04] p-2">Monitor <span className="font-mono text-cyan-300">{watch}</span></div>
          <div className="rounded-xl bg-white/[0.04] p-2">Blocked <span className="font-mono text-rose-300">{avoid}</span></div>
          <div className="rounded-xl bg-white/[0.04] p-2">Rows <span className="font-mono text-slate-100">{rows.length}</span></div>
        </div>
      )}
    </section>
  );
}

function toneFor(value: unknown): "amber" | "cyan" | "green" | "red" {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("WEAK") || text.includes("RISK")) return "red";
  if (text.includes("STRONG")) return "green";
  if (text.includes("BALANCED")) return "cyan";
  return "amber";
}

function toneClass(tone: "amber" | "cyan" | "green" | "red") {
  if (tone === "green") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (tone === "red") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (tone === "amber") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
}

function ConfidenceRing({ confidence }: { confidence: number }) {
  return (
    <div className="flex min-h-[220px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <ConfidenceDonut score={confidence} />
      <div className="mt-3 max-w-xs text-center text-[11px] leading-5 text-slate-500">Confidence reflects signal strength and data quality. Not a prediction.</div>
    </div>
  );
}

function RegimeInfoCard({ title, value, tone }: { title: string; value: unknown; tone: "amber" | "cyan" | "green" | "red" }) {
  return (
    <div className="min-h-[120px] min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`mt-4 inline-flex max-w-full rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${toneClass(tone)}`}>
        <span className="min-w-0 break-words">{String(value ?? "N/A").replaceAll(" ", "_")}</span>
      </div>
    </div>
  );
}

function RegimePillList({ items, title, tone }: { items: string[]; title: string; tone: "green" | "red" }) {
  const color = tone === "green" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200";
  return (
    <div className="min-h-[120px] min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-4 flex max-w-full flex-wrap gap-2">
        {items.length ? items.map((item) => (
          <span className={`max-w-full break-words rounded-full px-2.5 py-1 text-xs ${color}`} key={item}>
            {item}
          </span>
        )) : <span className="text-xs text-slate-500">No group data</span>}
      </div>
    </div>
  );
}
