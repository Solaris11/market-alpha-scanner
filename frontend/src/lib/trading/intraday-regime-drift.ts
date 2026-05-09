import type { IntradayDriftRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { OpportunityViewModel } from "./opportunity-view-model";

export type IntradayDriftDirection = "deteriorating" | "improving" | "stable" | "unstable_transition";

export type IntradayMarketState =
  | "Intraday Breadth Breakdown"
  | "Intraday Fragility Rising"
  | "Intraday Liquidity Stress"
  | "Intraday Mixed / Stable"
  | "Intraday Risk-On Drift"
  | "Intraday Sector Rotation"
  | "Intraday Shock Activity"
  | "Intraday Volatility Expansion";

export type IntradayAlertSeverity = "critical" | "info" | "warning";

export type IntradayPressureKey =
  | "breadth_health"
  | "event_reaction"
  | "exchange_pressure"
  | "liquidity_pressure"
  | "sector_rotation"
  | "shock_activity"
  | "volatility_pressure";

export type IntradayPressureComponent = {
  detail: string;
  inverse: boolean;
  key: IntradayPressureKey;
  label: string;
  score: number;
  state: string;
};

export type IntradayRegimeAlert = {
  detail: string;
  reasonCodes: string[];
  score: number;
  severity: IntradayAlertSeverity;
  title: string;
};

export type IntradayOpportunityDrift = {
  detail: string;
  direction: IntradayDriftDirection;
  metricLabel: string;
  reasonCodes: string[];
  score: number;
  state: "Deteriorating Setup" | "Fragility Spike" | "Improving Setup" | "Shock Watch" | "Stable Watch";
  symbol: string;
};

export type IntradayReactionItem = {
  detail: string;
  metricLabel: string;
  severity: IntradayAlertSeverity;
  symbol: string;
  title: string;
};

export type IntradayRegimeDriftSystem = {
  alerts: IntradayRegimeAlert[];
  breadthHealthScore: number;
  components: IntradayPressureComponent[];
  coverage: {
    coveragePct: number;
    driftRows: number;
    rows: number;
    snapshotCountMax: number;
    snapshotCountMedian: number;
  };
  currentMarketState: IntradayMarketState;
  driftDirection: IntradayDriftDirection;
  driftScore: number;
  eventReactionFeed: IntradayReactionItem[];
  eventReactionScore: number;
  exchangePressure: number;
  generatedAt: string;
  limitations: string[];
  liquidityPressure: number;
  llmBoundary: string;
  macroReactionFeed: IntradayReactionItem[];
  observationWindowLabel: string;
  opportunityDrifts: IntradayOpportunityDrift[];
  sectorRotationPressure: number;
  shockActivityScore: number;
  terminalSummary: string;
  volatilityPressure: number;
  whatChangedIntraday: string[];
  whatToMonitor: string[];
};

export type IntradayRegimeDriftBuildInput = {
  driftRows?: IntradayDriftRow[];
  generatedAt?: string;
  rows: OpportunityViewModel[];
};

type DriftMetrics = {
  breadthHealthScore: number;
  eventReactionScore: number;
  exchangePressure: number;
  liquidityPressure: number;
  sectorRotationPressure: number;
  shockActivityScore: number;
  volatilityPressure: number;
};

type SectorAggregate = {
  count: number;
  improving: number;
  scoreTotal: number;
  weakening: number;
};

export function buildIntradayRegimeDriftSystem(input: IntradayRegimeDriftBuildInput): IntradayRegimeDriftSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  if (!input.rows.length) return emptySystem(generatedAt);

  const driftRows = normalizeDriftRows(input.driftRows ?? []);
  const driftBySymbol = new Map(driftRows.map((row) => [row.symbol, row]));
  const coverage = coverageFor(input.rows, driftRows);
  const metrics = metricsFor(input.rows, driftRows, driftBySymbol);
  const opportunityDrifts = opportunityDriftsFor(input.rows, driftBySymbol);
  const eventReactionFeed = eventReactionFeedFor(input.rows, driftBySymbol);
  const macroReactionFeed = macroReactionFeedFor(input.rows, driftBySymbol);
  const driftScore = driftScoreFor(metrics, opportunityDrifts);
  const driftDirection = driftDirectionFor(driftScore, metrics, opportunityDrifts);
  const currentMarketState = classifyMarketState(metrics, opportunityDrifts);
  const alerts = alertsFor(metrics, opportunityDrifts, coverage);
  const components = componentsFor(metrics);
  const whatChangedIntraday = changedLinesFor(currentMarketState, metrics, opportunityDrifts, eventReactionFeed, coverage);

  return {
    alerts,
    breadthHealthScore: metrics.breadthHealthScore,
    components,
    coverage,
    currentMarketState,
    driftDirection,
    driftScore,
    eventReactionFeed,
    eventReactionScore: metrics.eventReactionScore,
    exchangePressure: metrics.exchangePressure,
    generatedAt,
    limitations: [
      "Intraday Regime Drift uses bounded scan observations and latest scanner rows; it is live-ish market-state context, not streaming execution data.",
      "The engine does not predict exact prices and does not claim macro events unless verified event fields already exist in the scanner packet.",
      "When intraday coverage is limited, TradeVeto reduces confidence and labels the state as observation-limited instead of inventing changes.",
    ],
    liquidityPressure: metrics.liquidityPressure,
    llmBoundary: "LLM may summarize deterministic intraday drift, but it must not invent real-time events, macro reactions, prices, probabilities, or direct trade instructions.",
    macroReactionFeed,
    observationWindowLabel: observationWindowLabel(coverage),
    opportunityDrifts,
    sectorRotationPressure: metrics.sectorRotationPressure,
    shockActivityScore: metrics.shockActivityScore,
    terminalSummary: terminalSummaryFor(currentMarketState, driftDirection, metrics, coverage),
    volatilityPressure: metrics.volatilityPressure,
    whatChangedIntraday,
    whatToMonitor: monitorListFor(metrics, opportunityDrifts, coverage),
  };
}

