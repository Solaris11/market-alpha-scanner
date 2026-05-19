import type { MarketCommandModel, MarketNewsItem } from "./market-research";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UnifiedConsoleRankedSymbol, UnifiedIntelligenceConsoleModel } from "./unified-intelligence-console";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber, formatMoney } from "@/lib/ui/formatters";

export type DailyCommandTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type DailyCommandRankedItem = {
  actionContext: string;
  companyName: string | null;
  convictionLabel: string;
  dailyMoveLabel: string;
  decision: string;
  detail: string;
  entryContext: string;
  evidenceLabel: string;
  href: string;
  invalidationContext: string;
  macroLabel: string;
  priceLabel: string;
  rank: number;
  replayLabel: string;
  riskRewardContext: string;
  score: number;
  scoreLabel: string;
  sector: string | null;
  setupContext: string;
  symbol: string;
  tone: DailyCommandTone;
  weeklyMoveLabel: string;
  whyItRanks: string;
};

export type DailyMoneyFlowSector = {
  averageReturn1d: number | null;
  averageReturn1w: number | null;
  count: number;
  direction: "leadership" | "mixed" | "pressure";
  leaders: string[];
  opportunityAverage: number | null;
  riskAverage: number | null;
  score: number;
  sector: string;
  tone: DailyCommandTone;
};

export type DailyMoneyFlowTheme = {
  detail: string;
  label: string;
  tone: DailyCommandTone;
  valueLabel: string;
};

export type DailyMarketChange = {
  detail: string;
  label: string;
  metricLabel: string;
  symbol?: string;
  tone: DailyCommandTone;
};

export type DailyDevelopmentCategory =
  | "All"
  | "Crypto"
  | "Earnings"
  | "Energy"
  | "Geopolitical"
  | "High Impact"
  | "Macro"
  | "My Watchlist"
  | "Rates";

export type DailyMarketDevelopment = {
  affectedSectors: string[];
  affectedSymbols: string[];
  category: Exclude<DailyDevelopmentCategory, "All" | "High Impact" | "My Watchlist">;
  headline: string;
  id: string;
  impact: "mixed" | "negative" | "positive" | "unknown";
  original: MarketNewsItem;
  source: string;
  sourceUrl: string;
  timestamp: string;
  tone: DailyCommandTone;
  urgency: "high" | "low" | "medium";
  watchlistImpact: boolean;
  whyItMatters: string;
};

export type DailyEventCalendarItem = {
  category: "dividend" | "earnings" | "event";
  date: string;
  detail: string;
  label: string;
  symbol: string;
  tone: DailyCommandTone;
};

export type DailyMarketCommandModel = {
  bestSetups: DailyCommandRankedItem[];
  breakoutCandidates: DailyCommandRankedItem[];
  calendar: DailyEventCalendarItem[];
  crashRisk: DailyCommandRankedItem[];
  developments: DailyMarketDevelopment[];
  generatedAt: string | null;
  hero: {
    attentionScore: number | null;
    dominantOpportunity: string;
    dominantRisk: string;
    marketState: string;
    moneyFlow: string;
    narrative: string;
  };
  moneyFlow: {
    breadthLabel: string;
    sectors: DailyMoneyFlowSector[];
    themes: DailyMoneyFlowTheme[];
  };
  newsEmptyState: {
    integrationNeeded: string;
    message: string;
  };
  watchlistSymbols: string[];
  whatChangedToday: DailyMarketChange[];
};

