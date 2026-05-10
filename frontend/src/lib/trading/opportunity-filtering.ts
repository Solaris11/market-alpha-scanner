import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { RiskTolerantOpportunity } from "@/lib/trading/risk-tolerant-opportunities";
import { cleanText, formatNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeInsightText } from "@/lib/ui/labels";

export type OpportunityDecisionFilter = "ALL" | "ENTER" | "WAIT_PULLBACK" | "WATCH" | "AVOID" | "EXIT";
export type OpportunitySortKey = "SCORE_DESC" | "CONVICTION_DESC" | "SYMBOL_ASC" | "PRICE_DESC" | "DECISION_PRIORITY";
export type OpportunityTabKey = "BEST" | "RISK_TOLERANT" | "SHOCK" | "PULLBACK" | "MOMENTUM" | "WATCHLIST" | "FULL";

export type OpportunityFilterState = {
  activeTab: OpportunityTabKey;
  assetTypeFilter: string;
  decisionFilter: OpportunityDecisionFilter;
  entryStatusFilter: string;
  minConviction: number;
  minScore: number;
  qualityFilter: string;
  search: string;
  sectorFilter: string;
  setupFilter: string;
  showWatchlistOnly: boolean;
  sortKey: OpportunitySortKey;
};

export function applyNonTabOpportunityFilters(rows: OpportunityViewModel[], state: OpportunityFilterState, watchlistSet: Set<string>): OpportunityViewModel[] {
  const query = state.search.trim().toLowerCase();
  return rows
    .filter((row) => !state.showWatchlistOnly || watchlistSet.has(row.symbol))
    .filter((row) => {
      if (!query) return true;
      return row.symbol.toLowerCase().includes(query) || cleanText(row.company_name, "").toLowerCase().includes(query);
    })
    .filter((row) => state.decisionFilter === "ALL" || opportunityDecision(row) === state.decisionFilter)
    .filter((row) => state.assetTypeFilter === "ALL" || cleanText(row.assetType, "") === state.assetTypeFilter)
    .filter((row) => state.sectorFilter === "ALL" || cleanText(row.sector, "") === state.sectorFilter)
    .filter((row) => state.setupFilter === "ALL" || opportunitySetupType(row) === state.setupFilter)
    .filter((row) => state.entryStatusFilter === "ALL" || cleanText(row.entryStatus, "") === state.entryStatusFilter)
    .filter((row) => state.qualityFilter === "ALL" || cleanText(row.recommendationQualityLabel, "") === state.qualityFilter)
    .filter((row) => (row.final_score ?? 0) >= state.minScore)
    .filter((row) => row.conviction >= state.minConviction);
}

export function opportunityTabMatches(row: OpportunityViewModel, tab: OpportunityTabKey, watchlistSet: Set<string>, riskTolerantSymbols: Set<string>): boolean {
  if (tab === "FULL") return true;
  if (tab === "WATCHLIST") return watchlistSet.has(row.symbol);
  if (tab === "RISK_TOLERANT") return riskTolerantSymbols.has(row.symbol);
  if (tab === "SHOCK") return opportunityIsShockPotential(row);
  if (tab === "PULLBACK") return opportunitySetupType(row) === "PULLBACK";
  if (tab === "MOMENTUM") return opportunityIsMomentumContinuation(row);
  return opportunityIsBestSetup(row);
}

export function opportunityIsBestSetup(row: OpportunityViewModel): boolean {
  const value = opportunityDecision(row);
  return value === "ENTER" || value === "WAIT_PULLBACK" || (value === "WATCH" && row.conviction >= 70);
}

