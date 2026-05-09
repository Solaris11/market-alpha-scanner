import { buildInstitutionalIntelligence } from "./institutional-intelligence";
import { buildTradeVetoOperatingSystem } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel, readableText } from "@/lib/ui/labels";

export const PUBLISHED_SYMBOLS = ["AMD", "NVDA", "MU", "DDOG", "AVGO", "ASML", "CRWD", "TSM", "OXY", "SPY", "QQQ", "GLD", "USO", "IBIT"] as const;

export type PublishedTone = "constructive" | "mixed" | "neutral" | "risk";

export type PublishedInsightCard = {
  detail: string;
  label: string;
  tone: PublishedTone;
  value: string;
};

export type PublishedInternalLink = {
  description: string;
  href: string;
  label: string;
};

export type PublishedSymbolIntelligence = {
  assetType: string;
  cards: PublishedInsightCard[];
  companyName: string;
  currentOpportunityState: string;
  decisionContext: string;
  description: string;
  eventContext: string;
  fragilityContext: string;
  generatedAt: string;
  internalLinks: PublishedInternalLink[];
  macroContext: string;
  narrativeSummary: string;
  relatedSymbols: string[];
  sector: string;
  shockContext: string;
  symbol: string;
  title: string;
  whatToWatch: string[];
  whyWaitSummary: string;
};

export type PublishedCollectionItem = {
  description: string;
  href: string;
  label: string;
  symbols: string[];
  tone: PublishedTone;
};

export type PublishedIntelligenceIndex = {
  collections: PublishedCollectionItem[];
  generatedAt: string;
  marketBriefing: string[];
  symbolPages: PublishedSymbolIntelligence[];
  universeCount: number;
};

export type PublishedMacroRegimePage = {
  generatedAt: string;
  marketState: string;
  metrics: PublishedInsightCard[];
  narrative: string[];
  sectorMap: PublishedCollectionItem[];
  title: string;
};

export type PublishedShockPage = {
  generatedAt: string;
  items: PublishedCollectionItem[];
  narrative: string[];
  title: string;
};

