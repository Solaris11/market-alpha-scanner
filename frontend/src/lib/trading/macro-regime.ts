import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type MacroRegimeState =
  | "Risk On"
  | "Risk Off"
  | "Mixed"
  | "Defensive"
  | "Overheated"
  | "Volatility Expansion"
  | "Volatility Compression"
  | "Liquidity Supportive"
  | "Liquidity Tightening";

export type MacroAlignmentState = "aligned" | "mixed" | "conflict";

export type MacroProxyCoverage = {
  missing: string[];
  used: string[];
};

export type MacroRegimeSummary = {
  liquidityPressure: number;
  macroPressureScore: number;
  macroRegime: MacroRegimeState;
  proxyCoverage: MacroProxyCoverage;
  regimeExplanation: string;
  riskOnScore: number;
  volatilityPressure: number;
};

export type MacroExchangeContext = MacroRegimeSummary & {
  alignmentState: MacroAlignmentState;
  exchangeContextLabel: string;
  exchangeHeadwind: string[];
  exchangeHealthScore: number;
  exchangeTailwind: string[];
  macroAlignmentScore: number;
  opposingForces: string[];
  sectorAlignmentScore: number;
  sectorPressure: string[];
  sectorTailwind: string[];
  supportingForces: string[];
  symbolProfile: string;
  themeContext: string;
};

export type MacroContextResolver = {
  forRow: (row: RankingRow) => MacroExchangeContext;
  summary: MacroRegimeSummary;
};

type ProxyMap = Map<string, RankingRow>;
type SectorStats = {
  averageScore: number;
  breadthScore: number;
  count: number;
  label: string;
};

const BROAD_PROXIES = ["SPY", "QQQ", "DIA", "IWM"];
const VOLATILITY_PROXIES = ["VIX", "^VIX", "VXX", "UVXY"];
const DOLLAR_PROXIES = ["DXY", "UUP"];
const RATE_PROXIES = ["TLT", "IEF", "TNX", "^TNX"];
const GOLD_PROXIES = ["GLD", "GDX"];
const OIL_PROXIES = ["USO", "OIL", "OXY", "XLE"];
const CRYPTO_PROXIES = ["BTC-USD", "BTC", "IBIT", "ETH-USD", "ETH"];
const SEMICONDUCTOR_SYMBOLS = new Set(["AMD", "ARM", "ASML", "AVGO", "INTC", "MU", "NVDA", "QCOM", "SMH", "SOXX", "TSM", "TXN"]);
const SOFTWARE_SYMBOLS = new Set(["ADBE", "CRM", "CRWD", "DDOG", "MSFT", "NOW", "ORCL", "PANW", "SNOW", "TEAM"]);
const FINANCIAL_SYMBOLS = new Set(["BAC", "C", "GS", "JPM", "MS", "WFC", "XLF"]);
const DEFENSIVE_SECTORS = new Set(["consumer defensive", "consumer staples", "healthcare", "utilities"]);

export function createMacroContextResolver(rows: RankingRow[]): MacroContextResolver {
  const proxyMap = buildProxyMap(rows);
  const sectorStats = buildSectorStats(rows);
  const summary = buildMacroRegimeSummary(proxyMap);
  return {
    summary,
    forRow: (row: RankingRow) => buildMacroExchangeContextFromResolver(row, { proxyMap, sectorStats, summary }),
  };
}

export function buildMacroExchangeContext(row: RankingRow, rows: RankingRow[] = []): MacroExchangeContext {
  return createMacroContextResolver(rows.length ? rows : [row]).forRow(row);
}

