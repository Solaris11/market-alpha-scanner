import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChartIndicatorSeries, buildChartWorkflowSummary } from "@/components/terminal/chart-intelligence-overlays";
import { markerVisualPolicy } from "@/components/terminal/symbol-chart-marker-policy";
import { buildResearchContextLevels, type ResearchCandle, type ResearchContextLevel } from "@/lib/trading/research-levels";

describe("research chart context levels", () => {
  it("generates deduplicated support and resistance context levels", () => {
    const candles = makeCandles(60);
    const levels = buildResearchContextLevels(candles, { entry: 121, entryHigh: null, entryLow: null, stop: 111, target: 136 });
    assert.ok(levels.length <= 7);
    assert.ok(levels.some((level) => level.label === "Support"));
    assert.ok(levels.some((level) => level.label === "Resistance"));
    assert.ok(levels.some((level) => level.label === "Entry zone"));
    assertNoNearDuplicates(levels);
  });

  it("uses research-context labels without financial advice language", () => {
    const levels = buildResearchContextLevels(makeCandles(24), { entry: 104, entryHigh: null, entryLow: null, stop: 96, target: 114 });
    const text = levels.map((level) => level.label).join(" ").toLowerCase();
    assert.equal(text.includes("buy here"), false);
    assert.equal(text.includes("recommend"), false);
  });

  it("maps intelligence overlay markers to explicit chart marker styles", () => {
    assert.deepEqual(markerVisualPolicy("CONFIDENCE"), { color: "#22d3ee", fallbackText: "SCORE", position: "belowBar", shape: "circle" });
    assert.deepEqual(markerVisualPolicy("REPLAY"), { color: "#c084fc", fallbackText: "REPLAY", position: "belowBar", shape: "square" });
    assert.deepEqual(markerVisualPolicy("EVENT"), { color: "#f43f5e", fallbackText: "EVENT", position: "aboveBar", shape: "square" });
    assert.deepEqual(markerVisualPolicy("STALE"), { color: "#fbbf24", fallbackText: "STALE", position: "aboveBar", shape: "circle" });
    assert.deepEqual(markerVisualPolicy("BREAKOUT"), { color: "#22c55e", fallbackText: "BREAKOUT", position: "belowBar", shape: "arrowUp" });
    assert.deepEqual(markerVisualPolicy("FAILURE"), { color: "#ef4444", fallbackText: "FAILURE", position: "aboveBar", shape: "arrowDown" });
    assert.deepEqual(markerVisualPolicy("MEMORY"), { color: "#34d399", fallbackText: "MEMORY", position: "belowBar", shape: "square" });
    assert.deepEqual(markerVisualPolicy("VOLATILITY"), { color: "#f97316", fallbackText: "VOL", position: "aboveBar", shape: "circle" });
  });

  it("builds managed indicator series only from validated candle history", () => {
    const indicators = buildChartIndicatorSeries(makeCandles(80), ["ema20", "ema50", "rangePressure"]);
    assert.equal(indicators.length, 3);
    assert.ok(indicators.every((indicator) => indicator.points.length >= 2));
    assert.ok(indicators.every((indicator) => indicator.points.every((point) => Number.isFinite(point.value) && point.value > 0)));
    assert.equal(indicators.find((indicator) => indicator.id === "ema20")?.label, "EMA 20");
    assert.equal(indicators.find((indicator) => indicator.id === "rangePressure")?.tone, "rose");
  });

  it("separates overlay indicators from diagnostic-only indicators honestly", () => {
    const indicators = buildChartIndicatorSeries(makeCandles(90), ["sma20", "rsi14", "macd", "atr14", "volatility20", "supertrend", "anchoredVwap"]);
    const byId = new Map(indicators.map((indicator) => [indicator.id, indicator]));

    assert.equal(byId.get("sma20")?.renderMode, "overlay");
    assert.ok((byId.get("sma20")?.points.length ?? 0) >= 2);
    assert.equal(byId.get("supertrend")?.renderMode, "overlay");
    assert.ok((byId.get("supertrend")?.points.length ?? 0) >= 2);
    assert.equal(byId.get("rsi14")?.renderMode, "diagnostic");
    assert.match(byId.get("rsi14")?.valueLabel ?? "", /(elevated|neutral|weak)/);
    assert.equal(byId.get("atr14")?.renderMode, "diagnostic");
    assert.match(byId.get("atr14")?.valueLabel ?? "", /^\$/);
    assert.equal(byId.get("anchoredVwap")?.valueLabel, "Requires volume");
    assert.equal(byId.get("anchoredVwap")?.points.length, 0);
  });

  it("summarizes synchronized chart workflow state without unsupported claims", () => {
    const summary = buildChartWorkflowSummary({
      candleCount: 42,
      drawingCount: 2,
      enabledFamilies: ["replay", "macro", "risk"],
      enabledIndicators: ["ema20", "rangePressure"],
      markerCount: 5,
    });
    assert.equal(summary.activeFamilies, 3);
    assert.equal(summary.activeIndicators, 2);
    assert.equal(summary.drawingCount, 2);
    assert.match(summary.narrative, /5 synchronized intelligence markers/);
    assert.match(summary.narrative, /2 user drawings/);
  });
});

function makeCandles(count: number): ResearchCandle[] {
  return Array.from({ length: count }, (_item, index) => {
    const close = 100 + index * 0.6;
    const day = String(index + 1).padStart(2, "0");
    return {
      close,
      high: close + 2,
      low: close - 2,
      open: close - 0.5,
      time: `2026-03-${day.length > 2 ? "28" : day}`,
    };
  });
}

function assertNoNearDuplicates(levels: ResearchContextLevel[]) {
  for (let index = 0; index < levels.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < levels.length; otherIndex += 1) {
      const left = levels[index].price;
      const right = levels[otherIndex].price;
      const distance = Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1);
      assert.ok(distance >= 0.0035, `${left} and ${right} should not be near duplicates`);
    }
  }
}