function emptySystem(generatedAt: string): IntradayRegimeDriftSystem {
  return {
    alerts: [],
    breadthHealthScore: 50,
    components: [],
    coverage: { coveragePct: 0, driftRows: 0, rows: 0, snapshotCountMax: 0, snapshotCountMedian: 0 },
    currentMarketState: "Intraday Mixed / Stable",
    driftDirection: "stable",
    driftScore: 50,
    eventReactionFeed: [],
    eventReactionScore: 50,
    exchangePressure: 50,
    generatedAt,
    limitations: ["Intraday drift appears after scanner rows are available."],
    liquidityPressure: 50,
    llmBoundary: "No intraday LLM summary should run without deterministic scanner and drift inputs.",
    macroReactionFeed: [],
    observationWindowLabel: "No scanner observations",
    opportunityDrifts: [],
    sectorRotationPressure: 50,
    shockActivityScore: 50,
    terminalSummary: "Intraday regime drift is waiting for scanner rows.",
    volatilityPressure: 50,
    whatChangedIntraday: ["Intraday drift is waiting for scanner rows."],
    whatToMonitor: ["Scanner rows and the next bounded scan observation."],
  };
}

function metricsFor(rows: OpportunityViewModel[], driftRows: IntradayDriftRow[], driftBySymbol: Map<string, IntradayDriftRow>): DriftMetrics {
  const scoreChanges = driftRows.map((row) => numberField(row.score_change)).filter((value): value is number => value !== null);
  const priceMoves = driftRows.map((row) => Math.abs(percentValue(row.price_change_pct) ?? 0));
  const latestVolatility = average(rows.map((row) => scoreValue(row.raw.volatility_pressure ?? row.raw.atr_percentile, row.fragility)), 50);
  const latestLiquidity = average(rows.map((row) => scoreValue(row.raw.liquidity_pressure, 50)), 50);
  const latestExchange = average(rows.map((row) => scoreValue(row.raw.exchange_health_score, scoreValue(row.raw.macro_alignment_score, 50))), 50);
  const scoreDeteriorationShare = ratio(scoreChanges, (change) => change <= -3);
  const scoreImprovementShare = ratio(scoreChanges, (change) => change >= 3);
  const largeMoveShare = ratio(priceMoves, (move) => move >= 2.5);
  const shockShare = ratio(rows, (row) => shockScore(row, driftBySymbol.get(row.symbol)) >= 65);
  const fragileShare = ratio(rows, (row) => row.fragility >= 68);
  const constructiveShare = ratio(rows, (row) => !/AVOID|EXIT/.test(cleanText(row.final_decision, "").toUpperCase()) && row.conviction >= 50);
  const avgScoreChange = average(scoreChanges, 0);
  const avgAbsMove = average(priceMoves, 0);
  const sectorRotationPressure = sectorRotationFor(rows, driftBySymbol);
  const eventReactionScore = Math.round(clamp(weightedAverage([
    [average(rows.map((row) => scoreValue(row.raw.event_risk_score ?? row.raw.verified_event_pressure_score, row.eventRisk)), 50), 0.38],
    [shockShare * 100, 0.20],
    [largeMoveShare * 100, 0.18],
    [average(rows.map((row) => Math.max(0, row.eventRisk - 45) * 2), 40), 0.14],
    [Math.abs(avgScoreChange) * 7 + 35, 0.10],
  ], 50)));
  const volatilityPressure = Math.round(clamp(weightedAverage([
    [latestVolatility, 0.42],
    [largeMoveShare * 100, 0.20],
    [avgAbsMove * 12 + 32, 0.16],
    [fragileShare * 100, 0.14],
    [shockShare * 100, 0.08],
  ], 50)));
  const liquidityPressure = Math.round(clamp(weightedAverage([
    [latestLiquidity, 0.44],
    [100 - latestExchange, 0.18],
    [scoreDeteriorationShare * 100, 0.16],
    [largeMoveShare * 100, 0.12],
    [average(rows.map((row) => scoreValue(row.raw.macro_conflict_penalty, 0) * 9), 30), 0.10],
  ], 50)));
  const breadthHealthScore = Math.round(clamp(weightedAverage([
    [constructiveShare * 100, 0.30],
    [100 - scoreDeteriorationShare * 100, 0.22],
    [scoreImprovementShare * 100, 0.16],
    [100 - fragileShare * 100, 0.14],
    [latestExchange, 0.10],
    [clamp(50 + avgScoreChange * 6), 0.08],
  ], 50)));
  const shockActivityScore = Math.round(clamp(weightedAverage([
    [shockShare * 100, 0.32],
    [largeMoveShare * 100, 0.22],
    [average(rows.map((row) => scoreValue(row.raw.event_shock_pressure_score ?? row.raw.shock_score, 45)), 45), 0.22],
    [avgAbsMove * 11 + 34, 0.14],
    [eventReactionScore, 0.10],
  ], 50)));

  return {
    breadthHealthScore,
    eventReactionScore,
    exchangePressure: Math.round(clamp(100 - latestExchange)),
    liquidityPressure,
    sectorRotationPressure,
    shockActivityScore,
    volatilityPressure,
  };
}