export function compareOpportunityRows(
  left: OpportunityViewModel,
  right: OpportunityViewModel,
  sortKey: OpportunitySortKey,
  riskTolerantRows: RiskTolerantOpportunity[],
  activeTab: OpportunityTabKey,
): number {
  const riskRank = riskTolerantRank(left, riskTolerantRows) - riskTolerantRank(right, riskTolerantRows);
  if (riskRank !== 0 && activeTab === "RISK_TOLERANT") return riskRank;
  if (activeTab === "SHOCK") {
    const shockRank = numericDesc(left.shockPattern?.opportunityScore ?? null, right.shockPattern?.opportunityScore ?? null);
    if (shockRank !== 0) return shockRank;
  }
  if (sortKey === "SYMBOL_ASC") return left.symbol.localeCompare(right.symbol);
  if (sortKey === "CONVICTION_DESC") return right.conviction - left.conviction || left.symbol.localeCompare(right.symbol);
  if (sortKey === "PRICE_DESC") return numericDesc(left.price, right.price) || left.symbol.localeCompare(right.symbol);
  if (sortKey === "DECISION_PRIORITY") return decisionPriority(left) - decisionPriority(right) || right.conviction - left.conviction || left.symbol.localeCompare(right.symbol);
  return numericDesc(left.final_score, right.final_score) || right.conviction - left.conviction || left.symbol.localeCompare(right.symbol);
}

export function opportunityEmptyMessage(tab: OpportunityTabKey, activeFilterCount: number, fullUniverseCount: number, watchlistCount: number): string {
  if (tab === "WATCHLIST" && watchlistCount === 0) {
    return "The watchlist tab is empty because no symbols are saved on this device yet.";
  }
  const hiddenHint = tab !== "FULL" && fullUniverseCount > 0
    ? `${fullUniverseCount.toLocaleString()} symbol${fullUniverseCount === 1 ? "" : "s"} match your search and filters in Full Universe, but not in this tab.`
    : "";
  const filterHint = activeFilterCount ? "Clear search and filters to broaden the result set." : "Switch to Full Universe when you want the widest view.";
  if (tab === "FULL") return `No symbols match the current search and filters. ${filterHint}`;
  if (tab === "RISK_TOLERANT") return `No strict risk-tolerant candidates match this exact view. ${hiddenHint || filterHint}`;
  if (tab === "SHOCK") return `No shock-potential symbols match this exact view. ${hiddenHint || filterHint}`;
  if (tab === "PULLBACK") return `No pullback-watch symbols match this exact view. ${hiddenHint || filterHint}`;
  if (tab === "MOMENTUM") return `No momentum-continuation symbols match this exact view. ${hiddenHint || filterHint}`;
  if (tab === "WATCHLIST") return `No watchlist symbols match this exact view. ${hiddenHint || filterHint}`;
  return `No best setups match this exact view. ${hiddenHint || filterHint}`;
}

export function opportunityRankingExplanation(sortKey: OpportunitySortKey, activeTab: OpportunityTabKey): string {
  if (activeTab === "RISK_TOLERANT") return "Higher-risk mode ranks the best risk/reward candidates first, then uses your selected sort as a tie-breaker.";
  if (activeTab === "SHOCK") return "Large-Move Watch ranks symbols by computed high-volatility opportunity first, with ties handled by the selected sort.";
  if (sortKey === "SCORE_DESC") return "Sorted by scanner score, then conviction and symbol for stable ordering.";
  if (sortKey === "CONVICTION_DESC") return "Sorted by conviction, then symbol for stable ordering.";
  if (sortKey === "SYMBOL_ASC") return "Sorted alphabetically so search and filter checks are easy to verify.";
  if (sortKey === "PRICE_DESC") return "Sorted by latest available price; missing prices fall to the bottom.";
  return "Sorted by decision priority, then conviction and symbol for stable ordering.";
}

