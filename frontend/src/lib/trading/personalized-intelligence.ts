import {
  buildRiskTolerantOpportunities,
  type RewardLevel,
  type RiskLevel,
  type RiskTolerantOpportunity,
} from "@/lib/trading/risk-tolerant-opportunities";
import {
  DEFAULT_USER_RISK_PROFILE,
  normalizePersonalityProfile,
  normalizePreferenceLevel,
  normalizeRiskProfile,
  type RiskPersonalityProfile,
  type UserRiskProfile,
} from "@/lib/trading/risk-veto";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { NarrativeIntelligence } from "@/lib/trading/narrative-intelligence";
import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { decisionLabel } from "@/lib/ui/labels";

export const RISK_PERSONALITY_OPTIONS: Array<{ description: string; label: string; value: RiskPersonalityProfile }> = [
  { description: "Strict downside control and cleaner entry quality.", label: "Conservative", value: "conservative" },
  { description: "Balanced risk/reward with selective momentum exposure.", label: "Balanced", value: "balanced" },
  { description: "Higher volatility tolerance with explicit chase warnings.", label: "Aggressive", value: "aggressive" },
  { description: "Ranks acceleration and relative strength higher.", label: "Momentum", value: "momentum" },
  { description: "Seeks larger upside relative to measured downside.", label: "Asymmetric Swing", value: "asymmetric_swing" },
  { description: "Accepts two-sided volatility when shock evidence is strong.", label: "Volatility Hunter", value: "volatility_hunter" },
  { description: "Favors capital preservation and lower fragility.", label: "Defensive", value: "defensive" },
  { description: "Watches verified catalysts without treating them as predictions.", label: "Event-Driven", value: "event_driven" },
  { description: "Prefers stable continuation over fresh speculation.", label: "Trend Continuation", value: "trend_continuation" },
  { description: "Waits for pullbacks and improved entry quality.", label: "Pullback Specialist", value: "pullback_specialist" },
];

export type BehaviorLearningSummary = {
  alertEngagement: number;
  ignoredOpportunityCount: number;
  lastUpdated: string | null;
  repeatedSymbolViews: number;
  topSymbols: string[];
  watchlistCount: number;
};

export type UserPersonalizationProfile = {
  asymmetryPreference: number;
  behavior: BehaviorLearningSummary;
  continuationPreference: number;
  description: string;
  drawdownTolerance: number;
  eventPreference: number;
  guardrails: string[];
  label: string;
  momentumPreference: number;
  personality: RiskPersonalityProfile;
  personalityConfidence: number;
  preferredRewardLevel: RewardLevel;
  preferredRiskLevel: RiskLevel;
  pullbackPreference: number;
  source: "behavioral" | "default" | "explicit" | "hybrid";
  volatilityTolerance: number;
};

export type PersonalizedOpportunity = {
  candidate: RiskTolerantOpportunity;
  personalizedRank: number;
  personalizedReason: string;
  personalizedScore: number;
  personalizedState: string;
  personalizedWarning: string;
  profileConflict: string | null;
  profileFit: "aligned" | "conflict" | "partial";
};

export type PersonalizedSignalFit = {
  conflictReason: string;
  fitLabel: string;
  fitReason: string;
  monitorNext: string[];
  profileWarning: string;
};

const DEFAULT_BEHAVIOR: BehaviorLearningSummary = {
  alertEngagement: 0,
  ignoredOpportunityCount: 0,
  lastUpdated: null,
  repeatedSymbolViews: 0,
  topSymbols: [],
  watchlistCount: 0,
};

