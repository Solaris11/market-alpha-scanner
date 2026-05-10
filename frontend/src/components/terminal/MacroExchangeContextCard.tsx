import {
  macroAlignmentLabel,
  macroPressureLabel,
  type MacroAlignmentState,
  type MacroExchangeContext,
} from "@/lib/trading/macro-regime";
import type { RankingRow } from "@/lib/types";
import { finiteNumber, formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText } from "@/lib/ui/labels";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function MacroExchangeContextCard({ context, row }: { context: MacroExchangeContext; row?: RankingRow }) {
  const baseScore = scoreField(row, "base_score") ?? scoreField(row, "final_score_base") ?? scoreField(row, "technical_score");
  const adjustedScore = scoreField(row, "macro_adjusted_score") ?? scoreField(row, "final_score_adjusted") ?? scoreField(row, "final_score");
  const totalAdjustment = scoreField(row, "macro_context_adjustment_total") ?? scoreField(row, "regime_adjustment");
  return (
    <GlassPanel className="p-5">
      <SectionTitle eyebrow="Market State" title="Market + Listing Context" meta={humanizeInsightText(macroAlignmentLabel(context))} />
      <p className="mt-3 text-sm leading-6 text-slate-400">{humanizeInsightText(context.regimeExplanation)}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Base Score" tone="mixed" value={baseScore === null ? "N/A" : formatNumber(baseScore)} />
        <Metric label="Market-Adjusted Score" tone={scoreTone(adjustedScore ?? context.macroAlignmentScore)} value={adjustedScore === null ? "N/A" : formatNumber(adjustedScore)} />
        <Metric label="Market Support" tone={alignmentTone(context.alignmentState)} value={`${context.macroAlignmentScore}/100`} />
        <Metric label="Context Adjustment" tone={adjustmentTone(totalAdjustment)} value={totalAdjustment === null ? "N/A" : signedNumber(totalAdjustment)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Metric label="Listing Health" tone={scoreTone(context.exchangeHealthScore)} value={`${context.exchangeHealthScore}/100`} />
        <Metric label="Sector / Theme" tone={scoreTone(context.sectorAlignmentScore)} value={`${context.sectorAlignmentScore}/100`} />
        <Metric label="Market Pressure" tone={pressureTone(context.macroPressureScore)} value={`${context.macroPressureScore}/100`} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3 md:grid-cols-2">
          <ForceList items={context.supportingForces} title="What Helps" tone="support" />
          <ForceList items={context.opposingForces} title="What Hurts" tone="pressure" />
          <ForceList items={context.exchangeTailwind.length ? context.exchangeTailwind : [context.exchangeContextLabel]} title="Listing Context" tone={context.exchangeHealthScore >= 55 ? "support" : "pressure"} />
          <ForceList items={context.sectorTailwind.length ? context.sectorTailwind : context.sectorPressure.length ? context.sectorPressure : [context.themeContext]} title="Sector / Theme Context" tone={context.sectorAlignmentScore >= 55 ? "support" : "pressure"} />
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pressure Stack</div>
            <PressureBar label="Risk On" reverse value={context.riskOnScore} />
            <PressureBar label="Volatility" value={context.volatilityPressure} />
            <PressureBar label="Liquidity" value={context.liquidityPressure} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Proxy Coverage</div>
            <div className="mt-2 text-xs leading-5 text-slate-300">
              Used: {context.proxyCoverage.used.length ? context.proxyCoverage.used.join(", ") : "limited latest-scan proxies"}.
            </div>
            {context.proxyCoverage.missing.length ? (
              <div className="mt-2 text-xs leading-5 text-slate-500">
                Missing: {context.proxyCoverage.missing.slice(0, 5).join(", ")}{context.proxyCoverage.missing.length > 5 ? "..." : ""}.
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.08] p-4 text-sm leading-6 text-slate-300">
            This shows whether the broader market is helping or hurting the setup. It is context, not a forecast or financial advice.
          </div>
        </aside>
      </div>
    </GlassPanel>
  );
}

function scoreField(row: RankingRow | undefined, key: string): number | null {
  if (!row) return null;
  return finiteNumber((row as unknown as Record<string, unknown>)[key]);
}

function signedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
}

function Metric({ label, tone, value }: { label: string; tone: "good" | "mixed" | "risk"; value: string }) {
  const color = tone === "good" ? "text-emerald-200" : tone === "risk" ? "text-rose-200" : "text-amber-100";
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="min-w-0 truncate text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-2 font-mono text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

function ForceList({ items, title, tone }: { items: string[]; title: string; tone: "support" | "pressure" }) {
  const eyebrow = tone === "support" ? "text-emerald-200" : "text-amber-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${eyebrow}`}>{title}</div>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.map((item) => <li key={item}>- {humanizeInsightText(item)}</li>)}
      </ul>
    </div>
  );
}

function PressureBar({ label, reverse = false, value }: { label: string; reverse?: boolean; value: number }) {
  const tone = reverse ? scoreTone(value) : pressureTone(value);
  const color = tone === "good" ? "bg-emerald-300" : tone === "risk" ? "bg-rose-300" : "bg-amber-300";
  const displayLabel = reverse ? `${value}/100` : macroPressureLabel(value);
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-100">{label}</span>
        <span className="text-slate-400">{displayLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function alignmentTone(state: MacroAlignmentState): "good" | "mixed" | "risk" {
  if (state === "aligned") return "good";
  if (state === "conflict") return "risk";
  return "mixed";
}

function scoreTone(score: number): "good" | "mixed" | "risk" {
  if (score >= 65) return "good";
  if (score < 45) return "risk";
  return "mixed";
}

function pressureTone(score: number): "good" | "mixed" | "risk" {
  if (score >= 65) return "risk";
  if (score < 45) return "good";
  return "mixed";
}

function adjustmentTone(value: number | null): "good" | "mixed" | "risk" {
  if (value === null) return "mixed";
  if (value > 0.75) return "good";
  if (value < -0.75) return "risk";
  return "mixed";
}