export function buildDailyMarketCommandModel(input: {
  marketCommand: MarketCommandModel;
  marketCondition?: string | null;
  rankedZones: UnifiedIntelligenceConsoleModel["rankedZones"];
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
  now?: Date;
}): DailyMarketCommandModel {
  const rowBySymbol = new Map(input.rows.map((row) => [row.symbol.toUpperCase(), row]));
  const bestSetups = mapRankedItems(input.rankedZones["best-setups"].topSymbols.slice(0, 5), rowBySymbol);
  const breakoutCandidates = mapRankedItems(dedupeRankedSymbols([
    ...input.rankedZones["shock-watch"].topSymbols,
    ...input.rankedZones["volatility-pressure"].topSymbols,
    ...input.rankedZones["replay-context"].topSymbols,
  ]).slice(0, 5), rowBySymbol);
  const crashRisk = mapRankedItems(dedupeRankedSymbols([
    ...input.rankedZones.dangerous.topSymbols,
    ...input.rankedZones["risk-review"].topSymbols,
    ...input.rankedZones["macro-pressure"].topSymbols,
  ]).slice(0, 5), rowBySymbol);
  const moneyFlow = buildMoneyFlow(input.rows);
  const developments = buildDevelopments({
    marketNews: input.marketCommand.macroNews,
    topDangerSymbols: crashRisk.map((item) => item.symbol),
    topOpportunitySymbols: bestSetups.map((item) => item.symbol),
    watchlistSymbols: input.watchlistSymbols ?? [],
  });
  const whatChangedToday = buildWhatChangedToday(input);
  const calendar = buildEventCalendar(input.rows, input.now ?? new Date());
  const attentionScore = averageNumber([
    bestSetups[0]?.score ?? null,
    breakoutCandidates[0]?.score ?? null,
    crashRisk[0]?.score ?? null,
    input.marketCommand.pressureSummary.pressureScore,
  ]);
  const dominantOpportunity = bestSetups[0]
    ? `${bestSetups[0].symbol} leads setup quality at ${bestSetups[0].score}/100.`
    : "No validated top setup is available in the current scanner packet.";
  const dominantRisk = crashRisk[0]
    ? `${crashRisk[0].symbol} leads downside/risk pressure at ${crashRisk[0].score}/100.`
    : "No validated crash-risk ranking is available in the current scanner packet.";
  const topFlow = moneyFlow.sectors[0];
  const moneyFlowLabel = topFlow
    ? `${topFlow.sector} shows the strongest current flow context.`
    : "Sector money-flow evidence is limited in this snapshot.";

  return {
    bestSetups,
    breakoutCandidates,
    calendar,
    crashRisk,
    developments,
    generatedAt: input.marketCommand.generatedAt,
    hero: {
      attentionScore,
      dominantOpportunity,
      dominantRisk,
      marketState: input.marketCondition ?? "Market state limited",
      moneyFlow: moneyFlowLabel,
      narrative: narrativeFor({
        best: bestSetups[0] ?? null,
        breakout: breakoutCandidates[0] ?? null,
        change: whatChangedToday[0] ?? null,
        risk: crashRisk[0] ?? null,
      }),
    },
    moneyFlow,
    newsEmptyState: {
      integrationNeeded: "Required integration: verified headline, source, source URL, timestamp, affected ticker/sector, and impact fields from a configured market-news provider.",
      message: "News source not configured yet",
    },
    watchlistSymbols: (input.watchlistSymbols ?? []).map((symbol) => symbol.toUpperCase()),
    whatChangedToday,
  };
}

function mapRankedItems(items: UnifiedConsoleRankedSymbol[], rowBySymbol: Map<string, OpportunityViewModel>): DailyCommandRankedItem[] {
  return items.map((item) => {
    const row = rowBySymbol.get(item.symbol.toUpperCase()) ?? null;
    return {
      actionContext: item.actionContext,
      companyName: item.companyName,
      convictionLabel: row ? `${row.conviction}/100 · ${row.confidenceLabel}` : "Conviction limited",
      dailyMoveLabel: movementLabel(row?.raw.return_1d ?? row?.raw.price_change_pct),
      decision: item.decision,
      detail: item.detail,
      entryContext: item.entryContext ?? row?.entryZoneLabel ?? "Entry context limited",
      evidenceLabel: row?.evidence?.label ?? cleanText(row?.raw.evidence_maturity, "Evidence limited"),
      href: item.href,
      invalidationContext: invalidationContext(row, item),
      macroLabel: row?.macroLabel ?? "Macro context limited",
      priceLabel: item.priceLabel,
      rank: item.rank,
      replayLabel: replayLabel(row),
      riskRewardContext: item.riskRewardContext ?? "Risk/reward context limited",
      score: item.score,
      scoreLabel: item.scoreLabel,
      sector: item.sector,
      setupContext: item.setupContext,
      symbol: item.symbol,
      tone: item.tone,
      weeklyMoveLabel: movementLabel(row?.raw.return_1w),
      whyItRanks: item.reason,
    };
  });
}