function opportunityDriftsFor(rows: OpportunityViewModel[], driftBySymbol: Map<string, IntradayDriftRow>): IntradayOpportunityDrift[] {
  return rows
    .map((row) => opportunityDriftFor(row, driftBySymbol.get(row.symbol)))
    .filter((item): item is IntradayOpportunityDrift => item !== null)
    .sort((left, right) => right.score - left.score || left.symbol.localeCompare(right.symbol))
    .slice(0, 10);
}

function opportunityDriftFor(row: OpportunityViewModel, drift: IntradayDriftRow | undefined): IntradayOpportunityDrift | null {
  const scoreChange = numberField(drift?.score_change);
  const priceMove = percentValue(drift?.price_change_pct);
  const shock = shockScore(row, drift);
  const macroAlignment = scoreValue(row.raw.macro_alignment_score, 50);
  const reasonCodes: string[] = [];
  if (scoreChange !== null && scoreChange >= 4) reasonCodes.push("SETUP_IMPROVING_INTRADAY");
  if (scoreChange !== null && scoreChange <= -4) reasonCodes.push("SETUP_DETERIORATING_INTRADAY");
  if (row.fragility >= 70 && (scoreChange ?? 0) <= 1) reasonCodes.push("INTRADAY_FRAGILITY_SPIKE");
  if (shock >= 68) reasonCodes.push("SHOCK_ACTIVITY_RISING");
  if (macroAlignment <= 42) reasonCodes.push("MACRO_REACTION_PRESSURE");
  if (priceMove !== null && Math.abs(priceMove) >= 3) reasonCodes.push("ABNORMAL_INTRADAY_MOVE");
  if (!reasonCodes.length) return null;

  const score = Math.round(clamp(
    Math.abs(scoreChange ?? 0) * 8 +
    Math.abs(priceMove ?? 0) * 7 +
    Math.max(0, row.fragility - 55) * 0.8 +
    Math.max(0, shock - 50) * 0.7 +
    Math.max(0, 50 - macroAlignment) * 0.55,
  ));
  const state = opportunityStateFor(row, scoreChange, priceMove, shock, macroAlignment);
  const direction: IntradayDriftDirection = state === "Improving Setup" || state === "Shock Watch" ? "improving" : state === "Stable Watch" ? "stable" : "deteriorating";

  return {
    detail: opportunityDetailFor(row, scoreChange, priceMove, shock, macroAlignment, state),
    direction,
    metricLabel: metricLabelFor(scoreChange, priceMove),
    reasonCodes,
    score,
    state,
    symbol: row.symbol,
  };
}