export function buildUserPersonalizationProfile(input: {
  behavior?: Partial<BehaviorLearningSummary> | null;
  profile?: Partial<UserRiskProfile> | null;
  source?: UserPersonalizationProfile["source"];
} = {}): UserPersonalizationProfile {
  const profile = normalizeRiskProfile(input.profile);
  const behavior = normalizeBehaviorSummary(input.behavior);
  const personality = normalizePersonalityProfile(profile.personalityProfile);
  const definition = RISK_PERSONALITY_OPTIONS.find((item) => item.value === personality) ?? RISK_PERSONALITY_OPTIONS[1];
  const riskReward = personalityRiskReward(personality, profile.preferredRiskLevel, profile.preferredRewardLevel);
  const learnedConfidence = behavior.repeatedSymbolViews >= 8 || behavior.watchlistCount >= 5 ? 12 : behavior.repeatedSymbolViews >= 3 ? 6 : 0;
  const confidence = clamp(profile.personalityConfidence + learnedConfidence);

  return {
    asymmetryPreference: profile.asymmetryPreference,
    behavior,
    continuationPreference: profile.continuationPreference,
    description: definition.description,
    drawdownTolerance: profile.drawdownTolerance,
    eventPreference: profile.eventPreference,
    guardrails: guardrailsFor(personality),
    label: definition.label,
    momentumPreference: profile.momentumPreference,
    personality,
    personalityConfidence: confidence,
    preferredRewardLevel: riskReward.rewardLevel,
    preferredRiskLevel: riskReward.riskLevel,
    pullbackPreference: profile.pullbackPreference,
    source: input.source ?? "explicit",
    volatilityTolerance: profile.volatilityTolerance,
  };
}

export function defaultPersonalizationProfile(): UserPersonalizationProfile {
  return buildUserPersonalizationProfile({ profile: DEFAULT_USER_RISK_PROFILE, source: "default" });
}

export function personalityRiskReward(personality: RiskPersonalityProfile, riskLevel?: unknown, rewardLevel?: unknown): { riskLevel: RiskLevel; rewardLevel: RewardLevel } {
  const preferredRisk = normalizePreferenceLevel(riskLevel) as RiskLevel;
  const preferredReward = normalizePreferenceLevel(rewardLevel) as RewardLevel;
  if (personality === "conservative" || personality === "defensive" || personality === "pullback_specialist") {
    return { riskLevel: preferredRisk === "high" ? "medium" : preferredRisk, rewardLevel: preferredReward };
  }
  if (personality === "aggressive" || personality === "volatility_hunter") {
    return { riskLevel: preferredRisk === "low" ? "medium" : preferredRisk, rewardLevel: preferredReward === "low" ? "medium" : preferredReward };
  }
  if (personality === "momentum" || personality === "asymmetric_swing" || personality === "event_driven") {
    return { riskLevel: preferredRisk, rewardLevel: preferredReward === "low" ? "medium" : preferredReward };
  }
  return { riskLevel: preferredRisk, rewardLevel: preferredReward };
}

export function buildPersonalizedOpportunities(
  rows: OpportunityViewModel[],
  profile: UserPersonalizationProfile,
  options: { includeProfileMismatches?: boolean; limit?: number } = {},
): PersonalizedOpportunity[] {
  const candidates = buildRiskTolerantOpportunities(
    rows,
    { riskLevel: profile.preferredRiskLevel, rewardLevel: profile.preferredRewardLevel },
    { includeProfileMismatches: true, limit: Math.max(options.limit ?? 10, 25) },
  );
  const personalized = candidates
    .map((candidate) => personalizeCandidate(candidate, profile))
    .filter((candidate) => options.includeProfileMismatches || candidate.profileFit !== "conflict")
    .sort((left, right) => right.personalizedScore - left.personalizedScore || right.candidate.reliabilityScore - left.candidate.reliabilityScore || left.candidate.symbol.localeCompare(right.candidate.symbol))
    .map((candidate, index) => ({
      ...candidate,
      candidate: { ...candidate.candidate, riskTolerantRank: index + 1 },
      personalizedRank: index + 1,
    }));
  return typeof options.limit === "number" ? personalized.slice(0, options.limit) : personalized;
}

