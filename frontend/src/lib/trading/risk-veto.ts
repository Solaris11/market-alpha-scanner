import { normalizeNumeric, normalizePercent } from "@/lib/ui/formatters";

export type RiskStatus = "OK" | "WARNING" | "VETO";

export type UserRiskProfile = {
  allowOverride: boolean;
  maxDailyLoss: number | null;
  maxPositionSizePercent: number | null;
  maxRiskPerTradePercent: number;
  maxSectorExposure: number;
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
  maxDailyLoss: null,
  maxPositionSizePercent: null,
  maxRiskPerTradePercent: 2,
  maxSectorExposure: 2,
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
    maxDailyLoss: positiveNumber(value?.maxDailyLoss),
    maxPositionSizePercent: positiveNumber(value?.maxPositionSizePercent),
    maxRiskPerTradePercent: maxRisk,
    maxSectorExposure,
  };
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
