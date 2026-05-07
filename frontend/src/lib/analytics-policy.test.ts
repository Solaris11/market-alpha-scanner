import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  normalizeAnalyticsEventName,
  normalizeAnalyticsRange,
  sanitizeAnalyticsMetadata,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsSymbol,
  sanitizeFeedbackMessage,
} from "./analytics-policy";

describe("analytics privacy policy", () => {
  test("allows only known analytics events", () => {
    assert.equal(normalizeAnalyticsEventName("page_view"), "page_view");
    assert.equal(normalizeAnalyticsEventName("made_up_event"), null);
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
