import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { formatHydrationSafeInteger, formatHydrationSafeUtcTime } from "./hydration-safe-formatters";

describe("hydration-safe formatters", () => {
  test("formats timestamps with UTC instead of runtime-local timezone", () => {
    const previousTz = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const utc = formatHydrationSafeUtcTime("2026-05-19T22:07:00.000Z");
      process.env.TZ = "America/Los_Angeles";
      const pacific = formatHydrationSafeUtcTime("2026-05-19T22:07:00.000Z");

      assert.equal(utc, "22:07 UTC");
      assert.equal(pacific, "22:07 UTC");
    } finally {
      process.env.TZ = previousTz;
    }
  });

  test("formats integers with explicit en-US grouping", () => {
    assert.equal(formatHydrationSafeInteger(1234567.9), "1,234,567");
    assert.equal(formatHydrationSafeInteger(null), "0");
    assert.equal(formatHydrationSafeInteger(Number.NaN), "0");
  });
});