function opportunityStateFor(
  row: OpportunityViewModel,
  scoreChange: number | null,
  priceMove: number | null,
  shock: number,
  macroAlignment: number,
): IntradayOpportunityDrift["state"] {
  if (row.fragility >= 72 && (scoreChange ?? 0) <= 1) return "Fragility Spike";
  if ((scoreChange ?? 0) <= -4 || macroAlignment <= 38) return "Deteriorating Setup";
  if (shock >= 72 || Math.abs(priceMove ?? 0) >= 5) return "Shock Watch";
  if ((scoreChange ?? 0) >= 4) return "Improving Setup";
  return "Stable Watch";
}

function opportunityDetailFor(
  row: OpportunityViewModel,
  scoreChange: number | null,
  priceMove: number | null,
  shock: number,
  macroAlignment: number,
  state: IntradayOpportunityDrift["state"],
): string {
  if (state === "Fragility Spike") return `${row.symbol} fragility is elevated while intraday score confirmation is not improving. Treat this as caution context, not a stronger signal.`;
  if (state === "Deteriorating Setup") return `${row.symbol} is showing weaker intraday quality or macro alignment. Watch whether this deterioration persists into the next scan.`;
  if (state === "Shock Watch") return `${row.symbol} has elevated intraday shock activity from price/score movement and shock pressure. This remains speculative high-volatility context.`;
  if (state === "Improving Setup") return `${row.symbol} setup quality improved across bounded intraday observations. Confirm breadth and volatility before elevating it.`;
  return `${row.symbol} has notable but not decisive intraday movement. Monitor the next scan for confirmation.`;
}

function eventReactionFeedFor(rows: OpportunityViewModel[], driftBySymbol: Map<string, IntradayDriftRow>): IntradayReactionItem[] {
  return rows
    .map((row): IntradayReactionItem | null => {
      const eventScore = scoreValue(row.raw.event_risk_score ?? row.raw.verified_event_pressure_score, row.eventRisk);
      const shock = shockScore(row, driftBySymbol.get(row.symbol));
      if (eventScore < 62 && shock < 68) return null;
      return {
        detail: `${row.symbol} has ${eventLabel(eventScore)} verified-event pressure with shock activity ${Math.round(shock)}/100. Confirmed event fields are used only when present in scanner data.`,
        metricLabel: `${Math.round(eventScore)}/100 event`,
        severity: eventScore >= 78 || shock >= 80 ? "warning" as const : "info" as const,
        symbol: row.symbol,
        title: "Event reaction watch",
      };
    })
    .filter((item): item is IntradayReactionItem => item !== null)
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.symbol.localeCompare(right.symbol))
    .slice(0, 6);
}

