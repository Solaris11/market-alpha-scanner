import assert from "node:assert/strict";
import test from "node:test";
import {
  applyNonTabOpportunityFilters,
  compareOpportunityRows,
  opportunityEmptyMessage,
  opportunityIsBestSetup,
  opportunityRankingExplanation,
  opportunityTabMatches,
  opportunityVisibilityReason,
  type OpportunityFilterState,
} from "./opportunity-filtering";
import type { OpportunityViewModel } from "./opportunity-view-model";

type OpportunityFixtureOverrides = Omit<Partial<OpportunityViewModel>, "raw"> & {
  raw?: Partial<OpportunityViewModel["raw"]>;
};

function row(overrides: OpportunityFixtureOverrides = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    conviction: 72,
    confidenceLabel: "High",
    dataFreshness: {
      ageMinutes: 3,
      humanAge: "Updated 3 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 3 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Scanner evidence is improving.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Context Mixed",
    eventRisk: 58,
    final_decision: "WATCH",
    final_score: 74,
    fragility: 55,
    fragilityLabel: "Moderate fragility",
    macroAdjustment: 1.2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 105,
    raw: {
      symbol,
      final_score: 74,
      final_decision: "WATCH",
      price: 105,
      return_1d: 1.2,
      setup_type: "CONTINUATION",
      setup_strength: 76,
      technical_score: 78,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable trend",
    suggested_entry: 101,
    symbol,
    target: 121,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

function state(overrides: Partial<OpportunityFilterState> = {}): OpportunityFilterState {
  return {
    activeTab: "BEST",
    assetTypeFilter: "ALL",
    decisionFilter: "ALL",
    entryStatusFilter: "ALL",
    minConviction: 0,
    minScore: 0,
    qualityFilter: "ALL",
    search: "",
    sectorFilter: "ALL",
    setupFilter: "ALL",
    showWatchlistOnly: false,
    sortKey: "SCORE_DESC",
    ...overrides,
  };
}

test("search matches full universe even when the active tab hides the symbol", () => {
  const hiddenAvoid = row({ conviction: 42, final_decision: "AVOID", symbol: "AMD" });
  const rows = [hiddenAvoid, row({ final_score: 81, symbol: "NVDA" })];
  const filteredUniverse = applyNonTabOpportunityFilters(rows, state({ search: "AMD" }), new Set());

  assert.deepEqual(filteredUniverse.map((item) => item.symbol), ["AMD"]);
  assert.equal(opportunityIsBestSetup(hiddenAvoid), false);
  assert.equal(opportunityTabMatches(hiddenAvoid, "BEST", new Set(), new Set()), false);
  assert.match(opportunityEmptyMessage("BEST", 1, filteredUniverse.length, 0), /Full Universe/);
});

test("contradictory tab and setup filters expose hidden full-universe matches", () => {
  const breakout = row({ raw: { setup_type: "BREAKOUT" }, symbol: "AVGO" });
  const rows = [breakout, row({ raw: { setup_type: "PULLBACK" }, symbol: "TSM" })];
  const filteredUniverse = applyNonTabOpportunityFilters(rows, state({ activeTab: "PULLBACK", setupFilter: "BREAKOUT" }), new Set());
  const visible = filteredUniverse.filter((item) => opportunityTabMatches(item, "PULLBACK", new Set(), new Set()));

  assert.deepEqual(filteredUniverse.map((item) => item.symbol), ["AVGO"]);
  assert.equal(visible.length, 0);
  assert.match(opportunityEmptyMessage("PULLBACK", 2, filteredUniverse.length, 0), /match your search and filters in Full Universe/);
});

test("watchlist-only filtering is explicit when no symbols are saved", () => {
  const rows = [row({ symbol: "AMD" }), row({ symbol: "MU" })];
  const filteredUniverse = applyNonTabOpportunityFilters(rows, state({ activeTab: "WATCHLIST", showWatchlistOnly: true }), new Set());

  assert.equal(filteredUniverse.length, 0);
  assert.match(opportunityEmptyMessage("WATCHLIST", 1, filteredUniverse.length, 0), /no symbols are saved/i);
});

test("sorting and visibility explanations remain deterministic", () => {
  const rows = [
    row({ final_score: 80, symbol: "MU" }),
    row({ final_score: 80, symbol: "AMD" }),
    row({ final_score: 74, symbol: "NVDA" }),
  ];
  const sorted = [...rows].sort((left, right) => compareOpportunityRows(left, right, "SCORE_DESC", [], "FULL"));

  assert.deepEqual(sorted.map((item) => item.symbol), ["AMD", "MU", "NVDA"]);
  assert.match(opportunityRankingExplanation("SCORE_DESC", "FULL"), /stable ordering/i);
  assert.match(opportunityVisibilityReason(sorted[0]!, "FULL", "SCORE_DESC", 0), /Full Universe/);
});

test("core tab, decision, and sort combinations stay stable without hiding full-universe context", () => {
  const rows = [
    row({ final_decision: "ENTER", raw: { setup_type: "PULLBACK" }, symbol: "AMD" }),
    row({ final_decision: "WAIT_PULLBACK", raw: { setup_type: "BREAKOUT" }, symbol: "MU" }),
    row({ conviction: 78, final_decision: "WATCH", raw: { setup_type: "CONTINUATION" }, symbol: "NVDA" }),
    row({ conviction: 38, final_decision: "AVOID", raw: { event_shock_pressure_score: 72, setup_type: "AVOID" }, symbol: "DDOG" }),
  ];
  const tabs = ["BEST", "RISK_TOLERANT", "SHOCK", "PULLBACK", "MOMENTUM", "WATCHLIST", "FULL"] as const;
  const decisions = ["ALL", "ENTER", "WAIT_PULLBACK", "WATCH", "AVOID", "EXIT"] as const;
  const sorts = ["SCORE_DESC", "CONVICTION_DESC", "SYMBOL_ASC", "PRICE_DESC", "DECISION_PRIORITY"] as const;
  const watchlist = new Set(["AMD", "DDOG"]);
  const riskTolerant = new Set(["MU", "DDOG"]);

  for (const activeTab of tabs) {
    for (const decisionFilter of decisions) {
      for (const sortKey of sorts) {
        const filteredUniverse = applyNonTabOpportunityFilters(rows, state({ activeTab, decisionFilter, sortKey }), watchlist);
        const visible = filteredUniverse
          .filter((item) => opportunityTabMatches(item, activeTab, watchlist, riskTolerant))
          .sort((left, right) => compareOpportunityRows(left, right, sortKey, [], activeTab));
        const symbols = visible.map((item) => item.symbol);

        assert.equal(new Set(symbols).size, symbols.length);
        assert.equal(filteredUniverse.length <= rows.length, true);
      }
    }
  }
});
