import type { IntradayDriftRow } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";
import {
  buildIntradayRegimeDriftSystem,
  intradayDriftLabel,
  type IntradayAlertSeverity,
  type IntradayRegimeDriftSystem,
} from "./intraday-regime-drift";
import type { OpportunityViewModel } from "./opportunity-view-model";

export type LiveIntelligenceStatus = "connected" | "degraded" | "paused";
export type LiveIntelligenceSeverity = "critical" | "info" | "warning";

export type LiveIntelligenceAlert = {
  detail: string;
  reasonCodes: string[];
  score: number;
  severity: LiveIntelligenceSeverity;
  title: string;
};

export type LiveOpportunityEscalation = {
  detail: string;
  eventPressureScore: number;
  priceMovePct: number | null;
  score: number;
  scoreChange: number | null;
  shockScore: number;
  state: "Deteriorating" | "Event Reaction" | "Improving" | "Shock Escalation" | "Unusual Volume";
  symbol: string;
  unusualVolumeScore: number;
};

export type LiveDashboardUpdate = {
  detail: string;
  label: string;
  score: number;
  severity: LiveIntelligenceSeverity;
};

export type LiveIntelligenceSystem = {
  alerts: LiveIntelligenceAlert[];
  breadthScore: number;
  dashboardUpdates: LiveDashboardUpdate[];
  eventReactionScore: number;
  generatedAt: string;
  intraday: IntradayRegimeDriftSystem;
  latencyLabel: string;
  limitations: string[];
  liveSummary: string;
  marketState: string;
  opportunityDriftScore: number;
  refreshIntervalMs: number;
  regimeShiftScore: number;
  sequence: number;
  shockEscalations: LiveOpportunityEscalation[];
  shockEscalationScore: number;
  status: LiveIntelligenceStatus;
  streamMode: "snapshot" | "sse";
  unusualVolumeScore: number;
  volatilityPressure: number;
};

export type LiveIntelligenceInput = {
  driftRows?: IntradayDriftRow[];
  generatedAt?: string;
  refreshIntervalMs?: number;
  rows: OpportunityViewModel[];
  sequence?: number;
  streamMode?: "snapshot" | "sse";
};

export function buildLiveIntelligenceSystem(input: LiveIntelligenceInput): LiveIntelligenceSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const refreshIntervalMs = boundedRefreshInterval(input.refreshIntervalMs);
  const intraday = buildIntradayRegimeDriftSystem({ driftRows: input.driftRows ?? [], generatedAt, rows: input.rows });
  const driftBySymbol = new Map((input.driftRows ?? []).map((row) => [cleanSymbol(row.symbol), row]));
  const unusualVolumeScore = unusualVolumeScoreFor(input.rows);
  const shockEscalations = shockEscalationsFor(input.rows, driftBySymbol);
  const shockEscalationScore = Math.round(clamp(weightedAverage([
    [intraday.shockActivityScore, 0.52],
    [average(shockEscalations.map((item) => item.score), 45), 0.28],
    [unusualVolumeScore, 0.20],
  ], 50)));
  const regimeShiftScore = Math.round(clamp(weightedAverage([
    [intraday.volatilityPressure, 0.25],
    [intraday.liquidityPressure, 0.22],
    [100 - intraday.breadthHealthScore, 0.22],
    [intraday.sectorRotationPressure, 0.16],
    [intraday.eventReactionScore, 0.15],
  ], 50)));
  const opportunityDriftScore = Math.round(clamp(average(intraday.opportunityDrifts.map((item) => item.score), 45)));
  const alerts = liveAlertsFor(intraday, shockEscalations, unusualVolumeScore, regimeShiftScore);
  const status = statusFor(input.rows.length, intraday.coverage.snapshotCountMax, alerts);
  const dashboardUpdates = dashboardUpdatesFor(intraday, shockEscalations, unusualVolumeScore, regimeShiftScore);

  return {
    alerts,
    breadthScore: intraday.breadthHealthScore,
    dashboardUpdates,
    eventReactionScore: intraday.eventReactionScore,
    generatedAt,
    intraday,
    latencyLabel: latencyLabel(refreshIntervalMs, status),
    limitations: [
      "Live Intelligence is near-real-time market awareness, not HFT and not broker execution.",
      "The stream refreshes bounded scanner-derived market-state data; it does not invent ticks, prices, events, or catalysts.",
      "Live event reactions appear only when verified event fields are already present in TradeVeto data.",
      "Alerts are research context and do not override core WAIT / AVOID risk decisions.",
    ],
    liveSummary: liveSummaryFor(intraday, shockEscalationScore, unusualVolumeScore, regimeShiftScore),
    marketState: intraday.currentMarketState,
    opportunityDriftScore,
    refreshIntervalMs,
    regimeShiftScore,
    sequence: Math.max(0, Math.trunc(input.sequence ?? 0)),
    shockEscalations,
    shockEscalationScore,
    status,
    streamMode: input.streamMode ?? "snapshot",
    unusualVolumeScore,
    volatilityPressure: intraday.volatilityPressure,
  };
}

