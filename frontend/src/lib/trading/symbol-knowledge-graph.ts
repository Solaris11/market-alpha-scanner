import type { SignalHistoryPoint } from "@/lib/adapters/DataServiceAdapter";
import type { RankingRow, ScannerScalar } from "@/lib/types";
import { finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";
import {
  formatMemoryDate,
  formatMemoryPercent,
  formatMemoryReturn,
  memoryReasonLabel,
  type MarketMemoryAnalog,
  type MarketMemorySummary,
} from "./market-memory";

export type KnowledgeGraphTone = "amber" | "cyan" | "emerald" | "rose" | "violet";
export type KnowledgeGraphStatus = "available" | "limited";
export type KnowledgeRelationshipType =
  | "correlated"
  | "event_linked"
  | "inverse"
  | "macro_linked"
  | "sector_leader"
  | "sympathy";
export type KnowledgeTimelineCategory = "alert" | "event" | "macro" | "replay" | "scanner" | "volatility";

export type SymbolMemoryTrait = {
  detail: string;
  evidenceSource: string;
  id: string;
  label: string;
  metric: string;
  status: KnowledgeGraphStatus;
  tone: KnowledgeGraphTone;
};

export type SymbolKnowledgeRelationship = {
  dataSource: string;
  evidence: string;
  href?: string;
  id: string;
  label: string;
  source: string;
  strength: number | null;
  target: string;
  tone: KnowledgeGraphTone;
  type: KnowledgeRelationshipType;
};

export type SymbolHistoricalAnalogMemory = {
  evidence: string;
  failureRate: number | null;
  href: string;
  macroSimilarity: string;
  reasonLabels: string[];
  sampleSize: number;
  setupType: string;
  signalTimestamp: string;
  similarityScore: number;
  successRate: number | null;
  symbol: string;
};

export type SymbolEventMemory = {
  detail: string;
  domain: string;
  eventCount: number;
  label: string;
  source: string;
  status: KnowledgeGraphStatus;
  symbols: string[];
  tone: KnowledgeGraphTone;
};

export type SymbolKnowledgeTimelineItem = {
  category: KnowledgeTimelineCategory;
  detail: string;
  href?: string;
  id: string;
  label: string;
  metric?: string;
  source: string;
  timestamp: string;
  tone: KnowledgeGraphTone;
};

export type SymbolKnowledgeGraphModel = {
  confidenceScore: number;
  eventMemory: SymbolEventMemory[];
  evidenceBoundaries: string[];
  generatedAt: string;
  historicalAnalogs: SymbolHistoricalAnalogMemory[];
  relationships: SymbolKnowledgeRelationship[];
  summary: string;
  symbol: string;
  timeline: SymbolKnowledgeTimelineItem[];
  traits: SymbolMemoryTrait[];
  unavailable: string[];
};

export function buildSymbolKnowledgeGraphModel({
  contextRows = [],
  generatedAt,
  history = [],
  marketMemory,
  priceSeries = [],
  row,
}: {
  contextRows?: RankingRow[];
  generatedAt?: string;
  history?: SignalHistoryPoint[];
  marketMemory?: MarketMemorySummary | null;
  priceSeries?: Array<Record<string, ScannerScalar>>;
  row: RankingRow;
}): SymbolKnowledgeGraphModel {
  const symbol = cleanSymbol(row.symbol);
  const normalizedContext = dedupeRows([row, ...contextRows]);
  const analogs = marketMemory?.analogs ?? [];
  const sourceGeneratedAt = generatedAt ?? marketMemory?.generatedAt ?? new Date().toISOString();
  const traits = buildMemoryTraits({ analogs, history, priceSeries, row });
  const unavailable: string[] = [];
  const relationships = buildKnowledgeRelationships({ contextRows: normalizedContext, row, unavailable });
  const historicalAnalogs = buildHistoricalAnalogMemory(analogs);
  const eventMemory = buildEventMemory({ analogs, contextRows: normalizedContext, row, unavailable });
  const timeline = buildKnowledgeTimeline({ analogs, generatedAt: sourceGeneratedAt, history, row });
  const confidenceScore = knowledgeConfidenceScore({ eventMemory, historicalAnalogs, relationships, timeline, traits });

  if (!history.length) unavailable.push("Scanner signal timeline is limited because no saved symbol history points are available.");
  if (!historicalAnalogs.length) unavailable.push("Historical analog memory is limited because no comparable market-memory analogs are available.");
  if (!relationships.some((relationship) => relationship.type === "inverse")) {
    unavailable.push("Inverse relationships are hidden until an explicit hedge or inverse symbol is source-backed.");
  }

  return {
    confidenceScore,
    eventMemory,
    evidenceBoundaries: [
      "Correlation labels are co-movement candidates from shared sector, setup, macro, or event evidence unless explicit price-correlation evidence is present.",
      "Historical analog success and failure rates use only source-backed forward outcome rows attached to market-memory analogs.",
      "Event memory is shown only when the scanner row, context rows, or market-memory analogs contain an event signature, label, or macro/event regime signature.",
      "No relationship, event, earnings reaction, inverse link, or replay result is fabricated when source evidence is missing.",
    ],
    generatedAt: sourceGeneratedAt,
    historicalAnalogs,
    relationships,
    summary: `${symbol} knowledge graph has ${relationships.length} source-backed relationship${relationships.length === 1 ? "" : "s"}, ${historicalAnalogs.length} historical analog${historicalAnalogs.length === 1 ? "" : "s"}, and ${timeline.length} timeline event${timeline.length === 1 ? "" : "s"}.`,
    symbol,
    timeline,
    traits,
    unavailable: Array.from(new Set(unavailable)).slice(0, 10),
  };
}

function buildMemoryTraits({
  analogs,
  history,
  priceSeries,
  row,
}: {
  analogs: MarketMemoryAnalog[];
  history: SignalHistoryPoint[];
  priceSeries: Array<Record<string, ScannerScalar>>;
  row: RankingRow;
}): SymbolMemoryTrait[] {
  const setupLabels = new Set<string>();
  const failureSignals = history.filter((point) => failureText(`${point.final_decision} ${point.entry_status} ${point.action}`)).length;
  const breakoutSignals = history.filter((point) => breakoutText(`${point.final_decision} ${point.entry_status} ${point.action}`)).length;
  history.forEach((point) => {
    const decision = cleanText(point.final_decision);
    if (decision) setupLabels.add(decision);
  });
  analogs.forEach((analog) => {
    const setup = cleanText(analog.setupType);
    if (setup) setupLabels.add(setup);
  });

  const eventText = [row.event_context_label, row.event_context_summary, row.verified_event_signature, row.macro_event_regime_signature].map((value) => cleanText(value)).filter(Boolean).join(" ");
  const volatilityScore = firstNumber(row.volatility_pressure, row.volatility_pressure_adjustment, row.atr, row.atr_pct, row.annualized_volatility);
  const liquidityScore = firstNumber(row.liquidity_pressure, row.liquidity_pressure_adjustment, row.avg_dollar_volume, row.dollar_volume);
  const trend = trendPersonality({ history, priceSeries, row });

  return [
    trait({
      available: setupLabels.size > 0 || history.length > 0,
      detail: setupLabels.size ? `Observed setup states: ${Array.from(setupLabels).slice(0, 4).map((value) => humanizeLabel(value)).join(", ")}.` : "No prior setup states are stored for this symbol yet.",
      id: "prior-setups",
      label: "Prior setups",
      metric: setupLabels.size ? `${setupLabels.size}` : "Limited",
      source: "Saved scanner history and market-memory analog setup labels",
      tone: "cyan",
    }),
    trait({
      available: failureSignals > 0 || analogs.some((analog) => analog.outcomes.some((outcome) => (outcome.returnPct ?? 0) < 0)),
      detail: failureSignals ? `${failureSignals} saved history point${failureSignals === 1 ? "" : "s"} contain failure, avoid, stale, or exit language.` : "No source-backed prior failure state is attached yet.",
      id: "prior-failures",
      label: "Prior failures",
      metric: failureSignals ? `${failureSignals}` : "Limited",
      source: "Scanner decision history and negative analog outcome rows",
      tone: failureSignals ? "rose" : "amber",
    }),
    trait({
      available: breakoutSignals > 0 || currentBreakoutAvailable(row),
      detail: breakoutSignals ? `${breakoutSignals} saved history point${breakoutSignals === 1 ? "" : "s"} contain breakout or enter language.` : currentBreakoutAvailable(row) ? "Current validated price is above source-backed entry or resistance context." : "No source-backed breakout memory exists yet.",
      id: "prior-breakouts",
      label: "Breakout behavior",
      metric: breakoutSignals ? `${breakoutSignals}` : currentBreakoutAvailable(row) ? "Current" : "Limited",
      source: "Scanner decision history plus validated price/level context",
      tone: breakoutSignals || currentBreakoutAvailable(row) ? "emerald" : "amber",
    }),
    trait({
      available: Boolean(cleanText(row.market_regime) || cleanText(row.macro_event_regime_signature) || cleanText(row.macro_context_label)),
      detail: cleanText(row.macro_context_summary) ?? cleanText(row.macro_event_regime_signature) ?? cleanText(row.market_regime) ?? "No macro condition memory is stored for this row.",
      id: "macro-conditions",
      label: "Macro conditions",
      metric: cleanText(row.market_regime) ? humanizeLabel(String(row.market_regime)) : "Limited",
      source: "Scanner macro regime and macro/event signature fields",
      tone: "violet",
    }),
    trait({
      available: eventDomain(eventText) === "earnings",
      detail: eventDomain(eventText) === "earnings" ? eventText.slice(0, 180) : "Limited: no verified earnings reaction signature is attached to this symbol packet.",
      id: "earnings-reactions",
      label: "Earnings reactions",
      metric: eventDomain(eventText) === "earnings" ? "Available" : "Limited",
      source: "Verified event signature, event context label, and market-memory analog event signatures",
      tone: eventDomain(eventText) === "earnings" ? "emerald" : "amber",
    }),
    trait({
      available: volatilityScore !== null || priceSeries.length >= 5,
      detail: volatilityScore !== null ? `Volatility pressure/value is ${Math.round(volatilityScore)} from source fields.` : priceSeries.length >= 5 ? "Volatility personality is inferred from stored close-price movement only." : "No volatility score or price depth is available yet.",
      id: "volatility-personality",
      label: "Volatility personality",
      metric: volatilityScore !== null ? `${Math.round(volatilityScore)}` : priceSeries.length >= 5 ? "Price trail" : "Limited",
      source: "Scanner volatility fields or stored price history",
      tone: volatilityScore !== null && volatilityScore >= 65 ? "rose" : "cyan",
    }),
    trait({
      available: liquidityScore !== null,
      detail: liquidityScore !== null ? `Liquidity field is source-backed at ${formatNumber(liquidityScore)}.` : "No source-backed liquidity or dollar-volume field is attached to this packet.",
      id: "liquidity-behavior",
      label: "Liquidity behavior",
      metric: liquidityScore !== null ? liquidityBucketLabel(liquidityScore) : "Limited",
      source: "Scanner liquidity pressure, liquidity adjustment, or dollar-volume fields",
      tone: liquidityScore !== null && liquidityScore >= 65 && liquidityScore < 1_000_000 ? "rose" : "cyan",
    }),
    trait({
      available: trend.available,
      detail: trend.detail,
      id: "trend-personality",
      label: "Trend personality",
      metric: trend.metric,
      source: trend.source,
      tone: trend.tone,
    }),
  ];
}

function buildKnowledgeRelationships({
  contextRows,
  row,
  unavailable,
}: {
  contextRows: RankingRow[];
  row: RankingRow;
  unavailable: string[];
}): SymbolKnowledgeRelationship[] {
  const symbol = cleanSymbol(row.symbol);
  const relationships: SymbolKnowledgeRelationship[] = [];
  const sector = cleanText(row.sector);
  const setup = cleanText(row.setup_type ?? row.final_decision ?? row.action);
  const macroSignature = cleanText(row.macro_event_regime_signature ?? row.market_regime ?? row.macro_context_label);
  const eventSignature = cleanText(row.verified_event_signature ?? row.event_context_label);

  if (sector) {
    contextRows
      .filter((item) => cleanSymbol(item.symbol) !== symbol && sameText(item.sector, sector))
      .sort((left, right) => scoreForRow(right) - scoreForRow(left))
      .slice(0, 3)
      .forEach((peer, index) => {
        const peerSymbol = cleanSymbol(peer.symbol);
        const peerScore = finiteNumber(peer.final_score ?? peer.macro_adjusted_score ?? peer.quality_score);
        relationships.push({
          dataSource: "Current scanner sector rows",
          evidence: `${peerSymbol} shares ${sector} sector context with ${symbol}; score ${scoreLabel(peerScore)}.`,
          href: `/symbol/${encodeURIComponent(peerSymbol)}`,
          id: relationId(symbol, "sector_leader", peerSymbol),
          label: index === 0 ? "Sector leader" : "Sector peer",
          source: symbol,
          strength: peerScore,
          target: peerSymbol,
          tone: peerScore !== null && peerScore >= 70 ? "emerald" : "cyan",
          type: "sector_leader",
        });
      });

    contextRows
      .filter((item) => cleanSymbol(item.symbol) !== symbol && sameText(item.sector, sector) && setup && sameText(item.setup_type ?? item.final_decision ?? item.action, setup))
      .slice(0, 3)
      .forEach((peer) => {
        const peerSymbol = cleanSymbol(peer.symbol);
        const peerScore = finiteNumber(peer.final_score ?? peer.macro_adjusted_score ?? peer.quality_score);
        relationships.push({
          dataSource: "Scanner sector/setup co-occurrence",
          evidence: `${peerSymbol} shares sector and setup/decision context. This is a co-movement candidate, not statistical correlation.`,
          href: `/symbol/${encodeURIComponent(peerSymbol)}`,
          id: relationId(symbol, "correlated", peerSymbol),
          label: "Correlated candidate",
          source: symbol,
          strength: peerScore,
          target: peerSymbol,
          tone: "cyan",
          type: "correlated",
        });
      });
  } else {
    unavailable.push("Sector leader and same-sector relationship memory are limited because the current row has no sector label.");
  }

  if (setup) {
    contextRows
      .filter((item) => cleanSymbol(item.symbol) !== symbol && sameText(item.setup_type ?? item.final_decision ?? item.action, setup))
      .slice(0, 3)
      .forEach((peer) => {
        const peerSymbol = cleanSymbol(peer.symbol);
        relationships.push({
          dataSource: "Current scanner setup and decision fields",
          evidence: `${peerSymbol} shares ${humanizeLabel(setup)} setup/decision context with ${symbol}.`,
          href: `/symbol/${encodeURIComponent(peerSymbol)}`,
          id: relationId(symbol, "sympathy", peerSymbol),
          label: "Sympathy play",
          source: symbol,
          strength: finiteNumber(peer.final_score ?? peer.quality_score),
          target: peerSymbol,
          tone: "violet",
          type: "sympathy",
        });
      });
  }

  if (macroSignature) {
    contextRows
      .filter((item) => cleanSymbol(item.symbol) !== symbol && sameText(item.macro_event_regime_signature ?? item.market_regime ?? item.macro_context_label, macroSignature))
      .slice(0, 4)
      .forEach((peer) => {
        const peerSymbol = cleanSymbol(peer.symbol);
        relationships.push({
          dataSource: "Scanner macro/event regime signatures",
          evidence: `${peerSymbol} shares macro signature ${humanizeLabel(macroSignature)}.`,
          href: `/symbol/${encodeURIComponent(peerSymbol)}`,
          id: relationId(symbol, "macro_linked", peerSymbol),
          label: "Macro-linked",
          source: symbol,
          strength: finiteNumber(peer.macro_alignment_score ?? peer.macro_score ?? peer.final_score),
          target: peerSymbol,
          tone: "violet",
          type: "macro_linked",
        });
      });
  }

  if (eventSignature) {
    contextRows
      .filter((item) => cleanSymbol(item.symbol) !== symbol && sameText(item.verified_event_signature ?? item.event_context_label, eventSignature))
      .slice(0, 4)
      .forEach((peer) => {
        const peerSymbol = cleanSymbol(peer.symbol);
        relationships.push({
          dataSource: "Verified event signature or event context label",
          evidence: `${peerSymbol} shares event signature ${humanizeLabel(eventSignature)}.`,
          href: `/symbol/${encodeURIComponent(peerSymbol)}`,
          id: relationId(symbol, "event_linked", peerSymbol),
          label: "Event-linked",
          source: symbol,
          strength: finiteNumber(peer.event_risk_score ?? peer.verified_event_pressure_score ?? peer.final_score),
          target: peerSymbol,
          tone: "amber",
          type: "event_linked",
        });
      });
  }

  explicitInverseSymbols(row).forEach((target) => {
    relationships.push({
      dataSource: "Explicit inverse or hedge symbol field on scanner row",
      evidence: `${target} was supplied as a source-backed inverse/hedge relationship.`,
      href: `/symbol/${encodeURIComponent(target)}`,
      id: relationId(symbol, "inverse", target),
      label: "Inverse / hedge",
      source: symbol,
      strength: null,
      target,
      tone: "rose",
      type: "inverse",
    });
  });

  return dedupeRelationships(relationships).slice(0, 14);
}

function buildHistoricalAnalogMemory(analogs: MarketMemoryAnalog[]): SymbolHistoricalAnalogMemory[] {
  return analogs.slice(0, 8).map((analog) => {
    const outcomeValues = analog.outcomes.map((outcome) => outcome.returnPct).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const successCount = outcomeValues.filter((value) => value > 0).length;
    const failureCount = outcomeValues.filter((value) => value < 0).length;
    const sampleSize = outcomeValues.length;
    const reasonLabels = analog.reasonCodes.slice(0, 5).map(memoryReasonLabel);
    return {
      evidence: sampleSize
        ? `Outcomes: ${analog.outcomes.map((outcome) => `${outcome.horizon} ${formatMemoryReturn(outcome.returnPct)}`).join(", ")}.`
        : "No forward outcome rows are attached to this analog yet.",
      failureRate: sampleSize ? failureCount / sampleSize : null,
      href: `/symbol/${encodeURIComponent(cleanSymbol(analog.symbol))}`,
      macroSimilarity: analog.reasonCodes.some((code) => code.includes("macro") || code.includes("regime")) ? "Macro/regime similar" : "Macro similarity limited",
      reasonLabels,
      sampleSize,
      setupType: humanizeLabel(analog.setupType ?? "Historical setup"),
      signalTimestamp: analog.signalTimestamp,
      similarityScore: analog.similarityScore,
      successRate: sampleSize ? successCount / sampleSize : null,
      symbol: cleanSymbol(analog.symbol),
    };
  });
}

function buildEventMemory({
  analogs,
  contextRows,
  row,
  unavailable,
}: {
  analogs: MarketMemoryAnalog[];
  contextRows: RankingRow[];
  row: RankingRow;
  unavailable: string[];
}): SymbolEventMemory[] {
  const entries: Array<{ detail: string; domain: string; source: string; symbol: string }> = [];
  const collect = (symbol: string, source: string, ...values: unknown[]) => {
    const text = values.map((value) => cleanText(value)).filter(Boolean).join(" ");
    if (!text) return;
    const domain = eventDomain(text);
    if (domain === "general") return;
    entries.push({ detail: text, domain, source, symbol: cleanSymbol(symbol) });
  };

  collect(row.symbol, "Current scanner event fields", row.verified_event_signature, row.event_context_label, row.event_context_summary, row.macro_event_regime_signature);
  contextRows.slice(0, 80).forEach((item) => collect(item.symbol, "Current scanner event fields", item.verified_event_signature, item.event_context_label, item.macro_event_regime_signature));
  analogs.forEach((analog) => collect(analog.symbol, "Market-memory analog event signature", analog.eventSignature, analog.macroEventRegimeSignature, analog.setupType));

  const grouped = new Map<string, Array<{ detail: string; source: string; symbol: string }>>();
  entries.forEach((entry) => {
    const bucket = grouped.get(entry.domain) ?? [];
    bucket.push({ detail: entry.detail, source: entry.source, symbol: entry.symbol });
    grouped.set(entry.domain, bucket);
  });

  const eventMemory = Array.from(grouped.entries())
    .map(([domain, items]): SymbolEventMemory => {
      const symbols = Array.from(new Set(items.map((item) => item.symbol).filter(Boolean))).slice(0, 8);
      return {
        detail: items[0]?.detail.slice(0, 220) ?? `${domain} memory is present.`,
        domain,
        eventCount: items.length,
        label: eventDomainLabel(domain),
        source: Array.from(new Set(items.map((item) => item.source))).join(" + "),
        status: "available",
        symbols,
        tone: eventTone(domain),
      };
    })
    .sort((left, right) => right.eventCount - left.eventCount || left.domain.localeCompare(right.domain))
    .slice(0, 8);

  ["fomc", "cpi", "earnings", "geopolitical", "crypto"].forEach((domain) => {
    if (!eventMemory.some((item) => item.domain === domain)) unavailable.push(`${eventDomainLabel(domain)} memory is limited because no source-backed event signature is attached.`);
  });

  return eventMemory;
}

function buildKnowledgeTimeline({
  analogs,
  generatedAt,
  history,
  row,
}: {
  analogs: MarketMemoryAnalog[];
  generatedAt: string;
  history: SignalHistoryPoint[];
  row: RankingRow;
}): SymbolKnowledgeTimelineItem[] {
  const symbol = cleanSymbol(row.symbol);
  const items: SymbolKnowledgeTimelineItem[] = [];
  history.slice(-12).forEach((point, index) => {
    items.push({
      category: "scanner",
      detail: `Decision ${point.final_decision}; entry state ${point.entry_status}; rating ${point.rating}.`,
      id: `history:${point.timestamp}:${index}`,
      label: `${symbol} scanner signal`,
      metric: point.final_score === null ? "Limited" : `${Math.round(point.final_score)}`,
      source: "Saved scanner signal history",
      timestamp: point.timestamp,
      tone: point.final_score !== null && point.final_score >= 70 ? "emerald" : point.final_score !== null && point.final_score < 45 ? "rose" : "cyan",
    });
  });

  analogs.slice(0, 8).forEach((analog) => {
    items.push({
      category: "replay",
      detail: `${cleanSymbol(analog.symbol)} matched through ${analog.reasonCodes.slice(0, 3).map(memoryReasonLabel).join(", ") || "limited reason detail"}.`,
      href: `/symbol/${encodeURIComponent(cleanSymbol(analog.symbol))}`,
      id: `analog:${analog.symbol}:${analog.signalTimestamp}`,
      label: "Historical analog",
      metric: `${Math.round(analog.similarityScore)}%`,
      source: "Market-memory analog engine",
      timestamp: analog.signalTimestamp,
      tone: "violet",
    });
  });

  const currentTime = cleanText(row.last_updated_utc ?? row.last_updated) ?? generatedAt;
  const eventText = cleanText(row.verified_event_signature ?? row.event_context_label ?? row.event_context_summary);
  if (eventText) {
    items.push({
      category: "event",
      detail: eventText,
      id: `event:${symbol}:${currentTime}`,
      label: eventDomainLabel(eventDomain(eventText)),
      metric: scoreLabel(finiteNumber(row.event_risk_score ?? row.verified_event_pressure_score)),
      source: "Current scanner verified event fields",
      timestamp: currentTime,
      tone: "amber",
    });
  }
  const macroText = cleanText(row.macro_event_regime_signature ?? row.market_regime ?? row.macro_context_label);
  if (macroText) {
    items.push({
      category: "macro",
      detail: macroText,
      id: `macro:${symbol}:${currentTime}`,
      label: "Macro condition",
      metric: scoreLabel(finiteNumber(row.macro_alignment_score ?? row.macro_score)),
      source: "Scanner macro regime fields",
      timestamp: currentTime,
      tone: "violet",
    });
  }
  const volatility = finiteNumber(row.volatility_pressure ?? row.volatility_pressure_adjustment ?? row.atr_pct);
  if (volatility !== null) {
    items.push({
      category: "volatility",
      detail: `Volatility pressure/value ${Math.round(volatility)}.`,
      id: `volatility:${symbol}:${currentTime}`,
      label: "Volatility personality",
      metric: `${Math.round(volatility)}`,
      source: "Scanner volatility fields",
      timestamp: currentTime,
      tone: volatility >= 65 ? "rose" : "cyan",
    });
  }

  return dedupeTimeline(items)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 18);
}

