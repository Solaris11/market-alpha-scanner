import type { ActiveAlertMatch } from "@/lib/active-alert-matches";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";
import { finiteNumber } from "@/lib/ui/formatters";
import type { LiveIntelligenceSystem, LiveOpportunityEscalation } from "./live-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";

export type MobileIntelligenceCategory = "copilot" | "fragility" | "macro" | "replay" | "shock" | "watchlist" | "what_changed";
export type MobileIntelligencePriority = "critical" | "high" | "low" | "medium";

export type MobileIntelligencePacket = {
  actionLabel: string;
  actionUrl: string;
  body: string;
  category: MobileIntelligenceCategory;
  evidenceLabel: string;
  id: string;
  priority: MobileIntelligencePriority;
  pushEligible: boolean;
  reasonCodes: string[];
  score: number;
  symbol: string | null;
  title: string;
  urgencyLabel: string;
};

export type MobileQuickAction = {
  href: string;
  label: string;
  summary: string;
};

export type MobileIntelligenceCenter = {
  deliveryPolicy: string[];
  generatedAt: string;
  limitations: string[];
  packets: MobileIntelligencePacket[];
  quickActions: MobileQuickAction[];
  summary: string;
};

export type MobileIntelligenceInput = {
  alertMatches?: ActiveAlertMatch[];
  generatedAt?: string;
  live: LiveIntelligenceSystem;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflow?: WorkflowEvolutionSummary | null;
};

const MAX_PACKETS = 12;

export function buildMobileIntelligenceCenter(input: MobileIntelligenceInput): MobileIntelligenceCenter {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const watchlist = new Set((input.watchlistSymbols ?? []).map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  const packets = dedupePackets([
    ...shockPackets(input.live.shockEscalations),
    ...macroPackets(input.live),
    ...fragilityPackets(input.rows, watchlist),
    ...watchlistPackets(input.workflow, input.alertMatches ?? [], watchlist),
    ...whatChangedPackets(input.workflow),
    ...replayPackets(input.workflow),
    copilotPacket(input.rows, input.live),
  ])
    .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority) || right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, MAX_PACKETS);

  return {
    deliveryPolicy: [
      "Push alerts are research context only and never override core WAIT / AVOID risk decisions.",
      "TradeVeto sends mobile alerts only from verified scanner, watchlist, workflow, and market-state data already present in the system.",
      "High-volatility, shock, and fragility alerts are intentionally labeled as high risk, not buy signals.",
    ],
    generatedAt,
    limitations: [
      "This is a mobile web app and push layer. Native App Store and Play Store shells still require a separate wrapper and signing workflow.",
      "Mobile push delivery requires browser permission and configured VAPID keys.",
      "iOS push support requires the app to be installed to the Home Screen in supported Safari versions.",
    ],
    packets,
    quickActions: [
      { href: "/terminal", label: "Open Terminal", summary: "See the current market state and priority stack." },
      { href: "/opportunities", label: "Review Opportunities", summary: "Compare risk-tolerant, shock, and core opportunities." },
      { href: "/alerts", label: "Tune Alerts", summary: "Adjust watchlist, price, score, and entry-zone alert rules." },
      { href: "/history", label: "Replay Decisions", summary: "Review what TradeVeto knew before or after key moves." },
      { href: "/support/chat", label: "Ask Copilot", summary: "Use concise research Q&A on mobile." },
    ],
    summary: summaryFor(packets, input.live),
  };
}

function shockPackets(escalations: LiveOpportunityEscalation[]): MobileIntelligencePacket[] {
  return escalations.slice(0, 3).map((item) => ({
    actionLabel: "Open symbol",
    actionUrl: `/symbol/${encodeURIComponent(item.symbol)}`,
    body: concise(item.detail, `${item.symbol} has elevated high-volatility research context. Watch entry quality and chase risk.`),
    category: "shock",
    evidenceLabel: `Shock ${item.shockScore}/100 · Volume ${item.unusualVolumeScore}/100`,
    id: `shock:${item.symbol}`,
    priority: priorityFor(item.score),
    pushEligible: item.score >= 70,
    reasonCodes: ["MOBILE_SHOCK_ALERT", item.state.toUpperCase().replace(/\s+/g, "_")],
    score: item.score,
    symbol: item.symbol,
    title: `${item.symbol} high-volatility watch`,
    urgencyLabel: urgencyFor(item.score),
  }));
}

