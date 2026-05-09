import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionMemorySummary,
  buildPersonalizedDecisionCoaching,
  normalizeDecisionJournalAction,
  snapshotFromRow,
  type DecisionJournalEntry,
} from "./decision-journal";
import { buildUserPersonalizationProfile } from "./personalized-intelligence";
import type { RankingRow } from "../types";

function entry(overrides: Partial<DecisionJournalEntry> = {}): DecisionJournalEntry {
  return {
    concerns: null,
    convictionScore: 72,
    createdAt: "2026-05-08T20:00:00.000Z",
    deterministicSnapshot: { entry_distance_pct: 1.4, return_1d: 0.8 },
    emotionalContext: null,
    expectedCatalyst: null,
    finalDecision: "WAIT",
    followupReturn1d: null,
    followupReturn5d: null,
    followupReturn10d: null,
    fragilityScore: 48,
    id: "entry-1",
    invalidationReasoning: "Invalidation should stay explicit.",
    macroRegime: "Risk On",
    macroView: null,
    outcomeQuality: "pending",
    outcomeStatus: "pending",
    personalityProfile: "balanced",
    reason: "Waiting for cleaner entry quality.",
    riskRewardProfile: "medium risk / high reward",
    setupType: "PULLBACK",
    shockState: null,
    symbol: "AMD",
    thesis: null,
    updatedAt: "2026-05-08T20:00:00.000Z",
    userAction: "wait",
    ...overrides,
  };
}

test("normalizes journal actions to a bounded vocabulary", () => {
  assert.equal(normalizeDecisionJournalAction("Aggressive Entry"), "aggressive_entry");
  assert.equal(normalizeDecisionJournalAction("pullback-watch"), "pullback_watch");
  assert.equal(normalizeDecisionJournalAction("buy now"), "watch");
});

test("decision memory detects patient behavior and chase-risk entries", () => {
  const entries = [
    entry({ id: "1", userAction: "wait" }),
    entry({ id: "2", userAction: "avoid", symbol: "TSM" }),
    entry({ id: "3", userAction: "pullback_watch", symbol: "NVDA" }),
    entry({
      id: "4",
      deterministicSnapshot: { entry_distance_pct: 9, return_1d: 8 },
      fragilityScore: 82,
      userAction: "aggressive_entry",
    }),
    entry({
      id: "5",
      deterministicSnapshot: { entry_distance_pct: 7 },
      fragilityScore: 75,
      userAction: "shock_watch",
    }),
    entry({
      id: "6",
      deterministicSnapshot: { return_1d: 7 },
      fragilityScore: 78,
      userAction: "enter",
    }),
  ];

  const memory = buildDecisionMemorySummary(entries, { symbol: "AMD" });

  assert.equal(memory.journalCount, 6);
  assert.equal(memory.patientDecisionCount, 3);
  assert.equal(memory.chaseCount, 3);
  assert.equal(memory.symbolEntryCount, 4);
  assert.ok(memory.behaviorFlags.includes("Elevated chase tendency"));
  assert.ok(memory.weaknesses.some((item) => item.toLowerCase().includes("chase")));
});

test("personalized coaching stays respectful and keeps core risk context intact", () => {
  const profile = buildUserPersonalizationProfile({
    profile: {
      personalityProfile: "aggressive",
      preferredRewardLevel: "high",
      preferredRiskLevel: "high",
    },
  });
  const row: RankingRow = {
    symbol: "AMD",
    entry_distance_pct: 8,
    final_decision: "AVOID",
    fragility_score: 82,
    price: 125,
    return_1d: 9,
    setup_type: "BREAKOUT",
  };
  const entries = [
    entry({ id: "1", setupType: "BREAKOUT", userAction: "aggressive_entry" }),
    entry({ id: "2", setupType: "BREAKOUT", userAction: "wait" }),
  ];
  const memory = buildDecisionMemorySummary(entries, { symbol: "AMD" });
  const coaching = buildPersonalizedDecisionCoaching({ entries, memory, profile, row });

  assert.equal(coaching.fitLabel, "Needs caution");
  assert.match(coaching.warningReason, /core action|Decision memory/i);
  assert.doesNotMatch(`${coaching.strengthReason} ${coaching.warningReason}`, /buy now|guaranteed|sure profit/i);
});

test("snapshot captures bounded structured inputs for later coaching", () => {
  const row: RankingRow = {
    symbol: "DDOG",
    event_risk_score: 61,
    final_decision: "WAIT",
    final_score: 79,
    fragility_score: 63,
    price: 101,
    return_1d: 4.2,
    setup_type: "PULLBACK",
  };

  const snapshot = snapshotFromRow(row, null);

  assert.equal(snapshot["symbol"], "DDOG");
  assert.equal(snapshot["final_score"], 79);
  assert.equal(snapshot["fragility_score"], 63);
  assert.equal(snapshot["personality_profile"], null);
});
