import assert from "node:assert/strict";
import test from "node:test";
import type { DecisionMemorySummary } from "./decision-journal";
import { buildUserMemoryActivation } from "./user-memory-activation";
import { buildUserPersonalizationProfile } from "./personalized-intelligence";
import { DEFAULT_USER_MEMORY_SETTINGS } from "./user-memory-settings";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

const memory: DecisionMemorySummary = {
  available: true,
  behaviorFlags: ["Patient review bias"],
  chaseCount: 2,
  coachingNotes: ["Patient decisions are becoming useful evidence."],
  journalCount: 7,
  lastUpdated: "2026-05-09T12:00:00.000Z",
  outcomePendingCount: 1,
  patientDecisionCount: 4,
  preferredActions: [{ count: 3, label: "Wait" }],
  privacyNote: "Private to your account.",
  strengths: ["You document patient WAIT decisions."],
  symbol: null,
  symbolEntryCount: 0,
  topSetups: [{ count: 4, label: "Pullback" }],
  weaknesses: ["No repeated behavioral weakness is strong enough to label yet."],
};

const workflow: WorkflowEvolutionSummary = {
  dailyBrief: ["One watchlist symbol changed enough to revisit."],
  deterioratingSetups: [],
  improvingSetups: [],
  lastSeenAt: "2026-05-09T10:00:00.000Z",
  opportunityMaturity: [],
  snapshotRows: [],
  triggerMonitors: [{
    condition: "Research trigger proximity",
    distanceLabel: "1.2% from research zone",
    priority: "high",
    reason: "AMD is close to its current research entry context. Confirm trend quality and fragility before escalating.",
    symbol: "AMD",
  }],
  watchlistEvolution: [{
    changeType: "watchlist_momentum",
    detail: "AMD is on your watchlist and has become more relevant since the prior workflow snapshot.",
    metricLabel: "Watch +5.0",
    severity: "positive",
    symbol: "AMD",
    title: "Watchlist momentum improving",
  }],
  whatChanged: [],
};

test("user memory activation explains what is remembered and creates habit-loop insights", () => {
  const profile = buildUserPersonalizationProfile({
    profile: { personalityProfile: "pullback_specialist", preferredRewardLevel: "high", preferredRiskLevel: "medium" },
  });

  const model = buildUserMemoryActivation({
    memory,
    profile,
    settings: DEFAULT_USER_MEMORY_SETTINGS,
    watchlistSymbols: ["AMD", "NVDA"],
    workflowEvolution: workflow,
  });

  assert.ok(model.transparency.some((item) => item.title === "What is remembered"));
  assert.ok(model.insights.some((item) => item.title === "Strongest setup type"));
  assert.ok(model.watchlistRevisit.some((item) => item.symbol === "AMD"));
  assert.match(model.dailyBriefing.headline, /Pullback Specialist/);
  assert.doesNotMatch(JSON.stringify(model), /buy now|guaranteed|sure profit|creepy|addictive/i);
});

test("disabled memory settings pause personalization without deleting exportable entries", () => {
  const model = buildUserMemoryActivation({
    memory,
    profile: null,
    settings: {
      behavioralLearningEnabled: false,
      journalCoachingEnabled: false,
      updatedAt: "2026-05-09T12:30:00.000Z",
    },
    watchlistSymbols: ["TSM"],
    workflowEvolution: null,
  });

  assert.equal(model.dailyBriefing.dataState, "disabled");
  assert.ok(model.transparency.some((item) => item.detail.includes("Disabled")));
  assert.ok(model.insights.some((item) => item.title === "Journal coaching paused"));
  assert.ok(model.privacySummary.some((item) => item.includes("Behavioral learning is disabled")));
});
