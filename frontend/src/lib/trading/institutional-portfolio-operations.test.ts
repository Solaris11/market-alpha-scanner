import assert from "node:assert/strict";
import test from "node:test";
import type { DataFreshness } from "@/lib/data-health";
import type { PaperAnalyticsData, PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type { CsvRow } from "@/lib/types";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { ShockMovePattern } from "./shock-move";
import { buildInstitutionalPortfolioOperationsSystem } from "./institutional-portfolio-operations";
import { buildPortfolioIntelligenceSystem } from "./portfolio-intelligence";
import { buildScenarioIntelligenceSystem } from "./scenario-intelligence";
import { buildSimulatedAiPortfolioSystem } from "./simulated-ai-portfolio";
import { normalizeWorkspacePreferences } from "./workspace-preferences";

const fresh: DataFreshness = {
  ageMinutes: 3,
  humanAge: "Updated 3 min ago",
  label: "Fresh",
  lastUpdated: "2026-05-21T16:00:00.000Z",
  message: "Fresh - updated 3 min ago",
  status: "fresh",
};

function position(overrides: Partial<PaperPositionRow> = {}): PaperPositionRow {
  const symbol = overrides.symbol ?? "AMD";
  return {
    close_reason: null,
    closed_at: null,
    current_price: 111,
    entry_price: 105,
    entry_status: "watch",
    exit_price: null,
    final_decision: "WATCH",
    id: `${symbol}-paper`,
    opened_at: "2026-05-19T14:30:00.000Z",
    quantity: 12,
    rating: "A",
    realized_pnl: null,
    recommendation_quality: "watch",
    return_pct: null,
    setup_type: "pullback",
    status: "OPEN",
    stop_loss: 97,
    symbol,
    target_price: 128,
    unrealized_pnl: 72,
    ...overrides,
  };
}

function event(overrides: Partial<PaperTradeEventRow> = {}): PaperTradeEventRow {
  const symbol = overrides.symbol ?? "AMD";
  return {
    cash_delta: -1260,
    created_at: "2026-05-19T14:31:00.000Z",
    event_reason: "paper entry",
    event_type: "OPEN",
    id: `${symbol}-event`,
    pnl_delta: 0,
    price: 105,
    quantity: 12,
    symbol,
    ...overrides,
  };
}

function analytics(): PaperAnalyticsData {
  return {
    configured: true,
    groups: [],
    summary: {
      avg_return_pct: -0.01,
      closed_trades: 2,
      max_drawdown: -240,
      open_trades: 2,
      total_pnl: -140,
      total_realized_pnl: -220,
      total_trades: 4,
      total_unrealized_pnl: 80,
      win_rate: 0.5,
    },
    timeline: [
      { cumulative_pnl: 200, daily_pnl: 200, date: "2026-05-18" },
      { cumulative_pnl: -40, daily_pnl: -240, date: "2026-05-19" },
      { cumulative_pnl: 50, daily_pnl: 90, date: "2026-05-20" },
    ],
  };
}

function shock(overrides: Partial<ShockMovePattern> = {}): ShockMovePattern {
  return {
    asymmetryScore: 72,
    averageDrawdownAfterEntry: "-3.2%",
    averageFollowthrough1d: 1.1,
    averageFollowthrough5d: 3.4,
    averageProfitPotential: "+10.0%",
    averageReversal5d: -1.4,
    chaseRiskLabel: "Moderate chase risk",
    chaseRiskScore: 42,
    chaseSuccessRate: 58,
    commonFailureConditions: ["macro support weakens"],
    commonPreconditions: ["compression before expansion"],
    currentSimilarityScore: 70,
    downsideRiskScore: 44,
    downsideShockCount: 3,
    doNotChaseZone: "$124.00+",
    historicalExitZone: "$126.00-$132.00",
    invalidationZone: "$97.00",
    largestDownside1d: -9.2,
    largestUpside1d: 14.4,
    lastUpdated: "2026-05-21T16:00:00.000Z",
    latestEvent: null,
    lookbackWindow: "3y",
    medianDownsideShock: -5.1,
    medianUpsideShock: 8.2,
    opportunityScore: 73,
    opportunityState: "Constructive Watch",
    pullbackSuccessRate: 63,
    reliabilityScore: 66,
    researchEntryZone: "$108.00-$111.00",
    shockEvents: [],
    symbol: "AMD",
    twoSidedVolatilityScore: 52,
    upsideShockCount: 14,
    upsideShockScore: 76,
    ...overrides,
  };
}

function opportunity(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const sector = overrides.sector ?? "Semiconductors";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 78,
    dataFreshness: fresh,
    decayLabel: "Fresh setup",
    decision_reason: "Structure is improving while the model waits for confirmation.",
    entryStatus: "watch",
    entryZoneLabel: "$108.00-$111.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 36,
    final_decision: "WATCH",
    final_score: 79,
    fragility: 42,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 111,
    raw: {
      exchange_health_score: 70,
      final_decision: "WATCH",
      final_score: 79,
      fragility_score: 42,
      liquidity_pressure: 34,
      macro_alignment_score: 74,
      price: 111,
      risk_reward: 2.1,
      sector,
      setup_type: "pullback",
      symbol,
      volatility_pressure: 38,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector,
    shockPattern: shock({ symbol }),
    stop_loss: 97,
    structuralLabel: "Stable structure",
    suggested_entry: 109,
    symbol,
    target: 128,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

function forwardRows(): CsvRow[] {
  return [
    { date: "2026-01-02", drawdown: -1.2, final_score: 86, fragility_score: 34, macro_alignment_score: 78, price: 100, return_pct: 4.2, risk_reward: 2.2, sector: "Semiconductors", setup_type: "pullback", symbol: "AMD", volatility_pressure: 42 },
    { date: "2026-01-05", drawdown: -6.4, final_score: 82, fragility_score: 48, macro_alignment_score: 66, price: 880, return_pct: 1.8, risk_reward: 1.7, sector: "Semiconductors", setup_type: "momentum", symbol: "NVDA", volatility_pressure: 58 },
    { date: "2026-01-08", drawdown: -7.2, final_score: 76, fragility_score: 66, macro_alignment_score: 41, price: 240, return_pct: -2.9, risk_reward: 1.3, sector: "Software", setup_type: "breakout", symbol: "CRWD", volatility_pressure: 72 },
    { date: "2026-01-12", drawdown: -2.1, final_score: 84, fragility_score: 38, macro_alignment_score: 72, price: 540, return_pct: 3.1, risk_reward: 1.9, sector: "Index", setup_type: "trend", symbol: "SPY", volatility_pressure: 35 },
  ];
}

test("institutional portfolio operations exposes lifecycle and risk budgets without inventing missing thesis data", () => {
  const opportunities = [
    opportunity({ symbol: "AMD" }),
    opportunity({
      fragility: 78,
      raw: { fragility_score: 78, macro_alignment_score: 34, sector: "Software", symbol: "DDOG", volatility_pressure: 76 },
      sector: "Software",
      shockPattern: shock({ downsideRiskScore: 76, symbol: "DDOG", twoSidedVolatilityScore: 80 }),
      symbol: "DDOG",
    }),
  ];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const portfolio = buildPortfolioIntelligenceSystem({
    accountValue: 50000,
    opportunities,
    positions: [
      position({ current_price: 111, quantity: 18, symbol: "AMD" }),
      position({ current_price: 142, entry_price: 139, quantity: 10, stop_loss: null, symbol: "DDOG", target_price: null }),
      position({
        close_reason: "target missed",
        closed_at: "2026-05-20T16:00:00.000Z",
        exit_price: 132,
        final_decision: "MANUAL",
        id: "DDOG-closed-paper",
        quantity: 5,
        realized_pnl: -35,
        return_pct: -0.0504,
        setup_type: "MANUAL",
        status: "CLOSED",
        symbol: "DDOG",
        unrealized_pnl: null,
      }),
    ],
    scenarioSystem,
  });

  const system = buildInstitutionalPortfolioOperationsSystem({
    paperAnalytics: analytics(),
    paperEvents: [
      event({ created_at: "2026-05-20T16:01:00.000Z", event_reason: "risk review", event_type: "CLOSE", pnl_delta: -35, price: 132, quantity: 5, symbol: "DDOG" }),
      event(),
    ],
    paperPositions: [
      position({ current_price: 111, quantity: 18, symbol: "AMD" }),
      position({ current_price: 142, entry_price: 139, quantity: 10, stop_loss: null, symbol: "DDOG", target_price: null }),
      position({
        close_reason: "target missed",
        closed_at: "2026-05-20T16:00:00.000Z",
        exit_price: 132,
        final_decision: "MANUAL",
        id: "DDOG-closed-paper",
        quantity: 5,
        realized_pnl: -35,
        return_pct: -0.0504,
        setup_type: "MANUAL",
        status: "CLOSED",
        symbol: "DDOG",
        unrealized_pnl: null,
      }),
    ],
    portfolio,
    workspacePreferences: normalizeWorkspacePreferences({
      favoriteModules: ["watchlist", "alerts"],
      updatedAt: "2026-05-20T20:00:00.000Z",
      workspaceMode: "watchlist_first",
    }),
  });

  assert.equal(system.openPositionCount, 2);
  assert.ok(system.positionLifecycle.some((item) => item.symbol === "DDOG" && item.status === "incomplete"));
  assert.ok(system.positionLifecycle.some((item) => item.symbol === "DDOG" && /Stop limited \/ Target limited/.test(item.stopTarget)));
  assert.ok(system.positionLifecycle.every((item) => item.drawdown.length > 0 && item.exitPlan.length > 0 && item.lessonLearned.length > 0));
  assert.ok(system.positionLifecycle.every((item) => item.scalingPlan.length > 0 && item.lifecycleSteps.length === 7));
  assert.ok(system.positionLifecycle.some((item) => item.symbol === "DDOG" && item.lifecycleSteps.some((step) => step.type === "invalidation" && step.status === "missing")));
  assert.ok(system.allocationHistory.some((item) => item.source === "paper_event"));
  assert.ok(system.allocationHistory.every((item) => item.priorMetric.length > 0 && item.rebalanceRationale.length > 0 && item.riskChange.length > 0));
  assert.ok(system.thesisLifecycle.some((item) => item.symbol === "DDOG" && item.state === "incomplete"));
  assert.ok(system.thesisLifecycle.some((item) => item.symbol === "DDOG" && item.lifecycleStage === "weakened"));
  assert.ok(system.drawdownStories.some((item) => item.source === "paper_account"));
  assert.ok(system.drawdownStories.every((item) => item.cause.length > 0 && item.macroRiskContext.length > 0 && item.recoveryStatus.length > 0));
  assert.ok(system.paperTradeAutopsies.some((item) => item.source === "paper_account" && /manual paper trade/i.test(item.replayEvidence) && !item.replayBacked));
  assert.ok(system.paperTradeAutopsies.every((item) => item.noFakeFillDisclosure.length > 0 && item.exit.length > 0 && item.lessonLearned.length > 0));
  assert.ok(system.workspaceContinuity.some((item) => item.label === "Saved Workspace" && item.status === "available"));
  assert.ok(system.workspaceContinuity.some((item) => item.label === "Portfolio Workspace Restore" && item.status === "available"));
  assert.ok(system.workspaceContinuity.some((item) => item.label === "Compare Restore" && item.status === "available"));
  assert.ok(system.operatingLanes.some((lane) => lane.label === "Thesis Completion"));
  assert.equal(system.auditManifest.evidenceBoundLifecyclePct, 100);
  assert.equal(system.auditManifest.ledgerIntegrity, "pass");
  assert.ok(system.proofGates.some((gate) => gate.label === "Trade autopsy boundary" && gate.status === "partial"));
  assert.ok(system.proofGates.some((gate) => gate.label === "Evidence-bound lifecycle records" && gate.status === "pass"));
  assert.ok(system.proofGates.some((gate) => gate.label === "Exportable operating ledger" && gate.status === "pass"));
  assert.equal(system.brokerIntegration.status, "not_integrated");
  assert.equal(system.brokerIntegration.canPlaceOrders, false);
  assert.equal(system.brokerIntegration.canReadBrokerFills, false);
  assert.ok(system.evidenceBoundaryDisclosures.some((line) => /No live broker integration/i.test(line)));
  assert.ok(system.operatingLedger.some((row) => row.category === "broker_boundary" && /No broker provider/i.test(row.evidence)));
  assert.ok(system.operatingLedger.some((row) => row.category === "position_lifecycle" && row.symbol === "AMD"));
  assert.ok(system.operatingLedger.some((row) => row.category === "allocation" && row.source === "paper_event"));
  assert.ok(system.operatingLedger.every((row) => row.boundaryDisclosure.length > 0 && row.evidenceLineage.length > 0));
  assert.match(system.operatingLedgerCsv, /boundary_disclosure/);
  assert.match(system.operatingLedgerCsv, /evidence_lineage/);
  assert.match(system.operatingLedgerCsv, /not a broker fill|No live broker integration/i);
  assert.ok(system.limitations.some((line) => /missing stop\/target\/thesis fields/i.test(line)));
  assert.ok(system.rebalanceHistory.length === 0);
});

test("institutional portfolio operations derives rebalance and strategy memory from simulation evidence", () => {
  const opportunities = [opportunity({ symbol: "AMD" }), opportunity({ raw: { sector: "Index", symbol: "SPY" }, sector: "Index", symbol: "SPY" })];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const portfolio = buildPortfolioIntelligenceSystem({
    accountValue: 100000,
    opportunities,
    positions: [position({ current_price: 111, quantity: 25, symbol: "AMD" }), position({ current_price: 545, entry_price: 540, quantity: 2, symbol: "SPY" })],
    scenarioSystem,
  });
  const simulatedPortfolio = buildSimulatedAiPortfolioSystem({
    forwardRows: forwardRows(),
    opportunities,
    startingCapital: 100000,
  });

  const system = buildInstitutionalPortfolioOperationsSystem({
    portfolio,
    preferredMode: "balanced",
    simulatedPortfolio,
  });

  assert.equal(system.activeMode, "balanced");
  assert.ok(system.rebalanceHistory.length >= 1);
  assert.ok(system.strategyMemory.length >= 1);
  assert.ok(system.drawdownStories.some((item) => item.source === "strategy_labs"));
  assert.ok(system.paperTradeAutopsies.some((item) => item.source === "strategy_labs" && item.replayBacked && item.replayEvidenceStatus === "explicit_replay"));
  assert.ok(system.strategyRevisions.every((item) => item.whatChanged.length > 0 && item.whyChanged.length > 0 && item.evidenceBasis.length > 0));
  assert.equal(system.auditManifest.revisionTraceabilityPct, 100);
  assert.ok(system.workspaceContinuity.some((item) => item.label === "Strategy Labs Memory" && item.status === "available"));
  assert.ok(system.workspaceContinuity.some((item) => item.label === "Strategy Workspace Restore" && item.status === "available"));
  assert.ok(system.workspaceContinuity.some((item) => item.label === "Scenario Restore" && item.status === "available"));
  assert.ok(system.proofGates.some((gate) => gate.label === "Portfolio risk operations" && gate.status === "pass"));
  assert.ok(system.proofGates.some((gate) => gate.label === "Revision traceability" && gate.status === "pass"));
  assert.ok(system.operatingLedger.some((row) => row.category === "strategy_revision" && row.source === "strategy_labs"));
  assert.ok(system.operatingLedger.some((row) => row.category === "autopsy" && row.source === "strategy_labs"));
  assert.ok(system.operatingLedgerCsv.includes("Strategy Labs"));
  assert.match(system.limitations.join(" "), /derived from Strategy Labs simulation evidence/i);
});

test("institutional portfolio operating ledger is exportable without broker or return fabrication", () => {
  const opportunities = [opportunity({ symbol: "AMD" })];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows: opportunities });
  const portfolio = buildPortfolioIntelligenceSystem({
    accountValue: 25000,
    opportunities,
    positions: [
      position({
        close_reason: "manual review",
        closed_at: "2026-05-20T16:00:00.000Z",
        exit_price: 112,
        realized_pnl: 84,
        return_pct: 0.0666,
        status: "CLOSED",
        symbol: "AMD",
      }),
    ],
    scenarioSystem,
  });

  const system = buildInstitutionalPortfolioOperationsSystem({
    paperAnalytics: analytics(),
    paperEvents: [event({ event_reason: "paper close, not broker fill", event_type: "CLOSE", pnl_delta: 84 })],
    paperPositions: [
      position({
        close_reason: "manual review",
        closed_at: "2026-05-20T16:00:00.000Z",
        exit_price: 112,
        realized_pnl: 84,
        return_pct: 0.0666,
        status: "CLOSED",
        symbol: "AMD",
      }),
    ],
    portfolio,
  });

  assert.ok(system.operatingLedger.length > 0);
  assert.ok(system.operatingLedger.every((row) => !/guarantee|broker execution confirmed|live fill/i.test(`${row.detail} ${row.evidence} ${row.boundaryDisclosure}`)));
  assert.equal(system.auditManifest.exportRowCount, system.operatingLedger.length);
  assert.equal(system.auditManifest.exportColumnCount, 11);
  assert.ok(system.operatingLedgerCsv.startsWith("\"date\",\"category\",\"source\""));
  assert.match(system.operatingLedgerCsv, /paper close, not broker fill/);
  assert.match(system.operatingLedgerCsv, /paper_event:AMD/);
  assert.match(system.operatingLedgerCsv, /broker|Broker/);
});
