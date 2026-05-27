import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChartDecisionWorkstationModel,
  chartDecisionTextContainsUnsupportedClaim,
  type BuildChartDecisionWorkstationInput,
} from "@/components/terminal/chart-decision-workstation";
import type { ChartCandle, ChartSignalMarker } from "@/components/terminal/SymbolChart";

describe("chart decision workstation model", () => {
  it("exposes multi-panel chart capabilities and active synced cursor state", () => {
    const model = buildChartDecisionWorkstationModel(makeInput({ layoutMode: "grid" }));
    const syncedCursor = model.capabilities.find((capability) => capability.label === "Synced cursors");
    const symbolGroups = model.capabilities.find((capability) => capability.label === "Synced symbol groups");

    assert.equal(model.symbol, "AMD");
    assert.equal(syncedCursor?.status, "available");
    assert.match(syncedCursor?.detail ?? "", /synchronized/);
    assert.equal(symbolGroups?.status, "limited");
    assert.match(symbolGroups?.detail ?? "", /Multi-symbol/);
  });

  it("keeps volume-backed overlays limited when the chart payload has no source volume", () => {
    const model = buildChartDecisionWorkstationModel(makeInput({ candles: makeCandles(80) }));
    const anchoredVwap = overlay(model, "anchoredVwap");
    const volumeProfile = overlay(model, "volumeProfile");
    const sessionVolume = overlay(model, "sessionVolume");

    assert.equal(anchoredVwap.status, "limited");
    assert.match(anchoredVwap.reason ?? "", /OHLC-only/);
    assert.equal(volumeProfile.status, "limited");
    assert.equal(sessionVolume.status, "limited");
  });

  it("derives ATR bands, price liquidity zones, and strategy zones from real candle and level data", () => {
    const model = buildChartDecisionWorkstationModel(makeInput({
      candles: makeCandles(90),
      tradeLevels: { entryHigh: 122, entryLow: 118, stop: 112, target: 138 },
    }));

    assert.equal(overlay(model, "atrBands").status, "available");
    assert.equal(overlay(model, "liquidityZones").status, "available");
    assert.equal(overlay(model, "strategyZones").status, "available");
    assert.equal(model.strategyZones.find((zone) => zone.label === "Risk/reward box")?.status, "available");
    assert.match(model.strategyZones.find((zone) => zone.label === "Entry range")?.value ?? "", /\$118\.00/);
  });

  it("marks strategy visualization limited when source-backed levels are absent", () => {
    const model = buildChartDecisionWorkstationModel(makeInput({ tradeLevels: undefined }));

    assert.equal(overlay(model, "strategyZones").status, "limited");
    assert.equal(model.strategyZones.every((zone) => zone.status === "limited"), true);
    assert.match(model.decisionLayer.invalidates, /No source-backed stop/);
    assert.match(model.decisionLayer.confirms, /Confirmation is limited/);
  });

  it("activates replay playback only when replay or memory markers exist", () => {
    const limited = buildChartDecisionWorkstationModel(makeInput({ signals: [] }));
    const available = buildChartDecisionWorkstationModel(makeInput({
      signals: [
        { time: "2026-03-12", type: "REPLAY", text: "2024 analog" },
        { time: "2026-03-18", type: "MEMORY", source: "Market memory cluster" },
      ],
    }));

    assert.equal(limited.replay.status, "limited");
    assert.equal(overlay(limited, "replayPlayback").status, "limited");
    assert.equal(available.replay.status, "available");
    assert.equal(overlay(available, "replayPlayback").status, "available");
    assert.equal(available.replay.markers.length, 2);
  });

  it("keeps decision-layer copy bounded and non-predictive", () => {
    const model = buildChartDecisionWorkstationModel(makeInput({
      scannerScore: 82,
      signals: [{ time: "2026-03-20", type: "RISK", text: "Macro risk" }],
      tradeLevels: { entry: 121, stop: 114, target: 135 },
    }));
    const text = [
      model.decisionLayer.confirms,
      model.decisionLayer.confidenceChanged,
      model.decisionLayer.invalidates,
      model.decisionLayer.whyExists,
    ].join(" ");

    assert.equal(chartDecisionTextContainsUnsupportedClaim(text), false);
    assert.doesNotMatch(text.toLowerCase(), /guaranteed|must buy|should buy|risk-free/);
    assert.match(text, /Research context|Confirmation requires|descriptive/);
  });
});

function overlay(model: ReturnType<typeof buildChartDecisionWorkstationModel>, id: string) {
  const result = model.advancedOverlays.find((item) => item.id === id);
  assert.ok(result, `expected overlay ${id}`);
  return result;
}

function makeInput(overrides: Partial<BuildChartDecisionWorkstationInput>): BuildChartDecisionWorkstationInput {
  return {
    candles: makeCandles(80),
    enabledIndicators: ["ema20", "ema50", "atr14"],
    enabledOverlayFamilies: ["levels", "risk", "macro", "replay"],
    interpretation: "AMD has validated chart context for research review.",
    layoutMode: "split",
    period: "6mo",
    scannerScore: null,
    signals: makeSignals(),
    symbol: "AMD",
    tradeLevels: { entry: 120, stop: 112, target: 136 },
    ...overrides,
  };
}

function makeCandles(count: number): ChartCandle[] {
  return Array.from({ length: count }, (_item, index) => {
    const close = 100 + index * 0.32 + Math.sin(index / 3) * 1.8;
    const day = String((index % 28) + 1).padStart(2, "0");
    const month = String(1 + Math.floor(index / 28)).padStart(2, "0");
    return {
      close,
      high: close + 2.6,
      low: close - 2.2,
      open: close - 0.8,
      time: `2026-${month}-${day}`,
    };
  });
}

function makeSignals(): ChartSignalMarker[] {
  return [
    { time: "2026-02-12", type: "MACRO", text: "Rates context" },
    { time: "2026-02-20", type: "REPLAY", source: "Historical analog" },
    { time: "2026-03-01", type: "CONFIDENCE", text: "Score shift" },
  ];
}