export function buildMacroRegimeSummary(rowsOrProxyMap: RankingRow[] | ProxyMap): MacroRegimeSummary {
  const proxyMap = Array.isArray(rowsOrProxyMap) ? buildProxyMap(rowsOrProxyMap) : rowsOrProxyMap;
  const spy = proxyScore(proxyMap, ["SPY"]);
  const qqq = proxyScore(proxyMap, ["QQQ"]);
  const dia = proxyScore(proxyMap, ["DIA"]);
  const iwm = proxyScore(proxyMap, ["IWM"]);
  const btc = proxyScore(proxyMap, CRYPTO_PROXIES);
  const broadRisk = weightedAverage([
    [spy.score, 0.32],
    [qqq.score, 0.30],
    [dia.score, 0.14],
    [iwm.score, 0.16],
    [btc.score, 0.08],
  ], 50);
  const volatilityPressure = inferVolatilityPressure(proxyMap, broadRisk);
  const liquidityPressure = inferLiquidityPressure(proxyMap, broadRisk);
  const gold = proxyScore(proxyMap, GOLD_PROXIES);
  const macroPressureScore = Math.round(clamp((100 - broadRisk) * 0.38 + volatilityPressure * 0.32 + liquidityPressure * 0.30));
  const macroRegime = classifyMacroRegime({
    goldScore: gold.score,
    liquidityPressure,
    macroPressureScore,
    riskOnScore: broadRisk,
    volatilityPressure,
  });
  return {
    liquidityPressure: Math.round(liquidityPressure),
    macroPressureScore,
    macroRegime,
    proxyCoverage: proxyCoverage(proxyMap),
    regimeExplanation: regimeExplanation({ liquidityPressure, macroPressureScore, macroRegime, riskOnScore: broadRisk, volatilityPressure }),
    riskOnScore: Math.round(broadRisk),
    volatilityPressure: Math.round(volatilityPressure),
  };
}

function buildMacroExchangeContextFromResolver(
  row: RankingRow,
  {
    proxyMap,
    sectorStats,
    summary,
  }: {
    proxyMap: ProxyMap;
    sectorStats: Map<string, SectorStats>;
    summary: MacroRegimeSummary;
  },
): MacroExchangeContext {
  const symbolProfile = symbolProfileFor(row);
  const exchange = exchangeScore(row, symbolProfile, proxyMap, summary);
  const sector = sectorScore(row, symbolProfile, sectorStats, proxyMap);
  const rowMacro = finiteNumber(row.macro_score);
  const macroPressureScore = Math.round(clamp(finiteNumber(row.macro_pressure_score) ?? summary.macroPressureScore));
  const volatilityPressure = Math.round(clamp(finiteNumber(row.volatility_pressure) ?? summary.volatilityPressure));
  const liquidityPressure = Math.round(clamp(finiteNumber(row.liquidity_pressure) ?? summary.liquidityPressure));
  const riskOnScore = Math.round(clamp(finiteNumber(row.risk_on_score) ?? summary.riskOnScore));
  const macroAlignmentScore = Math.round(clamp(finiteNumber(row.macro_alignment_score) ?? (exchange.score * 0.34 + sector.score * 0.28 + (100 - macroPressureScore) * 0.24 + (rowMacro ?? 55) * 0.14)));
  const exchangeHealthScore = Math.round(clamp(finiteNumber(row.exchange_health_score) ?? exchange.score));
  const sectorAlignmentScore = Math.round(clamp(finiteNumber(row.sector_alignment_score) ?? sector.score));
  const alignmentState: MacroAlignmentState = macroAlignmentScore >= 65 ? "aligned" : macroAlignmentScore < 45 ? "conflict" : "mixed";
  const exchangeTailwind = exchangeHealthScore >= 60 ? exchange.reasons : [];
  const exchangeHeadwind = exchangeHealthScore < 55 ? exchange.reasons : [];
  const sectorTailwind = sectorAlignmentScore >= 60 ? sector.reasons : [];
  const sectorPressure = sectorAlignmentScore < 55 ? sector.reasons : [];
  const rowAwareSummary = { ...summary, liquidityPressure, macroPressureScore, riskOnScore, volatilityPressure };
  const opposingForces = opposingForcesFor({ exchange: { ...exchange, score: exchangeHealthScore }, sector: { ...sector, score: sectorAlignmentScore }, summary: rowAwareSummary });
  const supportingForces = supportingForcesFor({ exchange: { ...exchange, score: exchangeHealthScore }, sector: { ...sector, score: sectorAlignmentScore }, summary: rowAwareSummary });
  const scannerSummary = textField(row, "macro_context_summary");

  return {
    ...rowAwareSummary,
    alignmentState,
    exchangeContextLabel: textField(row, "exchange_context_label") ?? contextLabel(exchangeHealthScore, `${exchange.label} Tailwind`, `${exchange.label} Mixed`, `${exchange.label} Headwind`),
    exchangeHeadwind,
    exchangeHealthScore,
    exchangeTailwind,
    macroAlignmentScore,
    opposingForces: scannerSummary && alignmentState === "conflict" ? [scannerSummary, ...opposingForces].slice(0, 4) : opposingForces,
    sectorAlignmentScore,
    sectorPressure,
    sectorTailwind,
    supportingForces: scannerSummary && alignmentState !== "conflict" ? [scannerSummary, ...supportingForces].slice(0, 4) : supportingForces,
    symbolProfile: humanizeLabel(symbolProfile),
    themeContext: textField(row, "sector_context_label") ?? sector.themeContext,
  };
}

