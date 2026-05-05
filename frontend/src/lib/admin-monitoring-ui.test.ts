import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { aggregateStatusBuckets, hasNumericSeriesData, normalizeMonitoringRange, sanitizeMonitoringRouteLabel } from "./admin-monitoring-ui";

describe("admin monitoring UI helpers", () => {
  test("normalizes supported time ranges and defaults unknown input", () => {
    assert.equal(normalizeMonitoringRange("15m"), "15m");
    assert.equal(normalizeMonitoringRange("6h"), "6h");
    assert.equal(normalizeMonitoringRange("24h"), "24h");
    assert.equal(normalizeMonitoringRange("unexpected"), "1h");
    assert.equal(normalizeMonitoringRange(undefined), "1h");
  });

  test("detects empty chart series honestly", () => {
    assert.equal(hasNumericSeriesData([]), false);
    assert.equal(hasNumericSeriesData([{ value: null }, { value: Number.NaN }]), false);
    assert.equal(hasNumericSeriesData([{ value: null }, { value: 0 }]), true);
  });

  test("redacts sensitive route query values before drilldown display", () => {
    const route = "/api/support/chat?token=abc&next=/account&Authorization=bearer-secret&safe=yes";
    const label = sanitizeMonitoringRouteLabel(route);
    assert.equal(label, "/api/support/chat?token=[redacted]&next=/account&Authorization=[redacted]&safe=yes");
    assert.doesNotMatch(label, /abc|bearer-secret/);
  });

  test("aggregates status codes into safe display buckets", () => {
    assert.deepEqual(
      aggregateStatusBuckets([
        { statusCode: 200, count: 12 },
        { statusCode: 204, count: 3 },
        { statusCode: 302, count: 2 },
        { statusCode: 401, count: 4 },
        { statusCode: 500, count: 1 },
      ]),
      [
        { label: "2xx", count: 15 },
        { label: "3xx", count: 2 },
        { label: "4xx", count: 4 },
        { label: "5xx", count: 1 },
      ],
    );
  });
});
