import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { buildDecisionIntelligence } from "@/lib/trading/decision-intelligence";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber, formatMoney } from "@/lib/ui/formatters";
import { decisionLabel, humanizeInsightText } from "@/lib/ui/labels";

export type RiskLevel = "low" | "medium" | "high";
export type RewardLevel = "low" | "medium" | "high";

export type RiskRewardPreference = {
  riskLevel: RiskLevel;
  rewardLevel: RewardLevel;
};

export type RiskRewardProfile = RiskRewardPreference & {
  acceptableFragility: number;
  allowsSpeculativeVolatility: boolean;
  chaseRiskTolerance: number;
  explanation: string;
  inefficient: boolean;
  label: string;
  maxDownsideRisk: number;
  minReliability: number;
  minUpsidePotential: number;
  preferredSetupTypes: string[];
  warning: string;
};

export type RiskTolerantOpportunity = {
  aggressiveOpportunityScore: number;
  asymmetryScore: number;
  averageDrawdownRisk: string;
  averageUpsidePotential: string;
  chaseRiskLabel: string;
  chaseRiskScore: number;
  currentDecision: string;
  currentMomentumScore: number;
  doNotChaseZone: string;
  downsideRiskScore: number;
  historicalExitZone: string;
  historicalShockSupport: number;
  invalidationZone: string;
  keyReason: string;
  keyReasons: string[];
  keyRisk: string;
  keyRisks: string[];
  macroSectorSupport: number;
  opportunityType: string;
  profileFitLabel: string;
  profileMatched: boolean;
  reliabilityScore: number;
  researchEntryZone: string;
  rewardRiskScore: number;
  riskTolerantRank: number;
  row: OpportunityViewModel;
  setupType: string;
  shockPatternAvailable: boolean;
  symbol: string;
  upsidePotentialScore: number;
};

export type RiskTolerantOpportunityPacket = {
  candidate: {
    aggressiveOpportunityScore: number;
    averageDrawdownRisk: string;
    averageUpsidePotential: string;
    chaseRiskScore: number;
    currentDecision: string;
    currentMomentumScore: number;
    downsideRiskScore: number;
    historicalShockSupport: number;
    macroSectorSupport: number;
    opportunityType: string;
    reliabilityScore: number;
    rewardRiskScore: number;
    riskTolerantRank: number;
    shockPatternAvailable: boolean;
    symbol: string;
    upsidePotentialScore: number;
  };
  dataFreshness: {
    label: string;
    lastUpdated: string | null;
    message: string;
    status: string;
  };
  deterministicReasons: {
    keyReasons: string[];
    keyRisks: string[];
  };
  levels: {
    doNotChaseZone: string;
    historicalExitZone: string;
    invalidationZone: string;
    researchEntryZone: string;
  };
  marketMemory: {
    available: boolean;
    evidenceLabel: string;
    narrative: string[];
    sampleSize: number;
  } | null;
  personalization?: {
    behaviorSummary: {
      repeatedSymbolViews: number;
      topSymbols: string[];
      watchlistCount: number;
    };
    drawdownTolerance: number;
    label: string;
    personality: string;
    personalityConfidence: number;
    preferredRewardLevel: RewardLevel;
    preferredRiskLevel: RiskLevel;
    volatilityTolerance: number;
  };
  preference: RiskRewardProfile;
  shockMetrics: {
    asymmetryScore: number | null;
    averageDrawdownAfterEntry: string | null;
    averageProfitPotential: string | null;
    chaseRiskLabel: string | null;
    currentSimilarityScore: number | null;
    downsideRiskScore: number | null;
    doNotChaseZone: string | null;
    historicalExitZone: string | null;
    invalidationZone: string | null;
    latestEventDate: string | null;
    opportunityScore: number | null;
    opportunityState: string | null;
    reliabilityScore: number | null;
    researchEntryZone: string | null;
    shockEventSampleSize: number | null;
    twoSidedVolatilityScore: number | null;
    upsideShockScore: number | null;
  };
  rawEvidence: {
    baseScore: number | null;
    convictionScore: number;
    analogQualityScore: number | null;
    confidenceReliability: number | null;
    evidenceMaturity: string;
    evidenceSampleSize: number | null;
    exchangeHealthScore: number | null;
    eventContext: string;
    finalScore: number | null;
    fragilityScore: number;
    historicalDepthDays: number | null;
    lastUpdated: string | null;
    liquidityPressure: number | null;
    macroContext: string;
    macroAlignmentScore: number | null;
    outcomeCoverage: number | null;
    price: number | null;
    relativeVolume: number | null;
    riskReward: number | null;
    sectorAlignmentScore: number | null;
    setupType: string;
    technicalScore: number | null;
    volatilityPressure: number | null;
    volume: number | null;
  };
};

