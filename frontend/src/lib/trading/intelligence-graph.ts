import type { RankingRow } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";
import type { MacroExchangeContext } from "./macro-regime";
import type { MarketMemorySummary } from "./market-memory";
import type { ShockMovePattern } from "./shock-move";

export type IntelligenceGraphTone = "amber" | "cyan" | "emerald" | "rose" | "violet";
export type IntelligenceGraphCategory = "event" | "macro" | "market" | "proxy" | "replay" | "risk" | "sector" | "theme" | "volatility";
export type IntelligenceGraphStatus = "limited" | "mixed" | "pressure" | "supportive";

export type IntelligenceGraphRelationship = {
  available: boolean;
  category: IntelligenceGraphCategory;
  dataSource: string;
  evidence: string;
  id: string;
  label: string;
  source: string;
  status: IntelligenceGraphStatus;
  strength: number | null;
  summary: string;
  target: string;
  targetHref?: string;
  tone: IntelligenceGraphTone;
};

export type IntelligenceGraphModel = {
  focus: string;
  lastUpdated?: string | null;
  relationships: IntelligenceGraphRelationship[];
  summary: string;
  title: string;
  unavailable: string[];
};

export type ZoneGraphFactor = {
  detail?: string;
  label: string;
  tone?: IntelligenceGraphTone;
  value: number | null | undefined;
};

const MARKET_PROXIES = ["SPY", "QQQ", "DIA"] as const;

const SECTOR_PROXY_CANDIDATES: Array<{
  match: string[];
  proxies: string[];
  theme: string;
}> = [
  { match: ["semiconductor", "chip"], proxies: ["SOXX", "SMH", "QQQ"], theme: "Semiconductor cycle" },
  { match: ["technology", "software", "internet", "communication"], proxies: ["QQQ", "XLK"], theme: "Growth and technology appetite" },
  { match: ["financial"], proxies: ["XLF", "KRE", "TLT"], theme: "Rates and financial conditions" },
  { match: ["energy", "oil", "gas"], proxies: ["XLE", "USO"], theme: "Energy and oil pressure" },
  { match: ["healthcare", "health care", "biotech"], proxies: ["XLV", "IBB"], theme: "Healthcare defensive flow" },
  { match: ["consumer discretionary"], proxies: ["XLY", "QQQ"], theme: "Consumer risk appetite" },
  { match: ["consumer staples"], proxies: ["XLP", "SPY"], theme: "Defensive consumption" },
  { match: ["industrial"], proxies: ["XLI", "DIA"], theme: "Cyclicals and industrial breadth" },
  { match: ["materials"], proxies: ["XLB", "GLD"], theme: "Materials and commodity sensitivity" },
  { match: ["real estate"], proxies: ["XLRE", "TLT"], theme: "Rate-sensitive real estate" },
  { match: ["utility"], proxies: ["XLU", "TLT"], theme: "Defensive rates sensitivity" },
  { match: ["crypto", "bitcoin"], proxies: ["BTC", "IBIT", "QQQ"], theme: "Speculative risk appetite" },
];