const FORBIDDEN_PUBLISHING_LANGUAGE = /\b(buy now|sell now|guaranteed|sure profit|can't lose|cannot lose|will definitely|must buy|must sell)\b/i;

export function buildPublishedSymbolIntelligence(rows: OpportunityViewModel[], symbol: string, generatedAt = new Date().toISOString()): PublishedSymbolIntelligence | null {
  const normalized = symbol.trim().toUpperCase();
  const row = rows.find((item) => item.symbol.toUpperCase() === normalized);
  if (!row) return isPublishedSymbol(normalized) ? unavailableSymbolIntelligence(normalized, generatedAt) : null;

  const institutional = buildInstitutionalIntelligence(row);
  const relatedSymbols = relatedSymbolsFor(row, rows);
  const decision = decisionLabel(row.final_decision);
  const setup = setupLabel(row);
  const macroContext = `${row.macroLabel}. ${pressurePhrase("volatility", row.raw.volatility_pressure, true)} ${pressurePhrase("liquidity", row.raw.liquidity_pressure, true)}`;
  const shockContext = row.shockPattern
    ? `${row.shockPattern.opportunityState}; ${row.shockPattern.chaseRiskLabel.toLowerCase()}; historical shock evidence is ${evidenceBand(row.shockPattern.reliabilityScore).toLowerCase()}.`
    : "Shock-pattern evidence is still building for this symbol.";
  const fragilityContext = `${row.fragilityLabel}. ${institutional.dangerAlerts.length ? institutional.dangerAlerts[0]?.explanation ?? "Danger pressure is elevated." : "No advanced danger alert dominates the public view."}`;
  const eventContext = row.eventLabel || "Verified event context is limited in the latest structured packet.";
  const narrativeSummary = row.narrative?.narrativeSummary ?? `${row.symbol} is tracked as a ${setup.toLowerCase()} research setup with ${decision.toLowerCase()} as the current core decision context.`;
  const whyWaitSummary = whyWaitSummaryFor(row, macroContext, fragilityContext);
  const whatToWatch = dedupe([
    ...(row.narrative?.whatToWatch ?? []),
    watchText("macro alignment", row.raw.macro_alignment_score, false),
    watchText("volatility pressure", row.raw.volatility_pressure, true),
    row.shockPattern ? `${row.shockPattern.chaseRiskLabel}; avoid interpreting shock potential as a core action signal.` : "Historical shock evidence remains limited.",
  ]).slice(0, 5);

  return {
    assetType: publicLabel(row.assetType, "Market instrument"),
    cards: [
      card("Decision Context", decision, row.decision_reason || `${decision} is the current structured decision label.`, toneFromDecision(decision)),
      card("Macro Context", row.macroLabel, macroContext, toneFromScore(row.raw.macro_alignment_score, false)),
      card("Fragility", row.fragilityLabel, fragilityContext, toneFromScore(row.fragility, true)),
      card("Shock Memory", row.shockPattern?.opportunityState ?? "Evidence Building", shockContext, toneFromScore(row.shockPattern?.opportunityScore, false)),
      card("Institutional Quality", institutional.institutionalQualityLabel, institutional.summary, toneFromScore(institutional.institutionalQualityScore, false)),
      card("Narrative Drift", row.narrative?.narrativeDrift.label ?? "Stable", row.narrative?.pressureStory ?? "Narrative context is inferred from current scanner fields.", toneFromScore(row.narrative?.narrativeDrift.momentumScore, false)),
    ],
    companyName: publicLabel(row.company_name, row.symbol),
    currentOpportunityState: institutional.compactLabels[0] ?? row.structuralLabel,
    decisionContext: safeText(`${decision} reflects ${setup.toLowerCase()} structure, ${row.macroLabel.toLowerCase()} context, and ${row.fragilityLabel.toLowerCase()} risk framing.`),
    description: safeText(`${row.symbol} AI market intelligence: ${decision.toLowerCase()} context, ${row.macroLabel.toLowerCase()}, ${row.fragilityLabel.toLowerCase()}, and public-safe shock/narrative evidence. Research only, not financial advice.`),
    eventContext: safeText(eventContext),
    fragilityContext: safeText(fragilityContext),
    generatedAt,
    internalLinks: internalLinksFor(row.symbol, relatedSymbols),
    macroContext: safeText(macroContext),
    narrativeSummary: safeText(narrativeSummary),
    relatedSymbols,
    sector: publicLabel(row.sector, "Unclassified"),
    shockContext: safeText(shockContext),
    symbol: row.symbol,
    title: `${row.symbol} AI Market Intelligence`,
    whatToWatch: whatToWatch.map(safeText),
    whyWaitSummary: safeText(whyWaitSummary),
  };
}

export function buildPublishedIntelligenceIndex(rows: OpportunityViewModel[], generatedAt = new Date().toISOString()): PublishedIntelligenceIndex {
  const meta = buildTradeVetoOperatingSystem({ rows });
  const symbolPages = rows
    .slice()
    .sort((left, right) => publishingPriority(right) - publishingPriority(left))
    .slice(0, 12)
    .map((row) => buildPublishedSymbolIntelligence(rows, row.symbol, generatedAt))
    .filter((item): item is PublishedSymbolIntelligence => item !== null);
  const fallbackSymbolPages = symbolPages.length
    ? symbolPages
    : PUBLISHED_SYMBOLS.slice(0, 6).map((symbol) => unavailableSymbolIntelligence(symbol, generatedAt));
  return {
    collections: [
      collection("Why WAIT Intelligence", "/intelligence/why-wait/AMD", "Explainable WAIT-state research for symbols where restraint, fragility, or macro conflict matters.", symbolPages.slice(0, 5).map((item) => item.symbol), "mixed"),
      collection("Shock Opportunity Research", "/intelligence/shock-opportunities", "Public-safe view of high-volatility and two-sided shock memory without trade-plan levels.", topShockSymbols(rows), "risk"),
      collection("Macro Regime Intelligence", "/intelligence/macro-regime", "Current broad market state, volatility pressure, liquidity pressure, and sector leadership context.", topMacroSymbols(rows), "neutral"),
    ],
    generatedAt,
    marketBriefing: meta.executiveBriefing.slice(0, 5).map(safeText),
    symbolPages: fallbackSymbolPages,
    universeCount: rows.length,
  };
}

export function buildPublishedShockPage(rows: OpportunityViewModel[], generatedAt = new Date().toISOString()): PublishedShockPage {
  const items = rows
    .filter((row) => row.shockPattern)
    .sort((left, right) => shockPriority(right) - shockPriority(left))
    .slice(0, 12)
    .map((row) => {
      const shock = row.shockPattern;
      return collection(
        `${row.symbol} ${shock?.opportunityState ?? "Shock Memory"}`,
        `/symbol/${row.symbol}`,
        safeText(`${row.symbol} shows ${shock?.opportunityState.toLowerCase() ?? "developing shock memory"} with ${shock?.chaseRiskLabel.toLowerCase() ?? "bounded chase-risk context"}. This is high-volatility research, not a core action signal.`),
        relatedSymbolsFor(row, rows).slice(0, 4),
        toneFromScore(shock?.downsideRiskScore ?? row.fragility, true),
      );
    });
  return {
    generatedAt,
    items,
    narrative: [
      "Shock intelligence is a volatility research layer. It highlights historical large-move behavior without turning that behavior into a direct trade instruction.",
      "The statistical engine owns shock counts, follow-through, chase-risk, and similarity metrics; public pages only summarize bounded labels and research context.",
      "If verified event context is unavailable, TradeVeto states that plainly instead of inventing a catalyst.",
    ],
    title: "High Volatility and Shock Opportunity Intelligence",
  };
}

export function buildPublishedMacroRegimePage(rows: OpportunityViewModel[], generatedAt = new Date().toISOString()): PublishedMacroRegimePage {
  const regime = buildRegimeShiftSystem({ rows });
  const sectors = sectorGroups(rows).slice(0, 10).map((group) => collection(
    `${group.label} Pressure`,
    `/intelligence?sector=${encodeURIComponent(group.label)}`,
    safeText(`${group.label} currently reads ${scoreBand(group.score, false).toLowerCase()} with ${group.rows.length} tracked symbols. Fragility pressure is ${scoreBand(group.fragility, true).toLowerCase()}.`),
    group.rows.slice(0, 5).map((row) => row.symbol),
    toneFromScore(group.score, false),
  ));
  return {
    generatedAt,
    marketState: regime.currentMarketState,
    metrics: [
      card("Breadth Health", scoreBand(regime.breadthHealthScore, false), "Participation breadth across the current scanner universe.", toneFromScore(regime.breadthHealthScore, false)),
      card("Exchange Health", scoreBand(regime.exchangeHealthScore, false), "Broad exchange and index-proxy support for current setups.", toneFromScore(regime.exchangeHealthScore, false)),
      card("Volatility Pressure", scoreBand(regime.volatilityPressure, true), "Higher volatility pressure increases two-sided risk and weakens clean continuation.", toneFromScore(regime.volatilityPressure, true)),
      card("Liquidity Pressure", scoreBand(regime.liquidityPressure, true), "Elevated liquidity pressure can reduce follow-through quality.", toneFromScore(regime.liquidityPressure, true)),
    ],
    narrative: [
      safeText(regime.terminalSummary),
      safeText(regime.stateExplanation),
      "Macro regime pages describe observed market structure. They do not forecast Fed decisions, inflation prints, or exact price outcomes.",
    ],
    sectorMap: sectors,
    title: "Current Macro Regime and Market Pressure Intelligence",
  };
}

export function buildWhyWaitIntelligence(rows: OpportunityViewModel[], symbol: string, generatedAt = new Date().toISOString()): PublishedSymbolIntelligence | null {
  return buildPublishedSymbolIntelligence(rows, symbol, generatedAt);
}

export function publishingJsonLdForSymbol(item: PublishedSymbolIntelligence): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    about: item.symbol,
    dateModified: item.generatedAt,
    description: item.description,
    headline: item.title,
    isAccessibleForFree: true,
    mainEntityOfPage: `https://tradeveto.com/symbol/${item.symbol}`,
    publisher: {
      "@type": "Organization",
      name: "TradeVeto",
      url: "https://tradeveto.com",
    },
  };
}

