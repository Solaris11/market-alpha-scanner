import type { OpportunityViewModel } from "./opportunity-view-model";
import { finiteNumber, formatNumber } from "@/lib/ui/formatters";
import { humanizeInsightText, humanizeLabel } from "@/lib/ui/labels";

export type TeamWorkspaceRole = "owner" | "admin" | "analyst" | "viewer";

export type TeamWorkspace = {
  createdAt: string;
  description: string | null;
  id: string;
  name: string;
  ownerUserId: string;
  slug: string;
  updatedAt: string;
};

export type TeamWorkspaceMember = {
  createdAt: string;
  displayName: string | null;
  email: string | null;
  role: TeamWorkspaceRole;
  userId: string;
};

export type TeamWorkspaceWatchSymbol = {
  addedByUserId: string | null;
  createdAt: string;
  note: string | null;
  symbol: string;
};

export type TeamResearchNote = {
  body: string;
  createdAt: string;
  createdByUserId: string | null;
  id: string;
  symbol: string | null;
  title: string;
  visibility: "admins" | "team";
};

export type TeamAuditEvent = {
  action: string;
  actorUserId: string | null;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown>;
  targetId: string | null;
  targetType: string;
};

export type TeamRoleCapabilities = {
  canAdmin: boolean;
  canEditResearch: boolean;
  canInvite: boolean;
  canManageWatchlist: boolean;
  canView: boolean;
  label: string;
};

export type TeamWorkspaceMetric = {
  detail: string;
  key: string;
  label: string;
  tone: "constructive" | "neutral" | "risk";
  value: string;
};

export type TeamOpportunityPriority = {
  attentionScore: number;
  companyName: string | null;
  currentDecision: string;
  entryContext: string;
  eventContext: string;
  keyReason: string;
  keyRisk: string;
  macroContext: string;
  opportunityScore: number;
  riskScore: number;
  symbol: string;
  tags: string[];
};

export type TeamRiskItem = {
  detail: string;
  label: string;
  score: number;
  symbol: string;
};

export type TeamWorkspaceSystem = {
  auditTrail: TeamAuditEvent[];
  generatedAt: string;
  limitations: string[];
  members: TeamWorkspaceMember[];
  metrics: TeamWorkspaceMetric[];
  researchNotes: TeamResearchNote[];
  role: TeamWorkspaceRole;
  roleCapabilities: TeamRoleCapabilities;
  sharedWatchlist: TeamWorkspaceWatchSymbol[];
  teamBriefing: string[];
  topSharedOpportunities: TeamOpportunityPriority[];
  watchlistRisks: TeamRiskItem[];
  workspace: TeamWorkspace;
  workspaceHealthScore: number;
};

export type TeamWorkspaceIntelligenceInput = {
  auditTrail?: TeamAuditEvent[];
  generatedAt?: string;
  members: TeamWorkspaceMember[];
  notes?: TeamResearchNote[];
  role: TeamWorkspaceRole;
  rows: OpportunityViewModel[];
  sharedWatchlist: TeamWorkspaceWatchSymbol[];
  workspace: TeamWorkspace;
};

export function teamRoleCapabilities(role: TeamWorkspaceRole): TeamRoleCapabilities {
  const canAdmin = role === "owner" || role === "admin";
  const canEditResearch = canAdmin || role === "analyst";
  return {
    canAdmin,
    canEditResearch,
    canInvite: canAdmin,
    canManageWatchlist: canEditResearch,
    canView: true,
    label: humanizeLabel(role),
  };
}