export function buildSymbolIntelligenceGraph({
  contextRows = [],
  macroContext,
  marketMemory,
  row,
  shockPattern,
}: {
  contextRows?: RankingRow[];
  macroContext?: MacroExchangeContext | null;
  marketMemory?: MarketMemorySummary | null;
  row: RankingRow;
  shockPattern?: ShockMovePattern | null;
}): IntelligenceGraphModel {
  const symbol = cleanSymbol(row.symbol);
  const rowEntries: Array<[string, RankingRow]> = contextRows
    .map((item): [string, RankingRow] => [cleanSymbol(item.symbol), item])
    .filter(([key]) => Boolean(key));
  const rowMap = new Map<string, RankingRow>(rowEntries);
  if (symbol && !rowMap.has(symbol)) rowMap.set(symbol, row);

  const relationships: IntelligenceGraphRelationship[] = [];
  const unavailable: string[] = [];
  const lastUpdated = textValue(row.last_updated_utc ?? row.last_updated);

  const sector = textValue(row.sector);
  if (sector) {
    const sectorPeers = contextRows
      .filter((item) => sameText(item.sector, sector) && cleanSymbol(item.symbol) !== symbol)
      .slice(0, 8);
    const peerSymbols = sectorPeers.map((item) => cleanSymbol(item.symbol)).filter(Boolean);
    const peerScore = averageNumber(sectorPeers.map(scoreFromRow));
    relationships.push({
      available: true,
      category: "sector",
      dataSource: "Current scanner sector mapping and visible scanner rows",
      evidence: peerSymbols.length ? `${peerSymbols.length} visible same-sector symbols: ${peerSymbols.join(", ")}` : `Sector label is available: ${sector}`,
      id: relationshipId(symbol, "sector", sector),
      label: "Sector pressure",
      source: symbol,
      status: peerScore === null ? "limited" : statusForScore(peerScore),
      strength: peerScore,
      summary: peerScore === null ? `${symbol} is classified in ${sector}; no peer score average is available yet.` : `${sector} peer context averages ${Math.round(peerScore)}/100 across the visible scanner rows.`,
      target: sector,
      tone: peerScore === null ? "cyan" : toneForScore(peerScore),
    });
  } else {
    unavailable.push("Sector relationship is not available because the current row has no sector label.");
  }

  const proxyPlan = proxyCandidatesFor(row);
  proxyPlan.proxies.forEach((proxySymbol) => {
    const proxyRow = rowMap.get(proxySymbol);
    if (!proxyRow) {
      unavailable.push(`${proxySymbol} relationship not available in the current scanner snapshot.`);
      return;
    }
    const proxyScore = scoreFromRow(proxyRow);
    relationships.push({
      available: true,
      category: "proxy",
      dataSource: "Scanner row for related ETF/proxy symbol",
      evidence: `${proxySymbol} exists in the current scanner universe with ${scoreLabel(proxyScore)} context.`,
      id: relationshipId(symbol, "proxy", proxySymbol),
      label: proxyPlan.theme,
      source: symbol,
      status: proxyScore === null ? "limited" : statusForScore(proxyScore),
      strength: proxyScore,
      summary: `${proxySymbol} is used as a visible proxy relationship for ${proxyPlan.theme.toLowerCase()}.`,
      target: proxySymbol,
      targetHref: `/symbol/${encodeURIComponent(proxySymbol)}`,
      tone: proxyScore === null ? "cyan" : toneForScore(proxyScore),
    });
  });

  if (macroContext) {
    relationships.push({
      available: true,
      category: "macro",
      dataSource: "Macro exchange context resolver",
      evidence: macroContext.regimeExplanation || macroContext.exchangeContextLabel,
      id: relationshipId(symbol, "macro", macroContext.macroRegime),
      label: "Macro regime",
      source: symbol,
      status: statusForScore(macroContext.macroAlignmentScore),
      strength: macroContext.macroAlignmentScore,
      summary: `${macroContext.macroRegime}: ${macroContext.exchangeContextLabel}`,
      target: macroContext.macroRegime,
      tone: toneForScore(macroContext.macroAlignmentScore),
    });
    relationships.push({
      available: true,
      category: "market",
      dataSource: "Macro exchange context resolver",
      evidence: `Risk-on score ${Math.round(macroContext.riskOnScore)}/100 from current macro proxy context.`,
      id: relationshipId(symbol, "market", "risk-appetite"),
      label: "Risk appetite",
      source: symbol,
      status: statusForScore(macroContext.riskOnScore),
      strength: macroContext.riskOnScore,
      summary: macroContext.alignmentState === "aligned" ? "Risk appetite is supporting the setup context." : macroContext.alignmentState === "conflict" ? "Risk appetite is pushing against the setup context." : "Risk appetite is mixed.",
      target: "Risk appetite",
      tone: toneForScore(macroContext.riskOnScore),
    });
    relationships.push({
      available: true,
      category: "volatility",
      dataSource: "Macro exchange context resolver",
      evidence: `Volatility pressure ${Math.round(macroContext.volatilityPressure)}/100; liquidity pressure ${Math.round(macroContext.liquidityPressure)}/100.`,
      id: relationshipId(symbol, "volatility", "pressure"),
      label: "Volatility / liquidity",
      source: symbol,
      status: pressureStatusForScore(Math.max(macroContext.volatilityPressure, macroContext.liquidityPressure)),
      strength: Math.max(macroContext.volatilityPressure, macroContext.liquidityPressure),
      summary: "Higher pressure means the setup needs cleaner confirmation before users should trust the visual signal.",
      target: "Pressure conditions",
      tone: pressureToneForScore(Math.max(macroContext.volatilityPressure, macroContext.liquidityPressure)),
    });
    if (macroContext.proxyCoverage.used.length) {
      relationships.push({
        available: true,
        category: "market",
        dataSource: "Validated macro proxy coverage",
        evidence: `Used proxies: ${macroContext.proxyCoverage.used.join(", ")}`,
        id: relationshipId(symbol, "market", "proxy-coverage"),
        label: "Market proxy coverage",
        source: symbol,
        status: "supportive",
        strength: clampScore((macroContext.proxyCoverage.used.length / Math.max(1, macroContext.proxyCoverage.used.length + macroContext.proxyCoverage.missing.length)) * 100),
        summary: "These proxies were available to the macro resolver for current context.",
        target: macroContext.proxyCoverage.used.join(", "),
        tone: "cyan",
      });
    }
    macroContext.proxyCoverage.missing.slice(0, 4).forEach((missing) => {
      unavailable.push(`${missing} macro proxy is missing from the current macro coverage set.`);
    });
  } else {
    unavailable.push("Macro relationship is unavailable because macro exchange context was not built for this symbol.");
  }

  const eventScore = finiteNumber(row.event_risk_score ?? row.verified_event_pressure_score ?? row.event_shock_pressure_score);
  const eventLabel = textValue(row.event_context_label ?? row.verified_event_signature);
  const eventSummary = textValue(row.event_context_summary);
  if (eventLabel || eventScore !== null || row.event_context_available === true) {
    relationships.push({
      available: true,
      category: "event",
      dataSource: "Verified event context fields on the scanner row",
      evidence: eventSummary || `Event risk score ${scoreLabel(eventScore)}.`,
      id: relationshipId(symbol, "event", eventLabel || "event-pressure"),
      label: "Event pressure",
      source: symbol,
      status: eventScore === null ? "limited" : pressureStatusForScore(eventScore),
      strength: eventScore,
      summary: eventLabel ? `${eventLabel}${eventSummary ? `: ${eventSummary}` : ""}` : "Event context is marked available, but the label is limited.",
      target: eventLabel || "Verified event context",
      tone: eventScore === null ? "amber" : pressureToneForScore(eventScore),
    });
  }

  if (shockPattern) {
    relationships.push({
      available: true,
      category: "risk",
      dataSource: "Shock move pattern engine",
      evidence: `Similarity ${Math.round(shockPattern.currentSimilarityScore)}/100, chase risk ${Math.round(shockPattern.chaseRiskScore)}/100, reliability ${Math.round(shockPattern.reliabilityScore)}/100.`,
      id: relationshipId(symbol, "risk", "shock"),
      label: "Shock / chase risk",
      source: symbol,
      status: pressureStatusForScore(Math.max(shockPattern.chaseRiskScore, shockPattern.downsideRiskScore)),
      strength: Math.max(shockPattern.chaseRiskScore, shockPattern.downsideRiskScore),
      summary: `${shockPattern.opportunityState}. ${shockPattern.chaseRiskLabel}`,
      target: "Shock risk",
      tone: pressureToneForScore(Math.max(shockPattern.chaseRiskScore, shockPattern.downsideRiskScore)),
    });
  } else {
    unavailable.push("Shock relationship is not available because no validated shock pattern exists for this symbol.");
  }

  const topAnalog = marketMemory?.available ? marketMemory.analogs[0] : null;
  if (topAnalog) {
    const analogSymbol = cleanSymbol(topAnalog.symbol);
    relationships.push({
      available: true,
      category: "replay",
      dataSource: "Market memory historical analog engine",
      evidence: topAnalog.reasonCodes.length ? topAnalog.reasonCodes.join(", ") : marketMemory?.evidence.explanation ?? "Market memory analog available.",
      id: relationshipId(symbol, "replay", analogSymbol || topAnalog.signalTimestamp),
      label: "Replay / memory analog",
      source: symbol,
      status: statusForScore(topAnalog.similarityScore),
      strength: topAnalog.similarityScore,
      summary: `${analogSymbol || "Historical analog"} has ${Math.round(topAnalog.similarityScore)}/100 similarity to this setup.`,
      target: analogSymbol || "Historical analog",
      targetHref: analogSymbol ? `/symbol/${encodeURIComponent(analogSymbol)}` : undefined,
      tone: "violet",
    });
  } else {
    unavailable.push(marketMemory?.evidence.explanation || "Replay relationship is unavailable because no comparable market memory analog exists yet.");
  }

  const deduped = dedupeRelationships(relationships).slice(0, 9);
  const availableCount = deduped.length;
  return {
    focus: symbol,
    lastUpdated,
    relationships: deduped,
    summary: availableCount
      ? `${symbol} has ${availableCount} data-backed relationship${availableCount === 1 ? "" : "s"} across sector, macro, proxy, event, risk, or replay context.`
      : `${symbol} does not have enough validated relationship data yet.`,
    title: `${symbol} Intelligence Graph`,
    unavailable: Array.from(new Set(unavailable)).slice(0, 8),
  };
}

