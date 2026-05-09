import { normalizeNumeric, normalizePercent } from "@/lib/ui/formatters";

export type RiskStatus = "OK" | "WARNING" | "VETO";
export type RiskPersonalityProfile =
  | "aggressive"
  | "asymmetric_swing"
  | "balanced"
  | "conservative"
  | "defensive"
  | "event_driven"
  | "momentum"
  | "pullback_specialist"
  | "trend_continuation"
  | "volatility_hunter";
export type RiskPreferenceLevel = "low" | "medium" | "high";

export type UserRiskProfile = {
  allowOverride: boolean;
  asymmetryPreference: number;
  continuationPreference: number;
  drawdownTolerance: number;
  eventPreference: number;
  maxDailyLoss: number | null;
  maxPositionSizePercent: number | null;
  maxRiskPerTradePercent: number;
  maxSectorExposure: number;
  momentumPreference: number;
  personalityConfidence: number;
  personalityProfile: RiskPersonalityProfile;
  preferredRewardLevel: RiskPreferenceLevel;
  preferredRiskLevel: RiskPreferenceLevel;
  pullbackPreference: number;
  volatilityTolerance: number;
};

export type RiskTradePlan = {
  accountEquity: number;
  atrPct?: unknown;
  currentPrice: number | null;
  entryPrice: number | null;
  maxRiskAmount: number;
  positionSize: number;
  riskPercent: number;
  sector?: string | null;
  symbol: string;
  volatilityPct?: unknown;
};

export type RiskPortfolioPosition = {
  positionValue?: number | null;
  riskAmount?: number | null;
  sector?: string | null;
  status?: string | null;
  symbol: string;
};

export type RiskEvaluation = {
  reasons: string[];
  status: RiskStatus;
};

export const DEFAULT_USER_RISK_PROFILE: UserRiskProfile = {
  allowOverride: true,
  asymmetryPreference: 55,
  continuationPreference: 55,
  drawdownTolerance: 50,
  eventPreference: 45,
  maxDailyLoss: null,
  maxPositionSizePercent: null,
  maxRiskPerTradePercent: 2,
  maxSectorExposure: 2,
  momentumPreference: 50,
  personalityConfidence: 35,
  personalityProfile: "balanced",
  preferredRewardLevel: "medium",
  preferredRiskLevel: "medium",
  pullbackPreference: 55,
  volatilityTolerance: 50,
};

const DEFAULT_PORTFOLIO_RISK_LIMIT_PERCENT = 6;
const HARD_RISK_MULTIPLE = 2;
const HARD_SINGLE_TRADE_RISK_PERCENT = 3;
const HIGH_ATR_PERCENT = 8;
const HIGH_VOLATILITY_PERCENT = 60;

export function evaluateRisk(tradePlan: RiskTradePlan, portfolio: RiskPortfolioPosition[], userProfile: UserRiskProfile): RiskEvaluation {
  let status: RiskStatus = "OK";
  const reasons: string[] = [];
  const profile = normalizeRiskProfile(userProfile);
  const riskPercent = safeNumber(tradePlan.riskPercent);
  const accountEquity = safeNumber(tradePlan.accountEquity);
  const maxRiskAmount = safeNumber(tradePlan.maxRiskAmount);

  if (riskPercent > HARD_SINGLE_TRADE_RISK_PERCENT) {
    status = escalate(status, "VETO");
    reasons.push(`Risk of ${formatPercentValue(riskPercent)} exceeds safe limit.`);
  } else if (riskPercent > profile.maxRiskPerTradePercent) {
    const reason = `Risk: ${formatPercentValue(riskPercent)} (max allowed: ${formatPercentValue(profile.maxRiskPerTradePercent)})`;
    if (riskPercent >= profile.maxRiskPerTradePercent * HARD_RISK_MULTIPLE) status = escalate(status, "VETO");
    else status = escalate(status, "WARNING");
    reasons.push(reason);
  }

  const sector = cleanKey(tradePlan.sector);
  if (sector && profile.maxSectorExposure > 0) {
    const sameSectorOpenPositions = portfolio.filter((position) => cleanKey(position.sector) === sector && cleanKey(position.status) !== "CLOSED").length;
    if (sameSectorOpenPositions >= profile.maxSectorExposure) {
      status = escalate(status, sameSectorOpenPositions > profile.maxSectorExposure ? "VETO" : "WARNING");
      reasons.push("Sector exposure exceeded");
    }
  }

  if (profile.maxPositionSizePercent !== null && profile.maxPositionSizePercent > 0 && accountEquity > 0) {
    const currentPrice = safeNullableNumber(tradePlan.currentPrice ?? tradePlan.entryPrice);
    const positionValue = currentPrice !== null ? currentPrice * Math.max(0, safeNumber(tradePlan.positionSize)) : null;
    if (positionValue !== null) {
      const positionSizePercent = (positionValue / accountEquity) * 100;
      if (positionSizePercent > profile.maxPositionSizePercent) {
        status = escalate(status, "VETO");
        reasons.push(`Position size: ${formatPercentValue(positionSizePercent)} of equity (max allowed: ${formatPercentValue(profile.maxPositionSizePercent)})`);
      }
    }
  }

  if (accountEquity > 0) {
    const openRisk = portfolio.reduce((total, position) => total + Math.max(0, safeNumber(position.riskAmount)), 0);
    const portfolioRiskLimit = profile.maxDailyLoss ?? accountEquity * (DEFAULT_PORTFOLIO_RISK_LIMIT_PERCENT / 100);
    const totalRisk = openRisk + maxRiskAmount;
    if (portfolioRiskLimit > 0 && totalRisk > portfolioRiskLimit) {
      status = escalate(status, "WARNING");
      reasons.push(`Open risk would reach ${formatMoneyValue(totalRisk)} (limit: ${formatMoneyValue(portfolioRiskLimit)})`);
    }
  }

  const atrPct = normalizeRiskPercent(tradePlan.atrPct);
  if (atrPct !== null && atrPct > HIGH_ATR_PERCENT) {
    status = escalate(status, "WARNING");
    reasons.push(`ATR is elevated at ${formatPercentValue(atrPct)}`);
  }

  const volatilityPct = normalizeRiskPercent(tradePlan.volatilityPct);
  if (volatilityPct !== null && volatilityPct > HIGH_VOLATILITY_PERCENT) {
    status = escalate(status, "WARNING");
    reasons.push(`Volatility is elevated at ${formatPercentValue(volatilityPct)}`);
  }

  return { reasons, status };
}