export function riskRewardProfile(preference: RiskRewardPreference): RiskRewardProfile {
  const key = `${preference.riskLevel}/${preference.rewardLevel}`;
  const base: Record<string, Omit<RiskRewardProfile, "riskLevel" | "rewardLevel">> = {
    "low/low": {
      acceptableFragility: 42,
      allowsSpeculativeVolatility: false,
      chaseRiskTolerance: 36,
      explanation: "Strict quality mode: prefers cleaner entries, lower failure risk, and modest upside.",
      inefficient: false,
      label: "Low Risk / Low Reward",
      maxDownsideRisk: 46,
      minReliability: 60,
      minUpsidePotential: 42,
      preferredSetupTypes: ["PULLBACK", "CONTINUATION"],
      warning: "Low-risk mode may show fewer symbols because quality gates stay strict.",
    },
    "low/medium": {
      acceptableFragility: 48,
      allowsSpeculativeVolatility: false,
      chaseRiskTolerance: 42,
      explanation: "Quality-first mode: prefers relative strength and pullback candidates with controlled downside.",
      inefficient: false,
      label: "Low Risk / Medium Reward",
      maxDownsideRisk: 52,
      minReliability: 62,
      minUpsidePotential: 50,
      preferredSetupTypes: ["PULLBACK", "CONTINUATION"],
      warning: "Lower-risk filters can reject otherwise attractive momentum names if chase risk is elevated.",
    },
    "low/high": {
      acceptableFragility: 46,
      allowsSpeculativeVolatility: false,
      chaseRiskTolerance: 40,
      explanation: "Asymmetric mode: only exceptional setups should pass because low risk and high reward rarely coexist.",
      inefficient: false,
      label: "Low Risk / High Reward",
      maxDownsideRisk: 48,
      minReliability: 70,
      minUpsidePotential: 72,
      preferredSetupTypes: ["PULLBACK", "CONTINUATION"],
      warning: "No low-risk/high-reward setup should be forced if evidence quality is not exceptional.",
    },
    "medium/low": {
      acceptableFragility: 54,
      allowsSpeculativeVolatility: false,
      chaseRiskTolerance: 48,
      explanation: "Balanced defensive mode: allows moderate uncertainty only when downside and chase risk remain contained.",
      inefficient: false,
      label: "Medium Risk / Low Reward",
      maxDownsideRisk: 58,
      minReliability: 54,
      minUpsidePotential: 44,
      preferredSetupTypes: ["PULLBACK", "CONTINUATION", "BREAKOUT"],
      warning: "This profile prioritizes cleaner structure over maximum upside.",
    },
    "medium/medium": {
      acceptableFragility: 62,
      allowsSpeculativeVolatility: false,
      chaseRiskTolerance: 58,
      explanation: "Balanced mode: accepts some failure risk when momentum, entry quality, and reliability line up.",
      inefficient: false,
      label: "Medium Risk / Medium Reward",
      maxDownsideRisk: 66,
      minReliability: 50,
      minUpsidePotential: 52,
      preferredSetupTypes: ["PULLBACK", "CONTINUATION", "BREAKOUT"],
      warning: "Balanced mode still penalizes overheated or chase-prone structures.",
    },
    "medium/high": {
      acceptableFragility: 68,
      allowsSpeculativeVolatility: true,
      chaseRiskTolerance: 66,
      explanation: "Growth mode: favors momentum, pullback, and event-supported candidates when downside is still measurable.",
      inefficient: false,
      label: "Medium Risk / High Reward",
      maxDownsideRisk: 72,
      minReliability: 48,
      minUpsidePotential: 64,
      preferredSetupTypes: ["BREAKOUT", "CONTINUATION", "PULLBACK"],
      warning: "Higher reward targets require explicit downside and chase-risk awareness.",
    },
    "high/low": {
      acceptableFragility: 52,
      allowsSpeculativeVolatility: false,
      chaseRiskTolerance: 42,
      explanation: "Inefficient profile: accepting high risk for low reward is usually unattractive, so filters stay very selective.",
      inefficient: true,
      label: "High Risk / Low Reward",
      maxDownsideRisk: 48,
      minReliability: 58,
      minUpsidePotential: 46,
      preferredSetupTypes: ["PULLBACK"],
      warning: "High risk with low reward is an inefficient profile. TradeVeto will avoid filling the list with weak setups.",
    },
    "high/medium": {
      acceptableFragility: 76,
      allowsSpeculativeVolatility: true,
      chaseRiskTolerance: 74,
      explanation: "Aggressive balanced mode: can rank faster-moving names, but still penalizes stale data, weak reliability, and obvious chase risk.",
      inefficient: false,
      label: "High Risk / Medium Reward",
      maxDownsideRisk: 82,
      minReliability: 38,
      minUpsidePotential: 54,
      preferredSetupTypes: ["BREAKOUT", "CONTINUATION", "PULLBACK", "VOLATILITY"],
      warning: "Speculative opportunity mode. Elevated downside risk is expected and must be monitored.",
    },
    "high/high": {
      acceptableFragility: 86,
      allowsSpeculativeVolatility: true,
      chaseRiskTolerance: 84,
      explanation: "Speculative high-upside mode: ranks large-move, momentum, and relative-strength candidates without treating them as main TradeVeto signals.",
      inefficient: false,
      label: "High Risk / High Reward",
      maxDownsideRisk: 88,
      minReliability: 34,
      minUpsidePotential: 62,
      preferredSetupTypes: ["BREAKOUT", "CONTINUATION", "VOLATILITY", "PULLBACK"],
      warning: "Speculative opportunity mode. Higher upside potential comes with elevated downside risk.",
    },
  };
  return {
    ...base[key],
    riskLevel: preference.riskLevel,
    rewardLevel: preference.rewardLevel,
  };
}

