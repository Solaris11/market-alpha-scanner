import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export type WorkflowSurface = "opportunities" | "symbol" | "terminal";

export type OpportunityMaturityState =
  | "Early Formation"
  | "Improving"
  | "Trigger Approaching"
  | "Breakout Confirmed"
  | "Extended"
  | "Decaying"
  | "High Chase Risk";

export type WorkflowSignalSnapshot = {
  capturedAt: string | null;
  convictionScore: number | null;
  entryDistancePct: number | null;
  eventPressureScore: number | null;
  finalDecision: string | null;
  finalScore: number | null;
  fragilityScore: number | null;
  macroAlignmentScore: number | null;
  maturityState: OpportunityMaturityState;
  metadata: Record<string, string | number | boolean | null>;
  return1d: number | null;
  setupType: string | null;
  shockPressureScore: number | null;
  symbol: string;
};

export type WorkflowChangeItem = {
  changeType:
    | "fragility_rising"
    | "improving"
    | "macro_shift"
    | "memory_starting"
    | "shock_aligning"
    | "trigger_approaching"
    | "watchlist_momentum";
  detail: string;
  metricLabel: string;
  severity: "info" | "positive" | "warning";
  symbol: string;
  title: string;
};

export type TriggerMonitor = {
  condition: string;
  distanceLabel: string;
  priority: "high" | "low" | "medium";
  reason: string;
  symbol: string;
};

export type WorkflowEvolutionSummary = {
  dailyBrief: string[];
  deterioratingSetups: WorkflowChangeItem[];
  improvingSetups: WorkflowChangeItem[];
  lastSeenAt: string | null;
  opportunityMaturity: Array<{
    detail: string;
    maturityState: OpportunityMaturityState;
    symbol: string;
  }>;
  snapshotRows: WorkflowSignalSnapshot[];
  triggerMonitors: TriggerMonitor[];
  watchlistEvolution: WorkflowChangeItem[];
  whatChanged: WorkflowChangeItem[];
};

type WorkflowBuildOptions = {
  lastSeenAt?: string | null;
  previousSnapshots?: WorkflowSignalSnapshot[];
  watchlistSymbols?: string[];
};

const MAX_SNAPSHOT_ROWS = 160;

export function buildWorkflowEvolution(rows: RankingRow[], options: WorkflowBuildOptions = {}): WorkflowEvolutionSummary {
  const watchlist = new Set((options.watchlistSymbols ?? []).map((symbol) => cleanSymbol(symbol)).filter((symbol): symbol is string => Boolean(symbol)));
  const previousBySymbol = new Map((options.previousSnapshots ?? []).map((snapshot) => [snapshot.symbol, snapshot]));
  const snapshotRows = rows.map((row) => snapshotFromWorkflowRow(row)).filter((snapshot): snapshot is WorkflowSignalSnapshot => Boolean(snapshot)).slice(0, MAX_SNAPSHOT_ROWS);
  const changes = snapshotRows.flatMap((snapshot) => changesForSnapshot(snapshot, previousBySymbol.get(snapshot.symbol), watchlist.has(snapshot.symbol)));
  const hasPrevious = previousBySymbol.size > 0;
  const whatChanged = hasPrevious
    ? changes.sort(compareChangeItems).slice(0, 8)
    : [{
        changeType: "memory_starting" as const,
        detail: "TradeVeto is creating a workflow baseline for future revisit intelligence.",
        metricLabel: "Baseline",
        severity: "info" as const,
        symbol: "WORKFLOW",
        title: "Workflow memory is starting",
      }];

  const improvingSetups = changes.filter((item) => item.changeType === "improving" || item.changeType === "shock_aligning" || item.changeType === "trigger_approaching").sort(compareChangeItems).slice(0, 5);
  const deterioratingSetups = changes.filter((item) => item.changeType === "fragility_rising" || item.changeType === "macro_shift").sort(compareChangeItems).slice(0, 5);
  const watchlistEvolution = changes.filter((item) => watchlist.has(item.symbol)).sort(compareChangeItems).slice(0, 5);
  const triggerMonitors = snapshotRows.flatMap((snapshot) => triggerMonitorsFor(snapshot, watchlist.has(snapshot.symbol))).sort(compareTriggerMonitors).slice(0, 8);
  const opportunityMaturity = snapshotRows
    .sort((left, right) => maturityRank(right.maturityState) - maturityRank(left.maturityState) || (right.finalScore ?? 0) - (left.finalScore ?? 0))
    .slice(0, 8)
    .map((snapshot) => ({
      detail: maturityDetail(snapshot),
      maturityState: snapshot.maturityState,
      symbol: snapshot.symbol,
    }));

  return {
    dailyBrief: dailyBriefFor({ deterioratingSetups, hasPrevious, improvingSetups, triggerMonitors, watchlistEvolution }),
    deterioratingSetups,
    improvingSetups,
    lastSeenAt: options.lastSeenAt ?? null,
    opportunityMaturity,
    snapshotRows,
    triggerMonitors,
    watchlistEvolution,
    whatChanged,
  };
}

