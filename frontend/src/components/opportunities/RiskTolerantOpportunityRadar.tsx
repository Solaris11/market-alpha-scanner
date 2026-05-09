"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRiskProfile } from "@/hooks/useRiskProfile";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import {
  buildPersonalizedOpportunities,
  buildUserPersonalizationProfile,
  RISK_PERSONALITY_OPTIONS,
  type PersonalizedOpportunity,
  type UserPersonalizationProfile,
} from "@/lib/trading/personalized-intelligence";
import {
  riskRewardProfile,
  type RewardLevel,
  type RiskLevel,
} from "@/lib/trading/risk-tolerant-opportunities";
import { type RiskPersonalityProfile } from "@/lib/trading/risk-veto";
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
  initialProfile,
  marketCondition,
  rows,
}: {
  compact?: boolean;
  defaultRewardLevel?: RewardLevel;
  defaultRiskLevel?: RiskLevel;
  initialProfile?: UserPersonalizationProfile;
  marketCondition: string | null;
  rows: OpportunityViewModel[];
}) {
  const { actions: riskProfileActions, profile: savedRiskProfile } = useRiskProfile();
  const [riskLevel, setRiskLevelState] = useState<RiskLevel>(initialProfile?.preferredRiskLevel ?? defaultRiskLevel);
  const [rewardLevel, setRewardLevelState] = useState<RewardLevel>(initialProfile?.preferredRewardLevel ?? defaultRewardLevel);
  const [personality, setPersonalityState] = useState<RiskPersonalityProfile>(initialProfile?.personality ?? savedRiskProfile.personalityProfile);
  const [analysis, setAnalysis] = useState<AnalysisResponse["analysis"] | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  useEffect(() => {
    setPersonalityState(savedRiskProfile.personalityProfile);
    setRiskLevelState(savedRiskProfile.preferredRiskLevel);
    setRewardLevelState(savedRiskProfile.preferredRewardLevel);
  }, [savedRiskProfile.personalityProfile, savedRiskProfile.preferredRewardLevel, savedRiskProfile.preferredRiskLevel]);

  const personalizationProfile = useMemo(() => buildUserPersonalizationProfile({
    behavior: initialProfile?.behavior,
    profile: {
      ...savedRiskProfile,
      personalityProfile: personality,
      preferredRewardLevel: rewardLevel,
      preferredRiskLevel: riskLevel,
    },
    source: initialProfile?.source ?? "explicit",
  }), [initialProfile?.behavior, initialProfile?.source, personality, rewardLevel, riskLevel, savedRiskProfile]);
  const profile = useMemo(() => riskRewardProfile({ riskLevel, rewardLevel }), [rewardLevel, riskLevel]);
  const candidates = useMemo(() => buildPersonalizedOpportunities(rows, personalizationProfile, { limit: 5 }), [personalizationProfile, rows]);
  const fallbackCandidates = useMemo(() => buildPersonalizedOpportunities(rows, personalizationProfile, { includeProfileMismatches: true, limit: 5 }), [personalizationProfile, rows]);
  const displayCandidates = candidates.length ? candidates : fallbackCandidates;
  const topCandidate = displayCandidates[0]?.candidate ?? null;

  function persistPersonalityPatch(patch: { personalityProfile?: RiskPersonalityProfile; preferredRewardLevel?: RewardLevel; preferredRiskLevel?: RiskLevel }) {
    riskProfileActions.updateRiskProfile({
      ...patch,
      personalityConfidence: Math.max(savedRiskProfile.personalityConfidence, 62),
    });
    trackAnalyticsEvent("personalization_update", {
      personality: patch.personalityProfile ?? personality,
      reward_level: patch.preferredRewardLevel ?? rewardLevel,
      risk_level: patch.preferredRiskLevel ?? riskLevel,
    }, { source: "risk_tolerant_radar" });
  }

  function setRiskLevel(value: RiskLevel) {
    setRiskLevelState(value);
    persistPersonalityPatch({ preferredRiskLevel: value });
  }

  function setRewardLevel(value: RewardLevel) {
    setRewardLevelState(value);
    persistPersonalityPatch({ preferredRewardLevel: value });
  }

  function setPersonality(value: RiskPersonalityProfile) {
    setPersonalityState(value);
    persistPersonalityPatch({ personalityProfile: value });
  }

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
        <PersonalizedControls
          personality={personality}
          rewardLevel={rewardLevel}
          riskLevel={riskLevel}
          setPersonality={setPersonality}
          setRewardLevel={setRewardLevel}
          setRiskLevel={setRiskLevel}
        />
      </div>

      <div className={`mt-4 rounded-2xl border p-4 ${profile.riskLevel === "high" ? "border-amber-300/25 bg-amber-400/[0.08]" : "border-white/10 bg-white/[0.035]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-100">{profile.label}</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{profile.explanation}</p>
            <p className="mt-1 text-xs leading-5 text-cyan-100/80">
              {personalizationProfile.label} personalization · confidence {formatNumber(personalizationProfile.personalityConfidence, 0)}/100
              {personalizationProfile.behavior.topSymbols.length ? ` · watched/viewed: ${personalizationProfile.behavior.topSymbols.slice(0, 3).join(", ")}` : ""}
            </p>
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
              key={candidate.candidate.symbol}
              onAnalyze={() => void runAnalysis(candidate.candidate.symbol)}
              showAnalyze={candidate.candidate.symbol === topCandidate?.symbol}
              loading={analysisLoading && candidate.candidate.symbol === topCandidate?.symbol}
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

function PersonalizedControls({
  personality,
  rewardLevel,
  riskLevel,
  setPersonality,
  setRewardLevel,
  setRiskLevel,
}: {
  personality: RiskPersonalityProfile;
  rewardLevel: RewardLevel;
  riskLevel: RiskLevel;
  setPersonality: (value: RiskPersonalityProfile) => void;
  setRewardLevel: (value: RewardLevel) => void;
  setRiskLevel: (value: RiskLevel) => void;
}) {
  return (
    <div className="grid min-w-[min(100%,520px)] gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)]">
      <label className="min-w-0">
        <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Personality</div>
        <select
          className="h-[46px] w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-xs font-bold text-slate-100 outline-none focus:border-cyan-300/50"
          onChange={(event) => setPersonality(event.currentTarget.value as RiskPersonalityProfile)}
          value={personality}
        >
          {RISK_PERSONALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
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
  candidate: PersonalizedOpportunity;
  loading: boolean;
  onAnalyze: () => void;
  showAnalyze: boolean;
}) {
  const base = candidate.candidate;
  return (
    <article className={`min-w-0 rounded-2xl border p-4 ${candidate.profileFit === "aligned" ? "border-white/10 bg-white/[0.04]" : "border-amber-300/20 bg-amber-400/[0.055]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Personal rank #{candidate.personalizedRank}</div>
          <Link className="mt-1 block font-mono text-2xl font-black text-slate-50 hover:text-cyan-100" href={`/symbol/${base.symbol}`}>{base.symbol}</Link>
        </div>
        <DecisionBadge className="px-2 py-1 text-[10px]" value={base.row.final_decision} />
      </div>
      <div className="mt-2 text-xs font-semibold text-cyan-200">{candidate.personalizedState}</div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{candidate.personalizedReason}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <MiniMetric label="Personalized" value={formatNumber(candidate.personalizedScore, 0)} />
        <MiniMetric label="Base Opp" value={formatNumber(base.aggressiveOpportunityScore, 0)} />
        <MiniMetric label="Asymmetry" value={formatNumber(base.asymmetryScore, 0)} />
        <MiniMetric label="Upside" value={formatNumber(base.upsidePotentialScore, 0)} />
        <MiniMetric label="Downside" value={formatNumber(base.downsideRiskScore, 0)} tone={base.downsideRiskScore >= 70 ? "risk" : "neutral"} />
        <MiniMetric label="Reliability" value={formatNumber(base.reliabilityScore, 0)} />
        <MiniMetric label="Entry Zone" value={base.researchEntryZone} />
        <MiniMetric label="Invalidation" value={base.invalidationZone} tone="risk" />
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/35 p-2 text-[11px] leading-4 text-slate-400">
        <span className="font-semibold text-amber-100">{base.chaseRiskLabel}.</span> {candidate.personalizedWarning}
      </div>
      {candidate.profileConflict ? (
        <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-2 text-[11px] leading-4 text-amber-100">
          {candidate.profileConflict}
        </div>
      ) : null}
      {base.row.narrative ? (
        <div className="mt-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.055] p-2 text-[11px] leading-4 text-slate-300">
          <span className="font-semibold text-cyan-100">Narrative:</span> {base.row.narrative.moderatorSummary}
        </div>
      ) : null}
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