export function buildZoneIntelligenceGraph({
  dataSource,
  factors = [],
  focus,
  lastUpdated,
  relatedSymbols = [],
  summary,
  title,
}: {
  dataSource?: string;
  factors?: ZoneGraphFactor[];
  focus: string;
  lastUpdated?: string | null;
  relatedSymbols?: string[];
  summary: string;
  title: string;
}): IntelligenceGraphModel {
  const cleanFocus = title || focus;
  const relationships: IntelligenceGraphRelationship[] = [];
  const unavailable: string[] = [];

  factors
    .filter((factor) => typeof factor.value === "number" && Number.isFinite(factor.value))
    .slice(0, 6)
    .forEach((factor) => {
      const value = clampScore(factor.value ?? 0);
      relationships.push({
        available: true,
        category: categoryForFactor(factor.label),
        dataSource: dataSource || "Unified console scored factors",
        evidence: factor.detail || `${factor.label} scored ${Math.round(value)}/100 in this console snapshot.`,
        id: relationshipId(cleanFocus, "factor", factor.label),
        label: factor.label,
        source: cleanFocus,
        status: factorLooksLikePressure(factor.label) ? pressureStatusForScore(value) : statusForScore(value),
        strength: value,
        summary: factor.detail || `${factor.label} contributes to why this zone is shown.`,
        target: factor.label,
        tone: factor.tone ?? (factorLooksLikePressure(factor.label) ? pressureToneForScore(value) : toneForScore(value)),
      });
    });

  normalizedSymbols(relatedSymbols).slice(0, 8).forEach((symbol) => {
    relationships.push({
      available: true,
      category: "market",
      dataSource: dataSource || "Unified console related symbols",
      evidence: `${symbol} appears in this zone's related symbol set.`,
      id: relationshipId(cleanFocus, "symbol", symbol),
      label: "Related symbol",
      source: cleanFocus,
      status: "limited",
      strength: null,
      summary: `${symbol} is directly referenced by this intelligence zone.`,
      target: symbol,
      targetHref: `/symbol/${encodeURIComponent(symbol)}`,
      tone: "cyan",
    });
  });

  if (!relationships.length) unavailable.push("No scored factor or related-symbol relationship is available for this zone yet.");

  return {
    focus: cleanFocus,
    lastUpdated,
    relationships: dedupeRelationships(relationships).slice(0, 10),
    summary,
    title: `${title} Relationship Map`,
    unavailable,
  };
}