export function normalizeRiskProfile(value: Partial<UserRiskProfile> | null | undefined): UserRiskProfile {
  const maxRisk = positiveNumber(value?.maxRiskPerTradePercent) ?? DEFAULT_USER_RISK_PROFILE.maxRiskPerTradePercent;
  const maxSectorExposure = Math.max(1, Math.floor(positiveNumber(value?.maxSectorExposure) ?? DEFAULT_USER_RISK_PROFILE.maxSectorExposure));
  return {
    allowOverride: typeof value?.allowOverride === "boolean" ? value.allowOverride : DEFAULT_USER_RISK_PROFILE.allowOverride,
    asymmetryPreference: boundedPreference(value?.asymmetryPreference, DEFAULT_USER_RISK_PROFILE.asymmetryPreference),
    continuationPreference: boundedPreference(value?.continuationPreference, DEFAULT_USER_RISK_PROFILE.continuationPreference),
    drawdownTolerance: boundedPreference(value?.drawdownTolerance, DEFAULT_USER_RISK_PROFILE.drawdownTolerance),
    eventPreference: boundedPreference(value?.eventPreference, DEFAULT_USER_RISK_PROFILE.eventPreference),
    maxDailyLoss: positiveNumber(value?.maxDailyLoss),
    maxPositionSizePercent: positiveNumber(value?.maxPositionSizePercent),
    maxRiskPerTradePercent: maxRisk,
    maxSectorExposure,
    momentumPreference: boundedPreference(value?.momentumPreference, DEFAULT_USER_RISK_PROFILE.momentumPreference),
    personalityConfidence: boundedPreference(value?.personalityConfidence, DEFAULT_USER_RISK_PROFILE.personalityConfidence),
    personalityProfile: normalizePersonalityProfile(value?.personalityProfile),
    preferredRewardLevel: normalizePreferenceLevel(value?.preferredRewardLevel),
    preferredRiskLevel: normalizePreferenceLevel(value?.preferredRiskLevel),
    pullbackPreference: boundedPreference(value?.pullbackPreference, DEFAULT_USER_RISK_PROFILE.pullbackPreference),
    volatilityTolerance: boundedPreference(value?.volatilityTolerance, DEFAULT_USER_RISK_PROFILE.volatilityTolerance),
  };
}

export function normalizePersonalityProfile(value: unknown): RiskPersonalityProfile {
  const text = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (
    text === "aggressive" ||
    text === "asymmetric_swing" ||
    text === "balanced" ||
    text === "conservative" ||
    text === "defensive" ||
    text === "event_driven" ||
    text === "momentum" ||
    text === "pullback_specialist" ||
    text === "trend_continuation" ||
    text === "volatility_hunter"
  ) {
    return text;
  }
  return DEFAULT_USER_RISK_PROFILE.personalityProfile;
}

export function normalizePreferenceLevel(value: unknown): RiskPreferenceLevel {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "low" || text === "medium" || text === "high" ? text : "medium";
}

function escalate(current: RiskStatus, next: RiskStatus): RiskStatus {
  if (current === "VETO" || next === "VETO") return "VETO";
  if (current === "WARNING" || next === "WARNING") return "WARNING";
  return "OK";
}

function safeNumber(value: unknown): number {
  return normalizeNumeric(value) ?? 0;
}

function safeNullableNumber(value: unknown): number | null {
  return normalizeNumeric(value);
}

function positiveNumber(value: unknown): number | null {
  const parsed = normalizeNumeric(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function boundedPreference(value: unknown, fallback: number): number {
  const parsed = normalizeNumeric(value);
  if (parsed === null) return fallback;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeRiskPercent(value: unknown): number | null {
  return normalizePercent(value, { max: 500, min: 0 });
}

function cleanKey(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function formatPercentValue(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
}

function formatMoneyValue(value: number): string {
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 0, style: "currency" });
}