function liveAlertsFor(
  intraday: IntradayRegimeDriftSystem,
  shockEscalations: LiveOpportunityEscalation[],
  unusualVolumeScore: number,
  regimeShiftScore: number,
): LiveIntelligenceAlert[] {
  const alerts: LiveIntelligenceAlert[] = intraday.alerts.map((alert) => ({
    detail: alert.detail,
    reasonCodes: alert.reasonCodes,
    score: alert.score,
    severity: severityFor(alert.severity),
    title: alert.title,
  }));

  if (regimeShiftScore >= 72) {
    alerts.push({
      detail: "Volatility, breadth, liquidity, sector, or event pressure is changing quickly enough to treat the market state as unstable.",
      reasonCodes: ["LIVE_REGIME_SHIFT"],
      score: regimeShiftScore,
      severity: regimeShiftScore >= 84 ? "critical" : "warning",
      title: "Live regime shift watch",
    });
  }
  if (unusualVolumeScore >= 68) {
    alerts.push({
      detail: "Relative-volume fields show enough abnormal activity to increase live monitoring priority.",
      reasonCodes: ["UNUSUAL_VOLUME"],
      score: unusualVolumeScore,
      severity: unusualVolumeScore >= 82 ? "critical" : "warning",
      title: "Unusual volume watch",
    });
  }
  const topShock = shockEscalations[0];
  if (topShock && topShock.score >= 68) {
    alerts.push({
      detail: `${topShock.symbol} has elevated live shock pressure from move intensity, event pressure, or volume expansion. Treat as high-volatility research context.`,
      reasonCodes: ["LIVE_SHOCK_ESCALATION"],
      score: topShock.score,
      severity: topShock.score >= 84 ? "critical" : "warning",
      title: "Live shock escalation",
    });
  }

  return dedupeAlerts(alerts)
    .sort((left, right) => right.score - left.score || severityRank(right.severity) - severityRank(left.severity))
    .slice(0, 8);
}

function dashboardUpdatesFor(
  intraday: IntradayRegimeDriftSystem,
  shockEscalations: LiveOpportunityEscalation[],
  unusualVolumeScore: number,
  regimeShiftScore: number,
): LiveDashboardUpdate[] {
  const updates: LiveDashboardUpdate[] = [
    {
      detail: `${intraday.currentMarketState} with ${intradayDriftLabel(intraday.driftDirection).toLowerCase()} drift across ${intraday.coverage.driftRows}/${intraday.coverage.rows} symbols.`,
      label: "Market State",
      score: intraday.driftScore,
      severity: intraday.driftDirection === "unstable_transition" || intraday.driftDirection === "deteriorating" ? "warning" : "info",
    },
    {
      detail: `Breadth ${intraday.breadthHealthScore}/100, volatility ${intraday.volatilityPressure}/100, liquidity ${intraday.liquidityPressure}/100.`,
      label: "Pressure Map",
      score: Math.round(weightedAverage([[100 - intraday.breadthHealthScore, 0.3], [intraday.volatilityPressure, 0.35], [intraday.liquidityPressure, 0.35]], 50)),
      severity: intraday.volatilityPressure >= 70 || intraday.liquidityPressure >= 70 || intraday.breadthHealthScore <= 42 ? "warning" : "info",
    },
    {
      detail: unusualVolumeScore >= 60 ? "Unusual volume is contributing to live monitoring priority." : "Unusual volume is not dominant in the latest packet.",
      label: "Unusual Volume",
      score: unusualVolumeScore,
      severity: unusualVolumeScore >= 68 ? "warning" : "info",
    },
    {
      detail: shockEscalations.length ? `${shockEscalations[0]?.symbol} is the top live shock watch.` : "No major live shock escalation is confirmed.",
      label: "Shock Detection",
      score: shockEscalations[0]?.score ?? intraday.shockActivityScore,
      severity: (shockEscalations[0]?.score ?? intraday.shockActivityScore) >= 68 ? "warning" : "info",
    },
    {
      detail: `Regime shift pressure is ${regimeShiftScore}/100. Watch whether this persists into the next stream packet.`,
      label: "Regime Shift",
      score: regimeShiftScore,
      severity: regimeShiftScore >= 70 ? "warning" : "info",
    },
  ];
  return updates;
}