function macroReactionFeedFor(rows: OpportunityViewModel[], driftBySymbol: Map<string, IntradayDriftRow>): IntradayReactionItem[] {
  return rows
    .map((row): IntradayReactionItem | null => {
      const macroAlignment = scoreValue(row.raw.macro_alignment_score, 50);
      const exchangeHealth = scoreValue(row.raw.exchange_health_score, macroAlignment);
      const volatility = scoreValue(row.raw.volatility_pressure, row.fragility);
      const scoreChange = numberField(driftBySymbol.get(row.symbol)?.score_change);
      if (macroAlignment > 45 && exchangeHealth > 45 && volatility < 68 && (scoreChange ?? 0) > -4) return null;
      return {
        detail: `${row.symbol} shows intraday macro or exchange pressure. Macro alignment ${Math.round(macroAlignment)}/100, exchange health ${Math.round(exchangeHealth)}/100, volatility pressure ${Math.round(volatility)}/100.`,
        metricLabel: `${Math.round(100 - macroAlignment)}/100 pressure`,
        severity: macroAlignment <= 35 || volatility >= 78 ? "warning" as const : "info" as const,
        symbol: row.symbol,
        title: "Macro reaction pressure",
      };
    })
    .filter((item): item is IntradayReactionItem => item !== null)
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.symbol.localeCompare(right.symbol))
    .slice(0, 6);
}

function driftScoreFor(metrics: DriftMetrics, opportunityDrifts: IntradayOpportunityDrift[]): number {
  const improving = opportunityDrifts.filter((item) => item.direction === "improving").length;
  const deteriorating = opportunityDrifts.filter((item) => item.direction === "deteriorating").length;
  return Math.round(clamp(weightedAverage([
    [metrics.breadthHealthScore, 0.24],
    [100 - metrics.volatilityPressure, 0.18],
    [100 - metrics.liquidityPressure, 0.16],
    [100 - metrics.exchangePressure, 0.12],
    [50 + improving * 5 - deteriorating * 6, 0.18],
    [100 - metrics.sectorRotationPressure, 0.12],
  ], 50)));
}

function driftDirectionFor(metricsScore: number, metrics: DriftMetrics, opportunityDrifts: IntradayOpportunityDrift[]): IntradayDriftDirection {
  const deteriorating = opportunityDrifts.filter((item) => item.direction === "deteriorating").length;
  if (metrics.volatilityPressure >= 75 || metrics.liquidityPressure >= 75 || (metrics.breadthHealthScore <= 38 && deteriorating >= 3)) return "unstable_transition";
  if (metricsScore >= 58) return "improving";
  if (metricsScore <= 42 || deteriorating >= 4) return "deteriorating";
  return "stable";
}

function classifyMarketState(metrics: DriftMetrics, opportunityDrifts: IntradayOpportunityDrift[]): IntradayMarketState {
  if (metrics.volatilityPressure >= 72) return "Intraday Volatility Expansion";
  if (metrics.liquidityPressure >= 72) return "Intraday Liquidity Stress";
  if (metrics.breadthHealthScore <= 38) return "Intraday Breadth Breakdown";
  if (opportunityDrifts.some((item) => item.state === "Fragility Spike") || average(opportunityDrifts.map((item) => item.score), 0) >= 72) return "Intraday Fragility Rising";
  if (metrics.shockActivityScore >= 70) return "Intraday Shock Activity";
  if (metrics.sectorRotationPressure >= 68) return "Intraday Sector Rotation";
  if (metrics.breadthHealthScore >= 62 && metrics.volatilityPressure <= 55 && metrics.liquidityPressure <= 58) return "Intraday Risk-On Drift";
  return "Intraday Mixed / Stable";
}