export function snapshotFromWorkflowRow(row: RankingRow): WorkflowSignalSnapshot | null {
  const symbol = cleanSymbol(row.symbol);
  if (!symbol) return null;
  const finalScore = scoreValue(row.final_score_adjusted ?? row.macro_adjusted_score ?? row.final_score ?? row.quality_score);
  const convictionScore = scoreValue(row.conviction_score ?? row.setup_strength ?? row.final_score);
  const fragilityScore = scoreValue(row.fragility_score ?? row.risk_score ?? row.event_risk_score);
  const macroAlignmentScore = scoreValue(row.macro_alignment_score ?? row.macro_score);
  const eventPressureScore = scoreValue(row.event_risk_score ?? row.verified_event_pressure_score);
  const shockPressureScore = scoreValue(row.event_shock_pressure_score ?? row.shock_score ?? row.upside_shock_score);
  const entryDistancePct = finiteNumber(row.entry_distance_pct ?? row.correction_distance_pct);
  const return1d = finiteNumber(row.return_1d);
  return {
    capturedAt: null,
    convictionScore,
    entryDistancePct,
    eventPressureScore,
    finalDecision: cleanOptionalText(row.final_decision),
    finalScore,
    fragilityScore,
    macroAlignmentScore,
    maturityState: maturityStateFor({ entryDistancePct, finalDecision: row.final_decision, finalScore, fragilityScore, return1d, setupType: row.setup_type }),
    metadata: {
      assetType: cleanOptionalText(row.asset_type),
      companyName: cleanOptionalText(row.company_name),
      macroContext: cleanOptionalText(row.macro_context_label ?? row.market_regime),
      sector: cleanOptionalText(row.sector),
    },
    return1d,
    setupType: cleanOptionalText(row.setup_type),
    shockPressureScore,
    symbol,
  };
}

export function maturityStateFor(input: {
  entryDistancePct: number | null;
  finalDecision: unknown;
  finalScore: number | null;
  fragilityScore: number | null;
  return1d: number | null;
  setupType: unknown;
}): OpportunityMaturityState {
  const decision = cleanText(input.finalDecision, "").toUpperCase();
  const setupType = cleanText(input.setupType, "").toUpperCase();
  const score = input.finalScore ?? 0;
  const fragility = input.fragilityScore ?? 0;
  const distance = input.entryDistancePct ?? 999;
  const return1d = input.return1d ?? 0;
  if ((distance >= 7 || return1d >= 7) && fragility >= 68) return "High Chase Risk";
  if (distance >= 6 || return1d >= 6) return "Extended";
  if (decision === "ENTER" || decision === "BUY") return "Breakout Confirmed";
  if (distance >= 0 && distance <= 2.5 && score >= 58) return "Trigger Approaching";
  if (setupType.includes("PULLBACK") && score >= 58) return "Improving";
  if (score < 52 || decision === "AVOID") return "Decaying";
  return "Early Formation";
}