function shockEscalationsFor(rows: OpportunityViewModel[], driftBySymbol: Map<string, IntradayDriftRow>): LiveOpportunityEscalation[] {
  return rows
    .map((row): LiveOpportunityEscalation | null => {
      const drift = driftBySymbol.get(row.symbol.toUpperCase());
      const priceMovePct = percentValue(drift?.price_change_pct);
      const scoreChange = numberValue(drift?.score_change);
      const unusualVolumeScore = unusualVolumeScoreForRow(row);
      const shockScore = scoreValue(row.raw.event_shock_pressure_score ?? row.raw.shock_score ?? row.raw.upside_shock_score ?? row.shockPattern?.opportunityScore, 45);
      const eventPressureScore = scoreValue(row.raw.event_risk_score ?? row.raw.verified_event_pressure_score, row.eventRisk);
      const deteriorationPressure = Math.max(0, -(scoreChange ?? 0)) * 9;
      const improvementPressure = Math.max(0, scoreChange ?? 0) * 8;
      const movePressure = Math.abs(priceMovePct ?? 0) * 10;
      const score = Math.round(clamp(weightedAverage([
        [shockScore, 0.28],
        [eventPressureScore, 0.18],
        [unusualVolumeScore, 0.20],
        [movePressure + 35, 0.18],
        [Math.max(deteriorationPressure, improvementPressure) + 35, 0.16],
      ], 45)));
      if (score < 58 && unusualVolumeScore < 62 && Math.abs(priceMovePct ?? 0) < 2.5) return null;
      return {
        detail: escalationDetail(row, score, priceMovePct, scoreChange, unusualVolumeScore, eventPressureScore, shockScore),
        eventPressureScore,
        priceMovePct,
        score,
        scoreChange,
        shockScore,
        state: escalationState(score, priceMovePct, scoreChange, unusualVolumeScore, eventPressureScore, shockScore),
        symbol: row.symbol,
        unusualVolumeScore,
      };
    })
    .filter((item): item is LiveOpportunityEscalation => item !== null)
    .sort((left, right) => right.score - left.score || left.symbol.localeCompare(right.symbol))
    .slice(0, 10);
}

function escalationState(
  score: number,
  priceMovePct: number | null,
  scoreChange: number | null,
  unusualVolumeScore: number,
  eventPressureScore: number,
  shockScore: number,
): LiveOpportunityEscalation["state"] {
  if (shockScore >= 72 || score >= 78 || Math.abs(priceMovePct ?? 0) >= 5) return "Shock Escalation";
  if (eventPressureScore >= 68) return "Event Reaction";
  if (unusualVolumeScore >= 68) return "Unusual Volume";
  if ((scoreChange ?? 0) <= -4) return "Deteriorating";
  if ((scoreChange ?? 0) >= 4) return "Improving";
  return "Shock Escalation";
}