export function buildTeamWorkspaceIntelligence(input: TeamWorkspaceIntelligenceInput): TeamWorkspaceSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const watchlistSymbols = new Set(input.sharedWatchlist.map((item) => item.symbol.toUpperCase()));
  const scopedRows = watchlistSymbols.size ? input.rows.filter((row) => watchlistSymbols.has(row.symbol.toUpperCase())) : input.rows;
  const topSharedOpportunities = scopedRows
    .map((row) => priorityForRow(row, watchlistSymbols.has(row.symbol.toUpperCase())))
    .sort((left, right) => right.attentionScore - left.attentionScore || right.opportunityScore - left.opportunityScore)
    .slice(0, 8);
  const watchlistRisks = scopedRows
    .filter((row) => row.fragility >= 62 || riskScoreForRow(row) >= 62)
    .map((row) => ({
      detail: riskDetail(row),
      label: row.fragilityLabel || "Risk elevated",
      score: riskScoreForRow(row),
      symbol: row.symbol,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
  const workspaceHealthScore = workspaceHealth(input, topSharedOpportunities, watchlistRisks);

  return {
    auditTrail: input.auditTrail ?? [],
    generatedAt,
    limitations: [
      "Team intelligence is a shared research layer built from persisted TradeVeto signals and team activity.",
      "Roles control collaborative research and watchlist changes; private account data remains user-scoped.",
      "Research context only. Not financial advice.",
    ],
    members: input.members,
    metrics: teamMetrics(input, workspaceHealthScore, topSharedOpportunities, watchlistRisks),
    researchNotes: input.notes ?? [],
    role: input.role,
    roleCapabilities: teamRoleCapabilities(input.role),
    sharedWatchlist: input.sharedWatchlist,
    teamBriefing: teamBriefing(input, topSharedOpportunities, watchlistRisks),
    topSharedOpportunities,
    watchlistRisks,
    workspace: input.workspace,
    workspaceHealthScore,
  };
}

function priorityForRow(row: OpportunityViewModel, sharedWatchSymbol: boolean): TeamOpportunityPriority {
  const score = opportunityScoreForRow(row, sharedWatchSymbol);
  const riskScore = riskScoreForRow(row);
  const attentionScore = clamp(Math.round(score * 0.68 + Math.max(0, 100 - riskScore) * 0.12 + row.conviction * 0.2));
  return {
    attentionScore,
    companyName: row.company_name,
    currentDecision: humanizeLabel(row.final_decision ?? "Watch"),
    entryContext: row.entryZoneLabel ? `Research entry context: ${row.entryZoneLabel}` : "Research entry context requires confirmation from the latest setup.",
    eventContext: row.eventLabel,
    keyReason: reasonForRow(row),
    keyRisk: riskDetail(row),
    macroContext: row.macroLabel,
    opportunityScore: score,
    riskScore,
    symbol: row.symbol,
    tags: tagsForRow(row, score, riskScore),
  };
}

function teamMetrics(
  input: TeamWorkspaceIntelligenceInput,
  workspaceHealthScore: number,
  opportunities: TeamOpportunityPriority[],
  risks: TeamRiskItem[],
): TeamWorkspaceMetric[] {
  const noteCount = input.notes?.length ?? 0;
  return [
    {
      detail: "Blends shared watchlist coverage, current opportunity quality, and elevated risk concentration.",
      key: "workspace_health",
      label: "Workspace Health",
      tone: workspaceHealthScore >= 68 ? "constructive" : workspaceHealthScore >= 45 ? "neutral" : "risk",
      value: String(workspaceHealthScore),
    },
    {
      detail: "Symbols visible to the workspace research team.",
      key: "shared_watchlist",
      label: "Shared Watchlist",
      tone: input.sharedWatchlist.length ? "constructive" : "neutral",
      value: String(input.sharedWatchlist.length),
    },
    {
      detail: "Highest attention candidates from the shared universe.",
      key: "team_priorities",
      label: "Team Priorities",
      tone: opportunities.length ? "constructive" : "neutral",
      value: String(opportunities.length),
    },
    {
      detail: "Shared notes and recent audit events make collaboration reviewable.",
      key: "research_activity",
      label: "Research Activity",
      tone: noteCount || input.auditTrail?.length ? "constructive" : "neutral",
      value: `${noteCount} notes`,
    },
    {
      detail: "High-fragility symbols that deserve shared review before action.",
      key: "risk_reviews",
      label: "Risk Reviews",
      tone: risks.length ? "risk" : "constructive",
      value: String(risks.length),
    },
  ];
}

function teamBriefing(input: TeamWorkspaceIntelligenceInput, opportunities: TeamOpportunityPriority[], risks: TeamRiskItem[]): string[] {
  const lines: string[] = [];
  if (opportunities[0]) {
    lines.push(`${opportunities[0].symbol} is the highest team attention candidate because ${opportunities[0].keyReason.toLowerCase()}`);
  } else if (input.sharedWatchlist.length) {
    lines.push("Shared symbols are saved, but none currently clear the team opportunity threshold.");
  } else {
    lines.push("Start by adding shared symbols so the team dashboard can rank common research priorities.");
  }

  if (risks[0]) {
    lines.push(`${risks[0].symbol} deserves risk review: ${risks[0].detail}`);
  } else {
    lines.push("No shared symbol currently has a dominant fragility warning from the latest scanner context.");
  }

  const analysts = input.members.filter((member) => member.role === "analyst" || member.role === "admin" || member.role === "owner").length;
  lines.push(`${formatNumber(input.members.length)} workspace member${input.members.length === 1 ? "" : "s"} configured; ${formatNumber(analysts)} can edit research and shared watchlists.`);
  return lines.slice(0, 4);
}

function workspaceHealth(input: TeamWorkspaceIntelligenceInput, opportunities: TeamOpportunityPriority[], risks: TeamRiskItem[]): number {
  const watchlistDepth = clamp(input.sharedWatchlist.length * 12, 0, 36);
  const opportunityQuality = average(opportunities.slice(0, 5).map((item) => item.opportunityScore)) ?? 45;
  const riskDrag = average(risks.map((item) => item.score)) ?? 45;
  const collaboration = clamp((input.notes?.length ?? 0) * 4 + input.members.length * 6, 0, 22);
  return clamp(Math.round(30 + watchlistDepth * 0.45 + opportunityQuality * 0.35 - Math.max(0, riskDrag - 55) * 0.2 + collaboration));
}

function opportunityScoreForRow(row: OpportunityViewModel, sharedWatchSymbol: boolean): number {
  const base = scoreValue(row.final_score, 45);
  const shock = row.shockPattern?.opportunityScore ?? row.shockPattern?.upsideShockScore ?? 45;
  const evidence = row.evidence?.confidenceReliability ?? row.evidence?.analogQualityScore ?? 50;
  const macro = numericField(row.raw.macro_alignment_score ?? row.raw.macro_score, 50);
  const watchlistBoost = sharedWatchSymbol ? 7 : 0;
  return clamp(Math.round(base * 0.34 + row.conviction * 0.22 + shock * 0.17 + macro * 0.12 + evidence * 0.08 + watchlistBoost));
}

function riskScoreForRow(row: OpportunityViewModel): number {
  const shockRisk = row.shockPattern?.downsideRiskScore ?? row.shockPattern?.chaseRiskScore ?? row.fragility;
  const volatility = numericField(row.raw.volatility_pressure, row.fragility);
  const eventRisk = row.eventRisk;
  return clamp(Math.round(row.fragility * 0.42 + shockRisk * 0.24 + volatility * 0.2 + eventRisk * 0.14));
}

function reasonForRow(row: OpportunityViewModel): string {
  if (row.narrative?.narrativeSummary) return cleanSentence(row.narrative.narrativeSummary);
  if (row.decision_reason) return cleanSentence(row.decision_reason);
  if (row.shockPattern?.opportunityState) return `Historically similar setups showed ${row.shockPattern.opportunityState.toLowerCase()} context.`;
  return `${row.structuralLabel} with ${row.macroLabel.toLowerCase()} context.`;
}

function riskDetail(row: OpportunityViewModel): string {
  if (row.shockPattern?.chaseRiskLabel && row.shockPattern.chaseRiskLabel.toLowerCase() !== "low") {
    return `${row.shockPattern.chaseRiskLabel} chase risk with ${row.fragilityLabel.toLowerCase()} fragility.`;
  }
  if (row.eventRisk >= 65) return `${row.eventLabel} and ${row.fragilityLabel.toLowerCase()} fragility.`;
  if (row.fragility >= 65) return `${row.fragilityLabel} fragility can weaken follow-through.`;
  return `${row.macroLabel} with ${row.fragilityLabel.toLowerCase()} fragility.`;
}

function tagsForRow(row: OpportunityViewModel, score: number, riskScore: number): string[] {
  const tags = [row.macroLabel, row.eventLabel].filter((item) => item && item !== "No verified event catalyst");
  if (score >= 70) tags.push("High team priority");
  if ((row.shockPattern?.upsideShockScore ?? 0) >= 65) tags.push("Shock potential");
  if (riskScore >= 68) tags.push("Risk review");
  if (row.entryZoneLabel) tags.push("Entry context available");
  return Array.from(new Set(tags)).slice(0, 5);
}

function cleanSentence(value: string): string {
  const text = humanizeInsightText(value, "").replace(/\s+/g, " ").trim();
  return text.endsWith(".") ? text : `${text}.`;
}

function numericField(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value);
  return parsed === null || Number.isNaN(parsed) ? fallback : parsed;
}

function scoreValue(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function average(values: number[]): number | null {
  const cleaned = values.filter((value) => Number.isFinite(value));
  if (!cleaned.length) return null;
  return cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
