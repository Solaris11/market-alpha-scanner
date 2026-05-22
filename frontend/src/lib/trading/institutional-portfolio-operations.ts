import type {
  PortfolioIntelligenceSystem,
  PortfolioPositionContext,
  PortfolioRiskTone,
} from "./portfolio-intelligence";
import type {
  SimulatedAiPortfolioSystem,
  SimulatedPortfolioAllocationPoint,
  SimulatedPortfolioMode,
  SimulatedPortfolioModeResult,
  SimulatedPortfolioModelRevision,
  SimulatedPortfolioStrategyMemory,
} from "./simulated-ai-portfolio";

export type InstitutionalPortfolioOpsTone = PortfolioRiskTone;

export type InstitutionalPortfolioOperationsInput = {
  generatedAt?: string;
  portfolio: PortfolioIntelligenceSystem;
  preferredMode?: SimulatedPortfolioMode;
  simulatedPortfolio?: SimulatedAiPortfolioSystem | null;
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
  entryReason: string;
  invalidation: string;
  openedAt: string;
  riskAmount: number;
  status: "active" | "fragile" | "incomplete" | "review";
  symbol: string;
  thesis: string;
  tone: InstitutionalPortfolioOpsTone;
  unrealizedPnl: number | null;
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
  date: string;
  evidence: string;
  fromPolicy: string;
  label: string;
  symbols: string[];
  toPolicy: string;
  tone: InstitutionalPortfolioOpsTone;
};

export type InstitutionalWorkspaceContinuityItem = {
  detail: string;
  label: string;
  status: "available" | "limited" | "missing";
};

export type InstitutionalPortfolioOperationsSystem = {
  activeMode: SimulatedPortfolioMode | null;
  generatedAt: string;
  headline: string;
  limitations: string[];
  openPositionCount: number;
  operatingLanes: InstitutionalOperatingLane[];
  operatingScore: number;
  positionLifecycle: InstitutionalPositionLifecycle[];
  rebalanceHistory: InstitutionalRebalanceCheckpoint[];
  riskBudget: InstitutionalOperatingLane[];
  strategyMemory: InstitutionalStrategyMemoryItem[];
  strategyRevisions: InstitutionalStrategyRevisionItem[];
  totalExposureValue: number;
  workspaceContinuity: InstitutionalWorkspaceContinuityItem[];
};

export function buildInstitutionalPortfolioOperationsSystem(
  input: InstitutionalPortfolioOperationsInput,
): InstitutionalPortfolioOperationsSystem {
  const activeMode = input.simulatedPortfolio ? input.preferredMode ?? "balanced" : null;
  const activeResult = activeMode ? input.simulatedPortfolio?.modes[activeMode] ?? null : null;
  const riskBudget = riskBudgetFor(input.portfolio);
  const positionLifecycle = lifecycleFor(input.portfolio.positionContexts);
  const rebalanceHistory = rebalanceHistoryFor(activeResult);
  const strategyMemory = strategyMemoryFor(activeResult);
  const strategyRevisions = strategyRevisionsFor(activeResult);
  const workspaceContinuity = workspaceContinuityFor(input.portfolio, activeResult);
  const operatingLanes = operatingLanesFor(input.portfolio, riskBudget, positionLifecycle);
  const limitations = limitationsFor(input.portfolio, activeResult);
  const operatingScore = operatingScoreFor(input.portfolio, activeResult, riskBudget, rebalanceHistory, strategyMemory);

  return {
    activeMode,
    generatedAt: input.generatedAt ?? input.portfolio.generatedAt,
    headline: headlineFor(input.portfolio, activeResult, operatingScore),
    limitations,
    openPositionCount: input.portfolio.openPositionCount,
    operatingLanes,
    operatingScore,
    positionLifecycle,
    rebalanceHistory,
    riskBudget,
    strategyMemory,
    strategyRevisions,
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
        entryReason: cleanLabel(context.opportunity?.decision_reason ?? position.final_decision ?? position.recommendation_quality, "Entry reason has not been linked to scanner evidence yet."),
        invalidation: position.stop_loss === null
          ? "No stop/invalidation level is recorded for this paper position."
          : `Paper invalidation is recorded at ${formatPrice(position.stop_loss)}${current !== null ? ` versus current ${formatPrice(current)}` : ""}.`,
        openedAt: position.opened_at,
        riskAmount: context.riskAmount,
        status,
        symbol: context.symbol,
        thesis: `${setup}; sector ${context.sector}; theme ${context.theme}.`,
        tone,
        unrealizedPnl,
      };
    });
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

function strategyRevisionsFor(result: SimulatedPortfolioModeResult | null): InstitutionalStrategyRevisionItem[] {
  if (!result) return [];
  return result.institutionalRealism.modelRevisions.map((item) => revisionItemFor(item));
}

function revisionItemFor(item: SimulatedPortfolioModelRevision): InstitutionalStrategyRevisionItem {
  return {
    date: item.date,
    evidence: item.evidence,
    fromPolicy: item.fromPolicy,
    label: item.label,
    symbols: item.symbols,
    toPolicy: item.toPolicy,
    tone: item.tone,
  };
}

function workspaceContinuityFor(
  portfolio: PortfolioIntelligenceSystem,
  result: SimulatedPortfolioModeResult | null,
): InstitutionalWorkspaceContinuityItem[] {
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

function limitationsFor(
  portfolio: PortfolioIntelligenceSystem,
  result: SimulatedPortfolioModeResult | null,
): string[] {
  const limitations = [
    "Institutional Portfolio Operations is research-only. It does not place orders, rebalance broker accounts, or provide financial advice.",
    "Position lifecycle uses current paper positions and stored paper trade fields; missing stop/target/thesis fields are shown as incomplete instead of invented.",
    result
      ? "Rebalance history and strategy memory are derived from Strategy Labs simulation evidence, not broker execution history."
      : "Strategy memory is unavailable because Strategy Labs simulation evidence is not available in this session.",
    "Saved multi-workspace execution workflows and broker-grade compliance approvals remain outside the current product boundary.",
  ];
  if (!portfolio.openPositionCount) limitations.push("No active paper positions are available, so portfolio operations are limited to evidence boundaries.");
  if (!result?.closedTrades.length) limitations.push("Closed-trade institutional memory is limited until completed historical evidence exists for this mode.");
  return limitations;
}

function operatingScoreFor(
  portfolio: PortfolioIntelligenceSystem,
  result: SimulatedPortfolioModeResult | null,
  riskBudget: InstitutionalOperatingLane[],
  rebalanceHistory: InstitutionalRebalanceCheckpoint[],
  strategyMemory: InstitutionalStrategyMemoryItem[],
): number {
  const evidenceScore = portfolio.openPositionCount > 0 ? 28 : 0;
  const lifecycleScore = portfolio.positionContexts.length
    ? 18 - Math.min(12, portfolio.positionContexts.filter((context) => context.position.stop_loss === null || context.position.target_price === null).length * 4)
    : 0;
  const strategyScore = result ? Math.min(22, Math.log10(Math.max(1, result.stats.closedTradeCount)) * 10 + (strategyMemory.length ? 6 : 0)) : 0;
  const rebalanceScore = rebalanceHistory.length ? Math.min(12, rebalanceHistory.length * 1.5) : 0;
  const riskScore = Math.max(0, 20 - (riskBudget[0]?.score ?? 0) * 0.12);
  return Math.round(clamp(evidenceScore + lifecycleScore + strategyScore + rebalanceScore + riskScore));
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