function proxyCandidatesFor(row: RankingRow): { proxies: string[]; theme: string } {
  const symbol = cleanSymbol(row.symbol);
  const assetType = `${row.asset_type ?? ""}`.toLowerCase();
  const sector = `${row.sector ?? ""}`.toLowerCase();
  if (["SPY", "QQQ", "DIA", "IWM", "TLT", "GLD", "USO", "UUP", "BTC", "IBIT"].includes(symbol)) {
    return { proxies: MARKET_PROXIES.filter((item) => item !== symbol), theme: "Broad market context" };
  }
  if (assetType.includes("crypto") || symbol === "BTC" || symbol.includes("BTC")) {
    return { proxies: ["BTC", "IBIT", "QQQ"], theme: "Crypto risk appetite" };
  }
  const matched = SECTOR_PROXY_CANDIDATES.find((candidate) => candidate.match.some((label) => sector.includes(label)));
  if (matched) return { proxies: Array.from(new Set([...matched.proxies, ...MARKET_PROXIES])), theme: matched.theme };
  return { proxies: [...MARKET_PROXIES], theme: "Broad market context" };
}

function scoreFromRow(row: RankingRow): number | null {
  return finiteNumber(row.macro_adjusted_score ?? row.final_score_adjusted ?? row.final_score ?? row.quality_score ?? row.macro_score);
}

