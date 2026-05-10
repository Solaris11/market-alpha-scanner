import assert from "node:assert/strict";
import test from "node:test";
import type { PaperPositionRow } from "@/lib/paper-data";
import type { DecisionMemorySummary } from "./decision-journal";
import type { MarketMemorySummary } from "./market-memory";
import { buildTradeVetoOperatingSystem } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildUserPersonalizationProfile } from "./personalized-intelligence";
import { buildPortfolioIntelligenceSystem } from "./portfolio-intelligence";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";
import {
  answerResearchCopilotDeterministically,
  buildResearchCopilotContext,
  inferResearchIntent,
} from "./research-copilot";
import { buildScenarioIntelligenceSystem } from "./scenario-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

function row(overrides: Partial<OpportunityViewModel> = {}): OpportunityViewModel {
  const symbol = overrides.symbol ?? "AMD";
  const base: OpportunityViewModel = {
    assetType: "equity",
    company_name: `${symbol} Inc.`,
    confidenceLabel: "High",
    conviction: 78,
    dataFreshness: {
      ageMinutes: 4,
      humanAge: "Updated 4 min ago",
      label: "Fresh",
      lastUpdated: "2026-05-08T20:00:00.000Z",
      message: "Fresh - updated 4 min ago",
      status: "fresh",
    },
    decayLabel: "Fresh setup",
    decision_reason: "Structure is constructive but still probabilistic.",
    entryStatus: "watch",
    entryZoneLabel: "$100.00-$103.00",
    eventLabel: "Event Risk Contained",
    eventRisk: 34,
    final_decision: "WATCH",
    final_score: 80,
    fragility: 42,
    fragilityLabel: "Controlled fragility",
    macroAdjustment: 2,
    macroLabel: "Macro Aligned",
    narrative: {
      bearishNarrative: "Fragility can rise if breadth weakens.",
      bullishNarrative: "Momentum remains supported by sector participation.",
      conditionalOpportunity: "Improves if relative volume confirms without extension.",
      decisionReasoning: "Watch state reflects improving structure with risk controls.",
      eventReasoning: "No verified event catalyst dominates the setup.",
      fragilityReasoning: "Volatility remains contained.",
      generatedAt: "2026-05-08T20:00:00.000Z",
      liquidityNarrative: "Liquidity pressure is moderate.",
      macroNarrative: "Macro alignment is supportive.",
      moderatorSummary: "Constructive, but not an execution instruction.",
      narrativeDrift: {
        deteriorationScore: 28,
        label: "strengthening",
        momentumScore: 64,
        transitionSignals: ["sector breadth"],
      },
      narrativeSummary: "Sector participation supports the setup while risk controls remain active.",
      positioningNarrative: "Crowding is not the dominant issue.",
      pressureStory: "Positive sector pressure offsets moderate event risk.",
      riskLanguage: "Research only. Not financial advice.",
      riskNarrative: "Risk remains two-sided.",
      sectorNarrative: "Semiconductor breadth is supportive.",
      source: "deterministic",
      symbol,
      unsupportedClaimsDetected: false,
      volatilityNarrative: "Volatility pressure is contained.",
      whatCouldBreak: "Breadth deterioration or volatility expansion.",
      whatToWatch: ["relative volume", "breadth"],
      whySetupMatters: "It is a high-priority watch candidate.",
    },
    price: 105,
    raw: {
      breadth_score: 72,
      exchange_health_score: 70,
      final_decision: "WATCH",
      final_score: 80,
      fragility_score: 42,
      liquidity_pressure: 34,
      macro_alignment_score: 72,
      price: 105,
      risk_on_score: 70,
      sector: "Semiconductors",
      setup_type: "MOMENTUM_CONTINUATION",
      symbol,
      volatility_pressure: 38,
    },
    recommendationQuality: "watch",
    recommendationQualityLabel: "Watch",
    sector: "Semiconductors",
    shockPattern: null,
    stop_loss: 96,
    structuralLabel: "Stable structure",
    suggested_entry: 101,
    symbol,
    target: 126,
  };
  return {
    ...base,
    ...overrides,
    raw: { ...base.raw, ...(overrides.raw ?? {}) },
  };
}

const memory: MarketMemorySummary = {
  analogs: [],
  available: true,
  evidence: {
    explanation: "Moderate evidence confidence based on comparable historical setups.",
    label: "Moderate evidence confidence",
    sampleSize: 42,
    tier: "moderate",
  },
  narrative: [
    "This setup resembles prior semiconductor continuation setups during supportive macro conditions.",
    "Historically similar setups became fragile when volatility expanded.",
  ],
  outcome: null,
};