export function publishingItemListJsonLd(title: string, items: PublishedCollectionItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: {
        "@type": "WebPage",
        name: item.label,
        url: `https://tradeveto.com${item.href}`,
      },
      position: index + 1,
    })),
    name: title,
  };
}

function card(label: string, value: string, detail: string, tone: PublishedTone): PublishedInsightCard {
  return { detail: safeText(detail), label, tone, value: safeText(value) };
}

function collection(label: string, href: string, description: string, symbols: string[], tone: PublishedTone): PublishedCollectionItem {
  return { description: safeText(description), href, label: safeText(label), symbols: symbols.map((symbol) => symbol.toUpperCase()).slice(0, 8), tone };
}

function internalLinksFor(symbol: string, related: string[]): PublishedInternalLink[] {
  return [
    { description: "Symbol-level public intelligence overview.", href: `/symbol/${symbol}`, label: `${symbol} intelligence` },
    { description: "Why the system may prefer patience or confirmation.", href: `/intelligence/why-wait/${symbol}`, label: `Why WAIT on ${symbol}` },
    { description: "Market-wide high-volatility research layer.", href: "/intelligence/shock-opportunities", label: "Shock opportunity research" },
    { description: "Broad market pressure and regime context.", href: "/intelligence/macro-regime", label: "Macro regime intelligence" },
    ...related.slice(0, 3).map((relatedSymbol) => ({
      description: "Related symbol intelligence page.",
      href: `/symbol/${relatedSymbol}`,
      label: `${relatedSymbol} related setup`,
    })),
  ];
}