function categoryForFactor(label: string): IntelligenceGraphCategory {
  const normalized = label.toLowerCase();
  if (normalized.includes("risk") || normalized.includes("fragility")) return "risk";
  if (normalized.includes("macro")) return "macro";
  if (normalized.includes("volatility") || normalized.includes("pressure")) return "volatility";
  if (normalized.includes("replay") || normalized.includes("asymmetry")) return "replay";
  if (normalized.includes("event")) return "event";
  if (normalized.includes("opportunity") || normalized.includes("decision")) return "market";
  return "theme";
}

function factorLooksLikePressure(label: string): boolean {
  const normalized = label.toLowerCase();
  return normalized.includes("risk") || normalized.includes("pressure") || normalized.includes("fragility") || normalized.includes("urgency");
}

function toneForScore(value: number): IntelligenceGraphTone {
  if (value >= 70) return "emerald";
  if (value >= 50) return "amber";
  if (value <= 35) return "rose";
  return "cyan";
}

function pressureToneForScore(value: number): IntelligenceGraphTone {
  if (value >= 70) return "rose";
  if (value >= 50) return "amber";
  if (value <= 35) return "emerald";
  return "cyan";
}

function statusForScore(value: number): IntelligenceGraphStatus {
  if (value >= 65) return "supportive";
  if (value <= 35) return "pressure";
  return "mixed";
}

function pressureStatusForScore(value: number): IntelligenceGraphStatus {
  if (value >= 65) return "pressure";
  if (value <= 35) return "supportive";
  return "mixed";
}

function averageNumber(values: Array<number | null>): number | null {
  const safe = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!safe.length) return null;
  return clampScore(safe.reduce((sum, value) => sum + value, 0) / safe.length);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function cleanSymbol(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function normalizedSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map(cleanSymbol).filter(Boolean)));
}

function textValue(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return null;
  return text;
}

function sameText(left: unknown, right: unknown): boolean {
  const cleanLeft = textValue(left)?.toLowerCase();
  const cleanRight = textValue(right)?.toLowerCase();
  return Boolean(cleanLeft && cleanRight && cleanLeft === cleanRight);
}

function scoreLabel(value: number | null): string {
  return value === null ? "limited" : `${Math.round(value)}/100`;
}

function relationshipId(source: string, category: string, target: string): string {
  return `${source}:${category}:${target}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, "-");
}

function dedupeRelationships(relationships: IntelligenceGraphRelationship[]): IntelligenceGraphRelationship[] {
  const seen = new Set<string>();
  const output: IntelligenceGraphRelationship[] = [];
  relationships.forEach((relationship) => {
    const key = `${relationship.category}:${relationship.target.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(relationship);
  });
  return output.sort((left, right) => {
    const leftStrength = left.strength ?? -1;
    const rightStrength = right.strength ?? -1;
    return rightStrength - leftStrength;
  });
}
