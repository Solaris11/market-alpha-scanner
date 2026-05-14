import assert from "node:assert/strict";
import test from "node:test";
import type { CsvRow } from "@/lib/types";
import { buildPublicStrategyPerformanceSystem } from "./public-strategy-performance";
import { buildSimulatedAiPortfolioSystem } from "./simulated-ai-portfolio";
import { buildStrategyIntelligenceSystem } from "./strategy-intelligence";

function forwardRows({
  count,
  drawdown,
  finalScore = 78,
  fragility = 42,
  macro = 72,
  returnPct,
  setup = "pullback_continuation",
  shock = 70,
  startDay = 1,
  symbol = "AMD",
}: {
  count: number;
  drawdown: number;
  finalScore?: number;
  fragility?: number;
  macro?: number;
  returnPct: number;
  setup?: string;
  shock?: number;
  startDay?: number;
  symbol?: string;
}): CsvRow[] {
  return Array.from({ length: count }, (_, index) => ({
    created_at: `2026-01-${String(((startDay + index - 1) % 28) + 1).padStart(2, "0")}T14:30:00.000Z`,
    final_score: finalScore,
    forward_return: returnPct / 100,
    fragility_score: fragility,
    horizon: "5D",
    liquidity_pressure: 38,
    macro_alignment_score: macro,
    market_regime: macro >= 66 ? "risk_on_expansion" : "mixed",
    max_drawdown_after_signal: drawdown / 100,
    price: 100 + index,
    return_pct: returnPct / 100,
    risk_reward: returnPct > 0 ? 2.5 : 1.2,
    sector: "Semiconductors",
    setup_type: setup,
    symbol: `${symbol}${index % 5}`,
    upside_shock_score: shock,
    verified_event_signature: returnPct > 0 ? "PRODUCT_CATALYST" : "EARNINGS_MISS",
    volatility_pressure: fragility > 75 ? 82 : 42,
  }));
}

test("public strategy performance strips open positions and keeps benchmark proof", () => {
  const forward = [
    ...forwardRows({ count: 42, drawdown: -2.2, returnPct: 2.4 }),
    ...forwardRows({ count: 34, drawdown: -7.5, finalScore: 84, fragility: 62, returnPct: -2.2, setup: "momentum_breakout", shock: 80, startDay: 7, symbol: "MU" }),
  ];
  const strategySystem = buildStrategyIntelligenceSystem({ forwardRows: forward });
  const portfolioSystem = buildSimulatedAiPortfolioSystem({ forwardRows: forward, strategySystem });
  const publicSystem = buildPublicStrategyPerformanceSystem({ portfolioSystem, strategySystem });
  const serialized = JSON.stringify(publicSystem);

  assert.equal(publicSystem.simulationOnly, true);
  assert.equal(publicSystem.status, "ready");
  assert.equal(publicSystem.modes.length, 3);
  assert.ok(publicSystem.modes.some((mode) => mode.closedTradeCount > 0));
  assert.ok(publicSystem.modes.every((mode) => mode.benchmarkDeltaPct === null || Number.isFinite(mode.benchmarkDeltaPct)));
  assert.ok(publicSystem.replayTrades.some((trade) => trade.outcomeLabel === "Worked"));
  assert.ok(publicSystem.replayTrades.some((trade) => trade.outcomeLabel === "Failed"));
  assert.equal(serialized.includes("openPositions"), false);
  assert.equal(serialized.includes("unrealizedPnl"), false);
  assert.doesNotMatch(serialized, /\b(buy now|sell now|guaranteed|sure profit|free money|must buy|must sell)\b/i);
});

test("public proof falls back honestly when evidence is unavailable", () => {
  const strategySystem = buildStrategyIntelligenceSystem({ forwardRows: [] });
  const portfolioSystem = buildSimulatedAiPortfolioSystem({ forwardRows: [], strategySystem });
  const publicSystem = buildPublicStrategyPerformanceSystem({ portfolioSystem, strategySystem });

  assert.equal(publicSystem.status, "limited");
  assert.match(publicSystem.summary, /waiting for more completed outcome history/i);
  assert.equal(publicSystem.replayTrades.length, 0);
  assert.ok(publicSystem.limitations.some((line) => /not real-money execution/i.test(line)));
});