function buildProxyMap(rows: RankingRow[]): ProxyMap {
  const proxyMap = new Map<string, RankingRow>();
  for (const row of rows) {
    const symbol = normalizeSymbol(row.symbol);
    if (!symbol) continue;
    proxyMap.set(symbol, row);
  }
  return proxyMap;
}

function buildSectorStats(rows: RankingRow[]): Map<string, SectorStats> {
  const groups = new Map<string, RankingRow[]>();
  for (const row of rows) {
    const sector = sectorKey(row);
    if (!sector) continue;
    const group = groups.get(sector) ?? [];
    group.push(row);
    groups.set(sector, group);
  }
  const stats = new Map<string, SectorStats>();
  for (const [sector, sectorRows] of groups) {
    const scores = sectorRows.map(signalScore).filter((score) => score !== null);
    const averageScore = scores.length ? average(scores, 50) : 50;
    const breadthScore = scores.length ? (scores.filter((score) => score >= 60).length / scores.length) * 100 : 50;
    stats.set(sector, {
      averageScore,
      breadthScore,
      count: sectorRows.length,
      label: humanizeLabel(sector),
    });
  }
  return stats;
}

function proxyScore(proxyMap: ProxyMap, symbols: string[]): { score: number; symbol: string | null } {
  for (const symbol of symbols) {
    const row = proxyMap.get(normalizeSymbol(symbol));
    if (row) return { score: rowContextScore(row), symbol: normalizeSymbol(row.symbol) };
  }
  return { score: 50, symbol: null };
}

function rowContextScore(row: RankingRow): number {
  const base = signalScore(row) ?? 50;
  const returnScore = returnPulseScore(row);
  return Math.round(clamp(base * 0.72 + returnScore * 0.28));
}

function signalScore(row: RankingRow): number | null {
  return finiteNumber(row.base_score ?? rawField(row, "final_score_base") ?? row.confidence_score ?? row.final_score ?? row.final_score_adjusted ?? row.quality_score);
}

function returnPulseScore(row: RankingRow): number {
  const oneDay = percentReturn(row.return_1d ?? row.price_change_pct ?? row.change_pct);
  if (oneDay === null) return 50;
  return clamp(50 + oneDay * 7.5);
}

function inferVolatilityPressure(proxyMap: ProxyMap, broadRisk: number): number {
  const volatility = proxyScore(proxyMap, VOLATILITY_PROXIES);
  if (volatility.symbol) {
    const row = proxyMap.get(volatility.symbol);
    const returnPressure = row ? returnPulseScore(row) : 50;
    return clamp(volatility.score * 0.64 + returnPressure * 0.36);
  }
  return clamp(52 + (50 - broadRisk) * 0.48);
}

function inferLiquidityPressure(proxyMap: ProxyMap, broadRisk: number): number {
  const dollar = proxyScore(proxyMap, DOLLAR_PROXIES);
  const rates = proxyScore(proxyMap, RATE_PROXIES);
  const iwm = proxyScore(proxyMap, ["IWM"]);
  const dollarPressure = dollar.symbol ? dollar.score : 50;
  const ratesPressure = rates.symbol ? 100 - rates.score : 50;
  const smallCapPressure = iwm.symbol ? 100 - iwm.score : 100 - broadRisk;
  return clamp(dollarPressure * 0.34 + ratesPressure * 0.28 + smallCapPressure * 0.24 + (100 - broadRisk) * 0.14);
}

function classifyMacroRegime({
  goldScore,
  liquidityPressure,
  macroPressureScore,
  riskOnScore,
  volatilityPressure,
}: {
  goldScore: number;
  liquidityPressure: number;
  macroPressureScore: number;
  riskOnScore: number;
  volatilityPressure: number;
}): MacroRegimeState {
  if (volatilityPressure >= 72) return "Volatility Expansion";
  if (liquidityPressure >= 72) return "Liquidity Tightening";
  if (riskOnScore >= 68 && volatilityPressure <= 50 && liquidityPressure <= 54) return "Risk On";
  if (riskOnScore >= 58 && liquidityPressure <= 38 && volatilityPressure <= 55) return "Liquidity Supportive";
  if (riskOnScore <= 38 || macroPressureScore >= 72) return "Risk Off";
  if (riskOnScore >= 66 && macroPressureScore >= 58) return "Overheated";
  if (volatilityPressure <= 35 && riskOnScore >= 50) return "Volatility Compression";
  if (goldScore >= riskOnScore + 12 && riskOnScore < 58) return "Defensive";
  return "Mixed";
}