function escalationDetail(
  row: OpportunityViewModel,
  score: number,
  priceMovePct: number | null,
  scoreChange: number | null,
  unusualVolumeScore: number,
  eventPressureScore: number,
  shockScore: number,
): string {
  const move = priceMovePct === null ? "move unavailable" : `move ${signedPct(priceMovePct)}`;
  const change = scoreChange === null ? "score change unavailable" : `score ${signed(scoreChange, 1)}`;
  if (eventPressureScore >= 68) {
    return `${row.symbol} has live event reaction pressure ${Math.round(eventPressureScore)}/100 with ${move} and ${change}. Only verified scanner event fields are used.`;
  }
  if (unusualVolumeScore >= 68) {
    return `${row.symbol} has unusual-volume pressure ${Math.round(unusualVolumeScore)}/100 with shock pressure ${Math.round(shockScore)}/100. Watch for persistence, not chase.`;
  }
  if (score >= 72 || shockScore >= 72) {
    return `${row.symbol} has elevated shock pressure ${Math.round(shockScore)}/100 with ${move} and ${change}. This is speculative live monitoring context.`;
  }
  return `${row.symbol} has a live monitoring score of ${score}/100. Watch whether the next packet confirms or fades this drift.`;
}

function liveSummaryFor(
  intraday: IntradayRegimeDriftSystem,
  shockEscalationScore: number,
  unusualVolumeScore: number,
  regimeShiftScore: number,
): string {
  return `${intraday.currentMarketState}: live packet shows breadth ${intraday.breadthHealthScore}/100, volatility ${intraday.volatilityPressure}/100, unusual volume ${unusualVolumeScore}/100, shock escalation ${shockEscalationScore}/100, and regime-shift pressure ${regimeShiftScore}/100. This is market-awareness context, not a trade instruction.`;
}

function statusFor(rowCount: number, snapshotCountMax: number, alerts: LiveIntelligenceAlert[]): LiveIntelligenceStatus {
  if (!rowCount) return "paused";
  if (snapshotCountMax <= 1) return "degraded";
  if (alerts.some((alert) => alert.severity === "critical")) return "degraded";
  return "connected";
}

function unusualVolumeScoreFor(rows: OpportunityViewModel[]): number {
  if (!rows.length) return 50;
  return Math.round(clamp(average(rows.map(unusualVolumeScoreForRow), 50)));
}

function unusualVolumeScoreForRow(row: OpportunityViewModel): number {
  const explicit = numberValue(row.raw.unusual_volume_score ?? row.raw.volume_pressure_score);
  if (explicit !== null) return clamp(explicit);
  const relativeVolume = numberValue(row.raw.relative_volume ?? row.raw.rel_volume ?? row.raw.volume_spike_ratio);
  if (relativeVolume !== null) return clamp(35 + relativeVolume * 22);
  const volumeChange = percentValue(row.raw.volume_change_pct);
  if (volumeChange !== null) return clamp(40 + Math.abs(volumeChange) * 0.45);
  return 45;
}

function latencyLabel(refreshIntervalMs: number, status: LiveIntelligenceStatus): string {
  if (status === "paused") return "Waiting for scanner rows";
  if (status === "degraded") return `Live-ish, observation-limited (${Math.round(refreshIntervalMs / 1000)}s refresh)`;
  return `Streaming every ${Math.round(refreshIntervalMs / 1000)}s`;
}

function dedupeAlerts(alerts: LiveIntelligenceAlert[]): LiveIntelligenceAlert[] {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = `${alert.title}:${alert.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function severityFor(value: IntradayAlertSeverity): LiveIntelligenceSeverity {
  if (value === "critical") return "critical";
  if (value === "warning") return "warning";
  return "info";
}

function severityRank(value: LiveIntelligenceSeverity): number {
  if (value === "critical") return 3;
  if (value === "warning") return 2;
  return 1;
}

function boundedRefreshInterval(value: unknown): number {
  const parsed = finiteNumber(value);
  if (parsed === null || !Number.isFinite(parsed)) return 30_000;
  return Math.max(10_000, Math.min(120_000, Math.trunc(parsed)));
}

function cleanSymbol(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function scoreValue(value: unknown, fallback: number): number {
  const parsed = numberValue(value);
  return parsed === null ? clamp(fallback) : clamp(parsed);
}

function numberValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

function percentValue(value: unknown): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function average(values: number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function weightedAverage(values: Array<[number | null | undefined, number]>, fallback: number): number {
  let numerator = 0;
  let denominator = 0;
  for (const [value, weight] of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    numerator += value * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : fallback;
}

function signed(value: number, digits: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function signedPct(value: number): string {
  return `${signed(value, 2)}%`;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