export function buildRiskTolerantOpportunities(
  rows: OpportunityViewModel[],
  preference: RiskRewardPreference,
  options: { includeProfileMismatches?: boolean; limit?: number } = {},
): RiskTolerantOpportunity[] {
  const profile = riskRewardProfile(preference);
  const ranked = rows
    .map((row) => buildRiskTolerantOpportunity(row, profile))
    .filter((candidate): candidate is RiskTolerantOpportunity => candidate !== null)
    .filter((candidate) => options.includeProfileMismatches || candidate.profileMatched)
    .sort((left, right) => right.aggressiveOpportunityScore - left.aggressiveOpportunityScore || right.reliabilityScore - left.reliabilityScore || left.symbol.localeCompare(right.symbol))
    .map((candidate, index) => ({ ...candidate, riskTolerantRank: index + 1 }));
  return typeof options.limit === "number" ? ranked.slice(0, options.limit) : ranked;
}

export function buildRiskTolerantOpportunity(row: OpportunityViewModel, profile: RiskRewardProfile): RiskTolerantOpportunity | null {
  if (!qualityGuardrail(row)) return null;
  const intelligence = buildDecisionIntelligence(row.raw);
  const setup = setupType(row);
  const shock = historicalShockSupport(row);
  const upside = upsidePotentialScore(row, shock);
  const momentum = currentMomentumScore(row);
  const macroSector = macroSectorSupport(row);
  const chase = chaseRiskScore(row, setup, momentum);
  const downside = downsideRiskScore(row, chase);
  const entryQuality = entryQualityScore(row, chase);
  const reliability = reliabilityScore(row, downside, chase);
  const asymmetry = asymmetryScore(row);
  const rewardRisk = clamp(upside * 0.38 + asymmetry * 0.12 + entryQuality * 0.16 + reliability * 0.17 + macroSector * 0.1 - downside * 0.18 - chase * 0.12 + (setupPreferenceBonus(setup, profile) * 0.08));
  const aggressive = profileAdjustedScore({
    chase,
    downside,
    entryQuality,
    macroSector,
    momentum,
    profile,
    reliability,
    rewardRisk,
    setup,
    shock,
    asymmetry,
    upside,
  });
  const profileMatched = profileMatch({ chase, downside, profile, reliability, setup, upside });
  const opportunityType = opportunityTypeFor({ row, setup, shock, downside, eventShock: eventShockScore(row), macroSector, momentum });
  const reasons = keyReasons({ row, setup, shock, upside, momentum, macroSector, reliability, opportunityType });
  const risks = keyRisks({ row, chase, downside, profile });
  return {
    aggressiveOpportunityScore: Math.round(aggressive),
    asymmetryScore: Math.round(asymmetry),
    averageDrawdownRisk: averageDrawdownRisk(row, downside),
    averageUpsidePotential: averageUpsidePotential(row, upside),
    chaseRiskLabel: chaseRiskLabel(chase),
    chaseRiskScore: Math.round(chase),
    currentDecision: decisionLabel(row.final_decision),
    currentMomentumScore: Math.round(momentum),
    doNotChaseZone: doNotChaseZone(row),
    downsideRiskScore: Math.round(downside),
    historicalExitZone: historicalExitZone(row),
    historicalShockSupport: Math.round(shock),
    invalidationZone: invalidationZone(row),
    keyReason: reasons[0] ?? "Risk-tolerant ranking is based on current scanner evidence.",
    keyReasons: reasons,
    keyRisk: risks[0] ?? "Risk remains elevated because this is not a core conservative signal.",
    keyRisks: risks,
    macroSectorSupport: Math.round(macroSector),
    opportunityType,
    profileFitLabel: profileMatched ? "Fits selected profile" : profile.inefficient ? "Profile inefficient" : "Below selected profile quality",
    profileMatched,
    reliabilityScore: Math.round(reliability),
    researchEntryZone: researchEntryZone(row),
    rewardRiskScore: Math.round(rewardRisk),
    riskTolerantRank: 0,
    row,
    setupType: setup,
    shockPatternAvailable: row.shockPattern !== null,
    symbol: row.symbol,
    upsidePotentialScore: Math.round(upside),
  };
}

