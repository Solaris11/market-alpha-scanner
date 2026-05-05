import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
