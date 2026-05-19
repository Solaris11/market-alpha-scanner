import test from "node:test";
import assert from "node:assert/strict";
import { filterInteractivePricePoints, summarizePriceMove, type InteractivePricePoint } from "./interactive-chart-data";

function point(date: string, close: number): InteractivePricePoint {
  return {
    close,
    date,
    datetime: `${date}T00:00:00.000Z`,
    high: close + 1,
    low: close - 1,
    open: close,
    volume: null,
  };
}

test("filterInteractivePricePoints keeps only validated points inside the selected range", () => {
  const rows = [
    point("2026-01-01", 100),
    point("2026-05-01", 110),
    point("2026-05-08", 112),
    point("2026-05-12", 120),
  ];

  assert.deepEqual(filterInteractivePricePoints(rows, "1wk").map((row) => row.date), ["2026-05-08", "2026-05-12"]);
  assert.deepEqual(filterInteractivePricePoints(rows, "3mo").map((row) => row.date), ["2026-05-01", "2026-05-08", "2026-05-12"]);
  assert.deepEqual(filterInteractivePricePoints(rows, "6mo").map((row) => row.date), ["2026-01-01", "2026-05-01", "2026-05-08", "2026-05-12"]);
});

test("summarizePriceMove reports real visible close-price movement", () => {
  const summary = summarizePriceMove([point("2026-05-01", 100), point("2026-05-12", 112)]);

  assert.equal(summary.firstClose, 100);
  assert.equal(summary.lastClose, 112);
  assert.equal(summary.absoluteChange, 12);
  assert.equal(summary.changePct, 12);
  assert.equal(summary.tone, "up");
});

test("summarizePriceMove returns limited state without enough valid closes", () => {
  const summary = summarizePriceMove([{ ...point("2026-05-01", 100), close: null }]);

  assert.equal(summary.changePct, null);
  assert.equal(summary.tone, "flat");
});