export function buildRiskTolerantOpportunityPacket(
  candidate: RiskTolerantOpportunity,
  profile: RiskRewardProfile,
  memory: MarketMemorySummary | null = null,
  personalization?: RiskTolerantOpportunityPacket["personalization"],
): RiskTolerantOpportunityPacket {
  return {
    candidate: {
      aggressiveOpportunityScore: candidate.aggressiveOpportunityScore,
      averageDrawdownRisk: candidate.averageDrawdownRisk,
      averageUpsidePotential: candidate.averageUpsidePotential,
      chaseRiskScore: candidate.chaseRiskScore,
      currentDecision: candidate.currentDecision,
      currentMomentumScore: candidate.currentMomentumScore,
      downsideRiskScore: candidate.downsideRiskScore,
      historicalShockSupport: candidate.historicalShockSupport,
      macroSectorSupport: candidate.macroSectorSupport,
      opportunityType: candidate.opportunityType,
      reliabilityScore: candidate.reliabilityScore,
      rewardRiskScore: candidate.rewardRiskScore,
      riskTolerantRank: candidate.riskTolerantRank,
      shockPatternAvailable: candidate.shockPatternAvailable,
      symbol: candidate.symbol,
      upsidePotentialScore: candidate.upsidePotentialScore,
    },
    dataFreshness: {
      label: candidate.row.dataFreshness.label,
      lastUpdated: candidate.row.dataFreshness.lastUpdated,
      message: candidate.row.dataFreshness.message,
      status: candidate.row.dataFreshness.status,
    },
    deterministicReasons: {
      keyReasons: candidate.keyReasons,
      keyRisks: candidate.keyRisks,
    },
    levels: {
      doNotChaseZone: candidate.doNotChaseZone,
      historicalExitZone: candidate.historicalExitZone,
      invalidationZone: candidate.invalidationZone,
      researchEntryZone: candidate.researchEntryZone,
    },
    marketMemory: memory ? {
      available: memory.available,
      evidenceLabel: memory.evidence.label,
      narrative: memory.narrative.slice(0, 3),
      sampleSize: memory.evidence.sampleSize,
    } : null,
    personalization,
    preference: profile,
    shockMetrics: {
      asymmetryScore: candidate.row.shockPattern?.asymmetryScore ?? null,
      averageDrawdownAfterEntry: candidate.row.shockPattern?.averageDrawdownAfterEntry ?? null,
      averageProfitPotential: candidate.row.shockPattern?.averageProfitPotential ?? null,
      chaseRiskLabel: candidate.row.shockPattern?.chaseRiskLabel ?? null,
      currentSimilarityScore: candidate.row.shockPattern?.currentSimilarityScore ?? null,
      downsideRiskScore: candidate.row.shockPattern?.downsideRiskScore ?? null,
      doNotChaseZone: candidate.row.shockPattern?.doNotChaseZone ?? null,
      historicalExitZone: candidate.row.shockPattern?.historicalExitZone ?? null,
      invalidationZone: candidate.row.shockPattern?.invalidationZone ?? null,
      latestEventDate: candidate.row.shockPattern?.latestEvent?.eventDate ?? null,
      opportunityScore: candidate.row.shockPattern?.opportunityScore ?? null,
      opportunityState: candidate.row.shockPattern?.opportunityState ?? null,
      reliabilityScore: candidate.row.shockPattern?.reliabilityScore ?? null,
      researchEntryZone: candidate.row.shockPattern?.researchEntryZone ?? null,
      // The count rather than the array: same number, and it survives the strip.
      shockEventSampleSize: candidate.row.shockPattern?.shockEventCount ?? null,
      twoSidedVolatilityScore: candidate.row.shockPattern?.twoSidedVolatilityScore ?? null,
      upsideShockScore: candidate.row.shockPattern?.upsideShockScore ?? null,
    },
    rawEvidence: {
      baseScore: numberField(candidate.row.raw.base_score),
      analogQualityScore: candidate.row.evidence?.analogQualityScore ?? null,
      convictionScore: candidate.row.conviction,
      confidenceReliability: candidate.row.evidence?.confidenceReliability ?? null,
      evidenceMaturity: candidate.row.evidence?.label ?? "Evidence building",
      evidenceSampleSize: candidate.row.evidence?.evidenceSampleSize ?? null,
      exchangeHealthScore: numberField(candidate.row.raw.exchange_health_score),
      eventContext: candidate.row.eventLabel,
      finalScore: candidate.row.final_score,
      fragilityScore: candidate.row.fragility,
      historicalDepthDays: candidate.row.evidence?.historicalDepthDays ?? null,
      lastUpdated: candidate.row.dataFreshness.lastUpdated,
      liquidityPressure: numberField(candidate.row.raw.liquidity_pressure),
      macroContext: candidate.row.macroLabel,
      macroAlignmentScore: numberField(candidate.row.raw.macro_alignment_score),
      outcomeCoverage: candidate.row.evidence?.outcomeCoverage ?? null,
      price: candidate.row.price,
      relativeVolume: numberField(candidate.row.raw.relative_volume ?? candidate.row.raw.rel_volume ?? candidate.row.raw.volume_spike_ratio),
      riskReward: numberField(candidate.row.raw.risk_reward),
      sectorAlignmentScore: numberField(candidate.row.raw.sector_alignment_score),
      setupType: candidate.setupType,
      technicalScore: numberField(candidate.row.raw.technical_score),
      volatilityPressure: numberField(candidate.row.raw.volatility_pressure),
      volume: numberField(candidate.row.raw.volume),
    },
  };
}