export function symbolKnowledgeTextContainsUnsupportedClaim(text: string): boolean {
  return /\b(guaranteed|guarantee|will definitely|must buy|must sell|risk-free|certain profit|sure thing)\b/i.test(text);
}

function trait({
  available,
  detail,
  id,
  label,
  metric,
  source,
  tone,
}: {
  available: boolean;
  detail: string;
  id: string;
  label: string;
  metric: string;
  source: string;
  tone: KnowledgeGraphTone;
}): SymbolMemoryTrait {
  return {
    detail,
    evidenceSource: source,
    id,
    label,
    metric,
    status: available ? "available" : "limited",
    tone: available ? tone : "amber",
  };
}

function trendPersonality({
  history,
  priceSeries,
  row,
}: {
  history: SignalHistoryPoint[];
  priceSeries: Array<Record<string, ScannerScalar>>;
  row: RankingRow;
}): { available: boolean; detail: string; metric: string; source: string; tone: KnowledgeGraphTone } {
  const closes = priceSeries.map((point) => finiteNumber(point.close ?? point.Close ?? point.price)).filter((value): value is number => value !== null);
  if (closes.length >= 3) {
    const first = closes[0] ?? 0;
    const last = closes[closes.length - 1] ?? 0;
    const changePct = first > 0 ? (last - first) / first : 0;
    return {
      available: true,
      detail: `Stored price trail moved ${formatMemoryReturn(changePct)} across ${closes.length} points.`,
      metric: changePct > 0.03 ? "Uptrend" : changePct < -0.03 ? "Downtrend" : "Range",
      source: "Stored symbol price history",
      tone: changePct > 0.03 ? "emerald" : changePct < -0.03 ? "rose" : "cyan",
    };
  }
  const scores = history.map((point) => point.final_score).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (scores.length >= 2) {
    const delta = scores[scores.length - 1] - scores[0];
    return {
      available: true,
      detail: `Saved scanner score changed ${delta >= 0 ? "+" : ""}${Math.round(delta)} points across ${scores.length} observations.`,
      metric: delta > 5 ? "Strengthening" : delta < -5 ? "Weakening" : "Stable",
      source: "Saved scanner score history",
      tone: delta > 5 ? "emerald" : delta < -5 ? "rose" : "cyan",
    };
  }
  const trend = cleanText(row.trend_personality ?? row.trend_state ?? row.trend_label);
  return {
    available: Boolean(trend),
    detail: trend ?? "No source-backed trend personality is available yet.",
    metric: trend ? humanizeLabel(trend) : "Limited",
    source: "Scanner trend fields",
    tone: "cyan",
  };
}

