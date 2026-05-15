import type { AIExplainabilityModel, ExplainabilityTone } from "./ai-explainability";
import type { IntelligenceFeedItem } from "./intelligence-feed";
import type { OpportunityViewModel } from "./opportunity-view-model";
import { cleanText, finiteNumber, formatMoney, formatNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type TrustTone = ExplainabilityTone;

export type EvidenceProvenanceItem = {
  detail: string;
  label: string;
  tone: TrustTone;
  value: string;
};

export type WorkflowTraceLink = {
  href: string;
  label: string;
  reason: string;
};

export type InstitutionalTrustModel = {
  auditability: string[];
  evidenceQuality: string;
  freshness: string;
  headline: string;
  limitations: string[];
  personalization: string[];
  provenance: EvidenceProvenanceItem[];
  score: number;
  summary: string;
  traceability: string[];
  workflow: WorkflowTraceLink[];
};

type OpportunityTrustOptions = {
  shownBecause?: string;
  watchlisted?: boolean;
};

type FeedTrustOptions = {
  watchlistSymbols?: string[];
};

type ExplainabilityTrustOptions = {
  symbol?: string;
};

const NO_LIMITATION = "No major limitation surfaced in the available packet.";

export function buildOpportunityTrustModel(row: OpportunityViewModel, options: OpportunityTrustOptions = {}): InstitutionalTrustModel {
  const symbol = cleanSymbol(row.symbol);
  const evidenceQuality = row.evidence?.label ?? cleanText(row.raw.evidence_maturity, "Evidence not scored");
  const priceLabel = row.price === null ? "Data unavailable" : formatMoney(row.price);
  const replaySamples = row.shockPattern?.timingValidation?.validationSampleSize ?? row.shockPattern?.shockEvents.length ?? null;
  const replayLabel = replaySamples === null ? "No replay context" : `${replaySamples} replay sample${replaySamples === 1 ? "" : "s"}`;
  const evidenceScore = finiteNumber(row.evidence?.score);
  const limitations = uniqueText([
    ...((row.evidence?.limitations ?? []).map((item) => cleanText(item, ""))),
    row.dataFreshness.status === "stale" ? "Scanner freshness is stale; wait for a fresh packet before leaning on this view." : null,
    row.dataFreshness.status === "missing" || row.dataFreshness.status === "schema_mismatch" ? "Freshness timestamp is unavailable for this row." : null,
    row.price === null ? "No latest available price is attached to this card." : null,
    replaySamples === null ? "No validated replay sample is attached to this setup." : null,
    evidenceScore !== null && evidenceScore < 45 ? "Evidence quality is still limited." : null,
    row.fragility >= 70 ? "Fragility is elevated; risk context is not clean." : null,
    row.eventRisk >= 70 ? "Event pressure is elevated." : null,
  ]);
  const personalization = uniqueText([
    options.shownBecause,
    options.watchlisted ? `Shown because ${symbol} is on your watchlist.` : null,
    row.raw.viewed_recently ? `Shown because ${symbol} was recently viewed.` : null,
  ]);
  const traceability = uniqueText([
    `Decision state comes from the latest scanner row: ${cleanText(row.final_decision, "not available")}.`,
    `Freshness check: ${row.dataFreshness.message}.`,
    `Evidence check: ${evidenceQuality}.`,
    `Risk check: ${row.fragilityLabel} fragility and ${row.eventLabel}.`,
    row.macroAdjustment === null ? "Macro support is not fully scored for this row." : `Macro context: ${row.macroLabel} (${signedNumber(row.macroAdjustment)}).`,
  ]);
  return {
    auditability: uniqueText([
      `This card is generated from the scanner row for ${symbol}.`,
      `Last scanner timestamp: ${row.dataFreshness.lastUpdated ?? "not available"}.`,
      `Price context is labeled as latest available data, not live execution data.`,
    ]),
    evidenceQuality,
    freshness: row.dataFreshness.message,
    headline: `${symbol} trust readout`,
    limitations: limitations.length ? limitations : [NO_LIMITATION],
    personalization: personalization.length ? personalization : ["Shown because it matched the current scanner and workflow filters."],
    provenance: [
      {
        detail: row.dataFreshness.message,
        label: "Freshness",
        tone: freshnessTone(row.dataFreshness.status),
        value: row.dataFreshness.label,
      },
      {
        detail: row.dataFreshness.lastUpdated ? `Latest scanner timestamp ${row.dataFreshness.lastUpdated}.` : "No scanner timestamp is available.",
        label: "Latest price",
        tone: row.price === null ? "caution" : "neutral",
        value: priceLabel,
      },
      {
        detail: row.evidence?.reasons?.slice(0, 2).join(" ") || "Evidence maturity is derived from the current scanner and replay packet when available.",
        label: "Evidence",
        tone: evidenceTone(evidenceScore),
        value: evidenceQuality,
      },
      {
        detail: row.shockPattern?.lastUpdated ? `Replay context last updated ${row.shockPattern.lastUpdated}.` : "No validated replay context is attached to this card.",
        label: "Replay",
        tone: replaySamples === null ? "caution" : "intelligence",
        value: replayLabel,
      },
      {
        detail: `${row.fragilityLabel} fragility. ${row.eventLabel}.`,
        label: "Risk",
        tone: row.fragility >= 70 || row.eventRisk >= 70 ? "risk" : row.fragility >= 50 || row.eventRisk >= 50 ? "caution" : "constructive",
        value: `${formatNumber(row.fragility, 0)}/100`,
      },
    ],
    score: trustScore([
      row.dataFreshness.status === "fresh" ? 18 : row.dataFreshness.status === "slightly_stale" ? 12 : 4,
      evidenceScore === null ? 8 : Math.min(22, Math.max(4, evidenceScore * 0.22)),
      row.price === null ? 4 : 12,
      replaySamples === null ? 4 : 12,
      row.fragility >= 70 ? 4 : row.fragility >= 50 ? 9 : 14,
      row.eventRisk >= 70 ? 4 : row.eventRisk >= 50 ? 9 : 12,
    ]),
    summary: `${symbol} is shown with ${evidenceQuality.toLowerCase()} and ${row.dataFreshness.label.toLowerCase()} data. ${limitations.length ? "Review limitations before relying on the signal." : "No major limitation is visible in the current packet."}`,
    traceability,
    workflow: [
      { href: `/symbol/${encodeURIComponent(symbol)}`, label: "Open symbol", reason: "Review full symbol context, chart, risk, and replay." },
      { href: `/symbol/${encodeURIComponent(symbol)}#chart`, label: "Open chart", reason: "Inspect latest available price context and overlays." },
      { href: `/history?symbol=${encodeURIComponent(symbol)}`, label: "Open history", reason: "Review what changed over time." },
      { href: `/alerts?symbol=${encodeURIComponent(symbol)}&intent=create`, label: "Create alert", reason: "Monitor conditions without chasing." },
      { href: "/terminal#copilot", label: "Ask Copilot", reason: "Ask why confidence, risk, or freshness changed." },
    ],
  };
}

export function buildFeedItemTrustModel(item: IntelligenceFeedItem, options: FeedTrustOptions = {}): InstitutionalTrustModel {
  const symbol = item.relatedSymbol ? cleanSymbol(item.relatedSymbol) : null;
  const watchlistRelevant = symbol !== null && (options.watchlistSymbols ?? []).map(cleanSymbol).includes(symbol);
  const timestamp = item.dataTimestamp ?? item.createdAt ?? item.notifiedAt ?? null;
  const limitations = uniqueText([
    item.evidenceLabel.toLowerCase().includes("limited") ? "Evidence is limited for this feed item." : null,
    timestamp ? null : "No data timestamp is attached to this feed item.",
    item.notificationEligible ? null : "This item stays in the feed and is not urgent enough for notification delivery.",
  ]);
  const personalization = uniqueText([
    watchlistRelevant && symbol ? `Shown because ${symbol} is on your watchlist.` : null,
    symbol ? `Shown because ${symbol} changed in the latest workflow packet.` : null,
    item.category ? `Shown in ${humanizeLabel(item.category)} because the update matched that awareness category.` : null,
  ]);
  return {
    auditability: uniqueText([
      `Feed item type: ${humanizeLabel(item.itemType)}.`,
      `Timestamp: ${timestamp ?? "not available"}.`,
      item.notificationEligible ? "Eligible for notification under current signal rules." : "Feed-only item under current signal rules.",
    ]),
    evidenceQuality: item.evidenceLabel,
    freshness: timestamp ? `Updated ${timestamp}` : "No timestamp available",
    headline: item.title,
    limitations: limitations.length ? limitations : [NO_LIMITATION],
    personalization: personalization.length ? personalization : ["Shown because it matched the current market awareness feed."],
    provenance: [
      {
        detail: item.summary,
        label: "What changed",
        tone: feedTone(item.severity),
        value: humanizeLabel(item.itemType),
      },
      {
        detail: item.whyItMatters,
        label: "Evidence",
        tone: item.evidenceLabel.toLowerCase().includes("limited") ? "caution" : "intelligence",
        value: item.evidenceLabel,
      },
      {
        detail: timestamp ? `Data timestamp ${timestamp}.` : "No timestamp is available.",
        label: "Timestamp",
        tone: timestamp ? "neutral" : "caution",
        value: timestamp ? "Available" : "Unavailable",
      },
      {
        detail: item.notificationEligible ? "This item can notify if user preferences allow it." : "This update is visible in feed only to avoid notification noise.",
        label: "Delivery",
        tone: item.notificationEligible ? "constructive" : "neutral",
        value: item.notificationEligible ? "Notify-ready" : "Feed only",
      },
    ],
    score: trustScore([item.notificationEligible ? 22 : 14, timestamp ? 18 : 8, item.evidenceLabel.toLowerCase().includes("limited") ? 8 : 18, watchlistRelevant ? 18 : 12, severityWeight(item.severity)]),
    summary: `${item.title} is shown because ${item.summary.toLowerCase()} ${item.notificationEligible ? "It is high-signal enough to be notification eligible." : "It remains feed-only to avoid noise."}`,
    traceability: uniqueText([
      `What changed: ${item.summary}`,
      `Why it matters: ${item.whyItMatters}`,
      `Monitor next: ${item.monitorNext}`,
      item.relatedSymbol ? `Related symbol: ${item.relatedSymbol}` : "Market-level item without a single related symbol.",
    ]),
    workflow: symbol ? [
      { href: item.actionHref, label: "Open detail", reason: "Review the primary context for this update." },
      { href: `/symbol/${encodeURIComponent(symbol)}`, label: "Open symbol", reason: "Inspect symbol-level evidence and risk." },
      { href: `/alerts?symbol=${encodeURIComponent(symbol)}&intent=create`, label: "Create alert", reason: "Monitor future condition changes." },
      { href: "/terminal#copilot", label: "Ask Copilot", reason: "Ask why this appeared or what changed." },
    ] : [
      { href: item.actionHref, label: "Open detail", reason: "Review the primary context for this update." },
      { href: "/terminal#market-charts", label: "Open charts", reason: "Inspect broader market context." },
      { href: "/history", label: "Open history", reason: "Review changes over time." },
      { href: "/terminal#copilot", label: "Ask Copilot", reason: "Ask why this appeared or what changed." },
    ],
  };
}

export function buildExplainabilityTrustModel(model: AIExplainabilityModel, options: ExplainabilityTrustOptions = {}): InstitutionalTrustModel {
  const symbol = cleanText(options.symbol, "this setup");
  const limitations = uniqueText([
    ...model.trustBadges.filter((badge) => badge.tone === "risk" || badge.tone === "caution").map((badge) => badge.detail),
    ...model.contradictions.map((contradiction) => contradiction.detail),
  ]);
  return {
    auditability: uniqueText([
      `Score basis: ${model.score.summary}`,
      `Confidence basis: ${model.confidence.summary}`,
      `Contradiction checks: ${model.contradictions.length}.`,
    ]),
    evidenceQuality: model.confidence.evidenceQuality,
    freshness: model.confidence.freshness,
    headline: `Trust layer for ${symbol}`,
    limitations: limitations.length ? limitations.slice(0, 4) : [NO_LIMITATION],
    personalization: ["Shown because this card explains the current scored intelligence packet."],
    provenance: [
      {
        detail: model.score.summary,
        label: "Score",
        tone: model.score.tone,
        value: model.score.label,
      },
      {
        detail: model.confidence.uncertainty,
        label: "Confidence",
        tone: model.confidence.tone,
        value: model.confidence.level,
      },
      {
        detail: model.confidence.freshness,
        label: "Freshness",
        tone: trustBadgeTone(model.trustBadges, "fresh"),
        value: firstTrustValue(model.trustBadges, "fresh") ?? "Tracked",
      },
      {
        detail: `${model.contradictions.length} contradiction check${model.contradictions.length === 1 ? "" : "s"} surfaced.`,
        label: "Uncertainty",
        tone: model.contradictions.length ? "caution" : "constructive",
        value: model.contradictions.length ? `${model.contradictions.length}` : "Clear",
      },
    ],
    score: trustScore([
      model.confidence.value * 0.32,
      model.contradictions.length ? Math.max(6, 24 - model.contradictions.length * 5) : 24,
      model.trustBadges.some((badge) => badge.tone === "risk") ? 8 : 18,
      model.trustBadges.some((badge) => badge.tone === "constructive") ? 18 : 12,
    ]),
    summary: model.beginnerSummary,
    traceability: uniqueText([
      ...model.score.dataSupport,
      model.confidence.whyChanged,
      model.mentalModel,
    ]),
    workflow: [
      { href: "/terminal#copilot", label: "Ask Copilot", reason: "Ask why confidence, risk, or freshness changed." },
      { href: "/history", label: "Open history", reason: "Review score and state changes over time." },
      { href: "/alerts", label: "Open alerts", reason: "Monitor risk changes without chasing." },
    ],
  };
}

function cleanSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "") || "N/A";
}

