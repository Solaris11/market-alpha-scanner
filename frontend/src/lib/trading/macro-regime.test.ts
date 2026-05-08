import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RankingRow } from "@/lib/types";
import { buildMacroExchangeContext, buildMacroRegimeSummary, createMacroContextResolver, macroAlignmentLabel } from "./macro-regime";

function row(symbol: string, overrides: Partial<RankingRow> = {}): RankingRow {
  return {
    final_decision: "WATCH",
    final_score: 65,
    return_1d: 0.01,
    sector: "Technology",
    symbol,
    ...overrides,
  } as RankingRow;
}

const riskOnRows: RankingRow[] = [
  row("SPY", { final_score: 78, return_1d: 0.012 }),
  row("QQQ", { final_score: 84, return_1d: 0.018 }),
  row("DIA", { final_score: 70, return_1d: 0.006 }),
  row("IWM", { final_score: 72, return_1d: 0.014 }),
  row("VXX", { final_score: 24, return_1d: -0.04 }),
  row("UUP", { final_score: 38, return_1d: -0.003 }),
  row("TLT", { final_score: 62, return_1d: 0.004 }),
  row("GLD", { final_score: 45, sector: "Commodities" }),
  row("USO", { final_score: 52, sector: "Energy" }),
  row("BTC-USD", { asset_type: "crypto", final_score: 72, return_1d: 0.025, sector: "Crypto" }),
  row("NVDA", { final_score: 86, return_1d: 0.02, sector: "Technology" }),
  row("AMD", { final_score: 80, return_1d: 0.012, sector: "Technology" }),
  row("TSM", { final_score: 82, return_1d: 0.011, sector: "Technology" }),
];

describe("macro regime engine", () => {
  it("classifies a supportive broad tape as risk-on and aligns Nasdaq symbols", () => {
    const resolver = createMacroContextResolver(riskOnRows);
    const context = resolver.forRow(row("NVDA", { final_score: 86, sector: "Technology" }));

    assert.equal(resolver.summary.macroRegime, "Risk On");
    assert.ok(context.riskOnScore >= 65);
    assert.ok(context.macroAlignmentScore >= 65);
    assert.equal(macroAlignmentLabel(context), "Macro Aligned");
    assert.match(context.exchangeContextLabel, /Nasdaq/);
    assert.ok(context.supportingForces.some((force) => force.includes("Risk appetite") || force.includes("Nasdaq")));
  });

  it("detects volatility and liquidity pressure in a weak macro tape", () => {
    const weakRows: RankingRow[] = [
      row("SPY", { final_score: 30, return_1d: -0.028 }),
      row("QQQ", { final_score: 28, return_1d: -0.035 }),
      row("DIA", { final_score: 36, return_1d: -0.015 }),
      row("IWM", { final_score: 24, return_1d: -0.04 }),
      row("VXX", { final_score: 88, return_1d: 0.12 }),
      row("UUP", { final_score: 76, return_1d: 0.015 }),
      row("TLT", { final_score: 32, return_1d: -0.018 }),
      row("NVDA", { final_score: 72, sector: "Technology" }),
    ];
    const summary = buildMacroRegimeSummary(weakRows);
    const context = buildMacroExchangeContext(row("NVDA", { final_score: 72, sector: "Technology" }), weakRows);

    assert.equal(summary.macroRegime, "Volatility Expansion");
    assert.ok(summary.volatilityPressure >= 70);
    assert.ok(summary.liquidityPressure >= 60);
    assert.equal(context.alignmentState, "conflict");
    assert.ok(context.opposingForces.some((force) => force.toLowerCase().includes("volatility")));
  });

  it("maps crypto symbols to crypto and risk appetite proxies", () => {
    const context = buildMacroExchangeContext(row("IBIT", { asset_type: "crypto", sector: "Crypto" }), riskOnRows);

    assert.equal(context.symbolProfile, "Crypto");
    assert.match(context.exchangeContextLabel, /Crypto/);
    assert.ok(context.exchangeHealthScore >= 60);
  });

  it("falls back honestly when proxies are missing", () => {
    const context = buildMacroExchangeContext(row("ABC", { final_score: 60, sector: "Industrials" }), [row("ABC", { final_score: 60, sector: "Industrials" })]);

    assert.ok(context.proxyCoverage.missing.length > 0);
    assert.equal(context.macroRegime, "Mixed");
    assert.ok(context.regimeExplanation.includes("risk-on score"));
  });

  it("uses visible sector breadth for sector alignment", () => {
    const context = buildMacroExchangeContext(row("MSFT", { final_score: 84, sector: "Technology" }), riskOnRows);

    assert.ok(context.sectorAlignmentScore >= 60);
    assert.match(context.themeContext.toLowerCase(), /technology|software|sector/);
  });

  it("prefers scanner-provided bounded macro fields when available", () => {
    const context = buildMacroExchangeContext(
      row("NVDA", {
        base_score: 82,
        exchange_health_score: 41,
        final_score: 74,
        macro_alignment_score: 38,
        macro_context_summary: "Macro Conflict: macro/exchange context reduces decision quality by -8.00 points.",
        macro_pressure_score: 71,
        sector_alignment_score: 63,
        volatility_pressure: 76,
      }),
      riskOnRows,
    );

    assert.equal(context.alignmentState, "conflict");
    assert.equal(context.macroAlignmentScore, 38);
    assert.equal(context.exchangeHealthScore, 41);
    assert.ok(context.opposingForces.some((force) => force.includes("reduces decision quality")));
  });

  it("keeps copy probabilistic and non-advisory", () => {
    const context = buildMacroExchangeContext(row("NVDA", { final_score: 86, sector: "Technology" }), riskOnRows);
    const generated = [
      context.regimeExplanation,
      context.themeContext,
      ...context.supportingForces,
      ...context.opposingForces,
      ...context.exchangeHeadwind,
      ...context.exchangeTailwind,
    ].join(" ").toLowerCase();

    assert.doesNotMatch(generated, /guarantee|will happen|buy now|sell now|prediction/);
  });
});