function regimeExplanation({
  liquidityPressure,
  macroPressureScore,
  macroRegime,
  riskOnScore,
  volatilityPressure,
}: {
  liquidityPressure: number;
  macroPressureScore: number;
  macroRegime: MacroRegimeState;
  riskOnScore: number;
  volatilityPressure: number;
}): string {
  return `${macroRegime}: risk-on score ${Math.round(riskOnScore)}/100, macro pressure ${Math.round(macroPressureScore)}/100, volatility pressure ${Math.round(volatilityPressure)}/100, liquidity pressure ${Math.round(liquidityPressure)}/100.`;
}

function exchangeScore(row: RankingRow, profile: string, proxyMap: ProxyMap, summary: MacroRegimeSummary): { label: string; reasons: string[]; score: number } {
  const spy = proxyScore(proxyMap, ["SPY"]);
  const qqq = proxyScore(proxyMap, ["QQQ"]);
  const dia = proxyScore(proxyMap, ["DIA"]);
  const iwm = proxyScore(proxyMap, ["IWM"]);
  const crypto = proxyScore(proxyMap, CRYPTO_PROXIES);
  const oil = proxyScore(proxyMap, OIL_PROXIES);
  const gold = proxyScore(proxyMap, GOLD_PROXIES);
  if (profile === "crypto") {
    return {
      label: "Crypto / risk asset context",
      reasons: [proxyReason(crypto.symbol, "Crypto proxy"), `Risk appetite ${scoreWord(summary.riskOnScore)}`],
      score: weightedAverage([[crypto.score, 0.66], [summary.riskOnScore, 0.34]], 50),
    };
  }
  if (profile === "energy") {
    return {
      label: "Energy context",
      reasons: [proxyReason(oil.symbol, "Oil proxy"), proxyReason(spy.symbol, "Broad market proxy")],
      score: weightedAverage([[oil.score, 0.62], [spy.score, 0.24], [summary.riskOnScore, 0.14]], 50),
    };
  }
  if (profile === "gold") {
    const score = weightedAverage([[gold.score, 0.58], [100 - summary.liquidityPressure, 0.24], [100 - proxyScore(proxyMap, DOLLAR_PROXIES).score, 0.18]], 50);
    return {
      label: "Gold / defensive context",
      reasons: [proxyReason(gold.symbol, "Gold proxy"), "Dollar and liquidity backdrop affect this profile"],
      score,
    };
  }
  if (profile === "small_cap") {
    return {
      label: "Small-cap risk appetite",
      reasons: [proxyReason(iwm.symbol, "IWM proxy"), `Risk appetite ${scoreWord(summary.riskOnScore)}`],
      score: weightedAverage([[iwm.score, 0.56], [spy.score, 0.20], [summary.riskOnScore, 0.24]], 50),
    };
  }
  if (profile === "nasdaq") {
    return {
      label: "Nasdaq context",
      reasons: [proxyReason(qqq.symbol, "QQQ proxy"), proxyReason(spy.symbol, "SPY proxy")],
      score: weightedAverage([[qqq.score, 0.52], [spy.score, 0.22], [iwm.score, 0.10], [summary.riskOnScore, 0.16]], 50),
    };
  }
  return {
    label: "Broad exchange context",
    reasons: [proxyReason(spy.symbol, "SPY proxy"), proxyReason(dia.symbol, "DIA proxy"), proxyReason(iwm.symbol, "IWM proxy")],
    score: weightedAverage([[spy.score, 0.42], [dia.score, 0.22], [iwm.score, 0.16], [summary.riskOnScore, 0.20]], 50),
  };
}

function sectorScore(row: RankingRow, profile: string, sectorStats: Map<string, SectorStats>, proxyMap: ProxyMap): { reasons: string[]; score: number; themeContext: string } {
  const sector = sectorKey(row);
  const stats = sector ? sectorStats.get(sector) : undefined;
  const theme = themeScore(row, profile, proxyMap);
  const fallback = signalScore(row) ?? 50;
  const statsScore = stats ? stats.averageScore * 0.68 + stats.breadthScore * 0.32 : fallback;
  const score = clamp(statsScore * 0.62 + theme.score * 0.38);
  const sectorLabel = stats?.label ?? humanizeLabel(row.sector, "Symbol group");
  const breadth = stats ? `${stats.count} symbols in visible ${sectorLabel} context` : "Sector basket is limited in the current scan";
  return {
    reasons: [breadth, theme.reason],
    score,
    themeContext: `${sectorLabel}: ${contextText(score)}. ${theme.reason}`,
  };
}

