import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterHistoryObservations,
  formatHistoryChartPrice,
  formatHistoryChartTimestamp,
  historyChartPoints,
  historyChartTooltipLines,
  nearestHistoryChartPoint,
  normalizeHistoryObservations,
  parseHistoryDateInput,
} from "./history-chart-tooltip";
import type { SymbolHistoryRow } from "./types";

const baseRow: SymbolHistoryRow = {
  confidence_score: 86,
  final_decision: "WATCH",
  final_score: 80.32,
  price: 401.59,
  source_file: "history.csv",
  symbol: "TSM",
  timestamp_utc: "2026-05-05T12:43:00Z",
};

describe("history chart tooltip helpers", () => {
  it("formats timestamps in compact UTC form", () => {
    assert.equal(formatHistoryChartTimestamp(Date.parse("2026-05-05T12:43:00Z")), "May 5, 2026 12:43 UTC");
  });

  it("formats prices without exposing raw unavailable values", () => {
    assert.equal(formatHistoryChartPrice(401.59), "$401.59");
    assert.equal(formatHistoryChartPrice(null), "N/A");
  });

  it("builds final score tooltip lines with optional fields", () => {
    assert.deepEqual(historyChartTooltipLines(baseRow, "final_score"), [
      { label: "Score", value: "80.32" },
      { label: "Decision", value: "Watch" },
      { label: "Confidence", value: "86" },
      { label: "Price", value: "$401.59" },
    ]);
  });

  it("builds price tooltip lines and tolerates missing confidence or decision", () => {
    assert.deepEqual(historyChartTooltipLines(baseRow, "price"), [
      { label: "Price", value: "$401.59" },
      { label: "Score", value: "80.32" },
      { label: "Decision", value: "Watch" },
      { label: "Confidence", value: "86" },
    ]);

    const row = { ...baseRow, confidence_score: undefined, final_decision: undefined };
    assert.deepEqual(historyChartTooltipLines(row, "price"), [
      { label: "Price", value: "$401.59" },
      { label: "Score", value: "80.32" },
      { label: "Decision", value: "Review" },
    ]);
  });

  it("binds chart points to the exact active observation", () => {
    const rows = [
      { ...baseRow, final_score: 60, price: 300, timestamp_utc: "2026-05-01T12:00:00Z" },
      { ...baseRow, final_score: 72.5, price: 350.25, timestamp_utc: "2026-05-03T12:00:00Z" },
      { ...baseRow, final_score: 88.75, price: 410.5, timestamp_utc: "2026-05-05T12:00:00Z" },
    ];
    const scorePoints = historyChartPoints(rows, "final_score");
    const pricePoints = historyChartPoints(rows, "price");

    assert.equal(nearestHistoryChartPoint(scorePoints, Date.parse("2026-05-03T13:00:00Z")), 1);
    assert.equal(scorePoints[1].row.final_score, 72.5);
    assert.equal(pricePoints[1].row.price, 350.25);
    assert.notEqual(scorePoints[0].row.final_score, scorePoints[2].row.final_score);
  });

  it("filters preset ranges relative to the latest observation timestamp", () => {
    const rows = [
      { ...baseRow, timestamp_utc: "2025-05-05T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2025-11-05T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-04-01T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-04-23T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-04-30T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-05-05T12:00:00Z" },
    ];

    assert.equal(filterHistoryObservations(rows, "7d").length, 2);
    assert.equal(filterHistoryObservations(rows, "14d").length, 3);
    assert.equal(filterHistoryObservations(rows, "1m").length, 3);
    assert.equal(filterHistoryObservations(rows, "6m").length, 5);
    assert.equal(filterHistoryObservations(rows, "1y").length, 6);
    assert.equal(filterHistoryObservations(rows, "all").length, 6);
  });

  it("lets custom date ranges override selected presets", () => {
    const rows = [
      { ...baseRow, timestamp_utc: "2026-04-20T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-04-25T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-05-05T12:00:00Z" },
    ];

    const filtered = filterHistoryObservations(rows, "7d", "2026-04-24T00:00", "2026-04-26T00:00");
    assert.deepEqual(filtered.map((row) => row.timestamp_utc), ["2026-04-25T12:00:00Z"]);
  });

  it("parses date and datetime-local filters in UTC instead of browser local time", () => {
    assert.equal(parseHistoryDateInput("2026-05-05"), Date.parse("2026-05-05T00:00:00.000Z"));
    assert.equal(parseHistoryDateInput("2026-05-05", true), Date.parse("2026-05-05T23:59:59.999Z"));
    assert.equal(parseHistoryDateInput("2026-05-05T12:43"), Date.parse("2026-05-05T12:43:00.000Z"));
  });

  it("updates filtered observation counts when preset and manual ranges change", () => {
    const rows = [
      { ...baseRow, timestamp_utc: "2026-04-01T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-04-20T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-04-25T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-05-01T12:00:00Z" },
      { ...baseRow, timestamp_utc: "2026-05-05T12:00:00Z" },
    ];

    assert.equal(filterHistoryObservations(rows, "7d").length, 2);
    assert.equal(filterHistoryObservations(rows, "14d").length, 3);
    assert.equal(filterHistoryObservations(rows, "1m").length, 4);
    assert.equal(filterHistoryObservations(rows, "7d", "2026-04-20T00:00", "2026-04-30T23:59").length, 2);
    assert.equal(filterHistoryObservations(rows, "7d", "", "").length, 2);
  });

  it("sorts observations ascending and dedupes duplicate timestamps", () => {
    const rows = [
      { ...baseRow, final_score: 70, timestamp_utc: "2026-05-05T12:00:00Z" },
      { ...baseRow, final_score: 50, timestamp_utc: "2026-05-01T12:00:00Z" },
      { ...baseRow, final_score: 75, timestamp_utc: "2026-05-05T12:00:00Z" },
    ];

    assert.deepEqual(
      normalizeHistoryObservations(rows).map((row) => [row.timestamp_utc, row.final_score]),
      [
        ["2026-05-01T12:00:00Z", 50],
        ["2026-05-05T12:00:00Z", 75],
      ],
    );
  });
});