function unavailableSymbolIntelligence(symbol: string, generatedAt: string): PublishedSymbolIntelligence {
  return {
    assetType: "Market instrument",
    cards: [
      card("Decision Context", "Evidence Limited", "The latest public scanner packet is unavailable for this symbol, so TradeVeto is not publishing a current decision label.", "neutral"),
      card("Macro Context", "Evidence Limited", "Macro and exchange context will appear after the next successful public-safe scanner snapshot.", "neutral"),
      card("Fragility", "Evidence Limited", "Fragility context is intentionally withheld until deterministic setup data is available.", "neutral"),
      card("Shock Memory", "Evidence Limited", "Shock-memory evidence is unavailable in the current public packet.", "neutral"),
    ],
    companyName: symbol,
    currentOpportunityState: "Evidence Limited",
    decisionContext: `${symbol} public intelligence is waiting for the latest structured scanner packet.`,
    description: `${symbol} public TradeVeto intelligence is temporarily evidence-limited. The page remains crawlable, but no current setup claim is made until deterministic data is available.`,
    eventContext: "Verified event context is unavailable in the current public packet.",
    fragilityContext: "Fragility context is unavailable in the current public packet.",
    generatedAt,
    internalLinks: internalLinksFor(symbol, []),
    macroContext: "Macro context is unavailable in the current public packet.",
    narrativeSummary: "TradeVeto does not publish an AI narrative when deterministic inputs are unavailable.",
    relatedSymbols: [],
    sector: "Unclassified",
    shockContext: "Shock-pattern evidence is unavailable in the current public packet.",
    symbol,
    title: `${symbol} AI Market Intelligence`,
    whatToWatch: ["Wait for the next completed scanner snapshot.", "Review macro, fragility, and shock context only after deterministic evidence is available."],
    whyWaitSummary: `${symbol} is evidence-limited right now, so the safest public explanation is patience until verified scanner context returns.`,
  };
}

function isPublishedSymbol(symbol: string): symbol is (typeof PUBLISHED_SYMBOLS)[number] {
  return PUBLISHED_SYMBOLS.some((item) => item === symbol);
}

function whyWaitSummaryFor(row: OpportunityViewModel, macroContext: string, fragilityContext: string): string {
  const decision = decisionLabel(row.final_decision);
  if (/wait|avoid|no trade/i.test(decision)) {
    return `${row.symbol} is framed with restraint because ${readableText(row.decision_reason, "the setup needs stronger confirmation.")} ${macroContext} ${fragilityContext}`;
  }
  return `${row.symbol} may still require patience if volatility expands, macro alignment weakens, or the setup becomes extended. TradeVeto keeps this as research context rather than an action instruction.`;
}

function relatedSymbolsFor(row: OpportunityViewModel, rows: OpportunityViewModel[]): string[] {
  const sector = cleanText(row.sector, "").toLowerCase();
  const assetType = cleanText(row.assetType, "").toLowerCase();
  return rows
    .filter((candidate) => candidate.symbol !== row.symbol)
    .filter((candidate) => cleanText(candidate.sector, "").toLowerCase() === sector || cleanText(candidate.assetType, "").toLowerCase() === assetType)
    .sort((left, right) => publishingPriority(right) - publishingPriority(left))
    .slice(0, 6)
    .map((candidate) => candidate.symbol);
}

