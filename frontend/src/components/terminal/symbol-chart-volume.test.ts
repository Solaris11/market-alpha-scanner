import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChartCandle } from "./SymbolChart";
import { hasVolume, toVolumeData, volumeAverageLine } from "./symbol-chart-utils";

const c = (over: Partial<ChartCandle>): ChartCandle => ({ time: "2026-01-01", open: 10, high: 11, low: 9, close: 10, ...over });

test("hasVolume is true only when a real positive volume exists", () => {
  assert.equal(hasVolume([c({}), c({ volume: 0 })]), false);
  assert.equal(hasVolume([c({ volume: 1000 })]), true);
});

test("toVolumeData maps only candles with finite positive volume", () => {
  const data = toVolumeData([
    c({ time: "2026-01-01", volume: 100 }),
    c({ time: "2026-01-02" }),           // no volume -> skipped, never faked to 0
    c({ time: "2026-01-03", volume: 0 }),// zero -> skipped
    c({ time: "2026-01-04", volume: -5 }),// negative -> skipped
    c({ time: "2026-01-05", volume: 200 }),
  ]);
  assert.deepEqual(data.map((d) => d.value), [100, 200]);
  assert.deepEqual(data.map((d) => d.time), ["2026-01-01", "2026-01-05"]);
});

test("volume bar is colored by candle direction", () => {
  const up = toVolumeData([c({ open: 10, close: 12, volume: 100 })])[0]!;
  const down = toVolumeData([c({ open: 12, close: 10, volume: 100 })])[0]!;
  assert.match(up.color, /38,166,154/);   // green
  assert.match(down.color, /239,83,80/);  // red
});

test("volume points preserve candle order", () => {
  const data = toVolumeData([
    c({ time: "2026-01-01", volume: 1 }),
    c({ time: "2026-01-02", volume: 2 }),
    c({ time: "2026-01-03", volume: 3 }),
  ]);
  assert.deepEqual(data.map((d) => d.time), ["2026-01-01", "2026-01-02", "2026-01-03"]);
});

test("volumeAverageLine needs enough real bars, then is a rolling mean", () => {
  const few = Array.from({ length: 5 }, (_, i) => c({ time: `2026-01-0${i + 1}`, volume: 100 }));
  assert.deepEqual(volumeAverageLine(few, 20), []); // honest: not enough bars, no line

  const many = Array.from({ length: 25 }, (_, i) => c({ time: `d${i}`, volume: 100 }));
  const line = volumeAverageLine(many, 20);
  assert.equal(line.length, 6);            // 25 - 20 + 1
  assert.equal(line[0]!.value, 100);       // mean of twenty 100s
});

test("empty candles produce no volume data and no crash (perf-sensitive guard)", () => {
  assert.deepEqual(toVolumeData([]), []);
  assert.deepEqual(volumeAverageLine([]), []);
  assert.equal(hasVolume([]), false);
});