export function deterministicOpportunityExplanation(packet: RiskTolerantOpportunityPacket): string {
  const freshness = packet.dataFreshness.status === "fresh" || packet.dataFreshness.status === "slightly_stale"
    ? `Data freshness is ${packet.dataFreshness.label.toLowerCase()}.`
    : `Data is ${packet.dataFreshness.label.toLowerCase()}, so confidence should be reduced.`;
  const reason = humanizeInsightText(packet.deterministicReasons.keyReasons[0] ?? "current scanner evidence");
  const risk = humanizeInsightText(packet.deterministicReasons.keyRisks[0] ?? "elevated downside risk");
  return `${packet.candidate.symbol} ranks #${packet.candidate.riskTolerantRank} for ${packet.preference.label.toLowerCase()} because ${reason}. ${risk}. ${freshness} This is a higher-risk watchlist idea, not a main TradeVeto signal or financial advice.`;
}

function qualityGuardrail(row: OpportunityViewModel): boolean {
  if (!row.symbol || row.symbol === "N/A") return false;
  if (row.price === null || row.price <= 0) return false;
  if (row.final_score === null && numberField(row.raw.technical_score) === null) return false;
  if (row.dataFreshness.status === "missing" || row.dataFreshness.status === "schema_mismatch") return false;
  if (Boolean(row.raw.data_provider_fallback_used) && row.dataFreshness.status === "stale") return false;
  return true;
}

function profileAdjustedScore(input: {
  chase: number;
  downside: number;
  entryQuality: number;
  macroSector: number;
  momentum: number;
  profile: RiskRewardProfile;
  reliability: number;
  rewardRisk: number;
  setup: string;
  shock: number;
  asymmetry: number;
  upside: number;
}): number {
  const riskWeight = input.profile.riskLevel === "low" ? 0.28 : input.profile.riskLevel === "medium" ? 0.16 : 0.08;
  const rewardWeight = input.profile.rewardLevel === "high" ? 0.30 : input.profile.rewardLevel === "medium" ? 0.22 : 0.14;
  const volatilityWeight = input.profile.allowsSpeculativeVolatility ? 0.16 : 0.04;
  let score =
    input.upside * rewardWeight +
    input.asymmetry * (input.profile.rewardLevel === "high" ? 0.12 : 0.06) +
    input.momentum * 0.17 +
    input.shock * volatilityWeight +
    input.macroSector * 0.12 +
    input.entryQuality * 0.14 +
    input.reliability * 0.17 +
    input.rewardRisk * 0.14 -
    input.downside * riskWeight -
    input.chase * (input.profile.riskLevel === "high" ? 0.07 : 0.15);
  score += setupPreferenceBonus(input.setup, input.profile) * 0.08;
  if (input.profile.inefficient) score -= 16;
  return clamp(score);
}

function profileMatch(input: { chase: number; downside: number; profile: RiskRewardProfile; reliability: number; setup: string; upside: number }): boolean {
  if (input.reliability < input.profile.minReliability) return false;
  if (input.upside < input.profile.minUpsidePotential) return false;
  if (input.downside > input.profile.maxDownsideRisk) return false;
  if (input.chase > input.profile.chaseRiskTolerance) return false;
  if (!input.profile.allowsSpeculativeVolatility && input.setup === "VOLATILITY") return false;
  return true;
}

function setupPreferenceBonus(setup: string, profile: RiskRewardProfile): number {
  return profile.preferredSetupTypes.includes(setup) ? 80 : setup === "AVOID" ? 20 : 45;
}

function setupType(row: OpportunityViewModel): string {
  const raw = cleanText(row.raw.setup_type, "AVOID").toUpperCase().replace(/[\s-]+/g, "_");
  if ((row.shockPattern?.upsideShockScore ?? 0) >= 70 || eventShockScore(row) >= 72 || raw.includes("VOLATILITY") || raw.includes("SHOCK")) return "VOLATILITY";
  if (raw.includes("PULLBACK") || raw.includes("AVWAP")) return "PULLBACK";
  if (raw.includes("BREAKOUT")) return "BREAKOUT";
  if (raw.includes("CONTINUATION") || raw.includes("TREND")) return "CONTINUATION";
  return "AVOID";
}