const decisionMemory: DecisionMemorySummary = {
  available: true,
  behaviorFlags: ["User often revisits momentum setups."],
  chaseCount: 1,
  coachingNotes: ["Waiting for pullback stabilization historically improved decision quality."],
  journalCount: 7,
  lastUpdated: "2026-05-08T20:00:00.000Z",
  outcomePendingCount: 2,
  patientDecisionCount: 4,
  preferredActions: [],
  privacyNote: "Private user memory.",
  strengths: ["Pullback continuation decisions show better outcomes."],
  symbol: null,
  symbolEntryCount: 0,
  topSetups: [],
  weaknesses: ["Late shock entries need caution."],
};

const workflow: WorkflowEvolutionSummary = {
  dailyBrief: ["AMD improved while MU fragility increased."],
  deterioratingSetups: [{
    changeType: "fragility_rising",
    detail: "Fragility increased after volatility pressure rose.",
    metricLabel: "Fragility +8",
    severity: "warning",
    symbol: "MU",
    title: "Fragility rising",
  }],
  improvingSetups: [{
    changeType: "improving",
    detail: "Conviction improved while macro alignment stayed supportive.",
    metricLabel: "Conviction +6",
    severity: "positive",
    symbol: "AMD",
    title: "Setup quality improving",
  }],
  lastSeenAt: "2026-05-07T20:00:00.000Z",
  opportunityMaturity: [],
  snapshotRows: [],
  triggerMonitors: [],
  watchlistEvolution: [],
  whatChanged: [{
    changeType: "improving",
    detail: "AMD moved higher in the attention queue.",
    metricLabel: "Priority up",
    severity: "positive",
    symbol: "AMD",
    title: "Priority improved",
  }],
};

function contextFor(question: string) {
  const rows = [
    row({ symbol: "AMD" }),
    row({
      conviction: 63,
      eventLabel: "Event Risk Elevated",
      final_score: 70,
      fragility: 68,
      macroLabel: "Macro Mixed",
      raw: {
        final_score: 70,
        fragility_score: 68,
        liquidity_pressure: 62,
        macro_alignment_score: 54,
        symbol: "MU",
        volatility_pressure: 66,
      },
      symbol: "MU",
    }),
  ];
  const metaSystem = buildTradeVetoOperatingSystem({
    personalizationProfile: buildUserPersonalizationProfile({ profile: { preferredRewardLevel: "high", preferredRiskLevel: "medium" } }),
    rows,
    workflowEvolution: workflow,
  });
  return buildResearchCopilotContext({
    conversation: [{ content: "We were comparing semiconductor candidates.", role: "user" }],
    decisionMemory,
    marketMemoryBySymbol: new Map([["AMD", memory]]),
    metaSystem,
    personalizationProfile: buildUserPersonalizationProfile({ profile: { preferredRewardLevel: "high", preferredRiskLevel: "medium" } }),
    question,
    regimeSystem: buildRegimeShiftSystem({ rows, workflowEvolution: workflow }),
    rows,
    workflowEvolution: workflow,
  });
}

function contextForWithMode(question: string, mode: "concise" | "deep_dive") {
  const rows = [
    row({ symbol: "AMD" }),
    row({
      conviction: 63,
      eventLabel: "Event Risk Elevated",
      final_score: 70,
      fragility: 68,
      macroLabel: "Macro Mixed",
      raw: {
        final_score: 70,
        fragility_score: 68,
        liquidity_pressure: 62,
        macro_alignment_score: 54,
        symbol: "MU",
        volatility_pressure: 66,
      },
      symbol: "MU",
    }),
  ];
  const metaSystem = buildTradeVetoOperatingSystem({
    personalizationProfile: buildUserPersonalizationProfile({ profile: { preferredRewardLevel: "high", preferredRiskLevel: "medium" } }),
    rows,
    workflowEvolution: workflow,
  });
  return buildResearchCopilotContext({
    conversation: [{ content: "We were comparing semiconductor candidates.", role: "user" }],
    decisionMemory,
    marketMemoryBySymbol: new Map([["AMD", memory]]),
    metaSystem,
    mode,
    personalizationProfile: buildUserPersonalizationProfile({ profile: { preferredRewardLevel: "high", preferredRiskLevel: "medium" } }),
    question,
    regimeSystem: buildRegimeShiftSystem({ rows, workflowEvolution: workflow }),
    rows,
    workflowEvolution: workflow,
  });
}