function themeScore(row: RankingRow, profile: string, proxyMap: ProxyMap): { reason: string; score: number } {
  const symbol = normalizeSymbol(row.symbol);
  if (profile === "energy") {
    const oil = proxyScore(proxyMap, OIL_PROXIES);
    return { reason: `${proxyReason(oil.symbol, "Energy/oil proxy")} is ${contextText(oil.score).toLowerCase()}.`, score: oil.score };
  }
  if (profile === "gold") {
    const gold = proxyScore(proxyMap, GOLD_PROXIES);
    return { reason: `${proxyReason(gold.symbol, "Gold proxy")} is ${contextText(gold.score).toLowerCase()}.`, score: gold.score };
  }
  if (profile === "crypto") {
    const crypto = proxyScore(proxyMap, CRYPTO_PROXIES);
    return { reason: `${proxyReason(crypto.symbol, "Crypto proxy")} is ${contextText(crypto.score).toLowerCase()}.`, score: crypto.score };
  }
  if (SEMICONDUCTOR_SYMBOLS.has(symbol)) {
    const semis = proxyRows(proxyMap, Array.from(SEMICONDUCTOR_SYMBOLS));
    const score = semis.length ? average(semis.map(rowContextScore), 50) : signalScore(row) ?? 50;
    return { reason: `Semiconductor basket context is ${contextText(score).toLowerCase()}.`, score };
  }
  if (SOFTWARE_SYMBOLS.has(symbol)) {
    const software = proxyRows(proxyMap, Array.from(SOFTWARE_SYMBOLS));
    const score = software.length ? average(software.map(rowContextScore), 50) : signalScore(row) ?? 50;
    return { reason: `Software basket context is ${contextText(score).toLowerCase()}.`, score };
  }
  if (FINANCIAL_SYMBOLS.has(symbol)) {
    const financials = proxyRows(proxyMap, Array.from(FINANCIAL_SYMBOLS));
    const score = financials.length ? average(financials.map(rowContextScore), 50) : signalScore(row) ?? 50;
    return { reason: `Financial basket context is ${contextText(score).toLowerCase()}.`, score };
  }
  return { reason: "Theme context falls back to visible sector and symbol diagnostics.", score: signalScore(row) ?? 50 };
}

function proxyRows(proxyMap: ProxyMap, symbols: string[]): RankingRow[] {
  return symbols.map((symbol) => proxyMap.get(normalizeSymbol(symbol))).filter((row): row is RankingRow => Boolean(row));
}

function symbolProfileFor(row: RankingRow): string {
  const symbol = normalizeSymbol(row.symbol);
  const sector = sectorKey(row);
  const assetType = cleanText(row.asset_type, "").toLowerCase();
  if (assetType.includes("crypto") || CRYPTO_PROXIES.includes(symbol)) return "crypto";
  if (sector.includes("energy") || OIL_PROXIES.includes(symbol)) return "energy";
  if (sector.includes("gold") || sector.includes("metal") || GOLD_PROXIES.includes(symbol) || symbol.includes("GOLD")) return "gold";
  if (assetType.includes("small") || symbol === "IWM") return "small_cap";
  if (SEMICONDUCTOR_SYMBOLS.has(symbol) || SOFTWARE_SYMBOLS.has(symbol) || sector.includes("technology") || sector.includes("communication")) return "nasdaq";
  if (DEFENSIVE_SECTORS.has(sector)) return "defensive";
  return "broad";
}

function supportingForcesFor({ exchange, sector, summary }: { exchange: { label: string; score: number }; sector: { score: number; themeContext: string }; summary: MacroRegimeSummary }): string[] {
  const forces: string[] = [];
  if (summary.riskOnScore >= 60) forces.push("Risk appetite is supportive across available broad-market proxies.");
  if (summary.liquidityPressure <= 45) forces.push("Liquidity pressure is contained in the available proxy set.");
  if (summary.volatilityPressure <= 45) forces.push("Volatility pressure is contained in the available proxy set.");
  if (exchange.score >= 60) forces.push(`${exchange.label} is supportive.`);
  if (sector.score >= 60) forces.push(sector.themeContext);
  return forces.length ? forces.slice(0, 4) : ["No major macro tailwind is confirmed by the available proxy set."];
}