function alertsFor(metrics: DriftMetrics, opportunityDrifts: IntradayOpportunityDrift[], coverage: IntradayRegimeDriftSystem["coverage"]): IntradayRegimeAlert[] {
  const alerts: IntradayRegimeAlert[] = [];
  if (coverage.snapshotCountMax <= 1) alerts.push(alert("Intraday baseline limited", "Only one bounded scanner observation is available, so TradeVeto is treating intraday drift as baseline context.", 45, "info", ["LIMITED_INTRADAY_BASELINE"]));
  if (metrics.volatilityPressure >= 68) alerts.push(alert("Volatility expansion alert", "Intraday move intensity and volatility pressure are elevated enough to reduce clean follow-through quality.", metrics.volatilityPressure, metrics.volatilityPressure >= 80 ? "critical" : "warning", ["VOLATILITY_EXPANSION_ALERT"]));
  if (metrics.liquidityPressure >= 68) alerts.push(alert("Liquidity pressure alert", "Liquidity or exchange pressure is high enough that setups may need stronger confirmation.", metrics.liquidityPressure, metrics.liquidityPressure >= 80 ? "critical" : "warning", ["LIQUIDITY_PRESSURE_ALERT"]));
  if (metrics.breadthHealthScore <= 42) alerts.push(alert("Breadth breakdown alert", "Constructive scanner participation weakened across the latest bounded observations.", 100 - metrics.breadthHealthScore, "warning", ["BREADTH_BREAKDOWN_ALERT"]));
  if (metrics.eventReactionScore >= 70) alerts.push(alert("Macro/event reaction alert", "Verified event and shock fields indicate elevated reaction pressure. Do not infer unverified catalysts.", metrics.eventReactionScore, "warning", ["MACRO_REACTION_ALERT"]));
  if (metrics.shockActivityScore >= 70) alerts.push(alert("Shock activity alert", "Unusual move intensity or event shock pressure is elevated in the current universe.", metrics.shockActivityScore, "warning", ["SHOCK_ACTIVITY_ALERT"]));
  if (opportunityDrifts.some((item) => item.state === "Fragility Spike")) alerts.push(alert("Intraday fragility spike", "At least one setup has elevated fragility while intraday quality confirmation is weak.", 74, "warning", ["INTRADAY_FRAGILITY_SPIKE"]));
  if (alerts.length) return alerts.sort((left, right) => right.score - left.score).slice(0, 7);
  return [alert("No major intraday alert", "Current bounded observations do not show a dominant intraday regime break.", 50, "info", ["INTRADAY_MONITORING"])];
}

function componentsFor(metrics: DriftMetrics): IntradayPressureComponent[] {
  return [
    component("volatility_pressure", "Volatility State", metrics.volatilityPressure, true, pressureLabel(metrics.volatilityPressure), "Tracks range expansion, abnormal movement, and fragility pressure."),
    component("breadth_health", "Breadth Health", metrics.breadthHealthScore, false, qualityLabel(metrics.breadthHealthScore), "Tracks constructive participation versus deterioration across the latest scan universe."),
    component("liquidity_pressure", "Liquidity Pressure", metrics.liquidityPressure, true, pressureLabel(metrics.liquidityPressure), "Tracks liquidity, exchange, macro conflict, and deterioration pressure."),
    component("exchange_pressure", "Exchange Pressure", metrics.exchangePressure, true, pressureLabel(metrics.exchangePressure), "Tracks whether listing/exchange context is helping or hurting symbol-level quality."),
    component("sector_rotation", "Sector Rotation", metrics.sectorRotationPressure, true, pressureLabel(metrics.sectorRotationPressure), "Tracks whether sector leadership is becoming more uneven intraday."),
    component("shock_activity", "Shock Activity", metrics.shockActivityScore, true, pressureLabel(metrics.shockActivityScore), "Tracks unusual move intensity, shock pressure, and event-linked volatility."),
    component("event_reaction", "Event Reaction", metrics.eventReactionScore, true, pressureLabel(metrics.eventReactionScore), "Tracks verified event pressure and immediate market reaction fields when present."),
  ];
}

