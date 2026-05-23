import { normalizeChartWorkflowSymbol } from "./chart-workflow-storage";

export type ChartAlertRuleType = "price_above" | "price_below" | "score_above" | "score_below";

export type ChartAlertRequest = {
  riskReason: string;
  sourceReason: string;
  threshold: number;
  type: ChartAlertRuleType;
};

export type ChartAlertRulePayload = {
  channels: ["telegram"];
  cooldown_minutes: number;
  enabled: boolean;
  id: string;
  risk_reason: string;
  scope: "symbol";
  source: "user";
  source_reason: string;
  symbol: string;
  threshold: number;
  type: ChartAlertRuleType;
};

export function buildChartAlertRulePayload(input: {
  idSuffix?: string;
  request: ChartAlertRequest;
  symbol: string;
}): ChartAlertRulePayload {
  const symbol = normalizeChartWorkflowSymbol(input.symbol);
  const threshold = normalizedThreshold(input.request.threshold, input.request.type);
  const idSuffix = sanitizeAlertIdSuffix(input.idSuffix ?? Date.now().toString(36));
  return {
    channels: ["telegram"],
    cooldown_minutes: 240,
    enabled: true,
    id: `chart_${symbol.toLowerCase()}_${input.request.type}_${idSuffix}`,
    risk_reason: compactReason(input.request.riskReason, 220),
    scope: "symbol",
    source: "user",
    source_reason: compactReason(input.request.sourceReason, 280),
    symbol,
    threshold,
    type: input.request.type,
  };
}

function normalizedThreshold(value: number, type: ChartAlertRuleType): number {
  if (!Number.isFinite(value)) throw new Error("Chart alert threshold must be finite.");
  if (type === "score_above" || type === "score_below") return Math.max(0, Math.min(100, Math.round(value)));
  return Number(value.toFixed(4));
}

function compactReason(value: string, maxLength: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength) || "Created from chart workflow.";
}

function sanitizeAlertIdSuffix(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "manual";
}
