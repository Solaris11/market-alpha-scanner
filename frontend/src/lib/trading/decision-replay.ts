import { buildTradeVetoOperatingSystem, type TradeVetoOperatingSystem } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildRegimeShiftSystem, type RegimeShiftSystem } from "./regime-shift-intelligence";
import { cleanText, finiteNumber, formatNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export type DecisionReplayOutcome = {
  horizon: string;
  interpretation: string;
  returnPct: number | null;
};

export type DecisionReplaySymbolState = {
  conviction: number;
  decision: string;
  eventContext: string;
  finalScore: number | null;
  fragility: number;
  macroContext: string;
  price: number | null;
  setupType: string;
  symbol: string;
};

export type DecisionReplayOpportunity = {
  category: string;
  decision: string;
  opportunityScore: number;
  riskScore: number;
  symbol: string;
};

export type DecisionReplayRisk = {
  detail: string;
  riskScore: number;
  symbol: string;
};

export type DecisionReplayReport = {
  after: {
    outcomes: DecisionReplayOutcome[];
    summary: string;
  };
  asOf: string;
  before: {
    marketState: string;
    marketSummary: string;
    selected: DecisionReplaySymbolState | null;
    topOpportunities: DecisionReplayOpportunity[];
    visibleRisks: DecisionReplayRisk[];
  };
  decisionQualityReview: string[];
  limitations: string[];
  matchedScanRunId: string;
  requestedTimestamp: string | null;
  symbol: string | null;
};

export type DecisionReplayBuildInput = {
  asOf: string;
  matchedScanRunId: string;
  outcomesBySymbol?: Map<string, DecisionReplayOutcome[]>;
  requestedTimestamp?: string | null;
  rows: OpportunityViewModel[];
  symbol?: string | null;
};

export function buildDecisionReplayReport(input: DecisionReplayBuildInput): DecisionReplayReport {
  const metaSystem = buildTradeVetoOperatingSystem({ rows: input.rows });
  const regimeSystem = buildRegimeShiftSystem({ rows: input.rows });
  const selectedRow = selectedReplayRow(input.rows, input.symbol, metaSystem);
  const symbol = selectedRow?.symbol ?? cleanSymbol(input.symbol);
  const outcomes = symbol ? input.outcomesBySymbol?.get(symbol) ?? [] : [];

  return {
    after: {
      outcomes,
      summary: afterSummary(selectedRow, outcomes),
    },
    asOf: input.asOf,
    before: {
      marketState: regimeSystem.currentMarketState,
      marketSummary: regimeSystem.terminalSummary,
      selected: selectedRow ? symbolState(selectedRow) : null,
      topOpportunities: topOpportunities(metaSystem),
      visibleRisks: visibleRisks(metaSystem, regimeSystem),
    },
    decisionQualityReview: decisionQualityReview(selectedRow, outcomes, metaSystem, regimeSystem),
    limitations: [
      "Replay uses the scanner snapshot and deterministic fields persisted at that time.",
      "Forward outcomes are shown only when stored forward-return evidence is available.",
      "Historical narrative, LLM, shock, and event layers may be limited for older snapshots; missing context is not backfilled with invented claims.",
      "Research context only. Not financial advice.",
    ],
    matchedScanRunId: input.matchedScanRunId,
    requestedTimestamp: input.requestedTimestamp ?? null,
    symbol,
  };
}

function selectedReplayRow(rows: OpportunityViewModel[], symbol: string | null | undefined, metaSystem: TradeVetoOperatingSystem): OpportunityViewModel | null {
  const cleaned = cleanSymbol(symbol);
  if (cleaned) {
    const selected = rows.find((row) => row.symbol === cleaned);
    if (selected) return selected;
  }
  const topSymbol = metaSystem.priorityQueue[0]?.symbol;
  if (topSymbol) return rows.find((row) => row.symbol === topSymbol) ?? rows[0] ?? null;
  return rows[0] ?? null;
}

function symbolState(row: OpportunityViewModel): DecisionReplaySymbolState {
  return {
    conviction: row.conviction,
    decision: decisionLabel(row.final_decision),
    eventContext: row.eventLabel,
    finalScore: row.final_score,
    fragility: row.fragility,
    macroContext: row.macroLabel,
    price: row.price,
    setupType: humanizeLabel(row.raw.setup_type ?? "Unknown"),
    symbol: row.symbol,
  };
}

function topOpportunities(metaSystem: TradeVetoOperatingSystem): DecisionReplayOpportunity[] {
  return metaSystem.priorityQueue.slice(0, 5).map((item) => ({
    category: item.category,
    decision: item.decision,
    opportunityScore: item.metaOpportunityScore,
    riskScore: item.metaRiskScore,
    symbol: item.symbol,
  }));
}

function visibleRisks(metaSystem: TradeVetoOperatingSystem, regimeSystem: RegimeShiftSystem): DecisionReplayRisk[] {
  const dangerRisks = metaSystem.dangerQueue.slice(0, 4).map((item) => ({
    detail: item.keyRisks[0] ?? `${item.symbol} carried elevated meta risk in this snapshot.`,
    riskScore: item.metaRiskScore,
    symbol: item.symbol,
  }));
  if (dangerRisks.length) return dangerRisks;
  return regimeSystem.alerts.slice(0, 4).map((alert) => ({
    detail: `${alert.title}: ${alert.detail}`,
    riskScore: alert.score,
    symbol: "MARKET",
  }));
}

function afterSummary(row: OpportunityViewModel | null, outcomes: DecisionReplayOutcome[]): string {
  if (!row) return "No selected symbol was available for this replay.";
  if (!outcomes.length) return "Forward outcome tracking is not available for this snapshot yet.";
  const best = outcomes.find((outcome) => outcome.horizon.toUpperCase() === "5D") ?? outcomes[0];
  if (!best || best.returnPct === null) return "Forward outcome tracking exists, but return values are incomplete.";
  const value = `${formatNumber(best.returnPct)}%`;
  if (best.returnPct > 3) return `${row.symbol} later showed positive follow-through over ${best.horizon} (${value}). Treat this as historical evidence, not prediction power.`;
  if (best.returnPct < -3) return `${row.symbol} later weakened over ${best.horizon} (${value}), useful for reviewing whether risk warnings were visible.`;
  return `${row.symbol} later stayed mixed over ${best.horizon} (${value}), so this replay is mainly a timing and decision-quality review.`;
}

function decisionQualityReview(
  row: OpportunityViewModel | null,
  outcomes: DecisionReplayOutcome[],
  metaSystem: TradeVetoOperatingSystem,
  regimeSystem: RegimeShiftSystem,
): string[] {
  if (!row) return ["No selected symbol was available for decision quality review."];
  const items: string[] = [];
  const decision = String(row.final_decision ?? "").toUpperCase();
  const fiveDay = outcomes.find((outcome) => outcome.horizon.toUpperCase() === "5D")?.returnPct ?? null;
  if ((decision === "WAIT" || decision === "AVOID" || decision === "WAIT_PULLBACK") && fiveDay !== null && fiveDay < 0) {
    items.push(`${decisionLabel(decision)} aligned with later downside evidence over 5D.`);
  } else if (fiveDay !== null && fiveDay > 0 && row.conviction >= 65) {
    items.push(`Conviction was already constructive before later positive follow-through appeared.`);
  } else if (fiveDay !== null) {
    items.push(`Later 5D outcome was ${formatNumber(fiveDay)}%, so this replay should be read as calibration evidence rather than a clean success/failure claim.`);
  } else {
    items.push("Outcome evidence is pending or unavailable for this snapshot.");
  }
  if (row.fragility >= 70) {
    items.push(`Fragility was elevated at ${row.fragility}/100, so chase or late-entry risk was visible at replay time.`);
  } else {
    items.push(`Fragility was ${row.fragility}/100, so the snapshot did not show an extreme fragility warning for this symbol.`);
  }
  if (regimeSystem.transitionRiskScore >= 70) {
    items.push(`Market transition risk was elevated at ${regimeSystem.transitionRiskScore}/100, limiting decision quality even if the symbol looked attractive.`);
  }
  const priority = metaSystem.priorityQueue.find((item) => item.symbol === row.symbol);
  if (priority) {
    items.push(`${row.symbol} ranked as ${priority.category} with opportunity ${priority.metaOpportunityScore}/100 and risk ${priority.metaRiskScore}/100.`);
  }
  return items.slice(0, 5);
}

export function buildReplayOutcome(horizon: string, returnPct: unknown): DecisionReplayOutcome {
  const normalizedHorizon = cleanText(horizon, "unknown").toUpperCase();
  const parsedReturn = finiteNumber(returnPct);
  return {
    horizon: normalizedHorizon,
    interpretation: outcomeInterpretation(normalizedHorizon, parsedReturn),
    returnPct: parsedReturn,
  };
}

function outcomeInterpretation(horizon: string, value: number | null): string {
  if (value === null) return `${horizon}: outcome value unavailable.`;
  if (value > 5) return `${horizon}: strong positive follow-through.`;
  if (value > 1) return `${horizon}: modest positive follow-through.`;
  if (value < -5) return `${horizon}: meaningful downside after the snapshot.`;
  if (value < -1) return `${horizon}: modest downside after the snapshot.`;
  return `${horizon}: mixed or flat follow-through.`;
}

function cleanSymbol(value: unknown): string | null {
  const text = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return text || null;
}
