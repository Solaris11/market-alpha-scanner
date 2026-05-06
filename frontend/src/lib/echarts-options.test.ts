import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildDistributionBarOption,
  buildDonutOption,
  buildPremiumTimeSeriesOption,
  hasDistributionData,
  hasPremiumChartData,
} from "./echarts-options";

describe("premium ECharts option builders", () => {
  test("detects honest chart data before rendering dashboards", () => {
    assert.equal(hasPremiumChartData([]), false);
    assert.equal(hasPremiumChartData([{ color: "#fff", label: "Empty", values: [{ bucket: "a", value: null }] }]), false);
    assert.equal(hasPremiumChartData([{ color: "#fff", label: "Zero", values: [{ bucket: "a", value: 0 }] }]), true);
    assert.equal(hasDistributionData([{ label: "None", value: 0 }]), false);
    assert.equal(hasDistributionData([{ label: "Some", value: 2 }]), true);
  });

  test("builds institutional time-series options with legends and axis tooltips", () => {
    const option = buildPremiumTimeSeriesOption({
      series: [
        {
          color: "#67e8f9",
          label: "Requests",
          values: [
            { bucket: "2026-05-05T12:00:00.000Z", value: 4 },
            { bucket: "2026-05-05T12:05:00.000Z", value: 9 },
          ],
        },
        {
          color: "#fbbf24",
          label: "Errors",
          values: [
            { bucket: "2026-05-05T12:00:00.000Z", value: 0 },
            { bucket: "2026-05-05T12:05:00.000Z", value: 1 },
          ],
        },
      ],
    });

    const record = asRecord(option);
    const tooltip = asRecord(record.tooltip);
    const legend = asRecord(record.legend);
    const xAxis = asRecord(record.xAxis);
    const series = asArray(record.series);

    assert.equal(tooltip.trigger, "axis");
    assert.deepEqual(legend.data, ["Requests", "Errors"]);
    assert.deepEqual(xAxis.data, ["2026-05-05T12:00:00.000Z", "2026-05-05T12:05:00.000Z"]);
    assert.equal(series.length, 2);
    assert.equal(asRecord(series[0]).type, "line");
  });

  test("builds compact distribution and donut options for dashboard intelligence", () => {
    const rows = [
      { color: "#34d399", label: "High", value: 3 },
      { color: "#fbbf24", label: "Medium", value: 5 },
      { color: "#fb7185", label: "Low", value: 1 },
    ];
    const bar = asRecord(buildDistributionBarOption({ rows, title: "Confidence", vertical: true }));
    const donut = asRecord(buildDonutOption({ centerLabel: "9 rows", rows, title: "Decision Mix" }));

    assert.equal(asRecord(bar.tooltip).trigger, "axis");
    assert.equal(asRecord(donut.tooltip).trigger, "item");
    assert.equal(asRecord(asArray(bar.series)[0]).type, "bar");
    assert.equal(asRecord(asArray(donut.series)[0]).type, "pie");
  });
});

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  assert.equal(Array.isArray(value), true);
  return value as unknown[];
}