export function personalizeCandidate(candidate: RiskTolerantOpportunity, profile: UserPersonalizationProfile): PersonalizedOpportunity {
  const setup = candidate.setupType.toUpperCase();
  const shock = candidate.historicalShockSupport;
  const row = candidate.row;
  let score = candidate.aggressiveOpportunityScore;
  score += preferenceBonus(profile.momentumPreference, candidate.currentMomentumScore);
  score += preferenceBonus(profile.asymmetryPreference, candidate.asymmetryScore);
  score += preferenceBonus(profile.continuationPreference, setup === "CONTINUATION" ? 76 : setup === "BREAKOUT" ? 58 : 45);
  score += preferenceBonus(profile.pullbackPreference, setup === "PULLBACK" ? 80 : candidate.chaseRiskScore <= 42 ? 58 : 36);
  score += preferenceBonus(profile.eventPreference, row.eventRisk);
  score += preferenceBonus(profile.volatilityTolerance, shock);
  if (profile.personality === "volatility_hunter") {
    score += Math.max(0, candidate.historicalShockSupport - 55) * 0.45;
    score += Math.max(0, candidate.upsidePotentialScore - 60) * 0.22;
    score -= Math.max(0, 58 - candidate.historicalShockSupport) * 0.35;
  }
  if (profile.personality === "conservative" || profile.personality === "defensive") {
    score -= Math.max(0, candidate.chaseRiskScore - 45) * 0.24;
  }
  score -= Math.max(0, candidate.downsideRiskScore - profile.drawdownTolerance) * (profile.personality === "conservative" || profile.personality === "defensive" ? 0.34 : 0.18);
  score -= candidate.chaseRiskScore >= 76 && profile.personality !== "aggressive" && profile.personality !== "volatility_hunter" ? 8 : 0;

  const conflict = conflictReason(candidate, profile);
  const fit = conflict ? "conflict" : candidate.profileMatched ? "aligned" : "partial";
  const state = personalizedState(candidate, profile);
  return {
    candidate,
    personalizedRank: candidate.riskTolerantRank,
    personalizedReason: personalizedReason(candidate, profile, state),
    personalizedScore: Math.round(clamp(score)),
    personalizedState: state,
    personalizedWarning: personalizedWarning(candidate, profile),
    profileConflict: conflict,
    profileFit: fit,
  };
}

export function personalizedSignalFit(row: RankingRow, narrative: NarrativeIntelligence | null, profile: UserPersonalizationProfile): PersonalizedSignalFit {
  const fragility = finiteNumber(row.fragility_score ?? row.risk_score ?? row.event_risk_score) ?? 50;
  const eventRisk = finiteNumber(row.event_risk_score) ?? 50;
  const setup = cleanText(row.setup_type, "current setup").toLowerCase();
  const decision = decisionLabel(row.final_decision);
  const highFragility = fragility >= Math.max(62, profile.drawdownTolerance + 10);
  const highEvent = eventRisk >= 70 && profile.eventPreference < 65;
  const momentumFit = /breakout|momentum|continuation|trend/i.test(setup) && profile.momentumPreference >= 58;
  const pullbackFit = /pullback|avwap|correction/i.test(setup) && profile.pullbackPreference >= 58;
  const volatilityFit = eventRisk >= 68 && profile.volatilityTolerance >= 68;
  const aligned = momentumFit || pullbackFit || volatilityFit || (!highFragility && decision !== "Avoid");
  const fitLabel = aligned && !highFragility ? "Profile aligned" : aligned ? "Partially aligned" : "Profile conflict";
  const narrativeText = narrative?.moderatorSummary ?? narrative?.narrativeSummary ?? "Narrative cache is still building for this symbol.";
  return {
    conflictReason: highFragility
      ? `${profile.label} has lower tolerance for this setup's fragility.`
      : highEvent
        ? `${profile.label} is less tolerant of current verified event pressure.`
        : `${profile.label} does not strongly favor this setup type yet.`,
    fitLabel,
    fitReason: aligned
      ? `${row.symbol} fits ${profile.label.toLowerCase()} because ${setup} evidence is compatible with the selected preference mix. ${narrativeText}`
      : `${row.symbol} is still visible, but ${profile.label.toLowerCase()} would rank cleaner alternatives ahead of it.`,
    monitorNext: [
      "Whether fragility improves without chase risk increasing.",
      "Whether macro/event pressure aligns with your selected style.",
      "Whether the setup returns toward a research entry zone instead of extending.",
    ],
    profileWarning: personalizedSafetyLanguage(profile, highFragility || highEvent),
  };
}

export function personalizedSafetyLanguage(profile: UserPersonalizationProfile, elevated = false): string {
  const base = `${profile.label} personalization changes ranking and framing, not the underlying scanner decision.`;
  return elevated
    ? `${base} Risk remains elevated; this is research context and not financial advice.`
    : `${base} Continue to treat all outputs as probabilistic research, not financial advice.`;
}

