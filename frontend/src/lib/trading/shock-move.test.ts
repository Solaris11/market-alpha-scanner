import assert from "node:assert/strict";
import test from "node:test";
import { buildShockMovePattern, type ShockMovePriceBar } from "./shock-move";

function barsWithShock(direction: "down" | "up"): ShockMovePriceBar[] {
  const bars: ShockMovePriceBar[] = [];
  let close = 100;
  for (let index = 0; index < 170; index += 1) {
    const date = new Date(Date.UTC(2025, 0, 1 + index)).toISOString();
    const drift = index % 9 === 0 ? 0.2 : 0.05;
    close += drift;
    if (index === 92) close *= direction === "up" ? 1.11 : 0.88;
    if (index === 126) close *= direction === "up" ? 1.08 : 0.91;
    bars.push({
      close,
      date,
      high: close * 1.012,
      low: close * 0.988,
      open: close * 0.995,
      volume: index === 92 || index === 126 ? 3_500_000 : 1_000_000 + index * 1000,
    });
  }
  return bars;
}

test("shock move engine detects upside shock memory and research zones", () => {
  const pattern = buildShockMovePattern({ bars: barsWithShock("up"), lookbackWindow: "1y", symbol: "AMD" });

  assert.ok(pattern);
  assert.equal(pattern.symbol, "AMD");
  assert.ok(pattern.upsideShockCount >= 2);
  assert.ok(pattern.upsideShockScore > 20);
  assert.ok(pattern.researchEntryZone.includes("$"));
  assert.ok(pattern.doNotChaseZone.includes("Above"));
  assert.ok(pattern.commonPreconditions.length > 0);
});

test("shock move engine distinguishes downside and two-sided volatility risk", () => {
  const pattern = buildShockMovePattern({ bars: barsWithShock("down"), lookbackWindow: "1y", symbol: "DDOG" });

  assert.ok(pattern);
  assert.ok(pattern.downsideShockCount >= 2);
  assert.ok(pattern.downsideRiskScore > 40);
  assert.ok(pattern.shockEvents.every((event) => event.return1d !== 0));
});