function upsidePotentialScore(row: OpportunityViewModel, shock: number): number {
  const rr = numberField(row.raw.risk_reward);
  const aggressiveLow = numberField(row.raw.aggressive_risk_reward_low);
  const aggressiveHigh = numberField(row.raw.aggressive_risk_reward_high);
  const rrScore = clamp(((rr ?? average([aggressiveLow, aggressiveHigh], 1.0)) ?? 1.0) * 28);
  const targetGap = percentGap(row.price, numberField(row.raw.take_profit_high ?? row.raw.target_price ?? row.raw.conservative_target));
  const targetScore = targetGap === null ? 48 : clamp(targetGap * 8);
  const eventShock = eventShockScore(row);
  const returnScore = clamp(50 + (numberField(row.raw.return_1d) ?? 0) * 5);
  const patternUpside = row.shockPattern ? average([row.shockPattern.upsideShockScore, row.shockPattern.asymmetryScore, row.shockPattern.opportunityScore], 50) : null;
  return average([rrScore, targetScore, shock, eventShock, returnScore, patternUpside], 50);
}

function currentMomentumScore(row: OpportunityViewModel): number {
  const technical = numberField(row.raw.technical_score) ?? row.final_score ?? 50;
  const setupStrength = numberField(row.raw.setup_strength) ?? row.conviction;
  const trend = numberField(row.raw.short_score ?? row.raw.mid_score ?? row.raw.long_score) ?? technical;
  const scoreChange = numberField(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  const changeScore = scoreChange === null ? 50 : clamp(50 + scoreChange * 4);
  const oneDay = numberField(row.raw.return_1d);
  const returnScore = oneDay === null ? 50 : clamp(50 + oneDay * 5);
  return average([technical, setupStrength, trend, changeScore, returnScore], 50);
}

function historicalShockSupport(row: OpportunityViewModel): number {
  if (row.shockPattern) {
    return average([row.shockPattern.upsideShockScore, row.shockPattern.twoSidedVolatilityScore, row.shockPattern.currentSimilarityScore, row.shockPattern.opportunityScore], 50);
  }
  const eventShock = eventShockScore(row);
  const atr = normalizePercent(row.raw.atr_pct ?? row.raw.atr ?? row.raw.current_atr);
  const volatility = normalizePercent(row.raw.annualized_volatility ?? row.raw.volatility ?? row.raw.volatility_pct);
  const oneDay = Math.abs(numberField(row.raw.return_1d) ?? 0);
  const volumeSpike = numberField(row.raw.volume_spike_ratio ?? row.raw.relative_volume ?? row.raw.rel_volume);
  const shockFromMove = clamp(oneDay * 8);
  const atrScore = atr === null ? 50 : clamp(atr * 12);
  const volScore = volatility === null ? 50 : clamp(volatility * 1.4);
  const volumeScore = volumeSpike === null ? 50 : clamp(volumeSpike * 24);
  return average([eventShock, shockFromMove, atrScore, volScore, volumeScore], 50);
}

function asymmetryScore(row: OpportunityViewModel): number {
  if (row.shockPattern) return row.shockPattern.asymmetryScore;
  const rewardRisk = numberField(row.raw.risk_reward) ?? 1;
  const upside = percentGap(row.price, numberField(row.raw.take_profit_high ?? row.raw.target_price ?? row.target)) ?? 0;
  const downside = Math.abs(percentGap(row.price, row.stop_loss) ?? 6);
  return clamp(rewardRisk * 20 + upside * 2 - downside * 1.6 + 45);
}

function macroSectorSupport(row: OpportunityViewModel): number {
  const macro = numberField(row.raw.macro_alignment_score) ?? 50;
  const exchange = numberField(row.raw.exchange_health_score) ?? 50;
  const sector = numberField(row.raw.sector_alignment_score) ?? 50;
  const eventConviction = numberField(row.raw.event_conviction_adjustment) ?? 0;
  const macroAdjustment = row.macroAdjustment ?? 0;
  const volatilityPressure = numberField(row.raw.volatility_pressure) ?? 50;
  const liquidityPressure = numberField(row.raw.liquidity_pressure) ?? 50;
  return clamp(average([macro, exchange, sector], 50) + eventConviction * 4 + macroAdjustment * 2 - Math.max(0, volatilityPressure - 62) * 0.18 - Math.max(0, liquidityPressure - 62) * 0.16);
}

function chaseRiskScore(row: OpportunityViewModel, setup: string, momentum: number): number {
  const entryDistance = Math.abs(numberField(row.raw.entry_distance_pct ?? row.raw.correction_distance_pct) ?? 0);
  const return1d = numberField(row.raw.return_1d) ?? 0;
  const codes = diagnosticCodes(row.raw);
  let score = entryDistance * 9 + Math.max(0, return1d - 2) * 8 + Math.max(0, row.fragility - 58) * 0.35;
  if (codes.some((code) => code.includes("OVEREXTENDED") || code.includes("EXTENDED"))) score += 26;
  if (setup === "BREAKOUT" && momentum >= 76) score += 8;
  if (eventShockScore(row) >= 72) score += 8;
  return clamp(score);
}

function downsideRiskScore(row: OpportunityViewModel, chase: number): number {
  const riskPenalty = numberField(row.raw.risk_penalty) ?? 0;
  const eventRisk = numberField(row.raw.event_risk_score) ?? row.eventRisk ?? 50;
  const volatilityPressure = numberField(row.raw.volatility_pressure) ?? 50;
  const macroPenalty = Math.max(0, -(row.macroAdjustment ?? 0)) * 8;
  const stopDistance = percentGap(row.price, row.stop_loss);
  const stopRisk = stopDistance === null ? 50 : clamp(Math.abs(stopDistance) * 7);
  const patternDownside = row.shockPattern?.downsideRiskScore ?? null;
  return clamp(average([row.fragility, riskPenalty * 12, eventRisk, volatilityPressure, stopRisk, chase, patternDownside], 50) + macroPenalty * 0.35);
}

function entryQualityScore(row: OpportunityViewModel, chase: number): number {
  const entryDistance = Math.abs(numberField(row.raw.entry_distance_pct ?? row.raw.correction_distance_pct) ?? 0);
  const hasEntry = row.entryZoneLabel !== null || row.suggested_entry !== null;
  const base = hasEntry ? 70 : 48;
  return clamp(base - entryDistance * 7 - chase * 0.25 + (row.final_decision === "WAIT_PULLBACK" ? 8 : 0));
}

function reliabilityScore(row: OpportunityViewModel, downside: number, chase: number): number {
  const dataQuality = numberField(row.raw.data_quality_score ?? row.raw.quality_score) ?? 58;
  const decisionPenalty = String(row.final_decision ?? "").toUpperCase() === "AVOID" ? 10 : 0;
  const freshnessPenalty = row.dataFreshness.status === "stale" ? 12 : row.dataFreshness.status === "slightly_stale" ? 4 : 0;
  const shockReliability = row.shockPattern?.reliabilityScore ?? null;
  return clamp(average([row.conviction, row.final_score ?? 50, dataQuality, shockReliability, 100 - downside * 0.5, 100 - chase * 0.35], 50) - decisionPenalty - freshnessPenalty);
}

function keyReasons(input: { macroSector: number; momentum: number; opportunityType: string; reliability: number; row: OpportunityViewModel; setup: string; shock: number; upside: number }): string[] {
  const reasons = [
    `${input.opportunityType.toLowerCase()} ranks better than most available symbols`,
  ];
  if (input.upside >= 70) reasons.push("upside potential is elevated based on target and risk/reward context");
  if (input.momentum >= 68) reasons.push("current momentum and setup strength are above the universe baseline");
  if (input.shock >= 68) reasons.push("large-move history is elevated based on volatility, events, and recent movement");
  if (input.row.shockPattern) reasons.push(`${input.row.shockPattern.opportunityState.toLowerCase()} history: ${input.row.shockPattern.upsideShockCount} upside events and ${input.row.shockPattern.downsideShockCount} downside events in the selected lookback`);
  if (input.macroSector >= 60) reasons.push("macro, exchange, or sector context is supportive");
  if (input.reliability >= 60) reasons.push("reliability remains acceptable despite the aggressive profile");
  if (input.row.eventLabel !== "Event Context Limited") reasons.push(`verified event context: ${input.row.eventLabel}`);
  return reasons.slice(0, 4);
}

function keyRisks(input: { chase: number; downside: number; profile: RiskRewardProfile; row: OpportunityViewModel }): string[] {
  const risks: string[] = [];
  if (input.profile.inefficient) risks.push("selected risk/reward profile is inefficient unless downside remains tightly controlled");
  if (input.downside >= 70) risks.push("downside risk is elevated; this is not a conservative TradeVeto signal");
  if (input.chase >= 65) risks.push("chase risk is elevated; pullback or confirmation quality matters");
  if (input.row.fragility >= 70) risks.push("setup fragility is high and quality can deteriorate quickly");
  if (input.row.eventRisk >= 68) risks.push("verified event risk is elevated");
  if (input.row.dataFreshness.status === "stale") risks.push("latest scan data is stale; rank should be treated cautiously");
  return risks.length ? risks.slice(0, 4) : ["risk-tolerant mode can rank candidates even when core decision remains WAIT or AVOID"];
}

function opportunityTypeFor(input: { downside: number; eventShock: number; macroSector: number; momentum: number; row: OpportunityViewModel; setup: string; shock: number }): string {
  if (input.row.shockPattern?.opportunityState) return input.row.shockPattern.opportunityState;
  if (input.eventShock >= 72 && input.downside >= 68) return "Two-sided volatility watch";
  if (input.eventShock >= 70 || input.shock >= 72) return "Upside shock watch";
  if (input.setup === "PULLBACK") return "Pullback entry watch";
  if (input.setup === "CONTINUATION" || input.momentum >= 70) return "Momentum continuation";
  if (input.macroSector >= 65) return "Relative strength leader";
  if (input.row.eventLabel !== "Event Context Limited") return "Event-driven watch";
  return "Risk-tolerant watch";
}

function researchEntryZone(row: OpportunityViewModel): string {
  if (row.shockPattern?.researchEntryZone) return row.shockPattern.researchEntryZone;
  return row.entryZoneLabel ?? formatMoney(row.suggested_entry ?? row.price);
}

function invalidationZone(row: OpportunityViewModel): string {
  if (row.shockPattern?.invalidationZone) return row.shockPattern.invalidationZone;
  const stop = row.stop_loss ?? numberField(row.raw.invalidation_level);
  return stop === null ? "Invalidation area unavailable" : formatMoney(stop);
}

function historicalExitZone(row: OpportunityViewModel): string {
  if (row.shockPattern?.historicalExitZone) return row.shockPattern.historicalExitZone;
  const high = numberField(row.raw.take_profit_high ?? row.raw.aggressive_target_high ?? row.raw.target_price);
  const low = numberField(row.raw.take_profit_low ?? row.raw.conservative_target ?? row.target);
  if (low !== null && high !== null && low !== high) return `${formatMoney(Math.min(low, high))}-${formatMoney(Math.max(low, high))}`;
  return high !== null || low !== null ? formatMoney(high ?? low) : "Historical exit zone unavailable";
}

function doNotChaseZone(row: OpportunityViewModel): string {
  if (row.shockPattern?.doNotChaseZone) return row.shockPattern.doNotChaseZone;
  const price = row.price;
  if (price === null) return "Do-not-chase zone unavailable";
  const entryHigh = numberField(row.raw.entry_zone_high ?? row.raw.buy_zone_high ?? row.suggested_entry);
  const atrPct = normalizePercent(row.raw.atr_pct ?? row.raw.atr ?? row.raw.current_atr) ?? 3;
  const threshold = entryHigh !== null ? entryHigh * 1.03 : price * (1 + Math.min(0.08, Math.max(0.025, atrPct / 100)));
  return `Above ${formatMoney(threshold)}`;
}

function averageUpsidePotential(row: OpportunityViewModel, score: number): string {
  if (row.shockPattern?.averageProfitPotential) return row.shockPattern.averageProfitPotential;
  const avgGain = numberField(row.raw.avg_max_gain ?? row.raw.avg_gain ?? row.raw.best_return);
  if (avgGain !== null) return `${formatPercentValue(avgGain)} historically observed upside context`;
  const target = numberField(row.raw.take_profit_high ?? row.raw.target_price ?? row.target);
  const gap = percentGap(row.price, target);
  if (gap !== null) return `${gap.toFixed(1)}% target-zone upside context`;
  return score >= 65 ? "Elevated, but historical upside sample is limited" : "Limited historical upside evidence";
}

function averageDrawdownRisk(row: OpportunityViewModel, score: number): string {
  if (row.shockPattern?.averageDrawdownAfterEntry) return row.shockPattern.averageDrawdownAfterEntry;
  const avgDrawdown = numberField(row.raw.avg_max_drawdown ?? row.raw.avg_drawdown ?? row.raw.max_drawdown_after_signal);
  if (avgDrawdown !== null) return `${formatPercentValue(avgDrawdown)} historically observed drawdown context`;
  return score >= 70 ? "Elevated drawdown risk; historical sample limited" : "Drawdown evidence limited";
}

function eventShockScore(row: OpportunityViewModel): number {
  return numberField(row.raw.event_shock_pressure_score ?? row.raw.verified_event_pressure_score) ?? 50;
}

function diagnosticCodes(row: RankingRow): string[] {
  const values = [row.decision_reason_codes, row.vetoes, row.setup_reason_codes, row.macro_context_reason_codes].flatMap(stringList);
  return values.map((item) => item.toUpperCase());
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text || ["[]", "nan", "none", "null"].includes(text.toLowerCase())) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? parsed.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return text.split(/[,|;]/).map((item) => item.trim()).filter(Boolean);
}

function percentGap(from: number | null, to: number | null): number | null {
  if (from === null || to === null || from <= 0) return null;
  return ((to - from) / from) * 100;
}

function formatPercentValue(value: number): string {
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}

function normalizePercent(value: unknown): number | null {
  const parsed = numberField(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function numberField(value: unknown): number | null {
  return finiteNumber(value);
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return fallback;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function chaseRiskLabel(score: number): string {
  if (score >= 72) return "High chase risk";
  if (score >= 50) return "Moderate chase risk";
  return "Controlled chase risk";
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