function buildMoneyFlow(rows: OpportunityViewModel[]): DailyMarketCommandModel["moneyFlow"] {
  const bySector = new Map<string, OpportunityViewModel[]>();
  for (const row of rows) {
    const sector = cleanText(row.sector, "Unclassified");
    const current = bySector.get(sector) ?? [];
    current.push(row);
    bySector.set(sector, current);
  }
  const sectors = Array.from(bySector.entries())
    .map(([sector, sectorRows]) => sectorFlow(sector, sectorRows))
    .sort((left, right) => right.score - left.score || right.count - left.count)
    .slice(0, 8);
  const positiveRows = rows.filter((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct) !== null && (normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct) ?? 0) > 0).length;
  const measuredRows = rows.filter((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct) !== null).length;
  const breadthRatio = measuredRows ? Math.round((positiveRows / measuredRows) * 100) : null;
  const strongest = sectors.find((sector) => sector.direction === "leadership") ?? sectors[0];
  const weakest = [...sectors].sort((left, right) => (right.riskAverage ?? 0) - (left.riskAverage ?? 0))[0];
  const aiRows = rows.filter(isAiOrSemiRow);
  const energyRows = rows.filter((row) => /energy|oil|gas/i.test(`${row.sector ?? ""} ${row.raw.industry ?? ""} ${row.symbol}`));
  const themes: DailyMoneyFlowTheme[] = [
    strongest ? {
      detail: `${strongest.leaders.slice(0, 4).join(", ")} are the highest-scored names inside the strongest sector cluster.`,
      label: `Leadership: ${strongest.sector}`,
      tone: strongest.tone,
      valueLabel: scoreLabel(strongest.score),
    } : null,
    weakest ? {
      detail: `${weakest.sector} carries the highest risk/pressure blend among measured sectors.`,
      label: `Pressure: ${weakest.sector}`,
      tone: weakest.riskAverage !== null && weakest.riskAverage >= 65 ? "rose" : "amber",
      valueLabel: weakest.riskAverage === null ? "Limited" : scoreLabel(weakest.riskAverage),
    } : null,
    breadthRatio !== null ? {
      detail: `${positiveRows} of ${measuredRows} symbols with validated daily movement are positive in the latest packet.`,
      label: breadthRatio >= 58 ? "Breadth improving" : breadthRatio <= 42 ? "Breadth weakening" : "Breadth mixed",
      tone: breadthRatio >= 58 ? "emerald" : breadthRatio <= 42 ? "rose" : "amber",
      valueLabel: `${breadthRatio}%`,
    } : null,
    aiRows.length ? themeForCluster("AI / semis", aiRows) : null,
    energyRows.length ? themeForCluster("Energy / oil", energyRows) : null,
  ].filter((item): item is DailyMoneyFlowTheme => item !== null);

  return {
    breadthLabel: breadthRatio === null ? "Breadth unavailable" : `${breadthRatio}% positive daily breadth across measured symbols`,
    sectors,
    themes,
  };
}

