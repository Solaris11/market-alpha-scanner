import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BETA_SUPPORT_MACROS,
  betaCapStatus,
  betaCohortInputFromAnalytics,
  buildBetaCohortDashboardModel,
  CONTROLLED_BETA_USER_CAP,
  type BetaCohortAnalyticsLike,
} from "./beta-cohort";

function fixtureAnalytics(overrides: Partial<BetaCohortAnalyticsLike> = {}): BetaCohortAnalyticsLike {
  return {
    betaCohort: {
      keyEvents: [
        { count: 6, eventName: "watchlist_add" },
        { count: 3, eventName: "replay_open" },
        { count: 2, eventName: "strategy_labs_open" },
        { count: 5, eventName: "first_useful_action" },
      ],
      supportTickets: { open: 1, opened: 2, urgent: 0 },
    },
    feedback: {
      recent: [],
      total: 4,
      typeCounts: [
        { count: 2, feedbackType: "confusing_signal" },
        { count: 1, feedbackType: "bug_report" },
      ],
    },
    journey: [{ count: 4, key: "terminal_symbol_watchlist" }],
    onboarding: { completedUsers: 9, completionRatePct: 75, eventCompletions: 9, totalUsers: 12 },
    retention: { averageSessionDepth: 4.5, dau: 5, repeatSessions: 4, totalSessions: 8, wau: 9 },
    supportUsage: { messages: 1, promptClicks: 2 },
    timeRange: "7d",
    topEvents: [{ count: 12, eventName: "page_view" }],
    ...overrides,
  };
}

describe("controlled beta cohort model", () => {
  test("enforces the 25-user cap policy", () => {
    assert.equal(CONTROLLED_BETA_USER_CAP, 25);
    assert.equal(betaCapStatus(5), "open");
    assert.equal(betaCapStatus(20), "near_cap");
    assert.equal(betaCapStatus(25), "full");
  });

  test("builds activation metrics from beta-specific analytics events", () => {
    const input = betaCohortInputFromAnalytics(fixtureAnalytics());
    assert.equal(input.totalUsers, 12);
    assert.equal(input.eventCounts.watchlist_add, 6);
    assert.equal(input.eventCounts.replay_open, 3);
    assert.equal(input.eventCounts.strategy_labs_open, 2);
    assert.equal(input.firstUsefulActionProxy, 6);
    assert.equal(input.feedback.confusing, 2);
    assert.equal(input.feedback.issue, 1);
  });

  test("returns a ready model when activation and support pressure are controlled", () => {
    const model = buildBetaCohortDashboardModel(betaCohortInputFromAnalytics(fixtureAnalytics()));
    assert.equal(model.cap.enrolledUsers, 12);
    assert.equal(model.cap.remainingSeats, 13);
    assert.equal(model.readiness.status, "ready");
    assert.ok(model.funnel.some((metric) => metric.label === "Watchlist creation" && metric.value === "6"));
  });

  test("holds invites when cohort is full or support pressure is elevated", () => {
    const model = buildBetaCohortDashboardModel(betaCohortInputFromAnalytics(fixtureAnalytics({
      betaCohort: {
        keyEvents: [],
        supportTickets: { open: 8, opened: 8, urgent: 2 },
      },
      onboarding: { completedUsers: 8, completionRatePct: 32, eventCompletions: 8, totalUsers: 30 },
    })));
    assert.equal(model.cap.enrolledUsers, 25);
    assert.equal(model.cap.status, "full");
    assert.equal(model.readiness.status, "blocked");
  });

  test("support macros stay non-advisory and beta-safe", () => {
    assert.ok(BETA_SUPPORT_MACROS.length >= 5);
    for (const macro of BETA_SUPPORT_MACROS) {
      assert.equal(/\b(buy now|sell now|guaranteed|sure profit)\b/i.test(macro.response), false, macro.id);
      assert.ok(macro.response.length > 40);
    }
  });
});
