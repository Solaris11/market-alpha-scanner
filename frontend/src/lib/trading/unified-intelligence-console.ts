import { buildInstitutionalPressureSystem } from "./institutional-intelligence";
import { buildTradeVetoOperatingSystem, type MetaOpportunityPriority } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber, formatMoney } from "@/lib/ui/formatters";

export type UnifiedConsoleZoneKey =
  | "best-setups"
  | "dangerous"
  | "macro-pressure"
  | "market-state"
  | "replay-context"
  | "risk-review"
  | "shock-watch"
  | "volatility-pressure"
  | "watchlist"
  | "what-changed";

export type UnifiedConsoleRankTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type UnifiedConsoleRankedFactor = {
  detail?: string;
  label: string;
  tone: UnifiedConsoleRankTone;
  value: number;
};

export type UnifiedConsoleRankedSymbol = {
  actionContext: string;
  category: string;
  companyName: string | null;
  decision: string;
  detail: string;
  entryContext: string | null;
  factors: UnifiedConsoleRankedFactor[];
  href: string;
  key: string;
  metricLabel: string;
  priceLabel: string;
  rank: number;
  reason: string;
  riskRewardContext: string | null;
  score: number;
  scoreLabel: string;
  sector: string | null;
  setupContext: string;
  symbol: string;
  tone: UnifiedConsoleRankTone;
  trendLabel: string | null;
};

export type UnifiedConsoleRankedZone = {
  dataSource: string;
  emptyMessage: string;
  key: UnifiedConsoleZoneKey;
  label: string;
  limitedEvidence: boolean;
  rankingLogic: string;
  topSymbols: UnifiedConsoleRankedSymbol[];
};

export type UnifiedConsoleItem = {
  actionContext: string;
  attentionPriority: MetaOpportunityPriority["attentionPriority"];
  attentionPriorityScore: number;
  category: string;
  decision: string;
  decisionQualityScore: number;
  detail: string;
  href: string;
  key: string;
  metricLabel: string;
  opportunityScore: number;
  reasonForAttention: string;
  riskScore: number;
  riskLabel: string;
  symbol: string;
  timingQualityScore: number;
  urgencyLabel: string;
  urgencyScore: number;
};

export type UnifiedConsoleMetric = {
  detail: string;
  inverse?: boolean;
  key: string;
  label: string;
  score: number;
};

export type UnifiedConsoleBriefing = {
  actionContext: string;
  label: string;
  priority: "high" | "low" | "medium";
  source: "asymmetry" | "change" | "event" | "fragility" | "macro" | "opportunity" | "shock" | "watchlist";
  symbol?: string;
};

export type UnifiedConsoleLlmPacket = {
  generatedAt: string;
  guardrail: string;
  marketState: string;
  topAttentionSymbols: string[];
  topRisks: string[];
  whatChanged: string[];
};

export type UnifiedIntelligenceConsoleModel = {
  attentionQueue: UnifiedConsoleItem[];
  bestAsymmetry: UnifiedConsoleBriefing[];
  biggestChanges: UnifiedConsoleBriefing[];
  eventPressure: UnifiedConsoleBriefing[];
  fragilityRising: UnifiedConsoleBriefing[];
  generatedAt: string;
  llmSummaryPacket: UnifiedConsoleLlmPacket;
  macroRegime: {
    label: string;
    summary: string;
  };
  metrics: UnifiedConsoleMetric[];
  personalizedSummary: string;
  rankedZones: Record<UnifiedConsoleZoneKey, UnifiedConsoleRankedZone>;
  shockConditionsAligning: UnifiedConsoleBriefing[];
  summary: string;
  topOpportunities: UnifiedConsoleItem[];
  topRisks: UnifiedConsoleItem[];
  watchlistChanges: UnifiedConsoleBriefing[];
  whatChangedSinceLastVisit: UnifiedConsoleBriefing[];
  whatMattersMost: string[];
};

