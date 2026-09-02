import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { describe, test } from "node:test";

import { readEventLoopDelay, readProcessHealth } from "./event-loop-monitor";

describe("event loop monitor", () => {
  test("reports a finite, non-negative snapshot before anything has stalled", () => {
    const snapshot = readEventLoopDelay();
    for (const [field, value] of Object.entries(snapshot)) {
      assert.equal(typeof value, "number", `${field} must be a number`);
      assert.ok(Number.isFinite(value), `${field} must be finite, got ${value}`);
      assert.ok(value >= 0, `${field} must be non-negative, got ${value}`);
    }
  });

  test("process health carries memory alongside the delay histogram", () => {
    const health = readProcessHealth();
    assert.ok(health.rssMb > 0, "rss should be positive");
    assert.ok(health.heapUsedMb > 0, "heap should be positive");
    assert.ok(health.heapUsedMb <= health.rssMb, "heap cannot exceed rss");
    assert.equal(typeof health.eventLoopDelay.maxMs, "number");
  });

  test("a synchronous stall is visible in the histogram", async () => {
    // Let the histogram take at least one clean sample first.
    await delay(60);
    const before = readEventLoopDelay().maxMs;

    const blockUntil = Date.now() + 250;
    while (Date.now() < blockUntil) {
      // Deliberately block the loop: this is the condition the monitor exists
      // to catch, so the test asserts it is actually observable.
    }
    await delay(60);

    const after = readEventLoopDelay().maxMs;
    assert.ok(after >= before, "max delay must never decrease");
    assert.ok(after >= 100, `a 250ms stall should register at least 100ms, got ${after}`);
  });

  test("the window grows monotonically", async () => {
    const first = readEventLoopDelay().windowSeconds;
    await delay(1_100);
    const second = readEventLoopDelay().windowSeconds;
    assert.ok(second >= first, "window must not go backwards");
  });
});