test("research copilot infers comparison intent from symbol pair questions", () => {
  assert.equal(inferResearchIntent("Why is AMD ranked above MU today?", ["AMD", "MU"]), "comparison");
});

test("research copilot infers replay and shock intents", () => {
  assert.equal(inferResearchIntent("What did TradeVeto know before the move?", ["AMD"]), "replay");
  assert.equal(inferResearchIntent("Where is shock risk rising?", ["AMD"]), "shock");
  assert.equal(inferResearchIntent("Did the macro regime shift today?", []), "market_state");
});

test("research copilot infers portfolio, scenario, and event synthesis intents", () => {
  assert.equal(inferResearchIntent("What does my portfolio exposure look like?", []), "portfolio");
  assert.equal(inferResearchIntent("What if QQQ -3% hits AMD and MU?", ["AMD", "MU"]), "scenario");
  assert.equal(inferResearchIntent("What events are influencing AMD and MU?", ["AMD", "MU"]), "event_synthesis");
});

test("research copilot compares symbols without direct action language", () => {
  const answer = answerResearchCopilotDeterministically(contextFor("Why is AMD ranked above MU today?"));

  assert.equal(answer.intent, "comparison");
  assert.equal(answer.mode, "concise");
  assert.ok(answer.confidenceNote.length > 0);
  assert.ok(answer.followUpQuestions.length > 0);
  assert.ok(answer.symbolComparisons.length > 0);
  assert.deepEqual(answer.referencedSymbols, ["AMD", "MU"]);
  assert.doesNotMatch(JSON.stringify(answer), /buy now|sell now|guaranteed|sure profit/i);
});

test("research copilot supports DDOG vs CRWD comparison prompts", () => {
  const rows = [
    row({ final_score: 77, fragility: 48, raw: { final_score: 77, fragility_score: 48, symbol: "DDOG" }, symbol: "DDOG" }),
    row({ conviction: 65, final_score: 72, fragility: 61, raw: { final_score: 72, fragility_score: 61, symbol: "CRWD" }, symbol: "CRWD" }),
  ];
  const metaSystem = buildTradeVetoOperatingSystem({ rows, workflowEvolution: workflow });
  const context = buildResearchCopilotContext({
    metaSystem,
    question: "DDOG vs CRWD: which setup is cleaner?",
    regimeSystem: buildRegimeShiftSystem({ rows, workflowEvolution: workflow }),
    rows,
    workflowEvolution: workflow,
  });
  const answer = answerResearchCopilotDeterministically(context);

  assert.equal(answer.intent, "comparison");
  assert.deepEqual(answer.referencedSymbols, ["DDOG", "CRWD"]);
  assert.ok(answer.symbolComparisons.some((item) => /DDOG|CRWD/.test(item)));
});

test("research copilot answers what changed from workflow evolution", () => {
  const answer = answerResearchCopilotDeterministically(contextFor("What changed since yesterday?"));

  assert.equal(answer.intent, "what_changed");
  assert.ok(answer.keyPoints.some((point) => /AMD|MU|workflow/i.test(point)));
});

test("research copilot keeps concise answers short and deep-dive answers richer", () => {
  const concise = answerResearchCopilotDeterministically(contextForWithMode("What changed since yesterday?", "concise"));
  const deepDive = answerResearchCopilotDeterministically(contextForWithMode("What changed since yesterday?", "deep_dive"));

  assert.equal(concise.mode, "concise");
  assert.equal(deepDive.mode, "deep_dive");
  assert.ok(concise.keyPoints.length <= 3);
  assert.ok(deepDive.keyPoints.length >= concise.keyPoints.length);
});

test("research copilot carries symbol context into follow-up questions", () => {
  const rows = [row({ symbol: "AMD" }), row({ symbol: "MU", fragility: 72, final_score: 68 })];
  const metaSystem = buildTradeVetoOperatingSystem({ rows, workflowEvolution: workflow });
  const context = buildResearchCopilotContext({
    conversation: [{ content: "Why is AMD ranked above MU today?", role: "user" }],
    metaSystem,
    question: "What about fragility?",
    regimeSystem: buildRegimeShiftSystem({ rows, workflowEvolution: workflow }),
    rows,
    workflowEvolution: workflow,
  });
  const answer = answerResearchCopilotDeterministically(context);

  assert.equal(context.followUpContext?.includes("AMD"), true);
  assert.deepEqual(answer.referencedSymbols, ["AMD", "MU"]);
});

