import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  classifyFailureMode,
  failureModeRetryDelayMs,
  lowBandwidthModeFromConnection,
  resilienceChecklist,
  sessionContinuityKey,
  shouldRetryFailure,
} from "./failure-mode";

describe("failure mode resilience governance", () => {
  test("stale evidence is downgraded and never presented as operational", () => {
    const decision = classifyFailureMode({ freshnessStatus: "stale", surface: "scanner" });

    assert.equal(decision.status, "stale");
    assert.equal(decision.severity, "warning");
    assert.equal(decision.confidenceMultiplier < 1, true);
    assert.match(decision.message, /not presented as live/i);
  });

  test("offline mode preserves context and remains retryable under governance", () => {
    const decision = classifyFailureMode({ attempt: 1, isOffline: true, surface: "chart" });

    assert.equal(decision.status, "offline");
    assert.equal(decision.preserveContext, true);
    assert.equal(decision.retry.canRetry, true);
    assert.equal(decision.retry.nextDelayMs, failureModeRetryDelayMs(1));
  });

  test("retry policy is bounded and blocks permanent failures", () => {
    assert.equal(failureModeRetryDelayMs(0), 750);
    assert.equal(failureModeRetryDelayMs(99), 30_000);
    assert.equal(shouldRetryFailure({ attempt: 4, errorMessage: "timeout", surface: "discovery" }), false);
    assert.equal(shouldRetryFailure({ attempt: 0, errorMessage: "provider not configured", surface: "feed" }), false);
    assert.equal(shouldRetryFailure({ attempt: 0, errorMessage: "network timeout", surface: "feed" }), true);
  });

  test("low bandwidth mode reduces charts, animation, and scanner density", () => {
    const saveData = lowBandwidthModeFromConnection({ saveData: true });
    const slowNetwork = lowBandwidthModeFromConnection({ downlink: 0.6, effectiveType: "3g" });

    assert.equal(saveData.enabled, true);
    assert.equal(saveData.chartMode, "lightweight");
    assert.equal(saveData.scannerMode, "compact");
    assert.equal(saveData.animationMode, "reduced");
    assert.equal(slowNetwork.enabled, true);
  });

  test("session continuity keys and checklist are stable", () => {
    assert.equal(sessionContinuityKey("scanner", "QA User"), "tradeveto:scanner:continuity:qa-user");
    assert.equal(sessionContinuityKey("scanner", "QA User"), sessionContinuityKey("scanner", "QA User"));
    assert.equal(resilienceChecklist().join(" ").toLowerCase().includes("infinite loaders"), true);
    assert.equal(resilienceChecklist().join(" ").toLowerCase().includes("stale intelligence"), true);
  });
});