function normalizeBehaviorSummary(value: Partial<BehaviorLearningSummary> | null | undefined): BehaviorLearningSummary {
  return {
    alertEngagement: Math.max(0, Math.floor(finiteNumber(value?.alertEngagement) ?? DEFAULT_BEHAVIOR.alertEngagement)),
    ignoredOpportunityCount: Math.max(0, Math.floor(finiteNumber(value?.ignoredOpportunityCount) ?? DEFAULT_BEHAVIOR.ignoredOpportunityCount)),
    lastUpdated: typeof value?.lastUpdated === "string" ? value.lastUpdated : DEFAULT_BEHAVIOR.lastUpdated,
    repeatedSymbolViews: Math.max(0, Math.floor(finiteNumber(value?.repeatedSymbolViews) ?? DEFAULT_BEHAVIOR.repeatedSymbolViews)),
    topSymbols: Array.isArray(value?.topSymbols) ? value.topSymbols.map((item) => String(item).trim().toUpperCase()).filter(Boolean).slice(0, 8) : [],
    watchlistCount: Math.max(0, Math.floor(finiteNumber(value?.watchlistCount) ?? DEFAULT_BEHAVIOR.watchlistCount)),
  };
}

function preferenceBonus(preference: number, score: number): number {
  return ((preference - 50) / 50) * ((score - 50) / 50) * 9;
}

function conflictReason(candidate: RiskTolerantOpportunity, profile: UserPersonalizationProfile): string | null {
  if ((profile.personality === "conservative" || profile.personality === "defensive") && candidate.downsideRiskScore >= 72) {
    return "Downside risk is above this profile's tolerance.";
  }
  if (profile.personality === "pullback_specialist" && candidate.chaseRiskScore >= 64) {
    return "The setup is too chase-prone for a pullback-first profile.";
  }
  if (profile.personality === "volatility_hunter" && candidate.historicalShockSupport < 55) {
    return "Large-move history is limited for a volatility-first profile.";
  }
  if (profile.personality === "event_driven" && candidate.row.eventRisk < 55) {
    return "Verified event pressure is not central enough for this profile.";
  }
  return null;
}

function personalizedState(candidate: RiskTolerantOpportunity, profile: UserPersonalizationProfile): string {
  if (candidate.chaseRiskScore >= 76 && profile.personality !== "volatility_hunter") return "Avoid Chase";
  if (profile.personality === "pullback_specialist") return "Pullback Watch";
  if (profile.personality === "volatility_hunter" && candidate.historicalShockSupport >= 65) return "Shock Watch";
  if (profile.personality === "asymmetric_swing" && candidate.asymmetryScore >= 68) return "Asymmetric Watch";
  if (profile.personality === "momentum" && candidate.currentMomentumScore >= 68) return "Momentum Watch";
  if (profile.personality === "conservative" || profile.personality === "defensive") return candidate.downsideRiskScore <= 58 ? "Cleaner Watch" : "Risk Review";
  return candidate.opportunityType;
}

function personalizedReason(candidate: RiskTolerantOpportunity, profile: UserPersonalizationProfile, state: string): string {
  return `${candidate.symbol} ranks as ${state.toLowerCase()} for ${profile.label.toLowerCase()} because ${candidate.keyReason}`;
}

function personalizedWarning(candidate: RiskTolerantOpportunity, profile: UserPersonalizationProfile): string {
  if (candidate.chaseRiskScore >= 70) return `${profile.label} mode still flags elevated late-entry risk. Wait for cleaner confirmation or entry timing.`;
  if (candidate.downsideRiskScore >= 72) return `${profile.label} mode sees elevated downside risk. Size and break-area discipline matter.`;
  if (candidate.profileMatched) return `${profile.label} mode is aligned, but this remains research only and not financial advice.`;
  return `${profile.label} mode shows partial fit. The symbol remains visible for context, not as a core action.`;
}

function guardrailsFor(personality: RiskPersonalityProfile): string[] {
  if (personality === "aggressive" || personality === "volatility_hunter") {
    return ["Show downside and late-entry risk before upside language.", "Never upgrade speculative watches into main TradeVeto signals.", "Require fresh data and a clear break area."];
  }
  if (personality === "conservative" || personality === "defensive") {
    return ["Prefer lower fragility and cleaner entry timing.", "Reject high downside risk even when momentum is strong.", "Preserve WAIT framing when evidence is incomplete."];
  }
  if (personality === "pullback_specialist") {
    return ["Penalize late entries and extended breakouts.", "Prefer pullback stabilization over momentum chasing.", "Highlight proximity to the break area."];
  }
  return ["Keep the scanner decision visible.", "Show both fit and conflict evidence.", "Use research language only."];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
