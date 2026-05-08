import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterPriceHistoryRows, isPriceHistoryPeriod, priceHistoryBounds } from "./price-history-range";

describe("price history range helpers", () => {
  const rows = [
    { date: "2025-12-31T00:00:00.000Z", close: 90 },
    { date: "2026-01-02T00:00:00.000Z", close: 95 },
    { date: "2026-05-01T00:00:00.000Z", close: 105 },
    { date: "2026-05-08T00:00:00.000Z", close: 110 },
  ];

  it("validates supported periods", () => {
    assert.equal(isPriceHistoryPeriod("1y"), true);
    assert.equal(isPriceHistoryPeriod("max"), true);
    assert.equal(isPriceHistoryPeriod("2wk"), false);
  });

  it("filters rows by rolling period", () => {
    assert.deepEqual(
      filterPriceHistoryRows(rows, "1wk").map((row) => row.close),
      [105, 110],
    );
  });

  it("filters year-to-date from the latest row year", () => {
    assert.deepEqual(
      filterPriceHistoryRows(rows, "ytd").map((row) => row.close),
      [95, 105, 110],
    );
  });

  it("returns sorted max history and bounds", () => {
    const unsorted = [rows[3], rows[0], rows[2]];
    const filtered = filterPriceHistoryRows(unsorted, "max");
    assert.deepEqual(
      filtered.map((row) => row.close),
      [90, 105, 110],
    );
    assert.deepEqual(priceHistoryBounds(filtered), { startDate: "2025-12-31", endDate: "2026-05-08" });
  });
});
