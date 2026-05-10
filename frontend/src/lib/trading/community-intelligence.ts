import type { OpportunityViewModel } from "./opportunity-view-model";
import { finiteNumber, formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";

export type CommunityInterest = "cautious" | "learning" | "monitoring";

export type CommunitySharedWatchlist = {
  createdAt: string;
  description: string | null;
  id: string;
  name: string;
  ownerLabel: string;
  symbols: string[];
};

export type CommunityReplayStudy = {
  createdAt: string;
  id: string;
  ownerLabel: string;
  replayTimestamp: string | null;
  summary: string;
  symbol: string;
  tags: string[];
  title: string;
};

export type CommunityFollowAggregate = {
  count: number;
  interest: CommunityInterest;
  symbol: string;
};

export type CommunityOpportunityTrend = {
  companyName: string | null;
  followCount: number;
  keyReason: string;
  keyRisk: string;
  opportunityScore: number;
  replayStudyCount: number;
  riskScore: number;
  sentimentLabel: string;
  sentimentScore: number;
  symbol: string;
  tags: string[];
  watchlistCount: number;
};

export type CommunityThemeTrend = {
  detail: string;
  followCount: number;
  label: string;
  score: number;
  symbolCount: number;
  theme: string;
  tone: "constructive" | "neutral" | "risk";
  watchlistCount: number;
};

export type CommunityMetric = {
  detail: string;
  key: string;
  label: string;
  tone: "constructive" | "neutral" | "risk";
  value: string;
};

export type CommunityIntelligenceSystem = {
  educationalHighlights: string[];
  generatedAt: string;
  metrics: CommunityMetric[];
  mostFollowedOpportunities: CommunityOpportunityTrend[];
  myFollows: CommunityFollowAggregate[];
  replayStudies: CommunityReplayStudy[];
  sharedWatchlists: CommunitySharedWatchlist[];
  topThemes: CommunityThemeTrend[];
  trustBoundaries: string[];
};

export type CommunityIntelligenceInput = {
  follows: CommunityFollowAggregate[];
  generatedAt?: string;
  myFollows?: CommunityFollowAggregate[];
  replayStudies: CommunityReplayStudy[];
  rows: OpportunityViewModel[];
  sharedWatchlists: CommunitySharedWatchlist[];
};

type SymbolCommunityCounts = {
  cautious: number;
  learning: number;
  monitoring: number;
  replayStudies: number;
  watchlists: number;
};

type ThemeAccumulator = {
  follows: number;
  risk: number;
  score: number;
  symbols: Set<string>;
  watchlists: number;
};

export function buildCommunityIntelligence(input: CommunityIntelligenceInput): CommunityIntelligenceSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const rowBySymbol = new Map(input.rows.map((row) => [row.symbol.toUpperCase(), row]));
  const counts = buildSymbolCounts(input);
  const mostFollowedOpportunities = Array.from(counts.entries())
    .map(([symbol, count]) => communityTrendForSymbol(symbol, count, rowBySymbol.get(symbol) ?? null))
    .filter((item) => item.followCount + item.watchlistCount + item.replayStudyCount > 0)
    .sort((left, right) => right.opportunityScore - left.opportunityScore || right.followCount - left.followCount || left.symbol.localeCompare(right.symbol))
    .slice(0, 10);
  const topThemes = buildThemeTrends(counts, rowBySymbol).slice(0, 8);

  return {
    educationalHighlights: educationalHighlights(input, mostFollowedOpportunities, topThemes),
    generatedAt,
    metrics: communityMetrics(input, mostFollowedOpportunities, topThemes),
    mostFollowedOpportunities,
    myFollows: input.myFollows ?? [],
    replayStudies: input.replayStudies,
    sharedWatchlists: input.sharedWatchlists,
    topThemes,
    trustBoundaries: [
      "Community intelligence uses opt-in shared research and anonymous aggregates only.",
      "Community attention is not a buy/sell signal and does not override TradeVeto scoring.",
      "No open chat feed is included; this layer is designed to avoid hype, spam, and low-quality noise.",
    ],
  };
}