function currentBreakoutAvailable(row: RankingRow): boolean {
  const price = firstNumber(row.price, row.last_price, row.close);
  const resistance = firstNumber(row.recent_resistance, row.resistance, row.entry_zone_high, row.buy_zone_high, row.correction_zone_high);
  return price !== null && resistance !== null && price >= resistance;
}

function explicitInverseSymbols(row: RankingRow): string[] {
  const record = row as unknown as Record<string, unknown>;
  return ["inverse_symbol", "hedge_symbol", "risk_hedge_symbol", "inverse_relationship_symbol", "macro_hedge_symbol"]
    .flatMap((key) => splitSymbols(record[key]))
    .filter((symbol) => symbol !== cleanSymbol(row.symbol));
}

function splitSymbols(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitSymbols);
  return String(value ?? "")
    .split(/[,|/ ]+/)
    .map(cleanSymbol)
    .filter(Boolean);
}

function eventDomain(value: string): string {
  const text = value.toLowerCase();
  if (/\b(fomc|fed|federal reserve|rate decision|powell)\b/.test(text)) return "fomc";
  if (/\b(cpi|inflation|pce|ppi)\b/.test(text)) return "cpi";
  if (/\b(earnings|eps|revenue|guidance|quarter|q[1-4])\b/.test(text)) return "earnings";
  if (/\b(geopolitical|war|sanction|election|tariff|china|taiwan|middle east|ukraine)\b/.test(text)) return "geopolitical";
  if (/\b(crypto|bitcoin|btc|ethereum|eth|etf flows)\b/.test(text)) return "crypto";
  if (/\b(oil|rates|dividend|analyst|downgrade|upgrade|macro|event)\b/.test(text)) return "macro";
  return "general";
}

