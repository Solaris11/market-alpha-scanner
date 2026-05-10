import assert from "node:assert/strict";
import test from "node:test";
import type { ActiveAlertMatch } from "@/lib/active-alert-matches";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import type { LiveIntelligenceSystem } from "./live-intelligence";
import { buildMobileIntelligenceCenter } from "./mobile-push-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 72,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-09T16:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh",
    decision_reason: "Structure is improving.",
    entryStatus: "watch",
    entryZoneLabel: "$100-$103",
    eventLabel: "Event Risk Contained",
    eventRisk: 42,
    final_decision: "WATCH",
    final_score: 76,
    fragility: 48,
    fragilityLabel: "Controlled",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: null,
    price: 108,
    raw: {
      final_decision: "WATCH",
      final_score: 76,
      relative_volume: 2.1,
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable",
    suggested_entry: 102,
    symbol,
    target: 122,
  };
  return { ...base, ...overrides, raw: { ...base.raw, ...(overrides.raw ?? {}) } };
}

function live(overrides: Partial<LiveIntelligenceSystem> = {}): LiveIntelligenceSystem {
  const base: LiveIntelligenceSystem = {
    alerts: [
      {
        detail: "Volatility and breadth pressure are changing quickly enough to review current risk.",
        reasonCodes: ["LIVE_REGIME_SHIFT"],
        score: 76,
        severity: "warning",
        title: "Live regime shift watch",
      },
    ],
    breadthScore: 44,
    dashboardUpdates: [],
    eventReactionScore: 54,
    generatedAt: "2026-05-09T16:00:00.000Z",
    intraday: {
      alerts: [],
      breadthHealthScore: 44,
      components: [],
      coverage: { coveragePct: 67, driftRows: 4, rows: 6, snapshotCountMax: 4, snapshotCountMedian: 3 },
      currentMarketState: "Intraday Volatility Expansion",
      driftDirection: "deteriorating",
      driftScore: 68,
      eventReactionFeed: [],
      eventReactionScore: 54,
      exchangePressure: 58,
      generatedAt: "2026-05-09T16:00:00.000Z",
      liquidityPressure: 62,
      limitations: [],
      llmBoundary: "LLM summarizes deterministic inputs only.",
      macroReactionFeed: [],
      observationWindowLabel: "Last 8 hours",
      opportunityDrifts: [],
      sectorRotationPressure: 58,
      shockActivityScore: 82,
      terminalSummary: "Volatility expansion is visible in latest scanner data.",
      volatilityPressure: 72,
      whatChangedIntraday: [],
      whatToMonitor: [],
    },
    latencyLabel: "Refreshes every 30 seconds",
    limitations: [],
    liveSummary: "Live intelligence is research context, not a trade instruction.",
    marketState: "Intraday Volatility Expansion",
    opportunityDriftScore: 55,
    refreshIntervalMs: 30_000,
    regimeShiftScore: 76,
    sequence: 0,
    shockEscalations: [
      {
        detail: "AMD has elevated live shock pressure from move intensity, event pressure, or volume expansion. Treat as high-volatility research context.",
        eventPressureScore: 70,
        priceMovePct: 5.2,
        score: 84,
        scoreChange: 8,
        shockScore: 82,
        state: "Shock Escalation",
        symbol: "AMD",
        unusualVolumeScore: 78,
      },
    ],
    shockEscalationScore: 82,
    status: "connected",
    streamMode: "snapshot",
    unusualVolumeScore: 78,
    volatilityPressure: 72,
  };
  return { ...base, ...overrides };
}

function workflow(): WorkflowEvolutionSummary {
  return {
    dailyBrief: ["AMD conditions changed."],
    deterioratingSetups: [],
    improvingSetups: [],
    lastSeenAt: "2026-05-08T16:00:00.000Z",
    opportunityMaturity: [],
    snapshotRows: [],
    triggerMonitors: [],
    watchlistEvolution: [
      {
        changeType: "shock_aligning",
        detail: "AMD shock conditions improved versus the previous workflow baseline.",
        metricLabel: "Shock +10",
        severity: "positive",
        symbol: "AMD",
        title: "Shock conditions aligning",
      },
    ],
    whatChanged: [
      {
        changeType: "fragility_rising",
        detail: "MU became more fragile. Review invalidation and avoid treating this as a stronger core signal.",
        metricLabel: "Fragility +12",
        severity: "warning",
        symbol: "MU",
        title: "Fragility increased",
      },
    ],
  };
}

function alertMatch(): ActiveAlertMatch {
  return {
    action: "WAIT",
    buy_zone: "100-103",
    channels: ["push"],
    company_name: "AMD Inc.",
    cooldown_active: false,
    cooldown_minutes: 60,
    entry_status: "NEAR ENTRY",
    final_decision: "WATCH",
    final_score: 76,
    last_sent: null,
    match_reason: "Price is near entry zone 100-103",
    notification_status: "Covered",
    price: 104,
    rating: "WATCH",
    risk_reward: "N/A",
    rule_id: "rule-1",
    rule_type: "NEAR ENTRY",
    scope: "watchlist",
    setup_type: "MOMENTUM_CONTINUATION",
    signal: "NEAR ENTRY",
    stop_loss: 96,
    symbol: "AMD",
    take_profit: "122",
    threshold: null,
    trade_quality: "Review",
  };
}

test("mobile intelligence prioritizes shock, macro, watchlist, and what-changed packets", () => {
  const center = buildMobileIntelligenceCenter({
    alertMatches: [alertMatch()],
    live: live(),
    rows: [row({ symbol: "AMD" }), row({ fragility: 76, fragilityLabel: "Elevated", symbol: "MU" })],
    watchlistSymbols: ["AMD"],
    workflow: workflow(),
  });

  assert.ok(center.packets.some((packet) => packet.category === "shock" && packet.symbol === "AMD" && packet.pushEligible));
  assert.ok(center.packets.some((packet) => packet.category === "macro" && packet.pushEligible));
  assert.ok(center.packets.some((packet) => packet.category === "watchlist" && packet.symbol === "AMD"));
  assert.ok(center.packets.some((packet) => packet.category === "what_changed" && packet.symbol === "MU"));
  assert.match(center.summary, /mobile update|tracking/i);
});

test("mobile intelligence remains research-only and avoids execution claims", () => {
  const center = buildMobileIntelligenceCenter({
    live: live(),
    rows: [row({ fragility: 82, fragilityLabel: "Elevated", symbol: "NVDA" })],
    workflow: null,
  });
  const combined = [
    center.summary,
    ...center.deliveryPolicy,
    ...center.limitations,
    ...center.packets.map((packet) => `${packet.title} ${packet.body} ${packet.evidenceLabel}`),
  ].join(" ");

  assert.doesNotMatch(combined, /buy now|sell now|guaranteed|sure profit|free money|place an order|execute this trade/i);
  assert.match(combined, /research context|not buy signals|not trade instructions/i);
});