function buildSymbolCounts(input: CommunityIntelligenceInput): Map<string, SymbolCommunityCounts> {
  const counts = new Map<string, SymbolCommunityCounts>();
  for (const follow of input.follows) {
    const bucket = countsFor(counts, follow.symbol);
    bucket[follow.interest] += Math.max(0, Math.floor(follow.count));
  }
  for (const watchlist of input.sharedWatchlists) {
    for (const symbol of watchlist.symbols) countsFor(counts, symbol).watchlists += 1;
  }
  for (const study of input.replayStudies) countsFor(counts, study.symbol).replayStudies += 1;
  return counts;
}

function communityTrendForSymbol(symbol: string, counts: SymbolCommunityCounts, row: OpportunityViewModel | null): CommunityOpportunityTrend {
  const followCount = counts.monitoring + counts.learning + counts.cautious;
  const sentimentScore = communitySentimentScore(counts);
  const rowScore = scoreValue(row?.final_score, 45);
  const shock = row?.shockPattern?.opportunityScore ?? row?.shockPattern?.upsideShockScore ?? 45;
  const evidence = row?.evidence?.confidenceReliability ?? row?.evidence?.analogQualityScore ?? 48;
  const riskScore = riskScoreForRow(row, counts);
  const participation = clamp(followCount * 8 + counts.watchlists * 6 + counts.replayStudies * 5, 0, 32);
  const opportunityScore = clamp(Math.round(rowScore * 0.28 + (row?.conviction ?? 45) * 0.2 + shock * 0.14 + evidence * 0.08 + sentimentScore * 0.08 + participation - Math.max(0, riskScore - 72) * 0.18));

  return {
    companyName: row?.company_name ?? null,
    followCount,
    keyReason: reasonForTrend(symbol, row, counts, sentimentScore),
    keyRisk: riskForTrend(row, counts, riskScore),
    opportunityScore,
    replayStudyCount: counts.replayStudies,
    riskScore,
    sentimentLabel: sentimentLabel(sentimentScore, counts),
    sentimentScore,
    symbol,
    tags: trendTags(row, counts, sentimentScore),
    watchlistCount: counts.watchlists,
  };
}

function communitySentimentScore(counts: SymbolCommunityCounts): number {
  const total = counts.monitoring + counts.learning + counts.cautious;
  if (!total) return 50;
  const weighted = counts.monitoring * 1 + counts.learning * 0.25 - counts.cautious * 0.85;
  return clamp(Math.round(50 + (weighted / total) * 42));
}

function sentimentLabel(score: number, counts: SymbolCommunityCounts): string {
  const total = counts.monitoring + counts.learning + counts.cautious;
  if (!total) return "No community trend yet";
  if (score >= 64) return "Constructive monitoring";
  if (score <= 42) return "Cautious interest";
  return "Mixed research interest";
}

function reasonForTrend(symbol: string, row: OpportunityViewModel | null, counts: SymbolCommunityCounts, sentimentScore: number): string {
  const total = counts.monitoring + counts.learning + counts.cautious;
  if (!row) return `${symbol} is appearing in community research, but current scanner context is limited.`;
  const community = total ? `${formatNumber(total)} opt-in community marker${total === 1 ? "" : "s"}` : "shared community research";
  const context = humanizeInsightText(row.narrative?.narrativeSummary || row.decision_reason || `${row.structuralLabel} with ${row.macroLabel.toLowerCase()} context.`);
  const sentiment = sentimentScore >= 64 ? "Community monitoring is constructive" : sentimentScore <= 42 ? "Community interest is cautious" : "Community interest is mixed";
  return `${sentiment}: ${community} align with ${cleanSentence(context).toLowerCase()}`;
}

