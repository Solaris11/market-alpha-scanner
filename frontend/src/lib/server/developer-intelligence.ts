import "server-only";

import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import type { PaperPositionRow } from "@/lib/paper-data";
import { getPerformanceData } from "@/lib/scanner-data";
import { buildOpportunitiesPageModel, type OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { buildPortfolioIntelligenceSystem } from "@/lib/trading/portfolio-intelligence";
import { buildScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import { getDecisionReplayReport } from "./decision-replay";
import { getNarrativeMap } from "./narrative-intelligence";
import { getShockMovePatternMap } from "./shock-move-patterns";

export type DeveloperOpportunityFeedItem = {
  companyName: string | null;
  conviction: number;
  decision: string | null;
  entryContext: string | null;
  eventContext: string;
  finalScore: number | null;
  fragility: number;
  macroContext: string;
  sector: string | null;
  shockOpportunityScore: number | null;
  symbol: string;
};

export type DeveloperPortfolioPositionInput = {
  allocationPct?: unknown;
  costBasis?: unknown;
  quantity?: unknown;
  riskProfile?: unknown;
  symbol?: unknown;
};

export async function loadDeveloperOpportunityFeed(limit = 25): Promise<{ generatedAt: string; opportunities: DeveloperOpportunityFeedItem[] }> {
  const rows = await loadOpportunityRows();
  const opportunities = rows
    .slice()
    .sort((left, right) => opportunityRankScore(right) - opportunityRankScore(left))
    .slice(0, boundedLimit(limit, 50))
    .map(opportunityFeedItem);
  return { generatedAt: new Date().toISOString(), opportunities };
}

export async function loadDeveloperMacroFeed() {
  const adapter = new ScannerDataAdapter();
  const regime = await adapter.getMarketRegime();
  return {
    generatedAt: new Date().toISOString(),
    limitations: ["Macro feed describes current TradeVeto context. It is not a macro prediction engine.", "Research context only. Not financial advice."],
    regime,
  };
}

export async function loadDeveloperShockFeed(limit = 25) {
  const rows = await loadOpportunityRows();
  const shocks = rows
    .filter((row) => row.shockPattern)
    .sort((left, right) => (right.shockPattern?.opportunityScore ?? 0) - (left.shockPattern?.opportunityScore ?? 0))
    .slice(0, boundedLimit(limit, 50))
    .map((row) => ({
      symbol: row.symbol,
      opportunityState: row.shockPattern?.opportunityState ?? null,
      upsideShockScore: row.shockPattern?.upsideShockScore ?? null,
      downsideRiskScore: row.shockPattern?.downsideRiskScore ?? null,
      twoSidedVolatilityScore: row.shockPattern?.twoSidedVolatilityScore ?? null,
      reliabilityScore: row.shockPattern?.reliabilityScore ?? null,
      chaseRiskLabel: row.shockPattern?.chaseRiskLabel ?? null,
      researchEntryZone: row.shockPattern?.researchEntryZone ?? null,
      historicalExitZone: row.shockPattern?.historicalExitZone ?? null,
      currentSimilarityScore: row.shockPattern?.currentSimilarityScore ?? null,
      keyRisk: row.shockPattern?.commonFailureConditions?.[0] ?? row.fragilityLabel,
    }));
  return {
    generatedAt: new Date().toISOString(),
    limitations: ["Large-move feed is high-volatility research context, not a main TradeVeto signal.", "Statistics are computed by TradeVeto; language remains non-advisory."],
    shocks,
  };
}

export async function loadDeveloperReplay(input: { symbol?: string | null; timestamp?: string | null }) {
  const replay = await getDecisionReplayReport({ symbol: input.symbol ?? null, timestamp: input.timestamp ?? null });
  return replay;
}

export async function runDeveloperPortfolioScenario(input: { accountValue?: unknown; positions: unknown }) {
  const rows = await loadOpportunityRows();
  const accountValue = positiveNumber(input.accountValue) ?? 100_000;
  const positions = normalizePortfolioPositions(input.positions, rows, accountValue);
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows });
  const portfolio = buildPortfolioIntelligenceSystem({
    accountValue,
    opportunities: rows,
    positions,
    scenarioSystem,
  });
  return {
    generatedAt: new Date().toISOString(),
    limitations: ["Portfolio scenario API uses supplied symbols and latest TradeVeto context. It does not connect to broker accounts.", "Stress outputs are scenario research, not exact price predictions."],
    portfolio,
  };
}

async function loadOpportunityRows(): Promise<OpportunityViewModel[]> {
  const adapter = new ScannerDataAdapter();
  const rows = await adapter.getOverviewSignals();
  const symbols = rows.map((row) => row.symbol);
  const [performance, shockPatterns, narratives] = await Promise.all([
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  return buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives).rows;
}

function opportunityFeedItem(row: OpportunityViewModel): DeveloperOpportunityFeedItem {
  return {
    companyName: row.company_name,
    conviction: row.conviction,
    decision: row.final_decision,
    entryContext: row.entryZoneLabel,
    eventContext: row.eventLabel,
    finalScore: row.final_score,
    fragility: row.fragility,
    macroContext: row.macroLabel,
    sector: row.sector,
    shockOpportunityScore: row.shockPattern?.opportunityScore ?? null,
    symbol: row.symbol,
  };
}

function normalizePortfolioPositions(value: unknown, opportunities: OpportunityViewModel[], accountValue: number): PaperPositionRow[] {
  const rawPositions = Array.isArray(value) ? value.slice(0, 50) : [];
  const priceBySymbol = new Map(opportunities.map((row) => [row.symbol.toUpperCase(), row.price ?? 100]));
  return rawPositions
    .map((item, index) => positionFromInput(item, index, priceBySymbol, accountValue))
    .filter((position): position is PaperPositionRow => Boolean(position));
}

function positionFromInput(value: unknown, index: number, priceBySymbol: Map<string, number>, accountValue: number): PaperPositionRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as DeveloperPortfolioPositionInput;
  const symbol = cleanSymbol(input.symbol);
  if (!symbol) return null;
  const currentPrice = positiveNumber(priceBySymbol.get(symbol)) ?? positiveNumber(input.costBasis) ?? 100;
  const allocationPct = positiveNumber(input.allocationPct);
  const rawQuantity = positiveNumber(input.quantity);
  const quantity = rawQuantity ?? (allocationPct ? (accountValue * Math.min(100, allocationPct) / 100) / currentPrice : 1);
  const entryPrice = positiveNumber(input.costBasis) ?? currentPrice;
  return {
    close_reason: null,
    closed_at: null,
    current_price: currentPrice,
    entry_price: entryPrice,
    entry_status: "developer_api",
    exit_price: null,
    final_decision: null,
    id: `developer-api-${index}-${symbol}`,
    opened_at: new Date().toISOString(),
    quantity,
    rating: null,
    realized_pnl: null,
    recommendation_quality: null,
    return_pct: null,
    setup_type: "developer_api",
    status: "OPEN",
    stop_loss: null,
    symbol,
    target_price: null,
    unrealized_pnl: (currentPrice - entryPrice) * quantity,
  };
}

function opportunityRankScore(row: OpportunityViewModel): number {
  return (row.final_score ?? 45) * 0.42 + row.conviction * 0.28 + (row.shockPattern?.opportunityScore ?? 45) * 0.18 + Math.max(0, 100 - row.fragility) * 0.12;
}

function boundedLimit(value: unknown, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function cleanSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return symbol || null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
