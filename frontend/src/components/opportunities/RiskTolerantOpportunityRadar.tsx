"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import {
  buildRiskTolerantOpportunities,
  riskRewardProfile,
  type RewardLevel,
  type RiskLevel,
  type RiskTolerantOpportunity,
} from "@/lib/trading/risk-tolerant-opportunities";
import { cleanText, formatNumber } from "@/lib/ui/formatters";
import { DecisionBadge } from "@/components/terminal/DecisionBadge";
import { GlassPanel } from "@/components/terminal/ui/GlassPanel";
import { SectionTitle } from "@/components/terminal/ui/SectionTitle";

type AnalysisResponse = {
  analysis?: {
    available: boolean;
    chaseRiskAssessment: string;
    conciseExplanation: string;
    dataFreshnessNote: string;
    evidenceSupportingRanking: string[];
    monitorNext: string[];
    profileFitReason: string;
    safetyLanguage: string;
    source: "deterministic" | "llm";
    uncertaintyNote: string;
    whyItMayFail: string;
    whyItMayWork: string;
  };
  ok?: boolean;
};

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high"];
const REWARD_LEVELS: RewardLevel[] = ["low", "medium", "high"];

export function RiskTolerantOpportunityRadar({
  compact = false,
  defaultRewardLevel = "high",
  defaultRiskLevel = "high",
  marketCondition,
  rows,
}: {
  compact?: boolean;
  defaultRewardLevel?: RewardLevel;
  defaultRiskLevel?: RiskLevel;
  marketCondition: string | null;
  rows: OpportunityViewModel[];
}) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(defaultRiskLevel);
  const [rewardLevel, setRewardLevel] = useState<RewardLevel>(defaultRewardLevel);
  const [analysis, setAnalysis] = useState<AnalysisResponse["analysis"] | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const profile = useMemo(() => riskRewardProfile({ riskLevel, rewardLevel }), [rewardLevel, riskLevel]);
  const candidates = useMemo(() => buildRiskTolerantOpportunities(rows, { riskLevel, rewardLevel }, { limit: 5 }), [rewardLevel, riskLevel, rows]);
  const fallbackCandidates = useMemo(() => buildRiskTolerantOpportunities(rows, { riskLevel, rewardLevel }, { includeProfileMismatches: true, limit: 5 }), [rewardLevel, riskLevel, rows]);
  const displayCandidates = candidates.length ? candidates : fallbackCandidates;
  const topCandidate = displayCandidates[0] ?? null;

  async function runAnalysis(symbol: string) {
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const params = new URLSearchParams({ reward: rewardLevel, risk: riskLevel, symbol });
      const response = await fetch(`/api/opportunities/risk-tolerant-analysis?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as AnalysisResponse | null;
      if (!response.ok || !payload?.ok || !payload.analysis) {
        setAnalysisError("AI analysis is unavailable. Deterministic ranking remains visible.");
        return;
      }
      setAnalysis(payload.analysis);
    } catch {
      setAnalysisError("AI analysis is unavailable. Deterministic ranking remains visible.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  return (
    <GlassPanel className={`${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <SectionTitle
            eyebrow="Risk-Tolerant Opportunity Radar"
            title="Best Opportunities If You Accept Risk"
            meta={cleanText(marketCondition, "Latest scan")}
          />
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Core TradeVeto decisions remain conservative. This parallel radar ranks speculative research candidates when you explicitly accept higher risk.
          </p>
        </div>
        <RiskRewardControls rewardLevel={rewardLevel} riskLevel={riskLevel} setRewardLevel={setRewardLevel} setRiskLevel={setRiskLevel} />
      </div>

      <div className={`mt-4 rounded-2xl border p-4 ${profile.riskLevel === "high" ? "border-amber-300/25 bg-amber-400/[0.08]" : "border-white/10 bg-white/[0.035]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-100">{profile.label}</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{profile.explanation}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-amber-100">
            Research only
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-amber-100">{profile.warning}</p>
      </div>

      {displayCandidates.length ? (
        <div className={`mt-4 grid gap-3 ${compact ? "lg:grid-cols-1" : "lg:grid-cols-2 2xl:grid-cols-5"}`}>
          {displayCandidates.map((candidate) => (
            <RiskCandidateCard
              candidate={candidate}
              key={candidate.symbol}
              onAnalyze={() => void runAnalysis(candidate.symbol)}
              showAnalyze={candidate.symbol === topCandidate?.symbol}
              loading={analysisLoading && candidate.symbol === topCandidate?.symbol}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
          No candidates meet this risk/reward profile. TradeVeto is not filling the list with low-quality setups just to create activity.
        </div>
      )}

      {analysis || analysisError ? (
        <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">AI Structured Analysis</div>
            {analysis ? <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300">{analysis.source === "llm" ? "LLM validated" : "Deterministic fallback"}</div> : null}
          </div>
          {analysis ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
              <div className="space-y-2 text-sm leading-6 text-slate-300">
                <p>{analysis.conciseExplanation}</p>
                <p><span className="font-semibold text-emerald-200">May work:</span> {analysis.whyItMayWork}</p>
                <p><span className="font-semibold text-rose-200">May fail:</span> {analysis.whyItMayFail}</p>
                <p className="text-xs text-slate-500">{analysis.safetyLanguage}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Monitor next</div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
                  {analysis.monitorNext.map((item) => <li key={item}>- {item}</li>)}
                </ul>
                <div className="mt-3 text-[11px] leading-5 text-slate-500">{analysis.dataFreshnessNote}</div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-100">{analysisError}</p>
          )}
        </div>
      ) : null}
    </GlassPanel>
  );
}

export function RiskRewardControls({
  rewardLevel,
  riskLevel,
  setRewardLevel,
  setRiskLevel,
}: {
  rewardLevel: RewardLevel;
  riskLevel: RiskLevel;
  setRewardLevel: (value: RewardLevel) => void;
  setRiskLevel: (value: RiskLevel) => void;
}) {
  return (
    <div className="grid min-w-[min(100%,320px)] gap-2 sm:grid-cols-2">
      <SegmentedControl label="Risk Level" options={RISK_LEVELS} value={riskLevel} onChange={setRiskLevel} />
      <SegmentedControl label="Reward Level" options={REWARD_LEVELS} value={rewardLevel} onChange={setRewardLevel} />
    </div>
  );
}

function SegmentedControl<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: T[]; value: T }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-slate-950/45 p-1">
        {options.map((option) => (
          <button
            className={`min-h-9 rounded-lg px-2 text-xs font-bold capitalize transition ${value === option ? "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/30" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"}`}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function RiskCandidateCard({
  candidate,
  loading,
  onAnalyze,
  showAnalyze,
}: {
  candidate: RiskTolerantOpportunity;
  loading: boolean;
  onAnalyze: () => void;
  showAnalyze: boolean;
}) {
  return (
    <article className={`min-w-0 rounded-2xl border p-4 ${candidate.profileMatched ? "border-white/10 bg-white/[0.04]" : "border-amber-300/20 bg-amber-400/[0.055]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Rank #{candidate.riskTolerantRank}</div>
          <Link className="mt-1 block font-mono text-2xl font-black text-slate-50 hover:text-cyan-100" href={`/symbol/${candidate.symbol}`}>{candidate.symbol}</Link>
        </div>
        <DecisionBadge className="px-2 py-1 text-[10px]" value={candidate.row.final_decision} />
      </div>
      <div className="mt-2 text-xs font-semibold text-cyan-200">{candidate.opportunityType}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{candidate.keyReason}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <MiniMetric label="Opp Score" value={formatNumber(candidate.aggressiveOpportunityScore, 0)} />
        <MiniMetric label="Asymmetry" value={formatNumber(candidate.asymmetryScore, 0)} />
        <MiniMetric label="Upside" value={formatNumber(candidate.upsidePotentialScore, 0)} />
        <MiniMetric label="Downside" value={formatNumber(candidate.downsideRiskScore, 0)} tone={candidate.downsideRiskScore >= 70 ? "risk" : "neutral"} />
        <MiniMetric label="Reliability" value={formatNumber(candidate.reliabilityScore, 0)} />
        <MiniMetric label="Shock Memory" value={candidate.shockPatternAvailable ? "Available" : "Limited"} />
        <MiniMetric label="Entry Zone" value={candidate.researchEntryZone} />
        <MiniMetric label="Invalidation" value={candidate.invalidationZone} tone="risk" />
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-2 text-[11px] leading-4 text-slate-400">
        <span className="font-semibold text-amber-100">{candidate.chaseRiskLabel}.</span> {candidate.keyRisk}
      </div>
      {showAnalyze ? (
        <button
          className="mt-3 w-full rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-60"
          disabled={loading}
          onClick={onAnalyze}
          type="button"
        >
          {loading ? "Analyzing..." : "Run AI explanation"}
        </button>
      ) : null}
    </article>
  );
}

function MiniMetric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "risk"; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-950/45 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`mt-1 truncate font-mono text-[11px] font-semibold ${tone === "risk" ? "text-rose-200" : "text-slate-100"}`} title={value}>{value}</div>
    </div>
  );
}