function eventDomainLabel(domain: string): string {
  if (domain === "fomc") return "FOMC reaction memory";
  if (domain === "cpi") return "CPI / inflation reaction memory";
  if (domain === "earnings") return "Earnings reaction memory";
  if (domain === "geopolitical") return "Geopolitical reaction memory";
  if (domain === "crypto") return "Crypto shock memory";
  if (domain === "macro") return "Macro event memory";
  return "Event memory";
}

function eventTone(domain: string): KnowledgeGraphTone {
  if (domain === "geopolitical") return "rose";
  if (domain === "earnings") return "emerald";
  if (domain === "crypto") return "violet";
  if (domain === "fomc" || domain === "cpi") return "amber";
  return "cyan";
}

function failureText(value: string): boolean {
  return /\b(fail|failure|avoid|exit|invalid|stale|breakdown|risk)\b/i.test(value);
}

function breakoutText(value: string): boolean {
  return /\b(breakout|enter|trigger|momentum|expansion)\b/i.test(value);
}

function knowledgeConfidenceScore({
  eventMemory,
  historicalAnalogs,
  relationships,
  timeline,
  traits,
}: {
  eventMemory: SymbolEventMemory[];
  historicalAnalogs: SymbolHistoricalAnalogMemory[];
  relationships: SymbolKnowledgeRelationship[];
  timeline: SymbolKnowledgeTimelineItem[];
  traits: SymbolMemoryTrait[];
}): number {
  const availableTraits = traits.filter((item) => item.status === "available").length;
  return Math.min(100, Math.round(availableTraits * 6 + relationships.length * 4 + historicalAnalogs.length * 5 + eventMemory.length * 6 + Math.min(20, timeline.length)));
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function scoreForRow(row: RankingRow): number {
  return finiteNumber(row.final_score ?? row.macro_adjusted_score ?? row.quality_score) ?? -1;
}

function scoreLabel(value: number | null): string {
  return value === null ? "Limited" : `${Math.round(value)}`;
}

function liquidityBucketLabel(value: number): string {
  if (value >= 1_000_000_000) return "Deep";
  if (value >= 100_000_000) return "Good";
  if (value >= 65) return "Pressured";
  return "Normal";
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${Math.round(value)}`;
}

function cleanSymbol(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined", "n/a", "na"].includes(text.toLowerCase())) return null;
  return text;
}

function sameText(left: unknown, right: unknown): boolean {
  const cleanLeft = cleanText(left)?.toLowerCase().replaceAll("_", " ");
  const cleanRight = cleanText(right)?.toLowerCase().replaceAll("_", " ");
  return Boolean(cleanLeft && cleanRight && cleanLeft === cleanRight);
}

function relationId(source: string, type: KnowledgeRelationshipType, target: string): string {
  return `${source}:${type}:${target}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, "-");
}