function topShockSymbols(rows: OpportunityViewModel[]): string[] {
  return rows.slice().sort((left, right) => shockPriority(right) - shockPriority(left)).slice(0, 8).map((row) => row.symbol);
}

function topMacroSymbols(rows: OpportunityViewModel[]): string[] {
  return rows
    .slice()
    .sort((left, right) => numeric(right.raw.macro_alignment_score, 50) - numeric(left.raw.macro_alignment_score, 50))
    .slice(0, 8)
    .map((row) => row.symbol);
}

function sectorGroups(rows: OpportunityViewModel[]): Array<{ fragility: number; label: string; rows: OpportunityViewModel[]; score: number }> {
  const grouped = new Map<string, OpportunityViewModel[]>();
  for (const row of rows) {
    const key = publicLabel(row.sector, publicLabel(row.assetType, "Unclassified"));
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped.entries())
    .map(([label, groupRows]) => ({
      fragility: average(groupRows.map((row) => row.fragility), 50),
      label,
      rows: groupRows.sort((left, right) => publishingPriority(right) - publishingPriority(left)),
      score: average(groupRows.map((row) => numeric(row.raw.macro_alignment_score ?? row.raw.sector_alignment_score ?? row.final_score, 50)), 50),
    }))
    .sort((left, right) => right.score - left.score || right.rows.length - left.rows.length);
}

function publishingPriority(row: OpportunityViewModel): number {
  return average([
    numeric(row.final_score, 50),
    row.conviction,
    100 - row.fragility,
    numeric(row.raw.macro_alignment_score, 50),
    row.shockPattern?.opportunityScore ?? 50,
    row.narrative?.narrativeDrift.momentumScore ?? 50,
  ], 50);
}

function shockPriority(row: OpportunityViewModel): number {
  return average([
    row.shockPattern?.opportunityScore ?? 0,
    row.shockPattern?.upsideShockScore ?? 0,
    row.shockPattern?.twoSidedVolatilityScore ?? 0,
    row.shockPattern?.currentSimilarityScore ?? 0,
  ], 0);
}

function setupLabel(row: OpportunityViewModel): string {
  return humanizeLabel(cleanText(row.raw.setup_type, "Market setup"));
}

function publicLabel(value: unknown, fallback: string): string {
  return humanizeLabel(cleanText(value, fallback), fallback);
}

function pressurePhrase(label: string, value: unknown, inverse: boolean): string {
  return `${humanizeLabel(label)} pressure is ${scoreBand(value, inverse).toLowerCase()}.`;
}

function watchText(label: string, value: unknown, inverse: boolean): string {
  return `Monitor ${humanizeLabel(label).toLowerCase()}; current public label is ${scoreBand(value, inverse).toLowerCase()}.`;
}

function scoreBand(value: unknown, inverse: boolean): string {
  const parsed = finiteNumber(value);
  if (parsed === null) return "Evidence limited";
  if (inverse) {
    if (parsed >= 68) return "Elevated";
    if (parsed <= 42) return "Contained";
    return "Mixed";
  }
  if (parsed >= 68) return "Constructive";
  if (parsed <= 42) return "Weak";
  return "Mixed";
}

function evidenceBand(value: unknown): string {
  const parsed = finiteNumber(value);
  if (parsed === null) return "Limited";
  if (parsed >= 70) return "Developing strongly";
  if (parsed >= 50) return "Developing";
  return "Limited";
}

function toneFromDecision(value: string): PublishedTone {
  if (/avoid|risk|no trade/i.test(value)) return "risk";
  if (/wait/i.test(value)) return "mixed";
  if (/watch|research|enter/i.test(value)) return "constructive";
  return "neutral";
}

function toneFromScore(value: unknown, inverse: boolean): PublishedTone {
  const parsed = finiteNumber(value);
  if (parsed === null) return "neutral";
  if (inverse) {
    if (parsed >= 68) return "risk";
    if (parsed <= 42) return "constructive";
    return "mixed";
  }
  if (parsed >= 68) return "constructive";
  if (parsed <= 42) return "risk";
  return "mixed";
}

function numeric(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value);
  return parsed === null ? fallback : parsed;
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => safeText(value)).filter(Boolean)));
}

function safeText(value: unknown): string {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.replace(FORBIDDEN_PUBLISHING_LANGUAGE, "research context");
}