function riskForTrend(row: OpportunityViewModel | null, counts: SymbolCommunityCounts, riskScore: number): string {
  if (!row) return "Scanner context is limited, so community interest should be treated as educational only.";
  if (counts.cautious > counts.monitoring) return `More users marked caution than monitoring; ${humanizeInsightText(row.fragilityLabel).toLowerCase()} still matters.`;
  if (riskScore >= 68) return `${humanizeInsightText(row.fragilityLabel)} and ${humanizeInsightText(row.eventLabel).toLowerCase()} keep risk elevated.`;
  if (row.shockPattern?.chaseRiskLabel && row.shockPattern.chaseRiskLabel.toLowerCase() !== "low") return `${humanizeInsightText(row.shockPattern.chaseRiskLabel)} remains visible.`;
  return `${humanizeInsightText(row.macroLabel)} and ${humanizeInsightText(row.fragilityLabel).toLowerCase()} should be checked before relying on community attention.`;
}

function trendTags(row: OpportunityViewModel | null, counts: SymbolCommunityCounts, sentimentScore: number): string[] {
  const tags: string[] = [];
  if (counts.watchlists) tags.push("Shared watchlists");
  if (counts.replayStudies) tags.push("Replay studies");
  if (counts.cautious > counts.monitoring) tags.push("Caution-heavy");
  if (sentimentScore >= 64) tags.push("Constructive monitoring");
  if (row?.shockPattern?.upsideShockScore && row.shockPattern.upsideShockScore >= 65) tags.push("Large-move context");
  if (row?.macroLabel) tags.push(humanizeInsightText(row.macroLabel));
  return Array.from(new Set(tags)).slice(0, 5);
}

function buildThemeTrends(counts: Map<string, SymbolCommunityCounts>, rowBySymbol: Map<string, OpportunityViewModel>): CommunityThemeTrend[] {
  const themes = new Map<string, ThemeAccumulator>();
  for (const [symbol, count] of counts.entries()) {
    const row = rowBySymbol.get(symbol);
    const theme = themeForRow(row, symbol);
    const bucket = themes.get(theme) ?? { follows: 0, risk: 0, score: 0, symbols: new Set<string>(), watchlists: 0 };
    const trend = communityTrendForSymbol(symbol, count, row ?? null);
    bucket.follows += trend.followCount;
    bucket.watchlists += trend.watchlistCount;
    bucket.risk += trend.riskScore;
    bucket.score += trend.opportunityScore;
    bucket.symbols.add(symbol);
    themes.set(theme, bucket);
  }
  return Array.from(themes.entries())
    .map(([theme, bucket]) => {
      const symbolCount = bucket.symbols.size || 1;
      const averageScore = bucket.score / symbolCount;
      const averageRisk = bucket.risk / symbolCount;
      const score = clamp(Math.round(averageScore + Math.min(18, bucket.follows * 2 + bucket.watchlists * 3) - Math.max(0, averageRisk - 70) * 0.12));
      const tone = averageRisk >= 72 ? "risk" : score >= 65 ? "constructive" : "neutral";
      return {
        detail: `${formatNumber(symbolCount)} symbol${symbolCount === 1 ? "" : "s"}, ${formatNumber(bucket.follows)} opt-in marker${bucket.follows === 1 ? "" : "s"}, and ${formatNumber(bucket.watchlists)} shared watchlist appearance${bucket.watchlists === 1 ? "" : "s"}.`,
        followCount: bucket.follows,
        label: tone === "risk" ? "High interest, higher risk" : score >= 65 ? "Constructive community theme" : "Developing research theme",
        score,
        symbolCount,
        theme,
        tone,
        watchlistCount: bucket.watchlists,
      } satisfies CommunityThemeTrend;
    })
    .sort((left, right) => right.score - left.score || right.followCount - left.followCount);
}

function educationalHighlights(input: CommunityIntelligenceInput, opportunities: CommunityOpportunityTrend[], themes: CommunityThemeTrend[]): string[] {
  const lines: string[] = [];
  if (opportunities[0]) lines.push(`${opportunities[0].symbol} has the strongest community attention, but TradeVeto still separates that from decision quality.`);
  if (themes[0]) lines.push(`${themes[0].theme} is the most visible community theme right now: ${themes[0].label.toLowerCase()}.`);
  if (input.replayStudies[0]) lines.push(`Latest replay study: ${input.replayStudies[0].title} on ${input.replayStudies[0].symbol}.`);
  if (!lines.length) lines.push("Community intelligence will become useful after users opt into shared watchlists, follows, or replay studies.");
  lines.push("Use this as educational context, not a substitute for scanner evidence, risk controls, or your own research.");
  return lines.slice(0, 4);
}

