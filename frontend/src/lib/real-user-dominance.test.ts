import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildRealUserDominanceProof, type RealUserDominanceInput } from "./real-user-dominance";

function dominanceInput(overrides: Partial<RealUserDominanceInput> = {}): RealUserDominanceInput {
  const base: RealUserDominanceInput = {
    activeUsers: 120,
    adaptiveProofScore: 78,
    averageSessionDepth: 6.4,
    averageTimeToFirstUsefulActionSeconds: 42,
    dau: 38,
    failedActions: 1,
    featureAdoption: [
      { activeUsers: 54, adoptionRatePct: 45, events: 240, feature: "Scanner" },
      { activeUsers: 48, adoptionRatePct: 40, events: 180, feature: "Feed" },
      { activeUsers: 36, adoptionRatePct: 30, events: 120, feature: "Replay" },
      { activeUsers: 34, adoptionRatePct: 28, events: 100, feature: "Strategy" },
      { activeUsers: 50, adoptionRatePct: 42, events: 190, feature: "Watchlist" },
      { activeUsers: 22, adoptionRatePct: 18, events: 36, feature: "Notifications" },
      { activeUsers: 25, adoptionRatePct: 21, events: 54, feature: "Mobile" },
    ],
    feedEngagement: 180,
    firstUsefulActions: 58,
    mobileFrictionEvents: 2,
    mobileSharePct: 26,
    modalAbandons: 1,
    notificationEngagement: 12,
    notificationUsefulnessRatePct: 50,
    rageClicks: 1,
    retentionDay2EligibleUsers: 110,
    retentionDay2RatePct: 22,
    retentionDay7EligibleUsers: 96,
    retentionDay7RatePct: 12,
    replayUsage: 120,
    scannerUsage: 240,
    scrollAbandons: 1,
    strategyUsage: 100,
    stickySessionRatePct: 42,
    totalEvents: 1800,
    totalSessions: 260,
    watchlistRetentionRatePct: 36,
    watchlistUsage: 190,
    wau: 110,
    workflowContinuityEvents: 28,
  };
  return { ...base, ...overrides };
}

describe("real user dominance proof", () => {
  test("certifies dominance only when all proof gates pass", () => {
    const proof = buildRealUserDominanceProof(dominanceInput());

    assert.equal(proof.status, "proven");
    assert.equal(proof.blockers.length, 0);
    assert.equal(proof.proofScore, 100);
    assert.ok(proof.gates.every((gate) => gate.passed));
  });

  test("refuses to claim dominance when sample depth is insufficient", () => {
    const proof = buildRealUserDominanceProof(dominanceInput({
      activeUsers: 6,
      firstUsefulActions: 2,
      totalEvents: 80,
      totalSessions: 10,
      wau: 6,
    }));

    assert.equal(proof.status, "insufficient_data");
    assert.match(proof.summary, /not proven/i);
    assert.ok(proof.blockers.some((blocker) => blocker.includes("Real user sample depth")));
  });

  test("surfaces workflow, notification, retention, and friction blockers", () => {
    const proof = buildRealUserDominanceProof(dominanceInput({
      failedActions: 12,
      modalAbandons: 8,
      notificationEngagement: 0,
      notificationUsefulnessRatePct: null,
      rageClicks: 6,
      retentionDay2RatePct: 2,
      retentionDay7RatePct: 0,
      scrollAbandons: 7,
      stickySessionRatePct: 8,
      watchlistRetentionRatePct: 4,
      workflowContinuityEvents: 1,
    }));

    assert.equal(proof.status, "developing");
    assert.ok(proof.blockers.some((blocker) => blocker.includes("Workflow continuity")));
    assert.ok(proof.blockers.some((blocker) => blocker.includes("Watchlist retention")));
    assert.ok(proof.blockers.some((blocker) => blocker.includes("2-day and 7-day cohort retention")));
    assert.ok(proof.blockers.some((blocker) => blocker.includes("Notification usefulness")));
    assert.ok(proof.blockers.some((blocker) => blocker.includes("Friction control")));
  });
});
