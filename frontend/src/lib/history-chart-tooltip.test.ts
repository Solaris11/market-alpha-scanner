import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatHistoryChartPrice, formatHistoryChartTimestamp, historyChartTooltipLines } from "./history-chart-tooltip";
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
    const row = { ...baseRow, confidence_score: undefined, final_decision: undefined };
    assert.deepEqual(historyChartTooltipLines(row, "price"), [
      { label: "Price", value: "$401.59" },
      { label: "Score", value: "80.32" },
      { label: "Decision", value: "Review" },
    ]);
  });
});