test("research copilot surfaces historical analog context when asked", () => {
  const answer = answerResearchCopilotDeterministically(contextFor("Which setups resemble historical AI momentum bursts?"));

  assert.equal(answer.intent, "historical_analogs");
  assert.ok(answer.keyPoints.some((point) => /Moderate evidence|historically/i.test(point)));
});

test("research copilot grounds portfolio reasoning with exposure citations", () => {
  const rows = [row({ symbol: "AMD" }), row({ fragility: 70, symbol: "MU" })];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows });
  const portfolioSystem = buildPortfolioIntelligenceSystem({
    accountValue: 100_000,
    opportunities: rows,
    positions: [
      paperPosition({ entry_price: 100, quantity: 400, symbol: "AMD" }),
      paperPosition({ entry_price: 80, quantity: 300, symbol: "MU" }),
    ],
    scenarioSystem,
  });
  const metaSystem = buildTradeVetoOperatingSystem({ rows, workflowEvolution: workflow });
  const context = buildResearchCopilotContext({
    decisionMemory,
    metaSystem,
    portfolioSystem,
    question: "What does my portfolio exposure look like?",
    regimeSystem: buildRegimeShiftSystem({ rows, workflowEvolution: workflow }),
    rows,
    scenarioSystem,
    workflowEvolution: workflow,
  });
  const answer = answerResearchCopilotDeterministically(context);

  assert.equal(answer.intent, "portfolio");
  assert.ok(answer.keyPoints.some((point) => /Quality|fragility|scenario/i.test(point)));
  assert.ok(answer.citations.some((citation) => citation.sourceType === "portfolio"));
  assert.doesNotMatch(JSON.stringify(answer), /buy now|sell now|guaranteed|sure profit/i);
});

test("research copilot explains scenario stress without turning it into prediction", () => {
  const rows = [row({ symbol: "AMD" }), row({ fragility: 70, symbol: "MU" })];
  const scenarioSystem = buildScenarioIntelligenceSystem({ rows });
  const metaSystem = buildTradeVetoOperatingSystem({ rows, workflowEvolution: workflow });
  const context = buildResearchCopilotContext({
    metaSystem,
    question: "What if QQQ -3% hits AMD and MU?",
    regimeSystem: buildRegimeShiftSystem({ rows, workflowEvolution: workflow }),
    rows,
    scenarioSystem,
    workflowEvolution: workflow,
  });
  const answer = answerResearchCopilotDeterministically(context);

  assert.equal(answer.intent, "scenario");
  assert.ok(answer.keyPoints.some((point) => /stress|vulnerable|resilient|QQQ/i.test(point)));
  assert.ok(answer.citations.some((citation) => citation.sourceType === "scenario"));
  assert.doesNotMatch(JSON.stringify(answer), /will fall|will rally|price target/i);
});

test("research copilot synthesizes event context from supplied verified packets only", () => {
  const answer = answerResearchCopilotDeterministically(contextFor("What events are influencing AMD and MU?"));

  assert.equal(answer.intent, "event_synthesis");
  assert.ok(answer.keyPoints.some((point) => /AMD|MU|Event/i.test(point)));
  assert.ok(answer.citations.some((citation) => citation.sourceType === "event" || citation.sourceType === "scanner"));
  assert.doesNotMatch(JSON.stringify(answer), /Reuters reported|Bloomberg reported|unconfirmed rumor/i);
});

function paperPosition(overrides: Partial<PaperPositionRow>): PaperPositionRow {
  return {
    close_reason: null,
    closed_at: null,
    current_price: overrides.current_price ?? overrides.entry_price ?? 100,
    entry_price: overrides.entry_price ?? 100,
    entry_status: overrides.entry_status ?? "watch",
    exit_price: null,
    final_decision: overrides.final_decision ?? "WATCH",
    id: overrides.id ?? `position-${overrides.symbol ?? "AMD"}`,
    opened_at: overrides.opened_at ?? "2026-05-08T20:00:00.000Z",
    quantity: overrides.quantity ?? 100,
    rating: overrides.rating ?? null,
    realized_pnl: null,
    recommendation_quality: overrides.recommendation_quality ?? "watch",
    return_pct: null,
    setup_type: overrides.setup_type ?? "MOMENTUM_CONTINUATION",
    status: overrides.status ?? "OPEN",
    stop_loss: overrides.stop_loss ?? null,
    symbol: overrides.symbol ?? "AMD",
    target_price: overrides.target_price ?? null,
    unrealized_pnl: overrides.unrealized_pnl ?? null,
  };
}