function sectorFlow(sector: string, rows: OpportunityViewModel[]): DailyMoneyFlowSector {
  const averageReturn1d = averageNumber(rows.map((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct)));
  const averageReturn1w = averageNumber(rows.map((row) => normalizedPercent(row.raw.return_1w)));
  const opportunityAverage = averageNumber(rows.map((row) => row.final_score ?? row.conviction));
  const riskAverage = averageNumber(rows.map((row) => averageNumber([row.fragility, row.eventRisk, finiteNumber(row.raw.volatility_pressure)])));
  const score = Math.round(clamp((opportunityAverage ?? 45) * 0.48 + positiveMoveScore(averageReturn1d) * 0.26 + (riskAverage === null ? 45 : 100 - riskAverage) * 0.16 + Math.min(100, rows.length * 12) * 0.10));
  const direction = averageReturn1d !== null && averageReturn1d <= -0.3
    ? "pressure"
    : opportunityAverage !== null && opportunityAverage >= 58
      ? "leadership"
      : "mixed";
  return {
    averageReturn1d,
    averageReturn1w,
    count: rows.length,
    direction,
    leaders: rows
      .slice()
      .sort((left, right) => (right.final_score ?? right.conviction) - (left.final_score ?? left.conviction))
      .slice(0, 5)
      .map((row) => row.symbol),
    opportunityAverage,
    riskAverage,
    score,
    sector,
    tone: direction === "leadership" ? "emerald" : direction === "pressure" ? "rose" : "amber",
  };
}

function buildDevelopments(input: {
  marketNews: MarketNewsItem[];
  topDangerSymbols: string[];
  topOpportunitySymbols: string[];
  watchlistSymbols: string[];
}): DailyMarketDevelopment[] {
  const watchlist = new Set(input.watchlistSymbols.map((symbol) => symbol.toUpperCase()));
  const topSymbols = new Set([...input.topDangerSymbols, ...input.topOpportunitySymbols].map((symbol) => symbol.toUpperCase()));
  return input.marketNews
    .map((item) => {
      const affectedSymbols = item.relatedAssets.map((symbol) => symbol.toUpperCase());
      const watchlistImpact = affectedSymbols.some((symbol) => watchlist.has(symbol));
      const topPriorityImpact = affectedSymbols.some((symbol) => topSymbols.has(symbol));
      const category = newsCategory(item);
      const urgency: DailyMarketDevelopment["urgency"] = item.relevance >= 75 || topPriorityImpact ? "high" : item.relevance >= 55 || watchlistImpact ? "medium" : "low";
      return {
        affectedSectors: item.affectedSectors,
        affectedSymbols,
        category,
        headline: item.title,
        id: item.id,
        impact: impactForDirection(item.direction),
        original: item,
        source: item.source,
        sourceUrl: item.sourceUrl,
        timestamp: item.publishedAt,
        tone: toneForDevelopment(item, watchlistImpact, urgency),
        urgency,
        watchlistImpact,
        whyItMatters: item.whyItMatters,
      };
    })
    .sort((left, right) => {
      const priority = developmentPriority(right) - developmentPriority(left);
      if (priority !== 0) return priority;
      return Date.parse(right.timestamp) - Date.parse(left.timestamp);
    })
    .slice(0, 12);
}

function buildWhatChangedToday(input: {
  rankedZones: UnifiedIntelligenceConsoleModel["rankedZones"];
  workflowEvolution?: WorkflowEvolutionSummary | null;
  marketCommand: MarketCommandModel;
}): DailyMarketChange[] {
  const workflowChanges = [
    ...(input.workflowEvolution?.whatChanged ?? []),
    ...(input.workflowEvolution?.deterioratingSetups ?? []),
    ...(input.workflowEvolution?.improvingSetups ?? []),
  ].slice(0, 5).map((item): DailyMarketChange => ({
    detail: item.detail,
    label: item.title,
    metricLabel: item.metricLabel,
    symbol: item.symbol === "WORKFLOW" ? undefined : item.symbol,
    tone: item.severity === "warning" ? "rose" : item.severity === "positive" ? "emerald" : "cyan",
  }));
  const rankedChanges = input.rankedZones["what-changed"].topSymbols.slice(0, 5).map((item): DailyMarketChange => ({
    detail: item.reason,
    label: `${item.symbol}: ${item.scoreLabel} moved`,
    metricLabel: item.metricLabel,
    symbol: item.symbol,
    tone: item.tone,
  }));
  const macroPressure = input.marketCommand.pressureSummary.pressureScore;
  const macroChange: DailyMarketChange | null = macroPressure === null ? null : {
    detail: `${input.marketCommand.pressureSummary.deteriorating} cross-asset proxies are deteriorating and ${input.marketCommand.pressureSummary.constructive} are constructive in the validated market strip.`,
    label: macroPressure >= 55 ? "Cross-asset pressure elevated" : "Cross-asset pressure contained",
    metricLabel: `${macroPressure}/100`,
    tone: macroPressure >= 55 ? "rose" : "emerald",
  };
  return dedupeChanges([macroChange, ...workflowChanges, ...rankedChanges]).slice(0, 8);
}