function macroPackets(live: LiveIntelligenceSystem): MobileIntelligencePacket[] {
  return live.alerts
    .filter((alert) => alert.reasonCodes.some((code) => code.includes("REGIME") || code.includes("VOLATILITY") || code.includes("BREADTH") || code.includes("LIQUIDITY")))
    .slice(0, 2)
    .map((alert, index) => ({
      actionLabel: "Open live panel",
      actionUrl: "/terminal#live-intelligence",
      body: concise(alert.detail, "Market structure is changing enough to review current opportunities with more caution."),
      category: "macro",
      evidenceLabel: `Market state: ${live.marketState}`,
      id: `macro:${index}:${alert.title}`,
      priority: priorityFor(alert.score),
      pushEligible: alert.score >= 72,
      reasonCodes: ["MOBILE_MACRO_ALERT", ...alert.reasonCodes],
      score: alert.score,
      symbol: null,
      title: alert.title,
      urgencyLabel: urgencyFor(alert.score),
    }));
}

function fragilityPackets(rows: OpportunityViewModel[], watchlist: Set<string>): MobileIntelligencePacket[] {
  return rows
    .filter((row) => row.fragility >= 70 || (watchlist.has(row.symbol) && row.fragility >= 62))
    .sort((left, right) => right.fragility - left.fragility || left.symbol.localeCompare(right.symbol))
    .slice(0, 3)
    .map((row) => ({
      actionLabel: "Review risk",
      actionUrl: `/symbol/${encodeURIComponent(row.symbol)}`,
      body: `${row.symbol} fragility is elevated. Review invalidation, chase risk, and whether the setup still fits your risk profile.`,
      category: "fragility",
      evidenceLabel: `${row.fragilityLabel} · Score ${Math.round(row.fragility)}/100`,
      id: `fragility:${row.symbol}`,
      priority: priorityFor(row.fragility),
      pushEligible: row.fragility >= 74,
      reasonCodes: ["MOBILE_FRAGILITY_ALERT"],
      score: Math.round(row.fragility),
      symbol: row.symbol,
      title: `${row.symbol} fragility rising`,
      urgencyLabel: urgencyFor(row.fragility),
    }));
}

function watchlistPackets(workflow: WorkflowEvolutionSummary | null | undefined, alerts: ActiveAlertMatch[], watchlist: Set<string>): MobileIntelligencePacket[] {
  const workflowItems = (workflow?.watchlistEvolution ?? []).slice(0, 3).map((item) => packetFromWorkflowChange(item, "watchlist"));
  const alertItems = alerts
    .filter((match) => watchlist.has(match.symbol) || match.scope === "watchlist" || match.scope === "symbol")
    .slice(0, 3)
    .map((match) => ({
      actionLabel: "Open symbol",
      actionUrl: `/symbol/${encodeURIComponent(match.symbol)}`,
      body: `${match.match_reason}. Entry status is ${match.entry_status.toLowerCase()}.`,
      category: "watchlist" as const,
      evidenceLabel: `${match.signal} · ${match.notification_status}`,
      id: `watchlist-alert:${match.symbol}:${match.signal}`,
      priority: match.signal.includes("STOP") ? "high" as const : "medium" as const,
      pushEligible: match.signal.includes("STOP") || match.signal.includes("BUY ZONE") || match.signal.includes("NEAR ENTRY"),
      reasonCodes: ["MOBILE_WATCHLIST_ALERT", match.signal.replace(/\s+/g, "_")],
      score: match.signal.includes("STOP") ? 78 : 64,
      symbol: match.symbol,
      title: `${match.symbol} watchlist alert`,
      urgencyLabel: match.signal.includes("STOP") ? "Review now" : "Watch closely",
    }));
  return [...workflowItems, ...alertItems];
}

function whatChangedPackets(workflow: WorkflowEvolutionSummary | null | undefined): MobileIntelligencePacket[] {
  return (workflow?.whatChanged ?? []).slice(0, 3).map((item) => packetFromWorkflowChange(item, "what_changed"));
}

function replayPackets(workflow: WorkflowEvolutionSummary | null | undefined): MobileIntelligencePacket[] {
  if (!workflow?.lastSeenAt) return [];
  return [
    {
      actionLabel: "Open history",
      actionUrl: "/history",
      body: "A new decision replay baseline is available. Review what changed since your last visit before acting on stale assumptions.",
      category: "replay",
      evidenceLabel: `Last visit ${new Date(workflow.lastSeenAt).toLocaleDateString()}`,
      id: "replay:last-visit",
      priority: "medium",
      pushEligible: false,
      reasonCodes: ["MOBILE_REPLAY_SUMMARY"],
      score: 60,
      symbol: null,
      title: "Replay summary ready",
      urgencyLabel: "Review when ready",
    },
  ];
}

