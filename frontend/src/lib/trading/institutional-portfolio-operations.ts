import type { PaperAnalyticsData, PaperAnalyticsTimelinePoint, PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type {
  PortfolioIntelligenceSystem,
  PortfolioPositionContext,
  PortfolioRiskTone,
} from "./portfolio-intelligence";
import { moduleLabel, WORKSPACE_MODE_LABELS, type WorkspacePreferences } from "./workspace-preferences";
import type {
  SimulatedAiPortfolioSystem,
  SimulatedPortfolioAllocationPoint,
  SimulatedPortfolioDrawdownEpisode,
  SimulatedPortfolioMode,
  SimulatedPortfolioModeResult,
  SimulatedPortfolioModelRevision,
  SimulatedPortfolioStrategyMemory,
} from "./simulated-ai-portfolio";

export type InstitutionalPortfolioOpsTone = PortfolioRiskTone;

export type InstitutionalPortfolioOperationsInput = {
  generatedAt?: string;
  paperAnalytics?: PaperAnalyticsData | null;
  paperEvents?: PaperTradeEventRow[];
  paperPositions?: PaperPositionRow[];
  portfolio: PortfolioIntelligenceSystem;
  preferredMode?: SimulatedPortfolioMode;
  simulatedPortfolio?: SimulatedAiPortfolioSystem | null;
  workspacePreferences?: WorkspacePreferences | null;
};

export type InstitutionalOperatingLane = {
  detail: string;
  evidence: string;
  label: string;
  score: number;
  symbols: string[];
  tone: InstitutionalPortfolioOpsTone;
  type: "allocation" | "correlation" | "liquidity" | "macro" | "scenario" | "shock" | "thesis";
};

export type InstitutionalPositionLifecycle = {
  allocationPct: number;
  currentValue: number;
  detail: string;
  drawdown: string;
  entryReason: string;
  exitPlan: string;
  invalidation: string;
  lessonLearned: string;
  openedAt: string;
  riskAmount: number;
  status: "active" | "fragile" | "incomplete" | "review";
  stopTarget: string;
  symbol: string;
  thesis: string;
  tone: InstitutionalPortfolioOpsTone;
  unrealizedPnl: number | null;
};

export type InstitutionalAllocationHistoryItem = {
  date: string;
  detail: string;
  label: string;
  metric: string;
  priorMetric: string;
  rebalanceRationale: string;
  riskChange: string;
  source: "current_paper_state" | "paper_event" | "paper_pnl";
  symbols: string[];
  tone: InstitutionalPortfolioOpsTone;
};

export type InstitutionalThesisLifecycleItem = {
  closedAt: string | null;
  detail: string;
  evidence: string;
  invalidation: string;
  lifecycleStage: "closed" | "created" | "invalidated" | "revised" | "weakened";
  openedAt: string;
  state: "active" | "closed_lost" | "closed_won" | "incomplete" | "manual_review";
  symbol: string;
  tone: InstitutionalPortfolioOpsTone;
};

export type InstitutionalDrawdownStory = {
  cause: string;
  depth: string;
  detail: string;
  lesson: string;
  macroRiskContext: string;
  period: string;
  recoveryStatus: string;
  source: "paper_account" | "strategy_labs";
  symbols: string[];
  tone: InstitutionalPortfolioOpsTone;
};

export type InstitutionalTradeAutopsyItem = {
  detail: string;
  evidence: string;
  exit: string;
  lessonLearned: string;
  lifecycle: string[];
  noFakeFillDisclosure: string;
  pnl: number | null;
  replayBacked: boolean;
  replayEvidence: string;
  replayEvidenceStatus: "explicit_replay" | "no_replay" | "setup_context_only";
  returnPct: number | null;
  source: "paper_account" | "strategy_labs";
  symbol: string;
  thesisReview: string;
  tone: InstitutionalPortfolioOpsTone;
};

export type InstitutionalRebalanceCheckpoint = {
  cashPct: number;
  date: string;
  deployedPct: number;
  detail: string;
  label: string;
  realizedPnl: number;
  tone: InstitutionalPortfolioOpsTone;
  topSymbol: string | null;
};

export type InstitutionalStrategyMemoryItem = {
  averageReturnPct: number | null;
  detail: string;
  label: string;
  latestLesson: string;
  sampleCount: number;
  tone: InstitutionalPortfolioOpsTone;
  totalPnl: number;
  worstDrawdownPct: number | null;
};

export type InstitutionalStrategyRevisionItem = {
  confidenceAfter: number | null;
  confidenceBefore: number | null;
  date: string;
  evidence: string;
  evidenceBasis: string;
  fromPolicy: string;
  label: string;
  symbols: string[];
  toPolicy: string;
  tone: InstitutionalPortfolioOpsTone;
  whatChanged: string;
  whyChanged: string;
};

export type InstitutionalOperationsCredibilityGate = {
  blocker: string | null;
  evidence: string;
  label: string;
  status: "fail" | "pass" | "partial";
};

export type InstitutionalWorkspaceContinuityItem = {
  detail: string;
  label: string;
  status: "available" | "limited" | "missing";
};

export type InstitutionalBrokerIntegrationState = {
  canPlaceOrders: false;
  canReadBrokerFills: false;
  disclosure: string;
  evidence: string;
  provider: "none";
  status: "not_integrated";
};

export type InstitutionalOperatingLedgerEntry = {
  amount: number | null;
  boundaryDisclosure: string;
  category: "allocation" | "autopsy" | "broker_boundary" | "drawdown" | "position_lifecycle" | "risk" | "strategy_revision" | "thesis";
  date: string;
  detail: string;
  evidence: string;
  event: string;
  metric: string;
  source: "paper_account" | "paper_event" | "portfolio_risk" | "strategy_labs" | "trust_boundary";
  symbol: string | null;
};

export type InstitutionalPortfolioOperationsSystem = {
  activeMode: SimulatedPortfolioMode | null;
  allocationHistory: InstitutionalAllocationHistoryItem[];
  brokerIntegration: InstitutionalBrokerIntegrationState;
  drawdownStories: InstitutionalDrawdownStory[];
  evidenceBoundaryDisclosures: string[];
  generatedAt: string;
  headline: string;
  limitations: string[];
  openPositionCount: number;
  operatingLanes: InstitutionalOperatingLane[];
  operatingLedger: InstitutionalOperatingLedgerEntry[];
  operatingLedgerCsv: string;
  operatingScore: number;
  proofGates: InstitutionalOperationsCredibilityGate[];
  paperTradeAutopsies: InstitutionalTradeAutopsyItem[];
  positionLifecycle: InstitutionalPositionLifecycle[];
  rebalanceHistory: InstitutionalRebalanceCheckpoint[];
  riskBudget: InstitutionalOperatingLane[];
  strategyMemory: InstitutionalStrategyMemoryItem[];
  strategyRevisions: InstitutionalStrategyRevisionItem[];
  thesisLifecycle: InstitutionalThesisLifecycleItem[];
  totalExposureValue: number;
  workspaceContinuity: InstitutionalWorkspaceContinuityItem[];
};

export function buildInstitutionalPortfolioOperationsSystem(
  input: InstitutionalPortfolioOperationsInput,
): InstitutionalPortfolioOperationsSystem {
  const activeMode = input.simulatedPortfolio ? input.preferredMode ?? "balanced" : null;
  const activeResult = activeMode ? input.simulatedPortfolio?.modes[activeMode] ?? null : null;
  const paperPositions = input.paperPositions ?? input.portfolio.positionContexts.map((context) => context.position);
  const paperEvents = input.paperEvents ?? [];
  const paperAnalytics = input.paperAnalytics ?? null;
  const riskBudget = riskBudgetFor(input.portfolio);
  const positionLifecycle = lifecycleFor(input.portfolio.positionContexts);
  const allocationHistory = allocationHistoryFor(input.portfolio, paperEvents, paperAnalytics);
  const thesisLifecycle = thesisLifecycleFor(paperPositions, input.portfolio.positionContexts);
  const drawdownStories = drawdownStoriesFor(paperAnalytics?.timeline ?? [], activeResult?.institutionalRealism.drawdownEpisodes ?? []);
  const paperTradeAutopsies = paperTradeAutopsiesFor(paperPositions, activeResult);
  const rebalanceHistory = rebalanceHistoryFor(activeResult);
  const strategyMemory = strategyMemoryFor(activeResult);
  const strategyRevisions = strategyRevisionsFor(activeResult, paperPositions);
  const brokerIntegration = brokerIntegrationFor();
  const workspaceContinuity = workspaceContinuityFor(input.portfolio, activeResult, {
    paperAnalytics,
    paperEvents,
    paperTradeAutopsies,
    workspacePreferences: input.workspacePreferences ?? null,
  });
  const operatingLanes = operatingLanesFor(input.portfolio, riskBudget, positionLifecycle);
  const limitations = limitationsFor(input.portfolio, activeResult, paperTradeAutopsies, paperAnalytics);
  const evidenceBoundaryDisclosures = evidenceBoundaryDisclosuresFor({
    activeResult,
    brokerIntegration,
    paperAnalytics,
    paperEvents,
    paperPositions,
  });
  const proofGates = proofGatesFor({
    allocationHistory,
    drawdownStories,
    paperTradeAutopsies,
    positionLifecycle,
    rebalanceHistory,
    riskBudget,
    strategyRevisions,
    thesisLifecycle,
  });
  const operatingScore = operatingScoreFor(input.portfolio, activeResult, riskBudget, rebalanceHistory, strategyMemory, {
    allocationHistory,
    drawdownStories,
    paperTradeAutopsies,
    thesisLifecycle,
  });
  const operatingLedger = operatingLedgerFor({
    allocationHistory,
    brokerIntegration,
    drawdownStories,
    generatedAt: input.generatedAt ?? input.portfolio.generatedAt,
    paperTradeAutopsies,
    positionLifecycle,
    riskBudget,
    strategyRevisions,
    thesisLifecycle,
  });

  return {
    activeMode,
    allocationHistory,
    brokerIntegration,
    drawdownStories,
    evidenceBoundaryDisclosures,
    generatedAt: input.generatedAt ?? input.portfolio.generatedAt,
    headline: headlineFor(input.portfolio, activeResult, operatingScore),
    limitations,
    openPositionCount: input.portfolio.openPositionCount,
    operatingLanes,
    operatingLedger,
    operatingLedgerCsv: operatingLedgerCsvFor(operatingLedger),
    operatingScore,
    proofGates,
    paperTradeAutopsies,
    positionLifecycle,
    rebalanceHistory,
    riskBudget,
    strategyMemory,
    strategyRevisions,
    thesisLifecycle,
    totalExposureValue: input.portfolio.totalExposureValue,
    workspaceContinuity,
  };
}

function riskBudgetFor(portfolio: PortfolioIntelligenceSystem): InstitutionalOperatingLane[] {
  const lanes: InstitutionalOperatingLane[] = [
    {
      detail: portfolio.concentrationScore >= 62
        ? "Exposure is concentrated enough to require allocation review before adding correlated positions."
        : "Concentration remains inside the current paper risk envelope.",
      evidence: `${portfolio.openPositionCount} open position(s), ${Math.round(portfolio.concentrationScore)}/100 concentration score.`,
      label: "Concentration Budget",
      score: portfolio.concentrationScore,
      symbols: topBucketSymbols(portfolio, "sector"),
      tone: riskTone(portfolio.concentrationScore),
      type: "allocation",
    },
    {
      detail: portfolio.fragilityScore >= 66
        ? "Fragility is stacked across open exposure; new entries should require cleaner confirmation."
        : "Fragility is not the dominant portfolio-level pressure.",
      evidence: `${Math.round(portfolio.fragilityScore)}/100 weighted fragility across open exposure.`,
      label: "Fragility Budget",
      score: portfolio.fragilityScore,
      symbols: portfolio.heatmap.filter((cell) => cell.fragilityScore >= 62).map((cell) => cell.symbol),
      tone: riskTone(portfolio.fragilityScore),
      type: "thesis",
    },
    {
      detail: portfolio.scenarioVulnerabilityScore >= 62
        ? "Scenario stress is elevated; portfolio review should start from the highest vulnerability case."
        : "Modeled scenario pressure is currently bounded by available evidence.",
      evidence: portfolio.scenarioStress[0]?.summary ?? "No scenario stress packet is available.",
      label: "Scenario Budget",
      score: portfolio.scenarioVulnerabilityScore,
      symbols: portfolio.scenarioStress[0]?.impactedSymbols ?? [],
      tone: riskTone(portfolio.scenarioVulnerabilityScore),
      type: "scenario",
    },
    {
      detail: portfolio.macroAlignmentScore <= 42
        ? "Open exposure is carrying macro headwind; allocations need a defensive review."
        : portfolio.macroAlignmentScore >= 66
          ? "Macro alignment is supportive for the current open exposure."
          : "Macro support is mixed and should not be treated as a green light.",
      evidence: `${Math.round(portfolio.macroAlignmentScore)}/100 weighted macro alignment.`,
      label: "Macro Exposure",
      score: 100 - portfolio.macroAlignmentScore,
      symbols: topBucketSymbols(portfolio, "macro"),
      tone: inverseQualityTone(portfolio.macroAlignmentScore),
      type: "macro",
    },
    {
      detail: portfolio.liquidityRiskScore >= 62
        ? "Liquidity pressure is high enough to change sizing and exit assumptions."
        : "Liquidity pressure is not the dominant operating risk.",
      evidence: `${Math.round(portfolio.liquidityRiskScore)}/100 liquidity pressure.`,
      label: "Liquidity Budget",
      score: portfolio.liquidityRiskScore,
      symbols: topBucketSymbols(portfolio, "liquidity"),
      tone: riskTone(portfolio.liquidityRiskScore),
      type: "liquidity",
    },
    {
      detail: portfolio.shockExposureScore >= 62
        ? "Large-move exposure is elevated; thesis invalidation and sizing should be checked before adding risk."
        : "Shock exposure is contained by current evidence.",
      evidence: `${Math.round(portfolio.shockExposureScore)}/100 large-move exposure.`,
      label: "Shock Budget",
      score: portfolio.shockExposureScore,
      symbols: topBucketSymbols(portfolio, "shock"),
      tone: riskTone(portfolio.shockExposureScore),
      type: "shock",
    },
  ];

  if (portfolio.hiddenCorrelationWarning) {
    lanes.push({
      detail: portfolio.hiddenCorrelationWarning,
      evidence: portfolio.rollingCorrelationPairs.length
        ? `${portfolio.rollingCorrelationPairs.length} rolling correlation pair(s) detected.`
        : "Factor correlation derived from sector, theme, macro, fragility, and scenario overlap.",
      label: "Hidden Correlation",
      score: Math.max(55, portfolio.correlationClusters[0]?.score ?? portfolio.concentrationScore),
      symbols: portfolio.correlationClusters[0]?.symbols ?? [],
      tone: "warn",
      type: "correlation",
    });
  }

  return lanes.sort((left, right) => right.score - left.score);
}

function lifecycleFor(contexts: PortfolioPositionContext[]): InstitutionalPositionLifecycle[] {
  return contexts
    .slice()
    .sort((left, right) => right.weightPct - left.weightPct || left.symbol.localeCompare(right.symbol))
    .map((context) => {
      const position = context.position;
      const incomplete = position.stop_loss === null || position.target_price === null;
      const fragile = context.fragilityScore >= 70 || context.macroAlignmentScore <= 38 || context.shockExposureScore >= 72;
      const status: InstitutionalPositionLifecycle["status"] = incomplete ? "incomplete" : fragile ? "fragile" : context.riskAmount > 0 ? "active" : "review";
      const tone: InstitutionalPortfolioOpsTone = status === "fragile" ? "risk" : status === "incomplete" ? "warn" : status === "active" ? "good" : "neutral";
      const setup = cleanLabel(position.setup_type ?? context.opportunity?.raw.setup_type, "Research setup");
      const current = finite(position.current_price) ?? finite(position.entry_price);
      const unrealizedPnl = finite(position.unrealized_pnl);
      return {
        allocationPct: Math.round(context.weightPct),
        currentValue: context.positionValue,
        detail: `${context.symbol} carries ${Math.round(context.weightPct)}% of open exposure, fragility ${context.fragilityScore}/100, macro alignment ${context.macroAlignmentScore}/100.`,
        drawdown: unrealizedPnl === null
          ? "Open drawdown is unavailable because unrealized P/L is not stored."
          : unrealizedPnl < 0
            ? `${context.symbol} is in open drawdown of ${formatMoney(Math.abs(unrealizedPnl))}; review thesis quality and risk budget.`
            : `${context.symbol} is not in stored open drawdown; unrealized P/L is ${formatMoney(unrealizedPnl)}.`,
        entryReason: cleanLabel(context.opportunity?.decision_reason ?? position.final_decision ?? position.recommendation_quality, "Entry reason has not been linked to scanner evidence yet."),
        exitPlan: position.target_price === null
          ? "No target/exit plan is recorded for this open paper position."
          : `Target/exit plan is recorded at ${formatPrice(position.target_price)}; no exit is recorded while the paper position remains open.`,
        invalidation: position.stop_loss === null
          ? "No stop/invalidation level is recorded for this paper position."
          : `Paper invalidation is recorded at ${formatPrice(position.stop_loss)}${current !== null ? ` versus current ${formatPrice(current)}` : ""}.`,
        lessonLearned: status === "incomplete"
          ? "Lesson pending: record stop, target, and thesis before treating this as institutionally reviewable."
          : fragile
            ? "Lesson pending: fragile open exposure requires explicit invalidation and sizing discipline before adding risk."
            : "Lesson pending: keep monitoring against the recorded thesis; no closed outcome exists yet.",
        openedAt: position.opened_at,
        riskAmount: context.riskAmount,
        status,
        stopTarget: `Stop ${position.stop_loss === null ? "limited" : formatPrice(position.stop_loss)} / Target ${position.target_price === null ? "limited" : formatPrice(position.target_price)}`,
        symbol: context.symbol,
        thesis: `${setup}; sector ${context.sector}; theme ${context.theme}.`,
        tone,
        unrealizedPnl,
      };
    });
}

function allocationHistoryFor(
  portfolio: PortfolioIntelligenceSystem,
  paperEvents: PaperTradeEventRow[],
  paperAnalytics: PaperAnalyticsData | null,
): InstitutionalAllocationHistoryItem[] {
  const currentDeployedPct = portfolio.accountValue && portfolio.accountValue > 0
    ? (portfolio.totalExposureValue / portfolio.accountValue) * 100
    : null;
  const items: InstitutionalAllocationHistoryItem[] = [{
    date: portfolio.generatedAt,
    detail: portfolio.accountValue && portfolio.accountValue > 0
      ? `${formatMoney(portfolio.totalExposureValue)} deployed across ${portfolio.openPositionCount} open paper position(s), ${formatPercent(currentDeployedPct)} of account value.`
      : `${formatMoney(portfolio.totalExposureValue)} deployed across ${portfolio.openPositionCount} open paper position(s). Account value is unavailable, so deployment percent is limited.`,
    label: "Current paper allocation",
    metric: currentDeployedPct === null ? formatMoney(portfolio.totalExposureValue) : formatPercent(currentDeployedPct),
    priorMetric: "Prior allocation requires paper event or closed P/L history.",
    rebalanceRationale: portfolio.openPositionCount
      ? `Current allocation is reconstructed from ${portfolio.openPositionCount} open paper position(s), not broker fills.`
      : "No open exposure exists, so no rebalance rationale is available.",
    riskChange: portfolio.scenarioStress[0]
      ? `${portfolio.scenarioStress[0].scenarioLabel} is the leading modeled risk at ${portfolio.scenarioStress[0].weightedVulnerabilityScore}/100 vulnerability.`
      : `Portfolio concentration ${Math.round(portfolio.concentrationScore)}/100 and fragility ${Math.round(portfolio.fragilityScore)}/100 define current risk change context.`,
    source: "current_paper_state",
    symbols: portfolio.positionContexts.map((context) => context.symbol).slice(0, 8),
    tone: currentDeployedPct === null ? "neutral" : currentDeployedPct >= 75 ? "risk" : currentDeployedPct >= 45 ? "warn" : "good",
  }];

  for (const event of paperEvents.slice(0, 8)) {
    const eventType = cleanLabel(event.event_type, "PAPER_EVENT").toUpperCase();
    const cashDelta = finite(event.cash_delta);
    const pnlDelta = finite(event.pnl_delta);
    const quantity = finite(event.quantity);
    const price = finite(event.price);
    const notional = quantity !== null && price !== null ? Math.abs(quantity * price) : Math.abs(cashDelta ?? 0);
    const isOpen = eventType.includes("OPEN") || eventType.includes("BUY");
    const isClose = eventType.includes("CLOSE") || eventType.includes("SELL");
    items.push({
      date: event.created_at,
      detail: `${event.symbol} ${eventType.toLowerCase().replace(/_/g, " ")}${event.event_reason ? `: ${event.event_reason}` : ""}. Cash delta ${formatMoney(cashDelta ?? 0)}, P/L delta ${formatMoney(pnlDelta ?? 0)}.`,
      label: isOpen ? "Paper allocation opened" : isClose ? "Paper allocation closed" : "Paper allocation event",
      metric: isClose ? formatMoney(pnlDelta ?? 0) : formatMoney(notional),
      priorMetric: "Prior allocation is not stored on paper event rows.",
      rebalanceRationale: event.event_reason
        ? event.event_reason
        : isOpen
          ? "Allocation increased from a stored paper open event."
          : isClose
            ? "Allocation decreased from a stored paper close event."
            : "Allocation changed from a stored paper event.",
      riskChange: isClose
        ? `Exposure in ${event.symbol} was reduced; realized P/L delta ${formatMoney(pnlDelta ?? 0)}.`
        : isOpen
          ? `Exposure in ${event.symbol} increased by approximately ${formatMoney(notional)}.`
          : "Risk change cannot be quantified beyond the stored event payload.",
      source: "paper_event",
      symbols: [event.symbol],
      tone: pnlDelta !== null ? pnlTone(pnlDelta) : isOpen ? "neutral" : "warn",
    });
  }

  const latestTimeline = [...(paperAnalytics?.timeline ?? [])].slice(-4).reverse();
  for (const point of latestTimeline) {
    items.push({
      date: point.date,
      detail: `Paper account realized ${formatMoney(point.daily_pnl)} on this closed-trade checkpoint; cumulative realized P/L became ${formatMoney(point.cumulative_pnl)}.`,
      label: "Paper P/L checkpoint",
      metric: formatMoney(point.cumulative_pnl),
      priorMetric: "Prior checkpoint is encoded in the closed-trade timeline order.",
      rebalanceRationale: "Closed paper outcomes change available capital and should be reviewed before sizing the next simulated allocation.",
      riskChange: point.daily_pnl < 0
        ? `Realized drawdown pressure increased by ${formatMoney(Math.abs(point.daily_pnl))}.`
        : `Realized buffer improved by ${formatMoney(point.daily_pnl)}.`,
      source: "paper_pnl",
      symbols: [],
      tone: pnlTone(point.daily_pnl),
    });
  }

  return items
    .sort((left, right) => sortDate(right.date) - sortDate(left.date))
    .slice(0, 12);
}

function thesisLifecycleFor(
  positions: PaperPositionRow[],
  contexts: PortfolioPositionContext[],
): InstitutionalThesisLifecycleItem[] {
  const contextById = new Map(contexts.map((context) => [context.position.id, context]));
  return positions
    .slice()
    .sort((left, right) => sortDate(right.closed_at ?? right.opened_at) - sortDate(left.closed_at ?? left.opened_at))
    .slice(0, 12)
    .map((position): InstitutionalThesisLifecycleItem => {
      const context = contextById.get(position.id) ?? null;
      const status = position.status.toUpperCase();
      const pnl = finite(position.realized_pnl);
      const incomplete = position.stop_loss === null || position.target_price === null;
      const manual = isManualPosition(position);
      const state: InstitutionalThesisLifecycleItem["state"] = status === "OPEN"
        ? incomplete ? "incomplete" : manual ? "manual_review" : "active"
        : (pnl ?? 0) >= 0 ? "closed_won" : "closed_lost";
      return {
        closedAt: position.closed_at,
        detail: thesisDetailFor(position, context),
        evidence: `Decision ${cleanLabel(position.final_decision, "limited")}; setup ${cleanLabel(position.setup_type, "limited")}; quality ${cleanLabel(position.recommendation_quality, "limited")}.`,
        invalidation: position.stop_loss === null
          ? "No stored stop/invalidation level. Thesis discipline is incomplete."
          : `Stored paper invalidation ${formatPrice(position.stop_loss)}; target ${position.target_price === null ? "limited" : formatPrice(position.target_price)}.`,
        lifecycleStage: thesisLifecycleStageFor({ context, manual, pnl, position, state }),
        openedAt: position.opened_at,
        state,
        symbol: position.symbol,
        tone: state === "closed_lost" ? "risk" : state === "incomplete" || state === "manual_review" ? "warn" : state === "closed_won" ? "good" : "neutral",
      };
    });
}

function thesisLifecycleStageFor(input: {
  context: PortfolioPositionContext | null;
  manual: boolean;
  pnl: number | null;
  position: PaperPositionRow;
  state: InstitutionalThesisLifecycleItem["state"];
}): InstitutionalThesisLifecycleItem["lifecycleStage"] {
  if (input.state === "closed_lost" || input.pnl !== null && input.pnl < 0) return "invalidated";
  if (input.state === "closed_won" || input.position.closed_at) return "closed";
  if (input.state === "incomplete" || input.position.stop_loss === null || input.position.target_price === null) return "weakened";
  if (input.manual || !input.context) return "revised";
  return "created";
}

function thesisDetailFor(position: PaperPositionRow, context: PortfolioPositionContext | null): string {
  if (context) {
    return `${context.symbol} active thesis links to ${context.sector} / ${context.theme}, ${Math.round(context.weightPct)}% of open exposure, and ${formatMoney(context.riskAmount)} planned risk.`;
  }
  const closeText = position.closed_at ? `closed ${formatDate(position.closed_at)}` : "still open";
  return `${position.symbol} thesis is reconstructed from stored paper fields only; ${closeText}, P/L ${formatMoney(finite(position.realized_pnl) ?? finite(position.unrealized_pnl) ?? 0)}.`;
}

function drawdownStoriesFor(
  paperTimeline: PaperAnalyticsTimelinePoint[],
  simulatedEpisodes: SimulatedPortfolioDrawdownEpisode[],
): InstitutionalDrawdownStory[] {
  const paperStories = paperDrawdownStoriesFor(paperTimeline);
  const simulatedStories = simulatedEpisodes.slice(0, 4).map((episode): InstitutionalDrawdownStory => {
    const symbols = drawdownEpisodeSymbols(episode);
    return {
      cause: symbols.length ? `Stress concentrated in ${symbols.join(", ")}.` : "Strategy Labs simulated equity curve declined during completed evidence.",
      depth: formatPercent(episode.depthPct),
      detail: episode.detail,
      lesson: episode.lesson,
      macroRiskContext: "Macro/risk context is inherited from the Strategy Labs simulated trade evidence, not a broker account.",
      period: `${episode.peakDate} -> ${episode.troughDate}${episode.recoveryDate ? ` -> ${episode.recoveryDate}` : ""}`,
      recoveryStatus: episode.recoveryDate ? `Recovered by ${episode.recoveryDate}.` : "Recovery was not visible in the simulated equity curve.",
      source: "strategy_labs",
      symbols,
      tone: episode.tone,
    };
  });
  return [...paperStories, ...simulatedStories].slice(0, 8);
}

function paperDrawdownStoriesFor(timeline: PaperAnalyticsTimelinePoint[]): InstitutionalDrawdownStory[] {
  if (timeline.length < 2) return [];
  const stories: InstitutionalDrawdownStory[] = [];
  let peak = timeline[0] ?? null;
  let trough = timeline[0] ?? null;
  for (const point of timeline.slice(1)) {
    if (!peak || !trough) continue;
    if (point.cumulative_pnl >= peak.cumulative_pnl) {
      const depth = peak.cumulative_pnl - trough.cumulative_pnl;
      if (depth > 0) {
        stories.push(paperDrawdownStoryFrom(peak, trough, point));
      }
      peak = point;
      trough = point;
      continue;
    }
    if (point.cumulative_pnl < trough.cumulative_pnl) trough = point;
  }
  if (peak && trough && peak.date !== trough.date && peak.cumulative_pnl > trough.cumulative_pnl) {
    stories.push(paperDrawdownStoryFrom(peak, trough, null));
  }
  return stories
    .sort((left, right) => numericDepth(right.depth) - numericDepth(left.depth))
    .slice(0, 4);
}

function paperDrawdownStoryFrom(
  peak: PaperAnalyticsTimelinePoint,
  trough: PaperAnalyticsTimelinePoint,
  recovery: PaperAnalyticsTimelinePoint | null,
): InstitutionalDrawdownStory {
  const depth = peak.cumulative_pnl - trough.cumulative_pnl;
  return {
    cause: "Closed paper trade P/L declined from the prior realized peak.",
    depth: formatMoney(depth),
    detail: `Paper realized P/L moved from ${formatMoney(peak.cumulative_pnl)} to ${formatMoney(trough.cumulative_pnl)}.`,
    lesson: recovery
      ? `Recovered by ${formatDate(recovery.date)} after closed-trade P/L returned to ${formatMoney(recovery.cumulative_pnl)}.`
      : "Recovery is not yet visible in the closed-trade paper timeline.",
    macroRiskContext: "Paper account drawdown is based only on closed paper P/L; macro/risk attribution is unavailable unless linked scanner evidence exists.",
    period: `${formatDate(peak.date)} -> ${formatDate(trough.date)}${recovery ? ` -> ${formatDate(recovery.date)}` : ""}`,
    recoveryStatus: recovery ? `Recovered by ${formatDate(recovery.date)}.` : "Unrecovered in the current closed-trade timeline.",
    source: "paper_account",
    symbols: [],
    tone: depth >= 500 ? "risk" : depth >= 100 ? "warn" : "neutral",
  };
}

function paperTradeAutopsiesFor(
  positions: PaperPositionRow[],
  result: SimulatedPortfolioModeResult | null,
): InstitutionalTradeAutopsyItem[] {
  const paperAutopsies = positions
    .filter((position) => position.status.toUpperCase() === "CLOSED")
    .sort((left, right) => sortDate(right.closed_at) - sortDate(left.closed_at))
    .slice(0, 6)
    .map(paperTradeAutopsyFor);
  const simulatedAutopsies = (result?.closedTrades ?? [])
    .slice(-4)
    .reverse()
    .map((trade): InstitutionalTradeAutopsyItem => ({
      detail: trade.autopsy.systemLearned,
      evidence: `${trade.symbol} ${formatPercent(trade.realizedReturnPct)} return, ${formatPercent(trade.drawdownPct)} adverse movement, confidence ${trade.confidenceAtEntry}->${trade.confidenceAtExit}.`,
      exit: `Simulated exit on ${trade.exitDate} at ${trade.exitPrice === null ? "limited price evidence" : formatPrice(trade.exitPrice)} after ${trade.horizonDays} day(s).`,
      lessonLearned: trade.learning.lesson,
      lifecycle: trade.lifecycle.map((step) => `${step.label}: ${step.detail}`).slice(0, 4),
      noFakeFillDisclosure: "Strategy Labs autopsy uses completed simulation evidence only; it is not a broker fill or paper order.",
      pnl: trade.realizedPnl,
      replayBacked: true,
      replayEvidence: trade.autopsy.replayContext,
      replayEvidenceStatus: "explicit_replay",
      returnPct: trade.realizedReturnPct,
      source: "strategy_labs",
      symbol: trade.symbol,
      thesisReview: [...trade.autopsy.whatWorked, ...trade.autopsy.whatFailed].slice(0, 3).join(" "),
      tone: trade.realizedPnl > 0 ? "good" : trade.realizedPnl < 0 ? "risk" : "neutral",
    }));
  return [...paperAutopsies, ...simulatedAutopsies].slice(0, 10);
}

function paperTradeAutopsyFor(position: PaperPositionRow): InstitutionalTradeAutopsyItem {
  const pnl = finite(position.realized_pnl);
  const returnPct = paperPositionReturnPct(position);
  const closeReason = cleanLabel(position.close_reason, "closed");
  const lifecycle = [
    `Entry: opened ${formatDate(position.opened_at)} at ${formatPrice(position.entry_price)} for ${formatQuantity(position.quantity)} share(s).`,
    `Risk plan: stop ${position.stop_loss === null ? "limited" : formatPrice(position.stop_loss)}, target ${position.target_price === null ? "limited" : formatPrice(position.target_price)}.`,
    `Exit: ${position.closed_at ? formatDate(position.closed_at) : "closed date limited"} at ${position.exit_price === null ? "limited" : formatPrice(position.exit_price)} because ${closeReason}.`,
  ];
  const manual = isManualPosition(position);
  const replayEvidenceStatus: InstitutionalTradeAutopsyItem["replayEvidenceStatus"] = manual
    ? "no_replay"
    : position.setup_type
      ? "setup_context_only"
      : "no_replay";
  return {
    detail: pnl === null
      ? "Closed paper trade has limited realized P/L fields."
      : pnl >= 0
        ? `Closed paper trade preserved positive realized P/L of ${formatMoney(pnl)}.`
        : `Closed paper trade lost ${formatMoney(Math.abs(pnl))}; review timing, stop placement, and setup evidence before repeating.`,
    evidence: `Stored fields: decision ${cleanLabel(position.final_decision, "limited")}, setup ${cleanLabel(position.setup_type, "limited")}, rating ${cleanLabel(position.rating, "limited")}.`,
    exit: position.closed_at
      ? `Paper exit recorded ${formatDate(position.closed_at)} at ${position.exit_price === null ? "limited price evidence" : formatPrice(position.exit_price)} because ${closeReason}.`
      : "Paper exit timestamp is unavailable on this closed row.",
    lessonLearned: thesisReviewFor(position),
    lifecycle,
    noFakeFillDisclosure: "Paper autopsy uses stored paper rows only; it does not claim broker execution, external fills, or fabricated return evidence.",
    pnl,
    replayBacked: false,
    replayEvidence: manual
      ? "Manual paper trade; scanner replay context was not the primary entry evidence."
      : position.setup_type
        ? "Setup context exists, but no replay snapshot id is stored on the paper trade row. Treat this as setup-context autopsy, not validated replay proof."
        : "No replay packet is attached to this paper trade row.",
    replayEvidenceStatus,
    returnPct,
    source: "paper_account",
    symbol: position.symbol,
    thesisReview: thesisReviewFor(position),
    tone: pnl === null ? "neutral" : pnl > 0 ? "good" : pnl < 0 ? "risk" : "neutral",
  };
}

function thesisReviewFor(position: PaperPositionRow): string {
  if (position.stop_loss === null || position.target_price === null) {
    return "Thesis lifecycle is incomplete because stop or target evidence is missing.";
  }
  const reward = Math.abs((position.target_price - position.entry_price) * position.quantity);
  const risk = Math.abs((position.entry_price - position.stop_loss) * position.quantity);
  const ratio = risk > 0 ? reward / risk : null;
  if (ratio !== null && ratio >= 2) return `Recorded thesis had ${ratio.toFixed(1)}R planned reward/risk.`;
  if (ratio !== null) return `Recorded thesis had thin ${ratio.toFixed(1)}R planned reward/risk.`;
  return "Recorded thesis has stop/target fields, but reward/risk could not be calculated.";
}

function rebalanceHistoryFor(result: SimulatedPortfolioModeResult | null): InstitutionalRebalanceCheckpoint[] {
  if (!result) return [];
  return result.allocationHistory.slice(-12).map((point) => checkpointFromAllocation(point));
}

function checkpointFromAllocation(point: SimulatedPortfolioAllocationPoint): InstitutionalRebalanceCheckpoint {
  const tone: InstitutionalPortfolioOpsTone = point.deployedPct >= 82
    ? "risk"
    : point.deployedPct >= 68 || point.cashPct <= 12
      ? "warn"
      : point.deployedPct <= 0
        ? "neutral"
        : "good";
  return {
    cashPct: Math.round(point.cashPct),
    date: point.date,
    deployedPct: Math.round(point.deployedPct),
    detail: `${Math.round(point.deployedPct)}% deployed, ${Math.round(point.cashPct)}% cash, cumulative simulated P/L ${formatMoney(point.realizedPnl)}.`,
    label: point.label,
    realizedPnl: point.realizedPnl,
    tone,
    topSymbol: point.topSymbol,
  };
}

function strategyMemoryFor(result: SimulatedPortfolioModeResult | null): InstitutionalStrategyMemoryItem[] {
  if (!result) return [];
  return result.institutionalRealism.strategyMemory.map((item) => memoryItemFor(item));
}

function memoryItemFor(item: SimulatedPortfolioStrategyMemory): InstitutionalStrategyMemoryItem {
  return {
    averageReturnPct: item.averageReturnPct,
    detail: `${item.sampleCount} completed sample(s), ${item.symbolCount} symbol(s), loss rate ${formatPercentOrNa(item.lossRatePct)}.`,
    label: item.label,
    latestLesson: item.latestLesson,
    sampleCount: item.sampleCount,
    tone: item.tone,
    totalPnl: item.totalPnl,
    worstDrawdownPct: item.worstDrawdownPct,
  };
}

function strategyRevisionsFor(
  result: SimulatedPortfolioModeResult | null,
  paperPositions: PaperPositionRow[],
): InstitutionalStrategyRevisionItem[] {
  const simulated = result?.institutionalRealism.modelRevisions.map((item) => revisionItemFor(item)) ?? [];
  const paperReviews = paperPositions
    .filter((position) => position.status.toUpperCase() === "CLOSED" || position.stop_loss === null || position.target_price === null)
    .sort((left, right) => sortDate(right.closed_at ?? right.opened_at) - sortDate(left.closed_at ?? left.opened_at))
    .slice(0, 4)
    .map((position): InstitutionalStrategyRevisionItem => {
      const pnl = finite(position.realized_pnl);
      const missingPlan = position.stop_loss === null || position.target_price === null;
      return {
        confidenceAfter: null,
        confidenceBefore: null,
        date: position.closed_at ?? position.opened_at,
        evidence: missingPlan
          ? `${position.symbol} has incomplete paper thesis fields; stop or target is missing.`
          : `${position.symbol} closed with stored paper P/L ${formatMoney(pnl ?? 0)} and return ${formatPercent(paperPositionReturnPct(position))}.`,
        evidenceBasis: "Stored paper position fields only.",
        fromPolicy: "Paper workflow accepts manually entered entries when stored context is limited.",
        label: missingPlan ? "Paper Thesis Completion Review" : "Paper Trade Rule Review",
        symbols: [position.symbol],
        toPolicy: missingPlan
          ? "Require stop, target, and thesis reason before treating a paper entry as institutionally reviewable."
          : pnl !== null && pnl < 0
            ? "Flag repeat setups with realized losses for sizing and entry-timing review before reuse."
            : "Keep the closed trade in memory without upgrading the rule until larger evidence exists.",
        tone: missingPlan ? "warn" : pnl !== null && pnl < 0 ? "risk" : "neutral",
        whatChanged: missingPlan ? "Thesis completeness requirement became visible." : "Closed paper outcome moved the review queue.",
        whyChanged: missingPlan
          ? "Institutional review requires explicit stop, target, and thesis evidence."
          : pnl !== null && pnl < 0
            ? "Loss-making paper outcomes should tighten sizing and entry-timing review."
            : "Positive paper outcomes are retained as evidence but do not automatically loosen rules.",
      };
    });
  return [...paperReviews, ...simulated].slice(0, 8);
}

function revisionItemFor(item: SimulatedPortfolioModelRevision): InstitutionalStrategyRevisionItem {
  return {
    confidenceAfter: null,
    confidenceBefore: null,
    date: item.date,
    evidence: item.evidence,
    evidenceBasis: "Completed Strategy Labs simulation sample.",
    fromPolicy: item.fromPolicy,
    label: item.label,
    symbols: item.symbols,
    toPolicy: item.toPolicy,
    tone: item.tone,
    whatChanged: item.label,
    whyChanged: item.evidence,
  };
}

function workspaceContinuityFor(
  portfolio: PortfolioIntelligenceSystem,
  result: SimulatedPortfolioModeResult | null,
  evidence: {
    paperAnalytics: PaperAnalyticsData | null;
    paperEvents: PaperTradeEventRow[];
    paperTradeAutopsies: InstitutionalTradeAutopsyItem[];
    workspacePreferences: WorkspacePreferences | null;
  },
): InstitutionalWorkspaceContinuityItem[] {
  const workspace = evidence.workspacePreferences;
  const favoriteModules = workspace?.favoriteModules.map((moduleId) => moduleLabel(moduleId)).join(", ") ?? "";
  return [
    {
      detail: portfolio.openPositionCount
        ? `${portfolio.openPositionCount} open paper position(s) feed portfolio concentration, scenario stress, risk budgets, and thesis lifecycle review.`
        : "Open paper positions are required before the portfolio operating workflow can evaluate real exposure.",
      label: "Paper Portfolio State",
      status: portfolio.openPositionCount ? "available" : "limited",
    },
    {
      detail: result
        ? `${result.config.label} mode contributes simulated allocation history, closed-trade autopsy, model revision, and strategy memory evidence.`
        : "Strategy Labs evidence is unavailable for this workflow.",
      label: "Strategy Labs Memory",
      status: result ? "available" : "limited",
    },
    {
      detail: evidence.paperEvents.length
        ? `${evidence.paperEvents.length} recent paper event(s) are available for allocation and rebalance reconstruction.`
        : "No paper event ledger rows are available for allocation history.",
      label: "Paper Event Ledger",
      status: evidence.paperEvents.length ? "available" : "limited",
    },
    {
      detail: evidence.paperAnalytics?.timeline.length
        ? `${evidence.paperAnalytics.timeline.length} closed-trade P/L checkpoint(s) are linked into drawdown storytelling.`
        : "Paper analytics timeline is unavailable, so actual paper drawdown stories are limited.",
      label: "Paper Analytics Timeline",
      status: evidence.paperAnalytics?.timeline.length ? "available" : "limited",
    },
    {
      detail: evidence.paperTradeAutopsies.some((item) => item.source === "paper_account")
        ? "Closed paper trades are converted into autopsy cards with explicit replay-evidence boundaries."
        : "No closed paper trades are available for account-backed trade autopsy.",
      label: "Paper Autopsy Queue",
      status: evidence.paperTradeAutopsies.some((item) => item.source === "paper_account") ? "available" : "limited",
    },
    {
      detail: workspace
        ? `${WORKSPACE_MODE_LABELS[workspace.workspaceMode]} workspace preferences are saved${workspace.updatedAt ? ` as of ${formatDate(workspace.updatedAt)}` : ""}; favorite modules: ${favoriteModules || "default modules"}.`
        : "No saved workspace preferences are linked to this portfolio workflow.",
      label: "Saved Workspace",
      status: workspace ? "available" : "limited",
    },
    {
      detail: portfolio.scenarioStress.length
        ? `${portfolio.scenarioStress.length} scenario packet(s) are linked into the operating risk review.`
        : "Scenario stress packets are not available for this portfolio state.",
      label: "Scenario Linkage",
      status: portfolio.scenarioStress.length ? "available" : "limited",
    },
    {
      detail: "Saved broker-grade multi-workspace execution, order tickets, and compliance approvals are not implemented yet.",
      label: "Execution Workspace",
      status: "missing",
    },
  ];
}

function brokerIntegrationFor(): InstitutionalBrokerIntegrationState {
  return {
    canPlaceOrders: false,
    canReadBrokerFills: false,
    disclosure: "No live broker integration is configured for Institutional Portfolio Operations. Broker fills, order status, and account balances are not imported or inferred.",
    evidence: "Current operating evidence is limited to TradeVeto paper rows, paper event rows, analytics checkpoints, portfolio risk packets, and Strategy Labs simulation output.",
    provider: "none",
    status: "not_integrated",
  };
}

function evidenceBoundaryDisclosuresFor(input: {
  activeResult: SimulatedPortfolioModeResult | null;
  brokerIntegration: InstitutionalBrokerIntegrationState;
  paperAnalytics: PaperAnalyticsData | null;
  paperEvents: PaperTradeEventRow[];
  paperPositions: PaperPositionRow[];
}): string[] {
  const closedPaperCount = input.paperPositions.filter((position) => position.status.toUpperCase() === "CLOSED").length;
  return [
    input.brokerIntegration.disclosure,
    `Paper operating evidence includes ${input.paperPositions.length} paper position row(s), ${input.paperEvents.length} paper event row(s), and ${input.paperAnalytics?.timeline.length ?? 0} closed-trade timeline checkpoint(s).`,
    closedPaperCount
      ? `${closedPaperCount} closed paper trade(s) can be reviewed, but replay-backed proof is shown only when explicit replay or Strategy Labs evidence exists.`
      : "No closed paper trade rows exist yet, so paper-account autopsy remains limited.",
    input.activeResult
      ? `${input.activeResult.config.label} Strategy Labs mode contributes ${input.activeResult.closedTrades.length} completed simulated trade sample(s) and ${input.activeResult.allocationHistory.length} allocation checkpoint(s).`
      : "Strategy Labs evidence is not attached to this operating packet.",
    "The operating ledger is exportable audit evidence; it is not a brokerage statement, account statement, tax document, or performance guarantee.",
  ];
}

function operatingLedgerFor(input: {
  allocationHistory: InstitutionalAllocationHistoryItem[];
  brokerIntegration: InstitutionalBrokerIntegrationState;
  drawdownStories: InstitutionalDrawdownStory[];
  generatedAt: string;
  paperTradeAutopsies: InstitutionalTradeAutopsyItem[];
  positionLifecycle: InstitutionalPositionLifecycle[];
  riskBudget: InstitutionalOperatingLane[];
  strategyRevisions: InstitutionalStrategyRevisionItem[];
  thesisLifecycle: InstitutionalThesisLifecycleItem[];
}): InstitutionalOperatingLedgerEntry[] {
  const rows: InstitutionalOperatingLedgerEntry[] = [];

  for (const item of input.positionLifecycle) {
    rows.push({
      amount: item.unrealizedPnl,
      boundaryDisclosure: "Position lifecycle row is reconstructed from stored paper position and portfolio-risk context only.",
      category: "position_lifecycle",
      date: item.openedAt,
      detail: `${item.detail} ${item.invalidation}`,
      evidence: item.entryReason,
      event: `Position lifecycle ${item.status}`,
      metric: `${item.allocationPct}% allocation / ${formatMoney(item.riskAmount)} risk`,
      source: "paper_account",
      symbol: item.symbol,
    });
  }

  for (const item of input.thesisLifecycle) {
    rows.push({
      amount: null,
      boundaryDisclosure: "Thesis lifecycle row is bounded to stored paper thesis, stop, target, setup, and close fields.",
      category: "thesis",
      date: item.closedAt ?? item.openedAt,
      detail: item.detail,
      evidence: item.evidence,
      event: `Thesis ${item.lifecycleStage}`,
      metric: item.invalidation,
      source: "paper_account",
      symbol: item.symbol,
    });
  }

  for (const item of input.allocationHistory) {
    rows.push({
      amount: null,
      boundaryDisclosure: item.source === "paper_event"
        ? "Allocation ledger row comes from a stored paper event, not a broker fill."
        : "Allocation checkpoint is reconstructed from paper/account analytics evidence, not a broker account.",
      category: "allocation",
      date: item.date,
      detail: item.detail,
      evidence: item.rebalanceRationale,
      event: item.label,
      metric: item.metric,
      source: item.source === "paper_event" ? "paper_event" : "paper_account",
      symbol: item.symbols[0] ?? null,
    });
  }

  for (const item of input.drawdownStories) {
    rows.push({
      amount: numericDepth(item.depth),
      boundaryDisclosure: item.source === "strategy_labs"
        ? "Strategy Labs drawdown row is simulated research evidence."
        : "Paper drawdown row uses closed paper P/L timeline only.",
      category: "drawdown",
      date: item.period,
      detail: item.detail,
      evidence: item.macroRiskContext,
      event: "Drawdown story",
      metric: item.depth,
      source: item.source,
      symbol: item.symbols[0] ?? null,
    });
  }

  for (const item of input.paperTradeAutopsies) {
    rows.push({
      amount: item.pnl,
      boundaryDisclosure: item.noFakeFillDisclosure,
      category: "autopsy",
      date: item.exit,
      detail: item.detail,
      evidence: item.replayEvidence,
      event: `Trade autopsy ${item.replayEvidenceStatus.replace(/_/g, " ")}`,
      metric: item.returnPct === null ? "Return limited" : formatPercent(item.returnPct),
      source: item.source,
      symbol: item.symbol,
    });
  }

  for (const item of input.strategyRevisions) {
    rows.push({
      amount: null,
      boundaryDisclosure: "Strategy revision row changes research policy only; it does not update broker rules or automated execution.",
      category: "strategy_revision",
      date: item.date,
      detail: item.whatChanged,
      evidence: item.evidenceBasis,
      event: item.label,
      metric: item.toPolicy,
      source: item.evidenceBasis.toLowerCase().includes("strategy labs") ? "strategy_labs" : "paper_account",
      symbol: item.symbols[0] ?? null,
    });
  }

  for (const item of input.riskBudget.slice(0, 8)) {
    rows.push({
      amount: item.score,
      boundaryDisclosure: "Risk row is a TradeVeto research risk score derived from current paper exposure and scanner context.",
      category: "risk",
      date: input.generatedAt,
      detail: item.detail,
      evidence: item.evidence,
      event: item.label,
      metric: `${Math.round(item.score)}/100`,
      source: "portfolio_risk",
      symbol: item.symbols[0] ?? null,
    });
  }

  rows.push({
    amount: null,
    boundaryDisclosure: input.brokerIntegration.disclosure,
    category: "broker_boundary",
    date: input.generatedAt,
    detail: input.brokerIntegration.evidence,
    evidence: "No broker provider, broker fill import, live order status, or account statement import is configured.",
    event: "Broker integration boundary",
    metric: input.brokerIntegration.status.replace(/_/g, " "),
    source: "trust_boundary",
    symbol: null,
  });

  return rows
    .sort((left, right) => sortDate(right.date) - sortDate(left.date) || left.category.localeCompare(right.category) || String(left.symbol ?? "").localeCompare(String(right.symbol ?? "")))
    .slice(0, 80);
}

function operatingLedgerCsvFor(rows: InstitutionalOperatingLedgerEntry[]): string {
  const headers = ["date", "category", "source", "symbol", "event", "metric", "amount", "detail", "evidence", "boundary_disclosure"];
  const body = rows.map((row) => [
    row.date,
    row.category,
    row.source,
    row.symbol ?? "",
    row.event,
    row.metric,
    row.amount === null ? "" : String(row.amount),
    row.detail,
    row.evidence,
    row.boundaryDisclosure,
  ]);
  return [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function operatingLanesFor(
  portfolio: PortfolioIntelligenceSystem,
  riskBudget: InstitutionalOperatingLane[],
  lifecycle: InstitutionalPositionLifecycle[],
): InstitutionalOperatingLane[] {
  const lanes = riskBudget.slice(0, 4);
  const missingLifecycle = lifecycle.filter((item) => item.status === "incomplete");
  if (missingLifecycle.length) {
    lanes.push({
      detail: `${missingLifecycle.length} open position(s) lack stop or target data, so thesis invalidation is incomplete.`,
      evidence: missingLifecycle.map((item) => item.symbol).join(", "),
      label: "Thesis Completion",
      score: 70,
      symbols: missingLifecycle.map((item) => item.symbol),
      tone: "warn",
      type: "thesis",
    });
  }
  if (!portfolio.openPositionCount) {
    lanes.push({
      detail: "No active portfolio exposure is available; add paper positions before institutional operations can become meaningful.",
      evidence: "0 open positions",
      label: "Portfolio State",
      score: 0,
      symbols: [],
      tone: "neutral",
      type: "allocation",
    });
  }
  return lanes.slice(0, 6);
}

function proofGatesFor(input: {
  allocationHistory: InstitutionalAllocationHistoryItem[];
  drawdownStories: InstitutionalDrawdownStory[];
  paperTradeAutopsies: InstitutionalTradeAutopsyItem[];
  positionLifecycle: InstitutionalPositionLifecycle[];
  rebalanceHistory: InstitutionalRebalanceCheckpoint[];
  riskBudget: InstitutionalOperatingLane[];
  strategyRevisions: InstitutionalStrategyRevisionItem[];
  thesisLifecycle: InstitutionalThesisLifecycleItem[];
}): InstitutionalOperationsCredibilityGate[] {
  const completePositions = input.positionLifecycle.filter((item) => item.status !== "incomplete").length;
  const replayBacked = input.paperTradeAutopsies.filter((item) => item.replayBacked).length;
  const setupOnly = input.paperTradeAutopsies.filter((item) => item.replayEvidenceStatus === "setup_context_only").length;
  return [
    {
      blocker: input.positionLifecycle.length && completePositions === input.positionLifecycle.length ? null : "Open positions need stop, target, invalidation, and lesson state before full lifecycle certification.",
      evidence: `${completePositions}/${input.positionLifecycle.length} active position lifecycle card(s) are complete.`,
      label: "Position lifecycle",
      status: input.positionLifecycle.length && completePositions === input.positionLifecycle.length ? "pass" : input.positionLifecycle.length ? "partial" : "fail",
    },
    {
      blocker: input.thesisLifecycle.length ? null : "No paper thesis lifecycle rows are available.",
      evidence: `${input.thesisLifecycle.length} thesis lifecycle item(s) with created/revised/weakened/invalidated/closed stage labeling.`,
      label: "Thesis lifecycle",
      status: input.thesisLifecycle.length ? "pass" : "fail",
    },
    {
      blocker: input.allocationHistory.length ? null : "No paper allocation history or event ledger evidence is available.",
      evidence: `${input.allocationHistory.length} allocation checkpoint(s), ${input.rebalanceHistory.length} Strategy Labs rebalance checkpoint(s).`,
      label: "Allocation and rebalance history",
      status: input.allocationHistory.length && input.rebalanceHistory.length ? "pass" : input.allocationHistory.length ? "partial" : "fail",
    },
    {
      blocker: input.drawdownStories.length ? null : "No closed-trade or simulated drawdown episode is available.",
      evidence: `${input.drawdownStories.length} drawdown story item(s) with cause, context, recovery status, and lesson.`,
      label: "Drawdown storytelling",
      status: input.drawdownStories.length ? "pass" : "fail",
    },
    {
      blocker: input.strategyRevisions.length ? null : "No evidence-backed strategy revision exists yet.",
      evidence: `${input.strategyRevisions.length} strategy revision item(s) with before/after policy and evidence basis.`,
      label: "Strategy revision history",
      status: input.strategyRevisions.length ? "pass" : "fail",
    },
    {
      blocker: input.paperTradeAutopsies.length ? null : "No closed paper or Strategy Labs trade autopsy exists yet.",
      evidence: `${input.paperTradeAutopsies.length} autopsy item(s); ${replayBacked} replay-backed, ${setupOnly} setup-context only.`,
      label: "Trade autopsy boundary",
      status: replayBacked > 0 ? "pass" : input.paperTradeAutopsies.length ? "partial" : "fail",
    },
    {
      blocker: input.riskBudget.length >= 5 ? null : "Portfolio risk layer needs concentration, sector, macro, correlation, liquidity, shock, and scenario coverage.",
      evidence: `${input.riskBudget.length} portfolio risk lane(s) are visible.`,
      label: "Portfolio risk operations",
      status: input.riskBudget.length >= 5 ? "pass" : input.riskBudget.length ? "partial" : "fail",
    },
  ];
}

function limitationsFor(
  portfolio: PortfolioIntelligenceSystem,
  result: SimulatedPortfolioModeResult | null,
  paperTradeAutopsies: InstitutionalTradeAutopsyItem[],
  paperAnalytics: PaperAnalyticsData | null,
): string[] {
  const limitations = [
    "Institutional Portfolio Operations is research-only. It does not place orders, rebalance broker accounts, or provide financial advice.",
    "Position lifecycle uses current paper positions and stored paper trade fields; missing stop/target/thesis fields are shown as incomplete instead of invented.",
    "Paper allocation history uses stored paper account/event rows, not broker fills or external execution reports.",
    result
      ? "Rebalance history and strategy memory are derived from Strategy Labs simulation evidence, not broker execution history."
      : "Strategy memory is unavailable because Strategy Labs simulation evidence is not available in this session.",
    "Saved multi-workspace execution workflows and broker-grade compliance approvals remain outside the current product boundary.",
  ];
  if (!portfolio.openPositionCount) limitations.push("No active paper positions are available, so portfolio operations are limited to evidence boundaries.");
  if (!result?.closedTrades.length) limitations.push("Closed-trade institutional memory is limited until completed historical evidence exists for this mode.");
  if (!paperAnalytics?.timeline.length) limitations.push("Actual paper drawdown storytelling is limited until closed-trade analytics timeline rows exist.");
  if (paperTradeAutopsies.some((item) => item.source === "paper_account" && !/replay/i.test(item.replayEvidence))) {
    limitations.push("Paper trade autopsy cards do not imply validated replay proof unless a replay packet is explicitly attached.");
  } else if (paperTradeAutopsies.some((item) => item.source === "paper_account")) {
    limitations.push("Paper trade autopsy cards expose whether replay evidence is present instead of fabricating replay-backed proof.");
  }
  return limitations;
}

function operatingScoreFor(
  portfolio: PortfolioIntelligenceSystem,
  result: SimulatedPortfolioModeResult | null,
  riskBudget: InstitutionalOperatingLane[],
  rebalanceHistory: InstitutionalRebalanceCheckpoint[],
  strategyMemory: InstitutionalStrategyMemoryItem[],
  evidence: {
    allocationHistory: InstitutionalAllocationHistoryItem[];
    drawdownStories: InstitutionalDrawdownStory[];
    paperTradeAutopsies: InstitutionalTradeAutopsyItem[];
    thesisLifecycle: InstitutionalThesisLifecycleItem[];
  },
): number {
  const evidenceScore = portfolio.openPositionCount > 0 ? 28 : 0;
  const lifecycleScore = portfolio.positionContexts.length
    ? 18 - Math.min(12, portfolio.positionContexts.filter((context) => context.position.stop_loss === null || context.position.target_price === null).length * 4)
    : 0;
  const strategyScore = result ? Math.min(22, Math.log10(Math.max(1, result.stats.closedTradeCount)) * 10 + (strategyMemory.length ? 6 : 0)) : 0;
  const rebalanceScore = rebalanceHistory.length ? Math.min(12, rebalanceHistory.length * 1.5) : 0;
  const operationsEvidenceScore = Math.min(
    16,
    (evidence.allocationHistory.length ? 4 : 0)
    + (evidence.thesisLifecycle.length ? 4 : 0)
    + (evidence.drawdownStories.length ? 4 : 0)
    + (evidence.paperTradeAutopsies.length ? 4 : 0),
  );
  const riskScore = Math.max(0, 20 - (riskBudget[0]?.score ?? 0) * 0.12);
  return Math.round(clamp(evidenceScore + lifecycleScore + strategyScore + rebalanceScore + operationsEvidenceScore + riskScore));
}

function headlineFor(
  portfolio: PortfolioIntelligenceSystem,
  result: SimulatedPortfolioModeResult | null,
  score: number,
): string {
  if (!portfolio.openPositionCount) return "Portfolio operations are waiting for active paper exposure.";
  const topRisk = portfolio.correlationClusters[0]?.label ?? portfolio.scenarioStress[0]?.scenarioLabel ?? "portfolio risk";
  const memoryText = result && result.stats.closedTradeCount > 0
    ? `${result.stats.closedTradeCount} completed simulated trade sample(s) inform strategy memory.`
    : "Strategy memory is still evidence-limited.";
  if (score >= 76) return `Portfolio operations are coherent; ${topRisk} remains the main review lane. ${memoryText}`;
  if (score >= 58) return `Portfolio operations are developing; ${topRisk} needs active monitoring. ${memoryText}`;
  return `Portfolio operations remain incomplete; ${topRisk} is visible but institutional continuity is not yet fully proven. ${memoryText}`;
}

function topBucketSymbols(portfolio: PortfolioIntelligenceSystem, type: InstitutionalOperatingLane["type"] | "sector"): string[] {
  return portfolio.exposureBuckets.find((bucket) => bucket.type === type)?.symbols ?? [];
}

function riskTone(score: number): InstitutionalPortfolioOpsTone {
  if (score >= 72) return "risk";
  if (score >= 55) return "warn";
  if (score <= 34) return "good";
  return "neutral";
}

function inverseQualityTone(score: number): InstitutionalPortfolioOpsTone {
  if (score <= 34) return "risk";
  if (score <= 50) return "warn";
  if (score >= 68) return "good";
  return "neutral";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortDate(value: string | null | undefined): number {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function pnlTone(value: number): InstitutionalPortfolioOpsTone {
  if (value > 0) return "good";
  if (value < 0) return "risk";
  return "neutral";
}

function numericDepth(value: string): number {
  const parsed = Number(value.replace(/[$,%\s]/g, ""));
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function drawdownEpisodeSymbols(episode: SimulatedPortfolioDrawdownEpisode): string[] {
  const match = /^([A-Z][A-Z0-9.-]{0,9}) stress$/.exec(episode.troughDate.trim());
  return match?.[1] ? [match[1]] : [];
}

function isManualPosition(position: PaperPositionRow): boolean {
  return [position.final_decision, position.recommendation_quality, position.entry_status, position.setup_type, position.rating]
    .some((value) => String(value ?? "").trim().toUpperCase() === "MANUAL");
}

function paperPositionReturnPct(position: PaperPositionRow): number | null {
  const stored = finite(position.return_pct);
  if (stored !== null) return stored * 100;
  const entry = finite(position.entry_price);
  const exit = finite(position.exit_price) ?? finite(position.current_price);
  if (entry !== null && exit !== null && entry > 0) return ((exit - entry) / entry) * 100;
  const pnl = finite(position.realized_pnl) ?? finite(position.unrealized_pnl);
  const quantity = finite(position.quantity);
  if (entry !== null && pnl !== null && quantity !== null && entry > 0 && quantity > 0) {
    return (pnl / (entry * quantity)) * 100;
  }
  return null;
}

function cleanLabel(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return fallback;
  return text;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 0, style: "currency" });
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 2, style: "currency" });
}

function formatPercentOrNa(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
}
