import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  WORKSPACE_MODE_LABELS,
  moduleLabel,
  type WorkspacePreferences,
} from "@/lib/trading/workspace-preferences";
import type { WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";

export type DailyDriverTone = "amber" | "cyan" | "emerald" | "rose" | "slate" | "violet";
export type DailyDriverStatus = "blocked" | "partial" | "ready";

export type DailyDriverFunnelStage = {
  detail: string;
  key:
    | "activation"
    | "first_useful_action"
    | "watchlist_anchor"
    | "scanner_reuse"
    | "replay_reuse"
    | "strategy_reuse"
    | "workflow_continuity"
    | "friction_control";
  label: string;
  targetLabel: string;
  tone: DailyDriverTone;
  value: number;
};

export type DailyDriverAction = {
  continuityLabel: string;
  detail: string;
  firstUsefulAction: boolean;
  href: string;
  key:
    | "create_watchlist"
    | "create_alert"
    | "morning_brief"
    | "review_replay"
    | "review_watchlist"
    | "save_scanner"
    | "strategy_review"
    | "workflow_restore";
  label: string;
  metricLabel: string;
  priority: number;
  status: DailyDriverStatus;
  symbol: string | null;
  tone: DailyDriverTone;
  workflow: "alerts" | "macro" | "replay" | "scanner" | "strategy" | "terminal" | "watchlist";
};

export type DailyDriverHabitLoop = {
  detail: string;
  href: string;
  key: "alert_return" | "macro_check" | "morning_check" | "replay_review" | "scanner_reuse" | "strategy_evolution" | "watchlist_movement";
  nextActionLabel: string;
  proofEvent: string;
  status: DailyDriverStatus;
  title: string;
  tone: DailyDriverTone;
};

export type DailyDriverContextItem = {
  detail: string;
  href: string | null;
  label: string;
  tone: DailyDriverTone;
  value: string;
};

export type DailyDriverRetentionModel = {
  activationScore: number;
  blockers: string[];
  continuity: DailyDriverContextItem[];
  funnel: DailyDriverFunnelStage[];
  habitLoops: DailyDriverHabitLoop[];
  personalization: DailyDriverContextItem[];
  primaryActions: DailyDriverAction[];
  proofBoundary: string;
  summary: string;
};

export type DailyDriverRetentionInput = {
  marketCondition: string;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
  workspacePreferences?: WorkspacePreferences | null;
};

type ScoredOpportunity = {
  opportunityScore: number;
  replayScore: number;
  riskScore: number;
  row: OpportunityViewModel;
};

export function buildDailyDriverRetentionModel(input: DailyDriverRetentionInput): DailyDriverRetentionModel {
  const rows = input.rows;
  const watchlistSymbols = normalizeSymbols(input.watchlistSymbols ?? []);
  const preferences = input.workspacePreferences ?? DEFAULT_WORKSPACE_PREFERENCES;
  const workflowEvolution = input.workflowEvolution ?? null;
  const scoredRows = rows.map((row) => scoreOpportunity(row));
  const topOpportunity = [...scoredRows].sort((left, right) => right.opportunityScore - left.opportunityScore)[0] ?? null;
  const topRisk = [...scoredRows].sort((left, right) => right.riskScore - left.riskScore)[0] ?? null;
  const topReplay = [...scoredRows].sort((left, right) => right.replayScore - left.replayScore)[0] ?? null;
  const watchlistRows = scoredRows.filter((item) => watchlistSymbols.includes(item.row.symbol));
  const topWatchlist = [...watchlistRows].sort((left, right) => right.opportunityScore - left.opportunityScore || right.riskScore - left.riskScore)[0] ?? null;

  const replayCandidateCount = scoredRows.filter((item) => item.replayScore >= 45).length;
  const workflowChangeCount = (workflowEvolution?.whatChanged.length ?? 0) + (workflowEvolution?.watchlistEvolution.length ?? 0);
  const triggerMonitorCount = workflowEvolution?.triggerMonitors.length ?? 0;
  const persistedWorkspace = Boolean(preferences.updatedAt);
  const favoriteModuleCount = preferences.favoriteModules.length;
  const watchlistScore = watchlistSymbols.length ? clamp(34 + watchlistSymbols.length * 12) : 0;
  const firstUsefulActionReadiness = clamp(weightedAverage([
    [watchlistSymbols.length ? 82 : 18, 0.32],
    [rows.length ? 78 : 0, 0.24],
    [replayCandidateCount ? 72 : 24, 0.18],
    [persistedWorkspace ? 80 : 36, 0.16],
    [triggerMonitorCount ? 70 : 30, 0.10],
  ]));
  const scannerReuseScore = clamp(rows.length >= 250 ? 92 : rows.length >= 100 ? 82 : rows.length >= 30 ? 64 : rows.length ? 44 : 0);
  const replayReuseScore = clamp(replayCandidateCount >= 8 ? 88 : replayCandidateCount >= 3 ? 72 : replayCandidateCount > 0 ? 52 : 18);
  const strategyReuseScore = clamp((topOpportunity?.opportunityScore ?? 0) * 0.55 + (topRisk?.riskScore ?? 0) * 0.22 + (preferences.preferredRiskStyle === "balanced" ? 18 : 24));
  const continuityScore = clamp((workflowEvolution?.lastSeenAt ? 38 : 14) + workflowChangeCount * 7 + triggerMonitorCount * 4 + (persistedWorkspace ? 24 : 0) + Math.min(16, watchlistSymbols.length * 4));
  const frictionControlScore = 72;

  const funnel: DailyDriverFunnelStage[] = [
    stage("activation", "Activation", rows.length ? 100 : 0, "Terminal opens", `${rows.length.toLocaleString()} validated scanner rows are available for today's command workflow.`),
    stage("first_useful_action", "First useful action", firstUsefulActionReadiness, "35%+ users", watchlistSymbols.length ? "Watchlist, scanner, replay, alerts, and strategy actions are one click from the Terminal." : "The first watchlist action is still the highest-friction missing activation step."),
    stage("watchlist_anchor", "Watchlist anchor", watchlistScore, "20%+ retention", watchlistSymbols.length ? `${watchlistSymbols.length} tracked symbol${watchlistSymbols.length === 1 ? "" : "s"} can drive return visits.` : "No tracked symbols are present, so return-loop personalization is weak."),
    stage("scanner_reuse", "Scanner reuse", scannerReuseScore, "Repeat scans", rows.length ? "Scanner and discovery routes are exposed as first-class daily actions." : "Scanner data is not available for this session."),
    stage("replay_reuse", "Replay reuse", replayReuseScore, "Replay return", replayCandidateCount ? `${replayCandidateCount} replay or shock-context candidates can pull users into research review.` : "Replay habit loops need more current candidates."),
    stage("strategy_reuse", "Strategy reuse", strategyReuseScore, "Strategy return", "Strategy Labs is now connected from the daily driver panel, but real repeat usage still requires telemetry proof."),
    stage("workflow_continuity", "Workflow continuity", continuityScore, "25%+ sticky", workflowEvolution?.lastSeenAt ? `Returning workflow memory exists from ${workflowEvolution.lastSeenAt}.` : "Workflow memory is starting from this visit."),
    stage("friction_control", "Friction control", frictionControlScore, "Low rage/abandon", "Behavior telemetry is active for rage clicks, duplicate clicks, modal abandonment, and scroll abandonment."),
  ];

  const activationScore = Math.round(weightedAverage(funnel.map((item) => [item.value, item.key === "friction_control" ? 0.08 : 0.132] as [number, number])));
  const primaryActions = buildActions({
    preferences,
    topOpportunity,
    topReplay,
    topRisk,
    topWatchlist,
    watchlistSymbols,
    workflowEvolution,
  }).sort((left, right) => right.priority - left.priority).slice(0, 6);

  const habitLoops = buildHabitLoops({
    replayCandidateCount,
    topOpportunity,
    topReplay,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });

  const continuity = buildContinuity({ preferences, triggerMonitorCount, watchlistSymbols, workflowEvolution });
  const personalization = buildPersonalization({ preferences, rows, watchlistSymbols });
  const blockers = buildBlockers({ persistedWorkspace, replayCandidateCount, watchlistSymbols, workflowEvolution });
  const summary = summaryFor({ activationScore, blockers, marketCondition: input.marketCondition, watchlistCount: watchlistSymbols.length });

  return {
    activationScore,
    blockers,
    continuity,
    funnel,
    habitLoops,
    personalization,
    primaryActions,
    proofBoundary: "This panel improves and instruments daily-driver workflows. It does not claim retention victory until production cohorts show better 2-day and 7-day retention.",
    summary,
  };
}

function buildActions(input: {
  preferences: WorkspacePreferences;
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topRisk: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverAction[] {
  const actions: DailyDriverAction[] = [];
  actions.push({
    continuityLabel: input.workflowEvolution?.lastSeenAt ? "Returning workflow" : "Start today's baseline",
    detail: "Start with the command center, daily developments, top setups, danger, and money flow before deeper research.",
    firstUsefulAction: false,
    href: "#daily-market-command",
    key: "morning_brief",
    label: "Run morning intelligence check",
    metricLabel: input.workflowEvolution?.whatChanged.length ? `${input.workflowEvolution.whatChanged.length} changes` : "Daily command",
    priority: 88,
    status: "ready",
    symbol: null,
    tone: "cyan",
    workflow: "terminal",
  });

  if (input.watchlistSymbols.length) {
    const watchSymbol = input.topWatchlist?.row.symbol ?? input.watchlistSymbols[0] ?? null;
    actions.push({
      continuityLabel: "Watchlist return loop",
      detail: watchSymbol ? `${watchSymbol} anchors the next watchlist review. Track what changed before opening new research.` : "Review tracked symbols and their current risk/opportunity drift.",
      firstUsefulAction: true,
      href: watchSymbol ? `/symbol/${watchSymbol}` : "/terminal#daily-driver-retention",
      key: "review_watchlist",
      label: "Review watchlist movement",
      metricLabel: `${input.watchlistSymbols.length} saved`,
      priority: 92,
      status: "ready",
      symbol: watchSymbol,
      tone: "emerald",
      workflow: "watchlist",
    });
  } else {
    const symbol = input.topOpportunity?.row.symbol ?? null;
    actions.push({
      continuityLabel: "Activation gap",
      detail: symbol ? `Start with ${symbol}, then save a small tracked list so future visits can show what changed.` : "Create a tracked list so future sessions can prioritize symbols that matter to you.",
      firstUsefulAction: true,
      href: symbol ? `/symbol/${symbol}` : "/discover",
      key: "create_watchlist",
      label: "Create first watchlist",
      metricLabel: "0 saved",
      priority: 100,
      status: "blocked",
      symbol,
      tone: "amber",
      workflow: "watchlist",
    });
  }

  actions.push({
    continuityLabel: input.preferences.updatedAt ? "Preferences persisted" : "Saveable workflow",
    detail: "Open discovery, apply a scanner lens, then save the scan or reuse it as a daily market pass.",
    firstUsefulAction: true,
    href: "/discover",
    key: "save_scanner",
    label: "Save or reuse scanner preset",
    metricLabel: input.preferences.updatedAt ? "Workspace saved" : "Preset needed",
    priority: input.preferences.updatedAt ? 72 : 90,
    status: input.preferences.updatedAt ? "ready" : "partial",
    symbol: null,
    tone: "violet",
    workflow: "scanner",
  });

  const replaySymbol = input.topReplay?.row.symbol ?? input.topOpportunity?.row.symbol ?? null;
  actions.push({
    continuityLabel: input.topReplay && input.topReplay.replayScore >= 45 ? "Replay candidate" : "Limited replay evidence",
    detail: replaySymbol ? `${replaySymbol} has the best available replay or volatility-memory context for this session.` : "Open replay history when enough symbol context is available.",
    firstUsefulAction: true,
    href: replaySymbol ? `/history?symbol=${replaySymbol}` : "/history",
    key: "review_replay",
    label: "Review replay context",
    metricLabel: input.topReplay ? `${Math.round(input.topReplay.replayScore)}/100 replay` : "Replay",
    priority: input.topReplay && input.topReplay.replayScore >= 45 ? 84 : 58,
    status: input.topReplay && input.topReplay.replayScore >= 45 ? "ready" : "partial",
    symbol: replaySymbol,
    tone: "cyan",
    workflow: "replay",
  });

  actions.push({
    continuityLabel: input.topRisk ? "Risk-aware strategy" : "Strategy baseline",
    detail: input.topRisk ? `${input.topRisk.row.symbol} is the current risk reference. Strategy Labs should review allocation behavior around that type of fragility.` : "Review how portfolio logic behaves before relying on any simulated strategy.",
    firstUsefulAction: true,
    href: "/strategy-labs",
    key: "strategy_review",
    label: "Run strategy evolution review",
    metricLabel: input.preferences.preferredRiskStyle,
    priority: 70,
    status: "partial",
    symbol: input.topRisk?.row.symbol ?? null,
    tone: "emerald",
    workflow: "strategy",
  });

  actions.push({
    continuityLabel: "Alert-driven return",
    detail: "Create a watchlist or global alert so TradeVeto has a concrete reason to bring you back.",
    firstUsefulAction: true,
    href: "/alerts",
    key: "create_alert",
    label: "Create return alert",
    metricLabel: "Return trigger",
    priority: input.watchlistSymbols.length ? 82 : 74,
    status: input.watchlistSymbols.length ? "ready" : "partial",
    symbol: null,
    tone: "rose",
    workflow: "alerts",
  });

  return actions;
}

function buildHabitLoops(input: {
  replayCandidateCount: number;
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverHabitLoop[] {
  const symbol = input.topOpportunity?.row.symbol ?? null;
  const replaySymbol = input.topReplay?.row.symbol ?? symbol;
  return [
    {
      detail: input.workflowEvolution?.dailyBrief[0] ?? "Open Terminal first to see market state, what changed, money flow, and top risk.",
      href: "/terminal#daily-market-command",
      key: "morning_check",
      nextActionLabel: "Open command center",
      proofEvent: "terminal_open + first_useful_action",
      status: "ready",
      title: "Morning intelligence check",
      tone: "cyan",
    },
    {
      detail: input.watchlistSymbols.length ? `${input.watchlistSymbols.length} tracked symbol${input.watchlistSymbols.length === 1 ? "" : "s"} can create a personalized return loop.` : "Missing watchlist anchor is the biggest activation blocker.",
      href: symbol ? `/symbol/${symbol}` : "/discover",
      key: "watchlist_movement",
      nextActionLabel: input.watchlistSymbols.length ? "Review tracked symbols" : "Create watchlist",
      proofEvent: "watchlist_add + watchlist_retention",
      status: input.watchlistSymbols.length ? "ready" : "blocked",
      title: "Watchlist movement",
      tone: input.watchlistSymbols.length ? "emerald" : "amber",
    },
    {
      detail: "Use dense scanner and saved presets as a repeatable daily scan instead of one-off browsing.",
      href: "/discover",
      key: "scanner_reuse",
      nextActionLabel: "Open discovery",
      proofEvent: "scanner_usage + workflow_continuity",
      status: "ready",
      title: "Scanner reuse",
      tone: "violet",
    },
    {
      detail: input.replayCandidateCount ? `${input.replayCandidateCount} current candidates have replay, shock, or memory context.` : "Replay loop is available, but current candidates are limited.",
      href: replaySymbol ? `/history?symbol=${replaySymbol}` : "/history",
      key: "replay_review",
      nextActionLabel: "Review replay",
      proofEvent: "replay_usage",
      status: input.replayCandidateCount ? "ready" : "partial",
      title: "Replay review",
      tone: "cyan",
    },
    {
      detail: "Strategy Labs turns scanner context into simulated allocation review and repeatable learning.",
      href: "/strategy-labs",
      key: "strategy_evolution",
      nextActionLabel: "Open Strategy Labs",
      proofEvent: "strategy_usage",
      status: "partial",
      title: "Strategy evolution",
      tone: "emerald",
    },
    {
      detail: "Alerts are the product-side bridge from passive browsing to return behavior.",
      href: "/alerts",
      key: "alert_return",
      nextActionLabel: "Create alert",
      proofEvent: "alert_create + notification_engagement",
      status: input.watchlistSymbols.length ? "ready" : "partial",
      title: "Alert-driven return",
      tone: "rose",
    },
    {
      detail: `${input.triggerMonitorCount} trigger monitor${input.triggerMonitorCount === 1 ? "" : "s"} can connect macro and opportunity review.`,
      href: "/macro",
      key: "macro_check",
      nextActionLabel: "Open macro context",
      proofEvent: "workflow_continuity",
      status: input.triggerMonitorCount ? "ready" : "partial",
      title: "Macro update loop",
      tone: "amber",
    },
  ];
}

function buildContinuity(input: {
  preferences: WorkspacePreferences;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverContextItem[] {
  return [
    {
      detail: input.workflowEvolution?.lastSeenAt ? "TradeVeto can compare current symbols with the previous workflow baseline." : "The first visit creates the baseline for future since-last-visit intelligence.",
      href: null,
      label: "Workflow memory",
      tone: input.workflowEvolution?.lastSeenAt ? "emerald" : "amber",
      value: input.workflowEvolution?.lastSeenAt ? "Returning" : "Starting",
    },
    {
      detail: input.preferences.updatedAt ? "Workspace choices can be restored across sessions." : "Saving workspace preferences would reduce repeat-session setup friction.",
      href: "/terminal#workspace-personalization",
      label: "Workspace restore",
      tone: input.preferences.updatedAt ? "emerald" : "amber",
      value: input.preferences.updatedAt ? "Saved" : "Default",
    },
    {
      detail: input.watchlistSymbols.length ? "Tracked symbols power watchlist retention and personalized priority." : "No tracked symbols means TradeVeto cannot yet personalize return workflows.",
      href: "/discover",
      label: "Tracked symbols",
      tone: input.watchlistSymbols.length ? "emerald" : "rose",
      value: input.watchlistSymbols.length.toLocaleString(),
    },
    {
      detail: "Trigger monitors convert passive market review into repeatable research check-ins.",
      href: "/history",
      label: "Trigger monitors",
      tone: input.triggerMonitorCount ? "cyan" : "slate",
      value: input.triggerMonitorCount.toLocaleString(),
    },
  ];
}

function buildPersonalization(input: { preferences: WorkspacePreferences; rows: OpportunityViewModel[]; watchlistSymbols: string[] }): DailyDriverContextItem[] {
  const sector = dominantSector(input.rows, input.watchlistSymbols);
  return [
    {
      detail: "Terminal ordering and mobile pinned cards adapt to this mode.",
      href: "/terminal#workspace-personalization",
      label: "Workspace mode",
      tone: input.preferences.workspaceMode === "balanced" ? "cyan" : "emerald",
      value: WORKSPACE_MODE_LABELS[input.preferences.workspaceMode],
    },
    {
      detail: input.preferences.favoriteModules.map(moduleLabel).join(", ") || "Default modules remain active.",
      href: "/terminal#workspace-personalization",
      label: "Favorite modules",
      tone: "violet",
      value: input.preferences.favoriteModules.length.toLocaleString(),
    },
    {
      detail: sector ? `${sector} is the strongest current personalization cluster from tracked or ranked symbols.` : "Sector preference will emerge after watchlist and scanner usage.",
      href: "/discover",
      label: "Focus cluster",
      tone: sector ? "cyan" : "slate",
      value: sector ?? "Learning",
    },
    {
      detail: input.preferences.preferredTimeframes.length ? `Preferred review windows: ${input.preferences.preferredTimeframes.join(", ")}.` : "Default timeframe behavior is active.",
      href: "/settings",
      label: "Timeframe habit",
      tone: "amber",
      value: input.preferences.preferredTimeframes.join("/") || "Default",
    },
  ];
}

function buildBlockers(input: {
  persistedWorkspace: boolean;
  replayCandidateCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): string[] {
  const blockers: string[] = [];
  if (!input.watchlistSymbols.length) blockers.push("No watchlist anchor exists yet, so personalized return behavior remains weak.");
  if (!input.persistedWorkspace) blockers.push("Workspace preferences have not been saved, so repeat sessions still start from default layout.");
  if (!input.workflowEvolution?.lastSeenAt) blockers.push("Workflow continuity is starting, but repeat-visit proof is not established yet.");
  if (!input.replayCandidateCount) blockers.push("Replay candidates are limited in this snapshot, weakening the replay habit loop.");
  blockers.push("Real retention dominance cannot be claimed until production cohorts show improved 2-day and 7-day retention.");
  return blockers;
}

function scoreOpportunity(row: OpportunityViewModel): ScoredOpportunity {
  const score = row.final_score ?? 0;
  const evidence = row.evidence?.score ?? 0;
  const macro = row.macroAdjustment ?? 0;
  const shock = row.shockPattern;
  const replayScore = shock ? clamp((shock.currentSimilarityScore * 0.4) + (shock.reliabilityScore * 0.24) + (shock.opportunityScore * 0.22) + (shock.evidenceQualityScore ?? evidence) * 0.14) : clamp(evidence * 0.35);
  const opportunityScore = clamp(score * 0.36 + row.conviction * 0.26 + evidence * 0.18 + Math.max(0, macro) * 0.12 + replayScore * 0.08 - row.fragility * 0.18);
  const riskScore = clamp(row.fragility * 0.38 + row.eventRisk * 0.2 + Math.max(0, -macro) * 0.18 + (shock?.downsideRiskScore ?? 0) * 0.14 + (100 - Math.max(0, score)) * 0.1);
  return { opportunityScore, replayScore, riskScore, row };
}

function stage(
  key: DailyDriverFunnelStage["key"],
  label: string,
  value: number,
  targetLabel: string,
  detail: string,
): DailyDriverFunnelStage {
  const safeValue = Math.round(clamp(value));
  return {
    detail,
    key,
    label,
    targetLabel,
    tone: toneForValue(safeValue),
    value: safeValue,
  };
}

function summaryFor(input: { activationScore: number; blockers: string[]; marketCondition: string; watchlistCount: number }): string {
  if (input.watchlistCount === 0) {
    return `${input.marketCondition} is visible, but the daily-driver loop is not anchored yet because the user has no tracked symbols.`;
  }
  if (input.blockers.length <= 1 && input.activationScore >= 82) {
    return `${input.marketCondition} is connected to watchlist, scanner, replay, alerts, and strategy loops. Retention still needs cohort proof.`;
  }
  return `${input.marketCondition} now has a clearer daily-driver path, with ${input.blockers.length} remaining proof gap${input.blockers.length === 1 ? "" : "s"} before retention dominance can be claimed.`;
}

function dominantSector(rows: OpportunityViewModel[], watchlistSymbols: string[]): string | null {
  const watchlist = new Set(watchlistSymbols);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const sector = cleanText(row.sector);
    if (!sector) continue;
    const weight = watchlist.has(row.symbol) ? 3 : 1;
    counts.set(sector, (counts.get(sector) ?? 0) + weight);
  }
  let selected: string | null = null;
  let selectedCount = 0;
  for (const [sector, count] of counts) {
    if (count > selectedCount) {
      selected = sector;
      selectedCount = count;
    }
  }
  return selected;
}

function normalizeSymbols(symbols: string[]): string[] {
  const output: string[] = [];
  for (const value of symbols) {
    const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
    if (symbol && !output.includes(symbol)) output.push(symbol);
  }
  return output;
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function toneForValue(value: number): DailyDriverTone {
  if (value >= 78) return "emerald";
  if (value >= 58) return "cyan";
  if (value >= 35) return "amber";
  return "rose";
}

function weightedAverage(items: Array<[number, number]>): number {
  const totalWeight = items.reduce((total, [, weight]) => total + weight, 0);
  if (totalWeight <= 0) return 0;
  return items.reduce((total, [value, weight]) => total + value * weight, 0) / totalWeight;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