function copilotPacket(rows: OpportunityViewModel[], live: LiveIntelligenceSystem): MobileIntelligencePacket {
  const top = rows
    .filter((row) => (row.final_score ?? 0) >= 55)
    .sort((left, right) => (right.final_score ?? 0) - (left.final_score ?? 0))[0];
  return {
    actionLabel: "Ask Copilot",
    actionUrl: "/support/chat",
    body: top
      ? `Ask why ${top.symbol} ranks where it does, what could break the setup, and what changed in the latest ${live.marketState.toLowerCase()} context.`
      : "Ask what matters most now, why opportunities are sparse, or which watchlist symbols changed.",
    category: "copilot",
    evidenceLabel: "Grounded in latest scanner packet",
    id: "copilot:mobile-research",
    priority: "low",
    pushEligible: false,
    reasonCodes: ["MOBILE_COPILOT_WORKFLOW"],
    score: 45,
    symbol: top?.symbol ?? null,
    title: "Mobile research copilot",
    urgencyLabel: "Ask on demand",
  };
}

function packetFromWorkflowChange(item: WorkflowChangeItem, category: "watchlist" | "what_changed"): MobileIntelligencePacket {
  const score = scoreForWorkflowChange(item);
  return {
    actionLabel: item.symbol === "WORKFLOW" ? "Open mobile" : "Open symbol",
    actionUrl: item.symbol === "WORKFLOW" ? "/mobile" : `/symbol/${encodeURIComponent(item.symbol)}`,
    body: concise(item.detail, `${item.title} for ${item.symbol}.`),
    category,
    evidenceLabel: item.metricLabel,
    id: `${category}:${item.symbol}:${item.changeType}`,
    priority: priorityFor(score),
    pushEligible: score >= 68 && item.symbol !== "WORKFLOW",
    reasonCodes: [`MOBILE_${category.toUpperCase()}_ALERT`, item.changeType.toUpperCase()],
    score,
    symbol: item.symbol === "WORKFLOW" ? null : item.symbol,
    title: item.title,
    urgencyLabel: urgencyFor(score),
  };
}

function summaryFor(packets: MobileIntelligencePacket[], live: LiveIntelligenceSystem): string {
  const highPriority = packets.filter((packet) => packet.priority === "critical" || packet.priority === "high").length;
  const pushReady = packets.filter((packet) => packet.pushEligible).length;
  if (highPriority > 0) {
    return `${highPriority} higher-priority mobile update${highPriority === 1 ? "" : "s"} detected. ${pushReady} update${pushReady === 1 ? "" : "s"} are eligible for push when permissions and delivery keys are configured.`;
  }
  return `Mobile intelligence is tracking ${live.marketState.toLowerCase()} conditions with no critical push alert in the latest packet.`;
}

function scoreForWorkflowChange(item: WorkflowChangeItem): number {
  const metricValue = finiteNumber(item.metricLabel);
  const base = item.severity === "warning" ? 72 : item.severity === "positive" ? 64 : 52;
  return Math.round(Math.max(base, Math.min(90, base + Math.abs(metricValue ?? 0))));
}

function priorityFor(score: number): MobileIntelligencePriority {
  if (score >= 84) return "critical";
  if (score >= 70) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function urgencyFor(score: number): string {
  if (score >= 84) return "High priority";
  if (score >= 70) return "Review soon";
  if (score >= 55) return "Watch closely";
  return "Low urgency";
}

function priorityRank(priority: MobileIntelligencePriority): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function dedupePackets(packets: MobileIntelligencePacket[]): MobileIntelligencePacket[] {
  const seen = new Set<string>();
  const output: MobileIntelligencePacket[] = [];
  for (const packet of packets) {
    const key = `${packet.category}:${packet.symbol ?? "market"}:${packet.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(packet);
  }
  return output;
}

function concise(value: string, fallback: string): string {
  const text = String(value ?? "").trim() || fallback;
  return text.replace(/\s+/g, " ").slice(0, 220);
}

function cleanSymbol(value: unknown): string | null {
  const text = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return text || null;
}