function changedLinesFor(
  state: IntradayMarketState,
  metrics: DriftMetrics,
  opportunityDrifts: IntradayOpportunityDrift[],
  eventReactionFeed: IntradayReactionItem[],
  coverage: IntradayRegimeDriftSystem["coverage"],
): string[] {
  const lines = [
    `${state}: volatility pressure ${metrics.volatilityPressure}/100, liquidity pressure ${metrics.liquidityPressure}/100, breadth health ${metrics.breadthHealthScore}/100.`,
  ];
  if (coverage.snapshotCountMax <= 1) lines.push("Only one bounded scanner observation is available, so this is a baseline rather than a confirmed intraday change.");
  const topDrift = opportunityDrifts[0];
  if (topDrift) lines.push(`${topDrift.symbol}: ${topDrift.state.toLowerCase()} (${topDrift.metricLabel}).`);
  const eventItem = eventReactionFeed[0];
  if (eventItem) lines.push(`${eventItem.symbol}: ${eventItem.title.toLowerCase()} with ${eventItem.metricLabel}.`);
  if (metrics.shockActivityScore >= 68) lines.push("Shock activity is elevated; treat high-volatility candidates as speculative watch context.");
  if (lines.length === 1) lines.push("No dominant intraday shift is confirmed by the bounded scanner observations.");
  return lines.slice(0, 5);
}

function terminalSummaryFor(
  state: IntradayMarketState,
  direction: IntradayDriftDirection,
  metrics: DriftMetrics,
  coverage: IntradayRegimeDriftSystem["coverage"],
): string {
  return `${state}: intraday drift is ${driftLabel(direction).toLowerCase()} across ${coverage.driftRows}/${coverage.rows} tracked symbols with volatility ${metrics.volatilityPressure}/100, breadth ${metrics.breadthHealthScore}/100, liquidity ${metrics.liquidityPressure}/100, and shock activity ${metrics.shockActivityScore}/100. This is bounded market-state context, not a trade instruction.`;
}

function monitorListFor(metrics: DriftMetrics, opportunityDrifts: IntradayOpportunityDrift[], coverage: IntradayRegimeDriftSystem["coverage"]): string[] {
  const items: string[] = [];
  if (coverage.snapshotCountMax <= 1) items.push("Wait for the next scan observation before treating baseline readings as confirmed intraday drift.");
  if (metrics.volatilityPressure >= 60) items.push("Watch whether volatility pressure expands further or fades on the next observation.");
  if (metrics.breadthHealthScore <= 50) items.push("Monitor whether breadth deterioration spreads beyond isolated symbols.");
  if (metrics.liquidityPressure >= 60) items.push("Monitor liquidity and exchange pressure before trusting continuation.");
  if (metrics.shockActivityScore >= 60) items.push("Separate speculative shock watch names from core decision-quality setups.");
  const fragile = opportunityDrifts.find((item) => item.state === "Fragility Spike");
  if (fragile) items.push(`Watch ${fragile.symbol} for confirmation that fragility pressure is easing rather than accelerating.`);
  if (!items.length) items.push("Continue monitoring breadth, volatility, liquidity, and shock activity for early market-state changes.");
  return items.slice(0, 6);
}

function sectorRotationFor(rows: OpportunityViewModel[], driftBySymbol: Map<string, IntradayDriftRow>): number {
  const sectors = new Map<string, SectorAggregate>();
  for (const row of rows) {
    const sector = cleanText(row.sector ?? row.assetType, "Unknown");
    const score = scoreValue(row.raw.sector_alignment_score ?? row.final_score, row.conviction);
    const change = numberField(driftBySymbol.get(row.symbol)?.score_change) ?? 0;
    const current = sectors.get(sector) ?? { count: 0, improving: 0, scoreTotal: 0, weakening: 0 };
    current.count += 1;
    current.scoreTotal += score;
    if (change >= 3) current.improving += 1;
    if (change <= -3) current.weakening += 1;
    sectors.set(sector, current);
  }
  const values = [...sectors.values()].map((item) => item.scoreTotal / item.count);
  if (values.length <= 1) return 45;
  const dispersion = Math.max(...values) - Math.min(...values);
  const unevenDrift = [...sectors.values()].reduce((total, item) => total + Math.abs(item.improving - item.weakening), 0) / Math.max(1, rows.length);
  return Math.round(clamp(38 + dispersion * 0.72 + unevenDrift * 60));
}