export function opportunityVisibilityReason(row: OpportunityViewModel, activeTab: OpportunityTabKey, sortKey: OpportunitySortKey, index: number): string {
  const rank = `Ranked #${index + 1}`;
  if (activeTab === "RISK_TOLERANT") {
    return `${rank} because it is part of the higher-risk candidate set. It remains research only and can still carry elevated downside or late-entry risk.`;
  }
  if (activeTab === "SHOCK") {
    const shockScore = row.shockPattern?.opportunityScore ?? row.shockPattern?.upsideShockScore ?? null;
    return `${rank} because large-move or volatility evidence is elevated${shockScore === null ? "" : ` (${formatNumber(shockScore, 0)}/100)`}. This is not a main TradeVeto signal.`;
  }
  if (activeTab === "PULLBACK") return `${rank} because the setup is a pullback watch. Entry timing still depends on stabilization and confirmation.`;
  if (activeTab === "MOMENTUM") return `${rank} because momentum or trend follow-through evidence is elevated. Late-entry risk remains visible below.`;
  if (activeTab === "WATCHLIST") return `${rank} because this symbol is saved in your watchlist and matches the active filters.`;
  if (activeTab === "FULL") return `${rank} in Full Universe after applying search, filters, and ${sortLabel(sortKey).toLowerCase()} sorting.`;
  return humanizeInsightText(`${rank} because it passes the Best Setups gate: enter/wait-pullback, or high-conviction watch.`);
}

export function opportunityDecision(row: OpportunityViewModel): string {
  return cleanText(row.final_decision, "WATCH").toUpperCase();
}

export function opportunitySetupType(row: OpportunityViewModel): string {
  const raw = cleanText(row.raw.setup_type, "AVOID").toUpperCase().replace(/[\s-]+/g, "_");
  if (raw === "PULLBACK" || raw.includes("PULLBACK") || raw.includes("AVWAP")) return "PULLBACK";
  if (raw === "BREAKOUT" || raw.includes("BREAKOUT")) return "BREAKOUT";
  if (raw === "CONTINUATION" || raw.includes("CONTINUATION") || raw.includes("TREND")) return "CONTINUATION";
  return "AVOID";
}

export function opportunitySetupLabel(value: string): string {
  if (value === "PULLBACK") return "Pullback";
  if (value === "BREAKOUT") return "Breakout";
  if (value === "CONTINUATION") return "Continuation";
  return "Avoid";
}

function sortLabel(sortKey: OpportunitySortKey): string {
  if (sortKey === "SCORE_DESC") return "Score descending";
  if (sortKey === "CONVICTION_DESC") return "Conviction descending";
  if (sortKey === "SYMBOL_ASC") return "Symbol A-Z";
  if (sortKey === "PRICE_DESC") return "Price";
  return "Decision priority";
}

function riskTolerantRank(row: OpportunityViewModel, riskTolerantRows: RiskTolerantOpportunity[]): number {
  return riskTolerantRows.find((candidate) => candidate.symbol === row.symbol)?.riskTolerantRank ?? Number.POSITIVE_INFINITY;
}

export function opportunityIsShockPotential(row: OpportunityViewModel): boolean {
  if ((row.shockPattern?.opportunityScore ?? 0) >= 45 || (row.shockPattern?.upsideShockScore ?? 0) >= 55 || (row.shockPattern?.twoSidedVolatilityScore ?? 0) >= 55) return true;
  const eventShock = numeric(row.raw.event_shock_pressure_score ?? row.raw.verified_event_pressure_score) ?? 0;
  const return1d = Math.abs(numeric(row.raw.return_1d) ?? 0);
  const volatility = numeric(row.raw.annualized_volatility ?? row.raw.volatility ?? row.raw.volatility_pct) ?? 0;
  return eventShock >= 68 || return1d >= 5 || volatility >= 55;
}

export function opportunityIsMomentumContinuation(row: OpportunityViewModel): boolean {
  const setup = opportunitySetupType(row);
  const technical = numeric(row.raw.technical_score) ?? row.final_score ?? 0;
  const setupStrength = numeric(row.raw.setup_strength) ?? row.conviction;
  return setup === "CONTINUATION" || technical >= 72 || setupStrength >= 72;
}

function decisionPriority(row: OpportunityViewModel): number {
  const value = opportunityDecision(row);
  if (value === "ENTER") return 0;
  if (value === "WAIT_PULLBACK") return 1;
  if (value === "WATCH") return 2;
  if (value === "EXIT") return 3;
  if (value === "AVOID") return 4;
  return 5;
}

function numericDesc(left: number | null, right: number | null): number {
  const leftValue = left ?? Number.NEGATIVE_INFINITY;
  const rightValue = right ?? Number.NEGATIVE_INFINITY;
  return rightValue - leftValue;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