function opposingForcesFor({ exchange, sector, summary }: { exchange: { label: string; score: number }; sector: { score: number; themeContext: string }; summary: MacroRegimeSummary }): string[] {
  const forces: string[] = [];
  if (summary.riskOnScore < 45) forces.push("Risk appetite is not confirming the setup.");
  if (summary.liquidityPressure >= 60) forces.push("Liquidity pressure is elevated in the available proxy set.");
  if (summary.volatilityPressure >= 60) forces.push("Volatility pressure is elevated.");
  if (exchange.score < 45) forces.push(`${exchange.label} is a headwind.`);
  if (sector.score < 45) forces.push(sector.themeContext);
  return forces.length ? forces.slice(0, 4) : ["No major macro headwind is confirmed by the available proxy set."];
}

function proxyCoverage(proxyMap: ProxyMap): MacroProxyCoverage {
  const expected = [...BROAD_PROXIES, "VIX/VXX", "DXY/UUP", "TLT/IEF", "GLD", "USO", "BTC/IBIT"];
  const used: string[] = [];
  for (const symbol of BROAD_PROXIES) {
    if (proxyMap.has(symbol)) used.push(symbol);
  }
  if (firstPresent(proxyMap, VOLATILITY_PROXIES)) used.push(firstPresent(proxyMap, VOLATILITY_PROXIES)!);
  if (firstPresent(proxyMap, DOLLAR_PROXIES)) used.push(firstPresent(proxyMap, DOLLAR_PROXIES)!);
  if (firstPresent(proxyMap, RATE_PROXIES)) used.push(firstPresent(proxyMap, RATE_PROXIES)!);
  if (firstPresent(proxyMap, GOLD_PROXIES)) used.push(firstPresent(proxyMap, GOLD_PROXIES)!);
  if (firstPresent(proxyMap, OIL_PROXIES)) used.push(firstPresent(proxyMap, OIL_PROXIES)!);
  if (firstPresent(proxyMap, CRYPTO_PROXIES)) used.push(firstPresent(proxyMap, CRYPTO_PROXIES)!);
  const missing = expected.filter((symbol) => !used.includes(symbol) && !symbol.split("/").some((part) => used.includes(part)));
  return { missing, used: Array.from(new Set(used)) };
}

function firstPresent(proxyMap: ProxyMap, symbols: string[]): string | null {
  return symbols.map(normalizeSymbol).find((symbol) => proxyMap.has(symbol)) ?? null;
}

function contextLabel(score: number, tailwind: string, mixed: string, headwind: string): string {
  if (score >= 65) return tailwind;
  if (score < 45) return headwind;
  return mixed;
}

function contextText(score: number): string {
  if (score >= 65) return "supportive";
  if (score < 45) return "under pressure";
  return "mixed";
}

function scoreWord(score: number): string {
  if (score >= 65) return "supportive";
  if (score < 45) return "weak";
  return "mixed";
}

function proxyReason(symbol: string | null, fallback: string): string {
  return symbol ? `${symbol} proxy` : `${fallback} unavailable`;
}

function sectorKey(row: RankingRow): string {
  return cleanText(row.sector, "").trim().toLowerCase();
}

function normalizeSymbol(value: unknown): string {
  return cleanText(value, "").trim().toUpperCase();
}

function textField(row: RankingRow, key: string): string | null {
  const value = rawField(row, key);
  const text = cleanText(value, "").trim();
  return text ? text : null;
}

function rawField(row: RankingRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function percentReturn(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function average(values: number[], fallback: number): number {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (!numbers.length) return fallback;
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function weightedAverage(values: Array<[number | null | undefined, number]>, fallback: number): number {
  let numerator = 0;
  let denominator = 0;
  for (const [value, weight] of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    numerator += value * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function macroAlignmentLabel(context: MacroExchangeContext): string {
  if (context.alignmentState === "aligned") return "Macro Aligned";
  if (context.alignmentState === "conflict") return "Macro Conflict";
  return "Macro Mixed";
}

export function macroPressureLabel(value: number): string {
  if (value >= 65) return "Pressure Elevated";
  if (value < 45) return "Pressure Contained";
  return "Pressure Mixed";
}
