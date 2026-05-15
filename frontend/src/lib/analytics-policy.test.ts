import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeAnalyticsEventName,
  pageOpenEventForPath,
  normalizeAnalyticsRange,
  normalizeFeedbackType,
  sanitizeAnalyticsMetadata,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsSymbol,
  sanitizeFeedbackMessage,
} from "./analytics-policy";

describe("analytics privacy policy", () => {
  test("allows only known analytics events", () => {
    assert.equal(normalizeAnalyticsEventName("page_view"), "page_view");
    assert.equal(normalizeAnalyticsEventName("dashboard_open"), "dashboard_open");
    assert.equal(normalizeAnalyticsEventName("strategy_labs_open"), "strategy_labs_open");
    assert.equal(normalizeAnalyticsEventName("first_useful_action"), "first_useful_action");
    assert.equal(normalizeAnalyticsEventName("modal_abandon"), "modal_abandon");
    assert.equal(normalizeAnalyticsEventName("copilot_question"), "copilot_question");
    assert.equal(normalizeAnalyticsEventName("rage_click"), "rage_click");
    assert.equal(normalizeAnalyticsEventName("failed_action"), "failed_action");
    assert.equal(normalizeAnalyticsEventName("experiment_exposed"), "experiment_exposed");
    assert.equal(normalizeAnalyticsEventName("made_up_event"), null);
  });

  test("maps dashboard route views to a dedicated analytics event", () => {
    assert.equal(pageOpenEventForPath("/dashboard"), "dashboard_open");
    assert.equal(pageOpenEventForPath("/dashboard/heatmaps"), "dashboard_open");
    assert.equal(pageOpenEventForPath("/strategy-labs"), "strategy_labs_open");
    assert.equal(pageOpenEventForPath("/paper"), "paper_trade_open");
  });

  test("normalizes beta feedback types for cohort learning", () => {
    assert.equal(normalizeFeedbackType("bug_report"), "bug_report");
    assert.equal(normalizeFeedbackType("onboarding_confusion"), "onboarding_confusion");
    assert.equal(normalizeFeedbackType("performance_issue"), "performance_issue");
    assert.equal(normalizeFeedbackType("private_note"), "general");
  });

  test("sanitizes metadata without keeping sensitive keys or secret-like values", () => {
    const metadata = sanitizeAnalyticsMetadata({
      Authorization: "Bearer FAKE",
      filter: "WAIT_PULLBACK",
      score: 82,
      stripe_secret: "sk_live_secret",
      token: "abc",
      url: "/history?symbol=TSM&token=secret",
    });
    assert.deepEqual(metadata, {
      filter: "WAIT_PULLBACK",
      score: 82,
      url: "[redacted]",
    });
  });

  test("keeps only safe URL parameters for analytics paths", () => {
    assert.equal(sanitizeAnalyticsPath("/history?symbol=TSM&token=secret&range=7d"), "/history?range=7d&symbol=TSM");
    assert.equal(sanitizeAnalyticsPath("https://tradeveto.com/history"), null);
  });

  test("normalizes symbols and time ranges deterministically", () => {
    assert.equal(sanitizeAnalyticsSymbol(" nvda<script> "), "NVDASCRIPT");
    assert.equal(normalizeAnalyticsRange("7d"), "7d");
    assert.equal(normalizeAnalyticsRange("24h"), "today");
    assert.equal(normalizeAnalyticsRange("all"), "30d");
  });

  test("redacts sensitive feedback content", () => {
    const message = sanitizeFeedbackMessage("Please help, my email is user@example.com and token=secret.");
    assert.equal(message, "Please help, my email is [email] and [redacted].");
  });
});