function evidenceTone(score: number | null): TrustTone {
  if (score === null) return "neutral";
  if (score >= 70) return "constructive";
  if (score >= 45) return "caution";
  return "risk";
}

function feedTone(severity: IntelligenceFeedItem["severity"]): TrustTone {
  if (severity === "positive") return "constructive";
  if (severity === "critical") return "risk";
  if (severity === "warning") return "caution";
  return "intelligence";
}

function firstTrustValue(badges: AIExplainabilityModel["trustBadges"], needle: string): string | null {
  const badge = badges.find((item) => item.label.toLowerCase().includes(needle) || item.detail.toLowerCase().includes(needle));
  return badge?.label ?? null;
}

function freshnessTone(status: OpportunityViewModel["dataFreshness"]["status"]): TrustTone {
  if (status === "fresh") return "constructive";
  if (status === "slightly_stale") return "caution";
  if (status === "stale") return "risk";
  return "caution";
}

function severityWeight(severity: IntelligenceFeedItem["severity"]): number {
  if (severity === "critical") return 18;
  if (severity === "warning") return 15;
  if (severity === "positive") return 18;
  return 12;
}

function signedNumber(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value, 1)}`;
}

function trustBadgeTone(badges: AIExplainabilityModel["trustBadges"], needle: string): TrustTone {
  const badge = badges.find((item) => item.label.toLowerCase().includes(needle) || item.detail.toLowerCase().includes(needle));
  return badge?.tone ?? "neutral";
}

function trustScore(parts: number[]): number {
  return Math.round(Math.max(0, Math.min(100, parts.reduce((sum, value) => sum + value, 0))));
}

function uniqueText(values: Array<string | null | undefined | false>): string[] {
  const output: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const text = cleanText(value, "");
    if (text && !output.includes(text)) output.push(text);
  }
  return output;
}