function dedupeRows(rows: RankingRow[]): RankingRow[] {
  const seen = new Set<string>();
  const output: RankingRow[] = [];
  rows.forEach((row) => {
    const symbol = cleanSymbol(row.symbol);
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    output.push(row);
  });
  return output;
}

function dedupeRelationships(relationships: SymbolKnowledgeRelationship[]): SymbolKnowledgeRelationship[] {
  const seen = new Set<string>();
  const output: SymbolKnowledgeRelationship[] = [];
  relationships.forEach((relationship) => {
    const key = `${relationship.type}:${relationship.target}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(relationship);
  });
  return output.sort((left, right) => (right.strength ?? -1) - (left.strength ?? -1) || left.type.localeCompare(right.type));
}

function dedupeTimeline(items: SymbolKnowledgeTimelineItem[]): SymbolKnowledgeTimelineItem[] {
  const seen = new Set<string>();
  const output: SymbolKnowledgeTimelineItem[] = [];
  items.forEach((item) => {
    const key = `${item.category}:${item.timestamp}:${item.label}:${item.metric ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(item);
  });
  return output;
}

export function formatKnowledgeRate(value: number | null): string {
  return value === null ? "Limited" : formatMemoryPercent(value);
}

export function formatKnowledgeTimestamp(value: string): string {
  return formatMemoryDate(value);
}