export type UnifiedIntelligenceConsoleInput = {
  marketCondition?: string | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

export function buildUnifiedIntelligenceConsole(input: UnifiedIntelligenceConsoleInput): UnifiedIntelligenceConsoleModel {
  const rows = input.rows;
  const operatingSystem = buildTradeVetoOperatingSystem({
    personalizationProfile: input.personalizationProfile ?? null,
    rows,
    workflowEvolution: input.workflowEvolution ?? null,
  });
  const institutionalSystem = buildInstitutionalPressureSystem(rows);
  const regimeSystem = buildRegimeShiftSystem({ rows, workflowEvolution: input.workflowEvolution ?? null });
  const topOpportunities = operatingSystem.priorityQueue.slice(0, 5).map(toConsoleItem);
  const topRisks = operatingSystem.dangerQueue.slice(0, 5).map(toConsoleItem);
  const attentionQueue = operatingSystem.attentionQueue.length
    ? operatingSystem.attentionQueue.slice(0, 6).map(toConsoleItem)
    : operatingSystem.priorityQueue.slice(0, 6).map(toConsoleItem);
  const shockConditionsAligning = shockBriefings(rows);
  const eventPressure = eventBriefings(rows);
  const fragilityRising = fragilityBriefings(rows, input.workflowEvolution ?? null);
  const bestAsymmetry = asymmetryBriefings(institutionalSystem.highAsymmetry);
  const whatChangedSinceLastVisit = changeBriefings(input.workflowEvolution?.whatChanged ?? [], "change");
  const watchlistChanges = changeBriefings(input.workflowEvolution?.watchlistEvolution ?? [], "watchlist");
  const biggestChanges = whatChangedSinceLastVisit.length ? whatChangedSinceLastVisit : fallbackChangeBriefings(rows);
  const topAttentionSymbols = attentionQueue.slice(0, 4).map((item) => item.symbol);
  const rankedZones = buildRankedZones({
    priorityQueue: operatingSystem.priorityQueue,
    rows,
    watchlistSymbols: input.watchlistSymbols ?? [],
    workflowEvolution: input.workflowEvolution ?? null,
  });

  return {
    attentionQueue,
    bestAsymmetry,
    biggestChanges,
    eventPressure,
    fragilityRising,
    generatedAt: operatingSystem.generatedAt,
    llmSummaryPacket: {
      generatedAt: operatingSystem.generatedAt,
      guardrail: "AI may summarize this scored TradeVeto data only; it must not invent events, prices, probabilities, or override scores.",
      marketState: operatingSystem.marketState,
      topAttentionSymbols,
      topRisks: topRisks.map((item) => `${item.symbol}: ${item.reasonForAttention}`),
      whatChanged: biggestChanges.map((item) => item.label),
    },
    macroRegime: {
      label: input.marketCondition ?? regimeSystem.currentMarketState,
      summary: regimeSystem.terminalSummary || operatingSystem.marketStateReason,
    },
    metrics: [
      metric("attention", "Attention", average(attentionQueue.map((item) => item.attentionPriorityScore), 50), "Highest-priority opportunities, risks, large-move signals, and workflow changes."),
      metric("opportunity", "Opportunity", operatingSystem.metaOpportunityAverage, "Average opportunity quality across the visible universe."),
      metric("decision", "Decision Quality", operatingSystem.decisionQualityAverage, "Decision quality combines timing, upside/downside balance, market pressure, and position quality."),
      metric("risk", "Risk Pressure", operatingSystem.metaRiskAverage, "Higher values require more caution and a clearer break area.", true),
      metric("fragility", "Fragility", average(rows.map((row) => row.fragility), 50), "Average setup failure risk across the scanner universe.", true),
      metric("asymmetry", "Upside / Downside", institutionalSystem.averageAsymmetryScore, "Average measured upside/downside structure across the visible universe."),
    ],
    personalizedSummary: personalizedSummaryFor(input.personalizationProfile ?? null, topOpportunities),
    rankedZones,
    shockConditionsAligning,
    summary: operatingSystem.summary,
    topOpportunities,
    topRisks,
    watchlistChanges,
    whatChangedSinceLastVisit,
    whatMattersMost: whatMattersMostFor({
      bestAsymmetry,
      eventPressure,
      fragilityRising,
      macroSummary: regimeSystem.terminalSummary || operatingSystem.marketStateReason,
      shockConditionsAligning,
      topOpportunities,
      topRisks,
    }),
  };
}

type RankedZoneBuildInput = {
  priorityQueue: MetaOpportunityPriority[];
  rows: OpportunityViewModel[];
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
};

type ZoneScoreModel = {
  actionContext: string;
  detail: string;
  factors: UnifiedConsoleRankedFactor[];
  reason: string;
  score: number;
  scoreLabel: string;
  tone: UnifiedConsoleRankTone;
};

function buildRankedZones(input: RankedZoneBuildInput): Record<UnifiedConsoleZoneKey, UnifiedConsoleRankedZone> {
  const priorityBySymbol = new Map(input.priorityQueue.map((item) => [item.symbol.toUpperCase(), item]));
  const workflowBySymbol = workflowChangeMap(input.workflowEvolution);
  const watchlist = new Set(input.watchlistSymbols.map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  const watchlistWorkflowSymbols = new Set((input.workflowEvolution?.watchlistEvolution ?? []).map((item) => cleanSymbol(item.symbol)).filter((symbol): symbol is string => Boolean(symbol)));

  return {
    "best-setups": rankedZone({
      dataSource: "Meta opportunity priority queue, scanner score fields, macro alignment, evidence maturity, risk/reward fields",
      emptyMessage: "No setup has enough scored opportunity evidence yet.",
      key: "best-setups",
      label: "Best Setups",
      rankingLogic: "Ranks by opportunity score, conviction, evidence maturity, macro support, risk/reward, setup quality, and lower fragility.",
      rows: input.rows,
      scoreForRow: (row) => bestSetupScore(row, priorityBySymbol.get(row.symbol.toUpperCase())),
    }),
    dangerous: rankedZone({
      dataSource: "Danger queue, fragility, volatility pressure, event risk, downside pressure, macro alignment",
      emptyMessage: "No dangerous-now candidates have enough risk evidence yet.",
      key: "dangerous",
      label: "Dangerous Now",
      rankingLogic: "Ranks by risk score, fragility, volatility pressure, event risk, downside pressure, weak structure, and negative macro alignment.",
      rows: input.rows,
      scoreForRow: (row) => dangerousScore(row, priorityBySymbol.get(row.symbol.toUpperCase())),
    }),
    "macro-pressure": rankedZone({
      dataSource: "Macro alignment, sector alignment, liquidity pressure, volatility pressure, macro pressure score, event macro pressure",
      emptyMessage: "No symbol-level macro pressure ranking is available yet.",
      key: "macro-pressure",
      label: "Macro Pressure",
      rankingLogic: "Ranks by negative macro alignment, sector pressure, liquidity pressure, volatility pressure, event macro pressure, and broad-market conflict fields.",
      rows: input.rows,
      scoreForRow: macroPressureScore,
    }),
    "market-state": rankedZone({
      dataSource: "Unified attention queue, opportunity queue, risk score, urgency, scanner score fields",
      emptyMessage: "No market-state attention candidates are available yet.",
      key: "market-state",
      label: "Market State",
      rankingLogic: "Ranks by unified attention score, urgency, risk/opportunity intensity, and current scanner score.",
      rows: input.rows,
      scoreForRow: (row) => marketStateScore(row, priorityBySymbol.get(row.symbol.toUpperCase())),
    }),
    "replay-context": rankedZone({
      dataSource: "Shock pattern, analog quality, regime similarity, event similarity, market memory fields",
      emptyMessage: "No validated replay or market-memory candidates are available yet.",
      key: "replay-context",
      label: "Replay Context",
      rankingLogic: "Ranks by historical analog strength, memory similarity, replay support, prior outcome quality, and available evidence depth.",
      rows: input.rows,
      scoreForRow: replayContextScore,
    }),
    "risk-review": rankedZone({
      dataSource: "Risk/reward fields, fragility, stop proximity, entry extension, timing quality, evidence maturity",
      emptyMessage: "No risk-review candidates have enough scored risk/reward evidence yet.",
      key: "risk-review",
      label: "Risk Review",
      rankingLogic: "Ranks by risk/reward weakness, fragility, stop proximity, overextension, poor timing, and low evidence maturity.",
      rows: input.rows,
      scoreForRow: (row) => riskReviewScore(row, priorityBySymbol.get(row.symbol.toUpperCase())),
    }),
    "shock-watch": rankedZone({
      dataSource: "Shock pattern model, volatility compression/expansion, event shock pressure, unusual movement, price extension",
      emptyMessage: "No large-move shock candidates are validated in this snapshot.",
      key: "shock-watch",
      label: "Shock Watch",
      rankingLogic: "Ranks by large-move score, volatility compression/expansion, event pressure, unusual movement, replay shock similarity, and price extension.",
      rows: input.rows,
      scoreForRow: shockWatchScore,
    }),
    "volatility-pressure": rankedZone({
      dataSource: "Volatility pressure, ATR proxy fields, shock risk, recent expansion, unstable price behavior, market-regime pressure",
      emptyMessage: "No volatility-pressure candidates have enough validated pressure evidence yet.",
      key: "volatility-pressure",
      label: "Volatility Pressure",
      rankingLogic: "Ranks by volatility pressure, shock risk, recent expansion, unstable price behavior, fragility, and regime pressure.",
      rows: input.rows,
      scoreForRow: volatilityPressureScore,
    }),
    watchlist: rankedZone({
      dataSource: "User watchlist symbols, watchlist workflow evolution, score/risk changes, alert-adjacent setup changes",
      emptyMessage: "Add watchlist symbols or revisit tracked names to see a ranked watchlist intelligence queue.",
      key: "watchlist",
      label: "Watchlist Intelligence",
      rankingLogic: "Ranks watchlist symbols first by improving confidence, deteriorating risk, alert/setup changes, current conviction, and workflow movement.",
      rows: input.rows.filter((row) => watchlist.has(row.symbol.toUpperCase()) || watchlistWorkflowSymbols.has(row.symbol.toUpperCase())),
      scoreForRow: (row) => watchlistScore(row, workflowBySymbol.get(row.symbol.toUpperCase())),
    }),
    "what-changed": rankedZone({
      dataSource: "Workflow evolution, score deltas, risk deltas, confidence/readiness deltas, watchlist state changes",
      emptyMessage: "No scan-to-scan or workflow change ranking is available in this snapshot.",
      key: "what-changed",
      label: "What Changed",
      rankingLogic: "Ranks by largest score change, risk change, confidence/readiness change, watchlist state change, and market-state impact.",
      rows: input.rows,
      scoreForRow: (row) => whatChangedScore(row, workflowBySymbol.get(row.symbol.toUpperCase())),
    }),
  };
}

function rankedZone(input: {
  dataSource: string;
  emptyMessage: string;
  key: UnifiedConsoleZoneKey;
  label: string;
  rankingLogic: string;
  rows: OpportunityViewModel[];
  scoreForRow: (row: OpportunityViewModel) => ZoneScoreModel | null;
}): UnifiedConsoleRankedZone {
  const topSymbols = input.rows
    .map((row) => {
      const model = input.scoreForRow(row);
      if (!model) return null;
      return rankedSymbolFor(row, model);
    })
    .filter((item): item is UnifiedConsoleRankedSymbol => item !== null)
    .sort((left, right) => right.score - left.score || left.symbol.localeCompare(right.symbol))
    .slice(0, 10)
    .map((item, index) => ({ ...item, rank: index + 1, key: `${input.key}:${item.symbol}:${index + 1}` }));

  return {
    dataSource: input.dataSource,
    emptyMessage: input.emptyMessage,
    key: input.key,
    label: input.label,
    limitedEvidence: topSymbols.length < 5,
    rankingLogic: input.rankingLogic,
    topSymbols,
  };
}

function rankedSymbolFor(row: OpportunityViewModel, model: ZoneScoreModel): UnifiedConsoleRankedSymbol {
  return {
    actionContext: model.actionContext,
    category: cleanText(row.raw.setup_type ?? row.recommendationQualityLabel ?? row.assetType ?? "Research candidate", "Research candidate"),
    companyName: row.company_name,
    decision: cleanText(row.final_decision, "Monitor"),
    detail: model.detail,
    entryContext: entryContextFor(row),
    factors: model.factors,
    href: `/symbol/${encodeURIComponent(row.symbol)}`,
    key: `${row.symbol}:${model.scoreLabel}`,
    metricLabel: `${model.score}/100 ${model.scoreLabel}`,
    priceLabel: row.price === null ? "Price unavailable" : formatMoney(row.price),
    rank: 0,
    reason: model.reason,
    riskRewardContext: riskRewardContextFor(row),
    score: model.score,
    scoreLabel: model.scoreLabel,
    sector: row.sector,
    setupContext: setupContextFor(row),
    symbol: row.symbol,
    tone: model.tone,
    trendLabel: trendLabelFor(row),
  };
}

function bestSetupScore(row: OpportunityViewModel, priority: MetaOpportunityPriority | undefined): ZoneScoreModel | null {
  const evidence = evidenceScore(row);
  const macro = numberField(row.raw.macro_alignment_score ?? row.raw.macro_score ?? row.raw.sector_alignment_score);
  const rr = riskRewardScore(row);
  const score = weightedScore([
    [priority?.metaOpportunityScore, 0.26],
    [row.final_score, 0.18],
    [row.conviction, 0.16],
    [evidence, 0.12],
    [macro, 0.10],
    [rr, 0.10],
    [100 - row.fragility, 0.08],
  ]);
  if (score === null) return null;
  return {
    actionContext: row.fragility >= 70 ? "Monitor, but review fragility and invalidation before treating the setup as higher quality." : "Open symbol detail and verify entry, invalidation, evidence freshness, and market support.",
    detail: row.decision_reason || priority?.keyReasons[0] || "Current scanner evidence supports monitoring this setup.",
    factors: [
      rankedFactor("Opportunity", priority?.metaOpportunityScore ?? row.final_score, "emerald", priority?.reasonForAttention),
      rankedFactor("Conviction", row.conviction, "cyan", row.confidenceLabel),
      rankedFactor("Evidence", evidence, "cyan", row.evidence?.label),
      rankedFactor("Macro", macro, "amber", row.macroLabel),
      rankedFactor("Risk/Reward", rr, "emerald", riskRewardContextFor(row) ?? undefined),
      rankedFactor("Fragility", 100 - row.fragility, "rose", row.fragilityLabel),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: priority?.reasonForAttention ?? `${row.symbol} ranks by opportunity quality, conviction, evidence maturity, and setup context.`,
    score,
    scoreLabel: "Opportunity",
    tone: "emerald",
  };
}

function dangerousScore(row: OpportunityViewModel, priority: MetaOpportunityPriority | undefined): ZoneScoreModel | null {
  const volatility = numberField(row.raw.volatility_pressure);
  const downside = row.shockPattern?.downsideRiskScore ?? null;
  const weakMacro = inverseScore(row.raw.macro_alignment_score ?? row.raw.macro_score ?? row.raw.sector_alignment_score);
  const decisionRisk = String(row.final_decision ?? "").toUpperCase().includes("AVOID") ? 82 : null;
  const score = weightedScore([
    [priority?.metaRiskScore, 0.26],
    [row.fragility, 0.18],
    [volatility, 0.16],
    [row.eventRisk, 0.14],
    [downside, 0.10],
    [weakMacro, 0.10],
    [decisionRisk, 0.06],
  ]);
  if (score === null) return null;
  return {
    actionContext: score >= 76 ? "Risk review first; treat as research context until fragility, timing, and invalidation improve." : "Monitor the risk driver and confirm whether pressure is still increasing.",
    detail: priority?.keyRisks[0] ?? row.fragilityLabel,
    factors: [
      rankedFactor("Risk", priority?.metaRiskScore, "rose", priority?.keyRisks[0]),
      rankedFactor("Fragility", row.fragility, "amber", row.fragilityLabel),
      rankedFactor("Volatility", volatility, "violet", "Volatility pressure"),
      rankedFactor("Event", row.eventRisk, "rose", row.eventLabel),
      rankedFactor("Macro drag", weakMacro, "amber", row.macroLabel),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: priority?.keyRisks[0] ?? `${row.symbol} has elevated fragility, event, volatility, or macro pressure.`,
    score,
    scoreLabel: "Risk",
    tone: score >= 75 ? "rose" : "amber",
  };
}

function shockWatchScore(row: OpportunityViewModel): ZoneScoreModel | null {
  const shock = row.shockPattern;
  const eventShock = numberField(row.raw.event_shock_pressure_score);
  const volatility = numberField(row.raw.volatility_pressure);
  const move = recentMoveScore(row);
  const extension = entryExtensionScore(row);
  const score = weightedScore([
    [shock?.currentSimilarityScore, 0.24],
    [shock?.upsideShockScore, 0.18],
    [shock?.twoSidedVolatilityScore, 0.18],
    [eventShock, 0.14],
    [volatility, 0.14],
    [move, 0.07],
    [extension, 0.05],
  ]);
  if (score === null) return null;
  return {
    actionContext: "Use large-move context as research only; check chase risk, event pressure, and invalidation before assuming continuation.",
    detail: shock?.opportunityState ?? "Large-move context is driven by volatility, event, or shock pressure fields.",
    factors: [
      rankedFactor("Similarity", shock?.currentSimilarityScore, "violet", "Current shock similarity"),
      rankedFactor("Upside shock", shock?.upsideShockScore, "emerald", "Upside shock history"),
      rankedFactor("Two-sided vol", shock?.twoSidedVolatilityScore, "amber", "Two-sided volatility"),
      rankedFactor("Event shock", eventShock, "rose", "Event shock pressure"),
      rankedFactor("Volatility", volatility, "violet", "Volatility pressure"),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: shock ? `${row.symbol} has ${shock.currentSimilarityScore}/100 current large-move similarity and ${shock.twoSidedVolatilityScore}/100 two-sided volatility.` : `${row.symbol} has event, volatility, or movement pressure that belongs on shock watch.`,
    score,
    scoreLabel: "Shock",
    tone: "violet",
  };
}

function riskReviewScore(row: OpportunityViewModel, priority: MetaOpportunityPriority | undefined): ZoneScoreModel | null {
  const rrWeakness = inverseScore(riskRewardScore(row));
  const stopProximity = stopProximityScore(row);
  const extension = entryExtensionScore(row);
  const timingWeakness = inverseScore(priority?.timingQualityScore);
  const evidenceWeakness = inverseScore(evidenceScore(row));
  const score = weightedScore([
    [priority?.metaRiskScore, 0.22],
    [rrWeakness, 0.18],
    [row.fragility, 0.18],
    [stopProximity, 0.14],
    [extension, 0.12],
    [timingWeakness, 0.10],
    [evidenceWeakness, 0.06],
  ]);
  if (score === null) return null;
  return {
    actionContext: "Review invalidation, stop proximity, overextension, evidence maturity, and whether reward still compensates for risk.",
    detail: riskRewardContextFor(row) ?? priority?.actionContext ?? "Risk review is driven by fragility, timing, entry distance, and evidence quality.",
    factors: [
      rankedFactor("Risk", priority?.metaRiskScore, "rose", priority?.keyRisks[0]),
      rankedFactor("R/R weakness", rrWeakness, "amber", riskRewardContextFor(row) ?? undefined),
      rankedFactor("Fragility", row.fragility, "rose", row.fragilityLabel),
      rankedFactor("Stop proximity", stopProximity, "amber", "Distance to invalidation"),
      rankedFactor("Timing risk", timingWeakness, "amber", priority?.actionContext),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: `${row.symbol} needs risk review because risk/reward, fragility, stop proximity, timing, or evidence quality is limiting the setup.`,
    score,
    scoreLabel: "Review",
    tone: "rose",
  };
}

function macroPressureScore(row: OpportunityViewModel): ZoneScoreModel | null {
  const macroDrag = inverseScore(row.raw.macro_alignment_score ?? row.raw.macro_score ?? row.raw.risk_on_score);
  const sectorDrag = inverseScore(row.raw.sector_alignment_score);
  const macroPressure = numberField(row.raw.macro_pressure_score ?? row.raw.macro_conflict_penalty);
  const liquidity = numberField(row.raw.liquidity_pressure);
  const volatility = numberField(row.raw.volatility_pressure);
  const eventMacro = numberField(row.raw.event_macro_pressure_adjustment);
  const score = weightedScore([
    [macroDrag, 0.24],
    [sectorDrag, 0.18],
    [macroPressure, 0.18],
    [liquidity, 0.16],
    [volatility, 0.14],
    [eventMacro, 0.10],
  ]);
  if (score === null) return null;
  return {
    actionContext: "Compare the symbol setup against macro, sector, liquidity, and volatility pressure before treating isolated strength as durable.",
    detail: row.macroLabel,
    factors: [
      rankedFactor("Macro drag", macroDrag, "amber", row.macroLabel),
      rankedFactor("Sector drag", sectorDrag, "amber", row.raw.sector_context_label ? String(row.raw.sector_context_label) : undefined),
      rankedFactor("Macro pressure", macroPressure, "rose", row.raw.macro_context_summary ? String(row.raw.macro_context_summary) : undefined),
      rankedFactor("Liquidity", liquidity, "rose", "Liquidity pressure"),
      rankedFactor("Volatility", volatility, "violet", "Volatility pressure"),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: `${row.symbol} ranks by macro/sector pressure, liquidity stress, volatility, and conflict with the current regime.`,
    score,
    scoreLabel: "Macro",
    tone: "amber",
  };
}

function whatChangedScore(row: OpportunityViewModel, change: WorkflowChangeItem | undefined): ZoneScoreModel | null {
  const scoreChange = deltaScore(row.raw.score_change);
  const riskChange = deltaScore(row.raw.risk_change ?? row.raw.fragility_change);
  const confidenceChange = deltaScore(row.raw.confidence_change ?? row.raw.readiness_change);
  const workflowScore = change ? (change.severity === "warning" ? 84 : change.severity === "positive" ? 76 : 62) : null;
  const score = weightedScore([
    [workflowScore, 0.34],
    [scoreChange, 0.24],
    [riskChange, 0.22],
    [confidenceChange, 0.20],
  ]);
  if (score === null) return null;
  return {
    actionContext: change?.detail ?? "Open history or symbol detail to confirm whether the change is sustained across fresh scanner snapshots.",
    detail: change?.metricLabel ?? "Change ranking is based on current scanner delta fields.",
    factors: [
      rankedFactor("Workflow", workflowScore, change?.severity === "warning" ? "rose" : "cyan", change?.title),
      rankedFactor("Score move", scoreChange, "cyan", "Absolute score change"),
      rankedFactor("Risk move", riskChange, "rose", "Absolute risk or fragility change"),
      rankedFactor("Confidence move", confidenceChange, "emerald", "Absolute confidence/readiness change"),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: change ? `${row.symbol}: ${change.title} (${change.metricLabel}).` : `${row.symbol} has the largest available scanner delta fields in this snapshot.`,
    score,
    scoreLabel: "Change",
    tone: change?.severity === "warning" ? "rose" : change?.severity === "positive" ? "emerald" : "cyan",
  };
}

function watchlistScore(row: OpportunityViewModel, change: WorkflowChangeItem | undefined): ZoneScoreModel | null {
  const scoreChange = signedSignalScore(row.raw.score_change);
  const confidence = row.conviction;
  const riskDeterioration = numberField(row.raw.risk_change ?? row.raw.fragility_change) ?? (row.fragility >= 70 ? row.fragility : null);
  const alertLike = row.eventRisk >= 65 ? row.eventRisk : null;
  const workflowScore = change ? (change.severity === "warning" ? 82 : change.severity === "positive" ? 78 : 64) : null;
  const score = weightedScore([
    [workflowScore, 0.28],
    [scoreChange, 0.22],
    [confidence, 0.18],
    [riskDeterioration, 0.18],
    [alertLike, 0.14],
  ]);
  if (score === null) return null;
  return {
    actionContext: change?.detail ?? "Review watchlist context, setup evolution, and alert rules before changing monitoring behavior.",
    detail: change?.metricLabel ?? row.decision_reason ?? "Tracked setup context is available from the latest scanner row.",
    factors: [
      rankedFactor("Workflow", workflowScore, change?.severity === "warning" ? "rose" : "emerald", change?.title),
      rankedFactor("Score drift", scoreChange, "cyan", "Score movement"),
      rankedFactor("Conviction", confidence, "emerald", row.confidenceLabel),
      rankedFactor("Risk drift", riskDeterioration, "rose", "Risk or fragility change"),
      rankedFactor("Alert pressure", alertLike, "amber", row.eventLabel),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: change ? `${row.symbol} is tracked and changed: ${change.title}.` : `${row.symbol} is tracked and has fresh setup, confidence, risk, or alert context.`,
    score,
    scoreLabel: "Watch",
    tone: change?.severity === "warning" ? "rose" : "emerald",
  };
}

function replayContextScore(row: OpportunityViewModel): ZoneScoreModel | null {
  const shock = row.shockPattern;
  const analog = numberField(row.raw.analog_quality_score);
  const regimeSimilarity = numberField(row.raw.regime_similarity_score);
  const eventSimilarity = numberField(row.raw.event_similarity_score);
  const evidenceDepth = sampleDepthScore(row.raw.market_memory_sample_size ?? row.raw.historical_sample_size ?? row.raw.forward_return_sample_size);
  const score = weightedScore([
    [shock?.currentSimilarityScore, 0.24],
    [analog, 0.22],
    [regimeSimilarity, 0.20],
    [eventSimilarity, 0.14],
    [shock?.reliabilityScore, 0.12],
    [evidenceDepth, 0.08],
  ]);
  if (score === null) return null;
  return {
    actionContext: "Use replay and memory context as conditional evidence; compare current macro, risk, and freshness before relying on analogs.",
    detail: shock?.opportunityState ?? "Replay context comes from market-memory, analog, and regime-similarity fields.",
    factors: [
      rankedFactor("Replay", shock?.currentSimilarityScore, "violet", "Current similarity"),
      rankedFactor("Analog", analog, "cyan", "Analog quality"),
      rankedFactor("Regime", regimeSimilarity, "amber", "Regime similarity"),
      rankedFactor("Event match", eventSimilarity, "rose", "Event similarity"),
      rankedFactor("Evidence depth", evidenceDepth, "emerald", "Historical sample depth"),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: `${row.symbol} ranks by replay similarity, market-memory quality, regime similarity, and evidence depth.`,
    score,
    scoreLabel: "Replay",
    tone: "violet",
  };
}

function volatilityPressureScore(row: OpportunityViewModel): ZoneScoreModel | null {
  const volatility = numberField(row.raw.volatility_pressure);
  const shockRisk = row.shockPattern ? weightedScore([
    [row.shockPattern.twoSidedVolatilityScore, 0.45],
    [row.shockPattern.downsideRiskScore, 0.35],
    [row.shockPattern.chaseRiskScore, 0.20],
  ]) : null;
  const move = recentMoveScore(row);
  const instability = row.fragility;
  const regimePressure = numberField(row.raw.macro_pressure_score ?? row.raw.liquidity_pressure);
  const score = weightedScore([
    [volatility, 0.28],
    [shockRisk, 0.24],
    [move, 0.18],
    [instability, 0.18],
    [regimePressure, 0.12],
  ]);
  if (score === null) return null;
  return {
    actionContext: "Treat expanding volatility as a monitoring condition; confirm whether movement is supported or just unstable price behavior.",
    detail: "Volatility pressure ranking uses current pressure, shock risk, recent movement, fragility, and regime pressure.",
    factors: [
      rankedFactor("Volatility", volatility, "violet", "Volatility pressure"),
      rankedFactor("Shock risk", shockRisk, "rose", "Shock/chase/downside blend"),
      rankedFactor("Recent move", move, "amber", "Recent price movement"),
      rankedFactor("Fragility", instability, "rose", row.fragilityLabel),
      rankedFactor("Regime", regimePressure, "amber", "Macro or liquidity pressure"),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: `${row.symbol} ranks by volatility pressure, shock risk, recent expansion, fragility, and regime pressure.`,
    score,
    scoreLabel: "Volatility",
    tone: "violet",
  };
}

function marketStateScore(row: OpportunityViewModel, priority: MetaOpportunityPriority | undefined): ZoneScoreModel | null {
  const score = weightedScore([
    [priority?.attentionPriorityScore, 0.34],
    [priority?.urgencyScore, 0.20],
    [priority?.metaRiskScore, 0.18],
    [priority?.metaOpportunityScore, 0.18],
    [row.final_score, 0.10],
  ]);
  if (score === null) return null;
  return {
    actionContext: priority?.actionContext ?? "Review symbol detail to see why this row affects the current market-state read.",
    detail: priority?.state ?? row.decision_reason ?? "Market-state ranking uses attention, urgency, risk, and opportunity intensity.",
    factors: [
      rankedFactor("Attention", priority?.attentionPriorityScore, "cyan", priority?.reasonForAttention),
      rankedFactor("Urgency", priority?.urgencyScore, "amber", priority?.urgencyLabel),
      rankedFactor("Risk", priority?.metaRiskScore, "rose", priority?.keyRisks[0]),
      rankedFactor("Opportunity", priority?.metaOpportunityScore, "emerald", priority?.keyReasons[0]),
    ].filter((factor): factor is UnifiedConsoleRankedFactor => factor !== null),
    reason: priority?.reasonForAttention ?? `${row.symbol} contributes to the current market state through scored scanner and attention fields.`,
    score,
    scoreLabel: "Attention",
    tone: score >= 72 ? "cyan" : "amber",
  };
}

function workflowChangeMap(workflow: WorkflowEvolutionSummary | null): Map<string, WorkflowChangeItem> {
  const map = new Map<string, WorkflowChangeItem>();
  const changes = [
    ...(workflow?.whatChanged ?? []),
    ...(workflow?.watchlistEvolution ?? []),
    ...(workflow?.deterioratingSetups ?? []),
    ...(workflow?.improvingSetups ?? []),
  ];
  for (const change of changes) {
    const symbol = cleanSymbol(change.symbol);
    if (!symbol || symbol === "WORKFLOW" || map.has(symbol)) continue;
    map.set(symbol, change);
  }
  return map;
}

function rankedFactor(label: string, value: number | null | undefined, tone: UnifiedConsoleRankTone, detail?: string): UnifiedConsoleRankedFactor | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return {
    detail,
    label,
    tone,
    value: Math.round(clamp(value)),
  };
}

function weightedScore(values: Array<[number | null | undefined, number]>): number | null {
  let numerator = 0;
  let denominator = 0;
  for (const [value, weight] of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    numerator += clamp(value) * weight;
    denominator += weight;
  }
  return denominator > 0 ? Math.round(clamp(numerator / denominator)) : null;
}

function cleanSymbol(value: unknown): string | null {
  const text = cleanText(value, "").trim().toUpperCase();
  return text || null;
}

function numberField(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

function inverseScore(value: unknown): number | null {
  const parsed = numberField(value);
  if (parsed === null) return null;
  return clamp(100 - parsed);
}

function deltaScore(value: unknown): number | null {
  const parsed = numberField(value);
  if (parsed === null) return null;
  return clamp(Math.abs(parsed) * 8 + 36);
}

function signedSignalScore(value: unknown): number | null {
  const parsed = numberField(value);
  if (parsed === null) return null;
  return clamp(50 + parsed * 7);
}

function recentMoveScore(row: OpportunityViewModel): number | null {
  const parsed = numberField(row.raw.return_1d ?? row.raw.price_change_pct ?? row.raw.return_1w ?? row.raw.return_1m);
  if (parsed === null) return null;
  const percent = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return clamp(Math.abs(percent) * 8 + 30);
}

function entryExtensionScore(row: OpportunityViewModel): number | null {
  const parsed = numberField(row.raw.entry_distance_pct ?? row.raw.distance_from_entry_pct ?? row.raw.correction_distance_pct);
  if (parsed === null) return null;
  return clamp(Math.abs(parsed) * 10 + 24);
}

function stopProximityScore(row: OpportunityViewModel): number | null {
  if (row.price === null || row.stop_loss === null || row.price === 0) return null;
  const distancePct = Math.abs((row.price - row.stop_loss) / row.price) * 100;
  return clamp(100 - distancePct * 10);
}

function riskRewardScore(row: OpportunityViewModel): number | null {
  const rr = numberField(row.raw.risk_reward ?? row.raw.conservative_risk_reward ?? row.raw.balanced_risk_reward_high ?? row.raw.aggressive_risk_reward_high);
  if (rr === null) return null;
  return clamp(38 + rr * 20);
}

function evidenceScore(row: OpportunityViewModel): number | null {
  const explicit = numberField(row.raw.score_reliability ?? row.raw.confidence_reliability ?? row.raw.outcome_coverage ?? row.raw.forward_return_coverage);
  if (explicit !== null) return explicit;
  const label = cleanText(row.evidence?.label ?? row.raw.evidence_maturity, "").toLowerCase();
  if (/strong|high|mature|validated/.test(label)) return 78;
  if (/medium|partial|developing|mixed/.test(label)) return 58;
  if (/limited|thin|low|insufficient/.test(label)) return 34;
  return null;
}

function sampleDepthScore(value: unknown): number | null {
  const parsed = numberField(value);
  if (parsed === null) return null;
  return clamp(24 + Math.log10(Math.max(1, parsed)) * 28);
}

function setupContextFor(row: OpportunityViewModel): string {
  return cleanText(row.raw.setup_type ?? row.entryStatus ?? row.recommendationQualityLabel ?? "Research setup", "Research setup");
}

function entryContextFor(row: OpportunityViewModel): string | null {
  if (row.entryZoneLabel) return `Entry zone ${row.entryZoneLabel}`;
  if (row.suggested_entry !== null) return `Suggested entry context ${formatMoney(row.suggested_entry)}`;
  return null;
}

function riskRewardContextFor(row: OpportunityViewModel): string | null {
  const label = cleanText(row.raw.risk_reward_label ?? row.raw.target_risk_reward_label, "");
  const rr = numberField(row.raw.risk_reward ?? row.raw.conservative_risk_reward ?? row.raw.balanced_risk_reward_high);
  const target = row.target === null ? null : `target ${formatMoney(row.target)}`;
  const stop = row.stop_loss === null ? null : `stop ${formatMoney(row.stop_loss)}`;
  const pieces = [
    label || null,
    rr === null ? null : `R/R ${rr.toFixed(2)}`,
    target,
    stop,
  ].filter((item): item is string => Boolean(item));
  return pieces.length ? pieces.join(" · ") : null;
}

function trendLabelFor(row: OpportunityViewModel): string | null {
  const parsed = numberField(row.raw.return_1d ?? row.raw.price_change_pct);
  if (parsed === null) return null;
  const percent = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}% 1D`;
}

function toConsoleItem(item: MetaOpportunityPriority): UnifiedConsoleItem {
  return {
    actionContext: item.actionContext,
    attentionPriority: item.attentionPriority,
    attentionPriorityScore: item.attentionPriorityScore,
    category: item.category,
    decision: item.decision,
    decisionQualityScore: item.decisionQualityScore,
    detail: item.keyReasons[0] ?? item.state,
    href: `/symbol/${item.symbol}`,
    key: `${item.symbol}:${item.category}`,
    metricLabel: `${item.metaOpportunityScore} opp / ${item.metaRiskScore} risk`,
    opportunityScore: item.metaOpportunityScore,
    reasonForAttention: item.reasonForAttention,
    riskScore: item.metaRiskScore,
    riskLabel: item.keyRisks[0] ?? "Risk still has uncertainty.",
    symbol: item.symbol,
    timingQualityScore: item.timingQualityScore,
    urgencyLabel: item.urgencyLabel,
    urgencyScore: item.urgencyScore,
  };
}

function metric(key: string, label: string, value: number, detail: string, inverse = false): UnifiedConsoleMetric {
  return { detail, inverse, key, label, score: Math.round(clamp(value)) };
}

function whatMattersMostFor(input: {
  bestAsymmetry: UnifiedConsoleBriefing[];
  eventPressure: UnifiedConsoleBriefing[];
  fragilityRising: UnifiedConsoleBriefing[];
  macroSummary: string;
  shockConditionsAligning: UnifiedConsoleBriefing[];
  topOpportunities: UnifiedConsoleItem[];
  topRisks: UnifiedConsoleItem[];
}): string[] {
  const lines: string[] = [];
  if (input.topOpportunities[0]) lines.push(`${input.topOpportunities[0].symbol} leads the unified attention queue because ${input.topOpportunities[0].reasonForAttention}`);
  if (input.topRisks[0]) lines.push(`${input.topRisks[0].symbol} is the top risk item; ${input.topRisks[0].riskLabel}`);
  if (input.shockConditionsAligning[0]) lines.push(input.shockConditionsAligning[0].label);
  if (input.bestAsymmetry[0]) lines.push(input.bestAsymmetry[0].label);
  if (input.eventPressure[0]) lines.push(input.eventPressure[0].label);
  if (input.fragilityRising[0]) lines.push(input.fragilityRising[0].label);
  if (input.macroSummary) lines.push(input.macroSummary);
  return dedupe(lines).slice(0, 5);
}

function shockBriefings(rows: OpportunityViewModel[]): UnifiedConsoleBriefing[] {
  return rows
    .filter((row) => row.shockPattern !== null)
    .map((row) => {
      const shock = row.shockPattern;
      const score = Math.round(average([
        shock?.currentSimilarityScore ?? 0,
        shock?.upsideShockScore ?? 0,
        shock?.twoSidedVolatilityScore ?? 0,
      ], 0));
      return {
        actionContext: "Use large-move history as speculative research only and check chase risk before acting on it.",
        label: `${row.symbol} large-move conditions are aligning at ${score}/100 current large-move context.`,
        priority: score >= 72 ? "high" as const : score >= 58 ? "medium" as const : "low" as const,
        source: "shock" as const,
        symbol: row.symbol,
      };
    })
    .filter((item) => item.priority !== "low")
    .sort(compareBriefings)
    .slice(0, 5);
}

function eventBriefings(rows: OpportunityViewModel[]): UnifiedConsoleBriefing[] {
  return rows
    .filter((row) => row.eventRisk >= 62)
    .sort((left, right) => right.eventRisk - left.eventRisk)
    .slice(0, 5)
    .map((row) => ({
      actionContext: "Check the verified event source, timestamp, and decay before relying on the story.",
      label: `${row.symbol} has elevated verified event pressure: ${row.eventLabel}.`,
      priority: row.eventRisk >= 75 ? "high" : "medium",
      source: "event",
      symbol: row.symbol,
    }));
}

function fragilityBriefings(rows: OpportunityViewModel[], workflow: WorkflowEvolutionSummary | null): UnifiedConsoleBriefing[] {
  const workflowItems = changeBriefings(workflow?.deterioratingSetups ?? [], "fragility");
  const rowItems = rows
    .filter((row) => row.fragility >= 70)
    .sort((left, right) => right.fragility - left.fragility)
    .slice(0, 5)
    .map((row) => ({
      actionContext: "Treat elevated fragility as a risk-first review item; do not chase without cleaner structure.",
      label: `${row.symbol} fragility is elevated at ${row.fragility}/100.`,
      priority: row.fragility >= 80 ? "high" as const : "medium" as const,
      source: "fragility" as const,
      symbol: row.symbol,
    }));
  return dedupeBriefings([...workflowItems, ...rowItems]).slice(0, 5);
}

function asymmetryBriefings(items: Array<{ asymmetryScore: number; symbol: string }>): UnifiedConsoleBriefing[] {
  return items.slice(0, 5).map((item) => ({
    actionContext: "Check entry timing, downside containment, and evidence strength before treating this balance as useful.",
    label: `${item.symbol} has the strongest upside/downside balance at ${item.asymmetryScore}/100.`,
    priority: item.asymmetryScore >= 72 ? "high" : "medium",
    source: "asymmetry",
    symbol: item.symbol,
  }));
}

function changeBriefings(items: WorkflowChangeItem[], source: UnifiedConsoleBriefing["source"]): UnifiedConsoleBriefing[] {
  return items.slice(0, 6).map((item) => ({
    actionContext: item.detail,
    label: `${item.symbol}: ${item.title} (${item.metricLabel}).`,
    priority: item.severity === "warning" ? "high" : item.severity === "positive" ? "medium" : "low",
    source,
    symbol: item.symbol === "WORKFLOW" ? undefined : item.symbol,
  }));
}

function fallbackChangeBriefings(rows: OpportunityViewModel[]): UnifiedConsoleBriefing[] {
  return rows
    .map((row) => ({ change: finiteNumber(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change), row }))
    .filter((item): item is { change: number; row: OpportunityViewModel } => item.change !== null)
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
    .slice(0, 5)
    .map((item) => ({
      actionContext: "Change is based on the latest saved scanner fields and should be confirmed on symbol detail.",
      label: `${item.row.symbol} ${item.change > 0 ? "improved" : "weakened"} ${Math.abs(item.change).toFixed(1)} points.`,
      priority: Math.abs(item.change) >= 6 ? "high" : "medium",
      source: "change",
      symbol: item.row.symbol,
    }));
}

function personalizedSummaryFor(profile: UserPersonalizationProfile | null, topOpportunities: UnifiedConsoleItem[]): string {
  if (!profile) return "Personalized priorities will sharpen after risk profile, watchlist, and behavior memory are available.";
  const top = topOpportunities[0];
  const fit = top ? `${top.symbol} is currently the top candidate under this unified ranking.` : "No dominant candidate is available under this profile.";
  return `${profile.label} profile active: priorities emphasize ${profile.preferredRiskLevel} risk and ${profile.preferredRewardLevel} reward. ${fit}`;
}

function compareBriefings(left: UnifiedConsoleBriefing, right: UnifiedConsoleBriefing): number {
  return priorityRank(right.priority) - priorityRank(left.priority) || cleanText(left.symbol, "").localeCompare(cleanText(right.symbol, ""));
}

function priorityRank(priority: UnifiedConsoleBriefing["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeBriefings(items: UnifiedConsoleBriefing[]): UnifiedConsoleBriefing[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source}:${item.symbol ?? item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function average(values: number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