function changesForSnapshot(snapshot: WorkflowSignalSnapshot, previous: WorkflowSignalSnapshot | undefined, watchlisted: boolean): WorkflowChangeItem[] {
  if (!previous) return [];
  const output: WorkflowChangeItem[] = [];
  const scoreDelta = delta(snapshot.finalScore, previous.finalScore);
  const convictionDelta = delta(snapshot.convictionScore, previous.convictionScore);
  const fragilityDelta = delta(snapshot.fragilityScore, previous.fragilityScore);
  const macroDelta = delta(snapshot.macroAlignmentScore, previous.macroAlignmentScore);
  const shockDelta = delta(snapshot.shockPressureScore, previous.shockPressureScore);

  if (scoreDelta >= 4 || convictionDelta >= 5) {
    output.push({
      changeType: "improving",
      detail: `${snapshot.symbol} setup quality improved versus the last recorded workflow snapshot.`,
      metricLabel: changeMetricLabel("Score", scoreDelta || convictionDelta),
      severity: "positive",
      symbol: snapshot.symbol,
      title: "Setup quality improving",
    });
  }
  if (fragilityDelta >= 8) {
    output.push({
      changeType: "fragility_rising",
      detail: `${snapshot.symbol} became more fragile. Review invalidation and avoid treating this as a stronger core signal.`,
      metricLabel: changeMetricLabel("Fragility", fragilityDelta),
      severity: "warning",
      symbol: snapshot.symbol,
      title: "Fragility increased",
    });
  }
  if (macroDelta <= -8) {
    output.push({
      changeType: "macro_shift",
      detail: `${snapshot.symbol} has weaker macro or exchange alignment than the previous workflow baseline.`,
      metricLabel: changeMetricLabel("Macro", macroDelta),
      severity: "warning",
      symbol: snapshot.symbol,
      title: "Macro alignment deteriorated",
    });
  }
  if (shockDelta >= 8) {
    output.push({
      changeType: "shock_aligning",
      detail: `${snapshot.symbol} shows higher high-volatility pressure. Treat this as speculative watch context, not a core action.`,
      metricLabel: changeMetricLabel("Shock", shockDelta),
      severity: "info",
      symbol: snapshot.symbol,
      title: "Shock conditions aligning",
    });
  }
  if (snapshot.maturityState === "Trigger Approaching" && previous.maturityState !== "Trigger Approaching") {
    output.push({
      changeType: "trigger_approaching",
      detail: `${snapshot.symbol} moved closer to a research trigger zone. Confirm quality before acting.`,
      metricLabel: distanceLabel(snapshot.entryDistancePct),
      severity: "positive",
      symbol: snapshot.symbol,
      title: "Trigger approaching",
    });
  }
  if (watchlisted && (scoreDelta >= 3 || convictionDelta >= 4 || snapshot.maturityState === "Trigger Approaching")) {
    output.push({
      changeType: "watchlist_momentum",
      detail: `${snapshot.symbol} is on your watchlist and has become more relevant since the prior workflow snapshot.`,
      metricLabel: changeMetricLabel("Watch", scoreDelta || convictionDelta),
      severity: "positive",
      symbol: snapshot.symbol,
      title: "Watchlist momentum improving",
    });
  }
  return output;
}

function triggerMonitorsFor(snapshot: WorkflowSignalSnapshot, watchlisted: boolean): TriggerMonitor[] {
  const output: TriggerMonitor[] = [];
  const distance = snapshot.entryDistancePct;
  const decision = snapshot.finalDecision ? decisionLabel(snapshot.finalDecision) : "Review";
  if (distance !== null && distance >= 0 && distance <= 3.5) {
    output.push({
      condition: "Research trigger proximity",
      distanceLabel: distanceLabel(distance),
      priority: distance <= 1.25 ? "high" : "medium",
      reason: `${snapshot.symbol} is close to its current research entry context. Confirm trend quality and fragility before escalating.`,
      symbol: snapshot.symbol,
    });
  }
  if ((snapshot.fragilityScore ?? 0) >= 72) {
    output.push({
      condition: "Fragility check",
      distanceLabel: scoreLabel(snapshot.fragilityScore),
      priority: "high",
      reason: `${snapshot.symbol} has elevated fragility. Revisit only if invalidation and downside context remain explicit.`,
      symbol: snapshot.symbol,
    });
  }
  if ((snapshot.shockPressureScore ?? 0) >= 72) {
    output.push({
      condition: "Shock watch",
      distanceLabel: scoreLabel(snapshot.shockPressureScore),
      priority: "medium",
      reason: `${snapshot.symbol} has elevated high-volatility pressure. This is speculative watch context, not a core ${decision} instruction.`,
      symbol: snapshot.symbol,
    });
  }
  if (watchlisted && snapshot.maturityState === "Improving") {
    output.push({
      condition: "Watchlist improvement",
      distanceLabel: snapshot.maturityState,
      priority: "medium",
      reason: `${snapshot.symbol} is on your watchlist and its setup maturity is improving.`,
      symbol: snapshot.symbol,
    });
  }
  return output;
}