function buildEventCalendar(rows: OpportunityViewModel[], now: Date): DailyEventCalendarItem[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const items: DailyEventCalendarItem[] = [];
  for (const row of rows) {
    const earningsDate = dateWithinWindow(row.raw.earnings_date, start, end);
    if (earningsDate) {
      items.push({
        category: "earnings",
        date: earningsDate,
        detail: cleanText(row.raw.event_context_summary, "Stored earnings date is available; surprise/reaction history may still be limited."),
        label: `${row.symbol} earnings`,
        symbol: row.symbol,
        tone: row.eventRisk >= 65 ? "rose" : "amber",
      });
    }
    const exDividendDate = dateWithinWindow(row.raw.ex_dividend_date ?? row.raw.dividend_ex_date, start, end);
    if (exDividendDate) {
      items.push({
        category: "dividend",
        date: exDividendDate,
        detail: "Stored ex-dividend context from the latest scanner/fundamental packet.",
        label: `${row.symbol} ex-dividend`,
        symbol: row.symbol,
        tone: "cyan",
      });
    }
  }
  return items
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date) || left.symbol.localeCompare(right.symbol))
    .slice(0, 12);
}

function narrativeFor(input: {
  best: DailyCommandRankedItem | null;
  breakout: DailyCommandRankedItem | null;
  change: DailyMarketChange | null;
  risk: DailyCommandRankedItem | null;
}): string {
  const pieces = [
    input.best ? `${input.best.symbol} leads opportunity research` : null,
    input.risk ? `${input.risk.symbol} leads risk review` : null,
    input.breakout ? `${input.breakout.symbol} has the strongest expansion context` : null,
    input.change ? `${input.change.label.toLowerCase()}` : null,
  ].filter((item): item is string => Boolean(item));
  return pieces.length ? `${pieces.join("; ")}.` : "Validated opportunity, risk, and development evidence is limited in this market packet.";
}

function invalidationContext(row: OpportunityViewModel | null, item: UnifiedConsoleRankedSymbol): string {
  if (row?.stop_loss !== null && row?.stop_loss !== undefined) return `Invalidation near ${formatMoney(row.stop_loss)}`;
  const raw = cleanText(row?.raw.stop_loss_reason ?? row?.raw.target_warning ?? row?.raw.key_risk, "");
  return raw || item.actionContext || "Invalidation context limited";
}

function replayLabel(row: OpportunityViewModel | null): string {
  if (!row) return "Replay limited";
  if (row.shockPattern) return `${row.shockPattern.currentSimilarityScore}/100 large-move replay`;
  const analog = finiteNumber(row.raw.analog_quality_score ?? row.raw.regime_similarity_score);
  if (analog !== null) return `${Math.round(analog)}/100 analog context`;
  return "Replay evidence limited";
}