function shockScore(row: OpportunityViewModel, drift: IntradayDriftRow | undefined): number {
  const base = scoreValue(row.raw.event_shock_pressure_score ?? row.raw.shock_score ?? row.raw.upside_shock_score, row.shockPattern?.opportunityScore ?? 45);
  const move = Math.abs(percentValue(drift?.price_change_pct) ?? 0);
  const scoreChange = Math.abs(numberField(drift?.score_change) ?? 0);
  return clamp(weightedAverage([
    [base, 0.56],
    [move * 10 + 35, 0.24],
    [scoreChange * 7 + 35, 0.20],
  ], base));
}

function coverageFor(rows: OpportunityViewModel[], driftRows: IntradayDriftRow[]): IntradayRegimeDriftSystem["coverage"] {
  const coveredSymbols = new Set(driftRows.map((row) => row.symbol));
  const snapshotCounts = driftRows.map((row) => Math.max(0, Math.trunc(row.snapshot_count))).sort((left, right) => left - right);
  const median = snapshotCounts.length ? snapshotCounts[Math.floor(snapshotCounts.length / 2)] ?? 0 : 0;
  return {
    coveragePct: rows.length ? Math.round((coveredSymbols.size / rows.length) * 100) : 0,
    driftRows: coveredSymbols.size,
    rows: rows.length,
    snapshotCountMax: snapshotCounts.at(-1) ?? 0,
    snapshotCountMedian: median,
  };
}

function normalizeDriftRows(rows: IntradayDriftRow[]): IntradayDriftRow[] {
  return rows
    .map((row) => ({ ...row, symbol: cleanSymbol(row.symbol) }))
    .filter((row) => row.symbol)
    .slice(0, 240);
}

function observationWindowLabel(coverage: IntradayRegimeDriftSystem["coverage"]): string {
  if (coverage.snapshotCountMax <= 0) return "No bounded scan observations";
  if (coverage.snapshotCountMax === 1) return "Single bounded scan observation";
  return `${coverage.snapshotCountMedian}-${coverage.snapshotCountMax} bounded scan observations`;
}

function metricLabelFor(scoreChange: number | null, priceMove: number | null): string {
  const score = scoreChange === null ? "score N/A" : `score ${signed(scoreChange, 1)}`;
  const price = priceMove === null ? "price N/A" : `price ${signed(priceMove, 2)}%`;
  return `${score} · ${price}`;
}

function eventLabel(score: number): string {
  if (score >= 75) return "elevated";
  if (score >= 60) return "active";
  return "mixed";
}

function alert(title: string, detail: string, score: number, severity: IntradayAlertSeverity, reasonCodes: string[]): IntradayRegimeAlert {
  return { detail, reasonCodes, score: Math.round(clamp(score)), severity, title };
}

function component(key: IntradayPressureKey, label: string, score: number, inverse: boolean, state: string, detail: string): IntradayPressureComponent {
  return { detail, inverse, key, label, score: Math.round(clamp(score)), state };
}

function pressureLabel(score: number): string {
  if (score >= 70) return "Elevated";
  if (score <= 42) return "Contained";
  return "Mixed";
}

function qualityLabel(score: number): string {
  if (score >= 65) return "Broad";
  if (score <= 42) return "Narrow";
  return "Mixed";
}

export function intradayDriftLabel(direction: IntradayDriftDirection): string {
  if (direction === "unstable_transition") return "Unstable Transition";
  if (direction === "improving") return "Improving";
  if (direction === "deteriorating") return "Deteriorating";
  return "Stable";
}

function driftLabel(direction: IntradayDriftDirection): string {
  return intradayDriftLabel(direction);
}

function scoreValue(value: unknown, fallback: number): number {
  const parsed = numberField(value);
  return parsed === null ? clamp(fallback) : clamp(parsed);
}

function numberField(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

function percentValue(value: unknown): number | null {
  const parsed = numberField(value);
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

function ratio<T>(values: T[], predicate: (value: T) => boolean): number {
  if (!values.length) return 0;
  return values.filter(predicate).length / values.length;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function cleanSymbol(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function signed(value: number, digits: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function severityRank(value: IntradayAlertSeverity): number {
  if (value === "critical") return 3;
  if (value === "warning") return 2;
  return 1;
}
