"use client";

import { buildEvidenceMaturityFromSignal, evidenceMaturityTone, type EvidenceMaturityModel } from "@/lib/trading/evidence-maturity";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import type { ShockMovePattern } from "@/lib/trading/shock-move";
import type { RankingRow } from "@/lib/types";
import { formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function EvidenceMaturityCard({
  compact = false,
  evidence,
  marketMemory,
  row,
  shockPattern,
}: {
  compact?: boolean;
  evidence?: EvidenceMaturityModel | null;
  marketMemory?: MarketMemorySummary | null;
  row: RankingRow;
  shockPattern?: ShockMovePattern | null;
}) {
  const model = evidence ?? buildEvidenceMaturityFromSignal(row, { marketMemory, shockPattern });
  const tone = evidenceMaturityTone(model.tier);
  const toneClass = {
    default: "border-cyan-300/20 bg-cyan-400/[0.06] text-cyan-100",
    good: "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100",
    warn: "border-amber-300/25 bg-amber-400/[0.08] text-amber-100",
  }[tone];

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <SectionTitle eyebrow="Evidence Maturity" title="Evidence Confidence" meta={model.label} />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This shows how much historical context supports the read: sample size, calendar depth, outcomes, analog quality, and score reliability. It is a confidence label, not a forecast.
          </p>
        </div>
        <div className={`w-fit rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-normal ${toneClass}`}>
          {model.score}/100 evidence
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <EvidenceMetric label="Sample Size" value={model.evidenceSampleSize.toLocaleString()} />
        <EvidenceMetric label="Depth Days" value={model.historicalDepthDays.toLocaleString()} />
        <EvidenceMetric label="Outcome Coverage" value={`${formatNumber(model.outcomeCoverage, 0)}%`} />
        <EvidenceMetric label="Analog Quality" value={`${formatNumber(model.analogQualityScore, 0)}/100`} />
        <EvidenceMetric label="Reliability" value={`${formatNumber(model.confidenceReliability, 0)}/100`} />
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <EvidenceList title="What Gives Confidence" items={model.reasons} />
          <EvidenceList title="Where Evidence Is Still Building" items={model.limitations.length ? model.limitations : ["No material evidence gap is dominant in this context."]} />
        </div>
      ) : null}
    </GlassPanel>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-black text-slate-50" title={value}>{value}</div>
    </div>
  );
}

function EvidenceList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="truncate text-[10px] font-black uppercase leading-4 tracking-normal text-cyan-300" title={title}>{title}</div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.map((item) => <li key={item}>- {humanizeInsightText(item)}</li>)}
      </ul>
    </div>
  );
}