function dailyBriefFor(input: {
  deterioratingSetups: WorkflowChangeItem[];
  hasPrevious: boolean;
  improvingSetups: WorkflowChangeItem[];
  triggerMonitors: TriggerMonitor[];
  watchlistEvolution: WorkflowChangeItem[];
}): string[] {
  if (!input.hasPrevious) {
    return [
      "Workflow memory starts from this visit; future sessions will show what changed since your last review.",
      "TradeVeto will track setup maturity, trigger proximity, fragility drift, and watchlist movement without creating direct trade instructions.",
    ];
  }
  const notes: string[] = [];
  if (input.improvingSetups.length) notes.push(`${input.improvingSetups.length} setup${input.improvingSetups.length === 1 ? "" : "s"} improved or moved closer to trigger conditions.`);
  if (input.deterioratingSetups.length) notes.push(`${input.deterioratingSetups.length} setup${input.deterioratingSetups.length === 1 ? "" : "s"} showed higher fragility or weaker context.`);
  if (input.watchlistEvolution.length) notes.push(`${input.watchlistEvolution.length} watchlist symbol${input.watchlistEvolution.length === 1 ? "" : "s"} changed enough to revisit.`);
  if (input.triggerMonitors.length) notes.push(`${input.triggerMonitors.length} trigger condition${input.triggerMonitors.length === 1 ? "" : "s"} deserve calm monitoring.`);
  return notes.length ? notes.slice(0, 4) : ["No material workflow changes were detected since the last recorded visit."];
}

function maturityDetail(snapshot: WorkflowSignalSnapshot): string {
  if (snapshot.maturityState === "High Chase Risk") return "Extended or fragile; patience and invalidation review matter more than urgency.";
  if (snapshot.maturityState === "Extended") return "Moved beyond ideal entry context; monitor for pullback stabilization.";
  if (snapshot.maturityState === "Trigger Approaching") return `Near research trigger context at ${distanceLabel(snapshot.entryDistancePct)}.`;
  if (snapshot.maturityState === "Breakout Confirmed") return "Current decision state indicates confirmation, but risk context remains required.";
  if (snapshot.maturityState === "Improving") return "Setup quality is improving without requiring immediate action.";
  if (snapshot.maturityState === "Decaying") return "Evidence is weakening or current state is blocked.";
  return "Early structure is forming; more confirmation is needed.";
}

function compareChangeItems(left: WorkflowChangeItem, right: WorkflowChangeItem): number {
  const severityScore = severityRank(right.severity) - severityRank(left.severity);
  if (severityScore !== 0) return severityScore;
  return right.metricLabel.localeCompare(left.metricLabel) || left.symbol.localeCompare(right.symbol);
}

function compareTriggerMonitors(left: TriggerMonitor, right: TriggerMonitor): number {
  return priorityRank(right.priority) - priorityRank(left.priority) || left.symbol.localeCompare(right.symbol);
}

function delta(current: number | null, previous: number | null): number {
  if (current === null || previous === null) return 0;
  return current - previous;
}

function scoreValue(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, parsed));
}

function cleanSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return symbol || null;
}

function cleanOptionalText(value: unknown): string | null {
  const text = cleanText(value, "");
  return text ? text.slice(0, 120) : null;
}

function changeMetricLabel(label: string, value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${label} ${safe >= 0 ? "+" : ""}${safe.toFixed(1)}`;
}

function distanceLabel(value: number | null): string {
  if (value === null) return "Distance unavailable";
  return `${value.toFixed(1)}% from research zone`;
}

function scoreLabel(value: number | null): string {
  if (value === null) return "Score unavailable";
  return `${Math.round(value)}/100`;
}

function maturityRank(state: OpportunityMaturityState): number {
  if (state === "Trigger Approaching") return 7;
  if (state === "Improving") return 6;
  if (state === "Breakout Confirmed") return 5;
  if (state === "High Chase Risk") return 4;
  if (state === "Extended") return 3;
  if (state === "Early Formation") return 2;
  return 1;
}

function severityRank(severity: WorkflowChangeItem["severity"]): number {
  if (severity === "warning") return 3;
  if (severity === "positive") return 2;
  return 1;
}

function priorityRank(priority: TriggerMonitor["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}