function communityMetrics(input: CommunityIntelligenceInput, opportunities: CommunityOpportunityTrend[], themes: CommunityThemeTrend[]): CommunityMetric[] {
  const followTotal = input.follows.reduce((sum, item) => sum + item.count, 0);
  return [
    {
      detail: "Opt-in shared watchlists only. Private user watchlists are not published here.",
      key: "shared_watchlists",
      label: "Shared Watchlists",
      tone: input.sharedWatchlists.length ? "constructive" : "neutral",
      value: formatNumber(input.sharedWatchlists.length),
    },
    {
      detail: "Aggregated opportunity markers: monitoring, learning, and cautious. No buy/sell votes.",
      key: "opportunity_markers",
      label: "Opportunity Markers",
      tone: followTotal ? "constructive" : "neutral",
      value: formatNumber(followTotal),
    },
    {
      detail: "Shared historical studies meant for learning from prior setups and outcomes.",
      key: "replay_studies",
      label: "Replay Studies",
      tone: input.replayStudies.length ? "constructive" : "neutral",
      value: formatNumber(input.replayStudies.length),
    },
    {
      detail: "Highest-ranked aggregate symbols after risk, evidence, and TradeVeto context are applied.",
      key: "community_opportunities",
      label: "Community Trends",
      tone: opportunities.length ? "constructive" : "neutral",
      value: formatNumber(opportunities.length),
    },
    {
      detail: "Theme clusters are derived from scanner sectors and opt-in community activity.",
      key: "themes",
      label: "Themes",
      tone: themes.some((theme) => theme.tone === "risk") ? "risk" : themes.length ? "constructive" : "neutral",
      value: formatNumber(themes.length),
    },
  ];
}

function riskScoreForRow(row: OpportunityViewModel | null, counts: SymbolCommunityCounts): number {
  if (!row) return counts.cautious ? 62 : 50;
  const shockRisk = row.shockPattern?.downsideRiskScore ?? row.shockPattern?.chaseRiskScore ?? row.fragility;
  const volatility = scoreValue(row.raw.volatility_pressure, row.fragility);
  const cautionDrag = counts.cautious > counts.monitoring ? 8 : 0;
  return clamp(Math.round(row.fragility * 0.42 + shockRisk * 0.22 + volatility * 0.18 + row.eventRisk * 0.12 + cautionDrag));
}

function themeForRow(row: OpportunityViewModel | undefined, symbol: string): string {
  if (row?.sector) return humanizeLabel(row.sector);
  const profile = stringValue(row?.raw.sector_profile ?? row?.raw.industry ?? row?.assetType);
  if (profile) return humanizeLabel(profile);
  if (["SPY", "QQQ", "DIA", "IWM"].includes(symbol)) return "Index / Market";
  if (["GLD", "USO", "IBIT", "BTC"].includes(symbol)) return "Macro / Commodity";
  return "General Market";
}

function countsFor(counts: Map<string, SymbolCommunityCounts>, symbolValue: string): SymbolCommunityCounts {
  const symbol = normalizeSymbol(symbolValue);
  const existing = counts.get(symbol);
  if (existing) return existing;
  const next: SymbolCommunityCounts = { cautious: 0, learning: 0, monitoring: 0, replayStudies: 0, watchlists: 0 };
  counts.set(symbol, next);
  return next;
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function cleanSentence(value: string): string {
  const text = humanizeInsightText(value, "").replace(/\s+/g, " ").trim();
  return text.endsWith(".") ? text : `${text}.`;
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function scoreValue(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value);
  return parsed === null || Number.isNaN(parsed) ? fallback : parsed;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