function movementLabel(value: unknown): string {
  const parsed = normalizedPercent(value);
  if (parsed === null) return "Move limited";
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

function normalizedPercent(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

function positiveMoveScore(value: number | null): number {
  if (value === null) return 45;
  return clamp(50 + value * 5);
}

function averageNumber(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function scoreLabel(value: number): string {
  return `${Math.round(value)}/100`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function isAiOrSemiRow(row: OpportunityViewModel): boolean {
  const text = `${row.symbol} ${row.sector ?? ""} ${row.raw.industry ?? ""} ${row.company_name ?? ""}`.toLowerCase();
  return /nvda|amd|avgo|tsm|smci|mu|amat|asml|semiconductor|chip|ai/.test(text);
}

function themeForCluster(label: string, rows: OpportunityViewModel[]): DailyMoneyFlowTheme {
  const opportunity = averageNumber(rows.map((row) => row.final_score ?? row.conviction));
  const risk = averageNumber(rows.map((row) => averageNumber([row.fragility, row.eventRisk, finiteNumber(row.raw.volatility_pressure)])));
  const return1d = averageNumber(rows.map((row) => normalizedPercent(row.raw.return_1d ?? row.raw.price_change_pct)));
  const tone: DailyCommandTone = risk !== null && risk >= 68 ? "rose" : opportunity !== null && opportunity >= 58 ? "emerald" : "amber";
  const driver = rows.slice().sort((left, right) => (right.final_score ?? right.conviction) - (left.final_score ?? left.conviction))[0];
  return {
    detail: driver ? `${driver.symbol} is the strongest measured name in this cluster. Daily movement: ${movementLabel(driver.raw.return_1d ?? driver.raw.price_change_pct)}.` : "Cluster evidence is limited.",
    label,
    tone,
    valueLabel: return1d === null ? scoreLabel(opportunity ?? risk ?? 0) : `${return1d >= 0 ? "+" : ""}${return1d.toFixed(1)}%`,
  };
}

function newsCategory(item: MarketNewsItem): DailyMarketDevelopment["category"] {
  const text = `${item.eventType} ${item.title} ${item.reasonCodes.join(" ")} ${item.relatedAssets.join(" ")}`.toLowerCase();
  if (/earnings|eps|revenue|guidance/.test(text)) return "Earnings";
  if (/fed|rate|bond|yield|cpi|ppi|inflation|jobs|payroll|gdp|recession/.test(text)) return "Rates";
  if (/war|peace|geopolitical|sanction|conflict/.test(text)) return "Geopolitical";
  if (/oil|energy|crude|uso|opec/.test(text)) return "Energy";
  if (/btc|bitcoin|crypto|coin/.test(text)) return "Crypto";
  return "Macro";
}

function impactForDirection(direction: string): DailyMarketDevelopment["impact"] {
  if (direction === "positive") return "positive";
  if (direction === "negative") return "negative";
  if (direction === "neutral") return "mixed";
  return "unknown";
}

function toneForDevelopment(item: MarketNewsItem, watchlistImpact: boolean, urgency: DailyMarketDevelopment["urgency"]): DailyCommandTone {
  if (item.direction === "negative" || urgency === "high") return "rose";
  if (item.direction === "positive") return "emerald";
  if (watchlistImpact) return "cyan";
  return item.tone;
}

function developmentPriority(item: DailyMarketDevelopment): number {
  return (item.watchlistImpact ? 80 : 0) + (item.urgency === "high" ? 60 : item.urgency === "medium" ? 35 : 10) + item.original.relevance;
}

function dateWithinWindow(value: unknown, start: Date, end: Date): string | null {
  const text = cleanText(value, "");
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return null;
  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  if (date < start || date > end) return null;
  return date.toISOString();
}

function dedupeRankedSymbols(items: UnifiedConsoleRankedSymbol[]): UnifiedConsoleRankedSymbol[] {
  const seen = new Set<string>();
  const deduped: UnifiedConsoleRankedSymbol[] = [];
  for (const item of items) {
    const key = item.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...item, rank: deduped.length + 1 });
  }
  return deduped;
}

function dedupeChanges(items: Array<DailyMarketChange | null>): DailyMarketChange[] {
  const seen = new Set<string>();
  const deduped: DailyMarketChange[] = [];
  for (const item of items) {
    if (!item) continue;
    const key = `${item.symbol ?? "MARKET"}:${item.label}:${item.metricLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}
