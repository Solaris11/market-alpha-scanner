import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { AnalyticsEventName } from "@/lib/analytics-policy";
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  WORKSPACE_MODE_LABELS,
  moduleLabel,
  type WorkspacePreferences,
} from "@/lib/trading/workspace-preferences";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "@/lib/trading/workflow-evolution";

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
  key:
    | "alert_return"
    | "macro_check"
    | "morning_check"
    | "notification_feedback"
    | "replay_review"
    | "scanner_reuse"
    | "strategy_evolution"
    | "watchlist_movement";
  nextActionLabel: string;
  proofEvent: string;
  status: DailyDriverStatus;
  title: string;
  tone: DailyDriverTone;
};

export type DailyDriverDailySetupTask = {
  detail: string;
  eventName: AnalyticsEventName;
  href: string;
  key:
    | "alert_follow_up"
    | "daily_briefing"
    | "market_memory_updates"
    | "market_opportunities"
    | "performance_review"
    | "replay_review"
    | "symbol_follow_up"
    | "watchlist_review";
  label: string;
  metricLabel: string;
  status: DailyDriverStatus;
  tone: DailyDriverTone;
};

export type DailyDriverDailySetupCard = {
  detail: string;
  eventName: AnalyticsEventName;
  key: "daily_setup";
  label: string;
  primaryHref: string;
  primaryLabel: string;
  status: DailyDriverStatus;
  tasks: DailyDriverDailySetupTask[];
  tone: DailyDriverTone;
};

export type DailyDriverContextItem = {
  detail: string;
  href: string | null;
  label: string;
  tone: DailyDriverTone;
  value: string;
};

export type DailyDriverMorningWorkflowItem = {
  detail: string;
  href: string;
  key:
    | "ai_digest"
    | "important_events_today"
    | "macro_updates"
    | "overnight_events"
    | "overnight_summary"
    | "portfolio_pressure"
    | "risk_changes"
    | "scanner_changes"
    | "watchlist_movement";
  label: string;
  metricLabel: string;
  tone: DailyDriverTone;
  workflow: DailyDriverAction["workflow"];
};

export type DailyDriverBriefingItem = {
  detail: string;
  href: string;
  key: "deteriorated" | "improved" | "matters" | "next_action" | "risk" | "what_changed";
  label: string;
  metricLabel: string;
  status: DailyDriverStatus;
  tone: DailyDriverTone;
  workflow: DailyDriverAction["workflow"];
};

export type DailyDriverDependenceLoop = {
  detail: string;
  eventName:
    | "alert_return"
    | "briefing_return"
    | "chart_return"
    | "compare_return"
    | "morning_workflow_start"
    | "replay_return"
    | "return_session"
    | "scanner_return"
    | "symbol_return"
    | "watchlist_return";
  href: string;
  key:
    | "compare_dependence"
    | "first_open"
    | "repeat_chart_usage"
    | "repeat_scanner_usage"
    | "repeat_watchlist_usage"
    | "replay_dependence"
    | "return_sessions";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverChangeSignal = {
  detail: string;
  href: string;
  key: string;
  label: string;
  metricLabel: string;
  symbol: string | null;
  tone: DailyDriverTone;
  type: "baseline" | "deteriorating" | "improving" | "trigger" | "watchlist";
};

export type DailyDriverAdaptivePriority = {
  detail: string;
  href: string;
  key: "adaptive_feed" | "adaptive_macro" | "adaptive_scanner" | "preferred_asset" | "preferred_workflow";
  label: string;
  priorityLabel: string;
  proofEvent: string;
  rank: number;
  score: number;
  symbol: string | null;
  tone: DailyDriverTone;
  workflow: DailyDriverAction["workflow"];
};

export type DailyDriverRetentionTarget = {
  currentLabel: string;
  detail: string;
  evidenceLabel: string;
  key: "active_day_depth" | "alert_return_conversion" | "d2_retention" | "d7_retention" | "notification_useful_ratio";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverTelemetrySignal = {
  detail: string;
  eventName: string;
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverActivationMilestone = {
  detail: string;
  eventName: "activation_milestone" | "first_useful_action";
  href: string;
  key: "first_alert" | "first_compare" | "first_replay" | "first_scanner" | "first_symbol_investigation" | "first_watchlist";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverReturnLoop = {
  detail: string;
  eventName:
    | "alert_return"
    | "briefing_return"
    | "chart_return"
    | "compare_return"
    | "replay_return"
    | "scanner_habit_loop"
    | "scanner_return"
    | "strategy_return"
    | "symbol_return"
    | "watchlist_return";
  href: string;
  key: "alert" | "briefing" | "chart" | "compare" | "replay" | "scanner" | "scanner_habit" | "strategy" | "symbol" | "watchlist";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverReturnReason = {
  detail: string;
  eventName: AnalyticsEventName;
  href: string;
  key:
    | "ai_confidence_changed"
    | "macro_risk_changed"
    | "market_memory_updated"
    | "missed_opportunities"
    | "new_opportunities"
    | "triggered_alerts"
    | "watchlist_movers";
  label: string;
  metricLabel: string;
  status: DailyDriverStatus;
  tone: DailyDriverTone;
};

export type DailyDriverNotificationContextRule = {
  detail: string;
  eventName: "notification_engagement" | "notification_usefulness_feedback";
  key: "next_action" | "opened" | "usefulness" | "what_changed" | "why" | "why_matters";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverHabitMetric = {
  detail: string;
  eventName: AnalyticsEventName | "analytics_rollup";
  key:
    | "alert_returns"
    | "briefing_returns"
    | "compare_returns"
    | "daily_active_users"
    | "monthly_active_users"
    | "replay_returns"
    | "return_sessions"
    | "symbol_returns"
    | "watchlist_returns"
    | "weekly_active_users";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverNotificationQualityControl = {
  detail: string;
  eventName: "notification_engagement" | "notification_usefulness_feedback";
  key: "adaptive_relevance" | "category_quality" | "fatigue_suppression" | "intelligent_priority" | "quiet_low_value";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverAlertQualityEngineItem = {
  detail: string;
  eventName: "alert_return" | "notification_engagement" | "notification_usefulness_feedback";
  key: "adaptive_importance" | "fatigue_score" | "relevance" | "return_attribution" | "workflow_linked_alerts";
  label: string;
  status: DailyDriverStatus;
  targetLabel: string;
  tone: DailyDriverTone;
};

export type DailyDriverContinuationItem = {
  detail: string;
  href: string;
  key: "chart_state" | "compare_state" | "history_investigation" | "replay_workflow" | "scanner_state" | "strategy_workflow";
  label: string;
  status: DailyDriverStatus;
  tone: DailyDriverTone;
  value: string;
};

export type DailyDriverRetentionModel = {
  activationScore: number;
  activationMilestones: DailyDriverActivationMilestone[];
  adaptivePriorities: DailyDriverAdaptivePriority[];
  alertQualityEngine: DailyDriverAlertQualityEngineItem[];
  blockers: string[];
  changeVisualization: DailyDriverChangeSignal[];
  continuationWorkflows: DailyDriverContinuationItem[];
  continuity: DailyDriverContextItem[];
  dailyBriefing: DailyDriverBriefingItem[];
  dailySetupCard: DailyDriverDailySetupCard;
  dependenceLoops: DailyDriverDependenceLoop[];
  funnel: DailyDriverFunnelStage[];
  habitMetrics: DailyDriverHabitMetric[];
  habitLoops: DailyDriverHabitLoop[];
  morningWorkflow: DailyDriverMorningWorkflowItem[];
  notificationContextRules: DailyDriverNotificationContextRule[];
  notificationQuality: DailyDriverNotificationQualityControl[];
  personalization: DailyDriverContextItem[];
  primaryActions: DailyDriverAction[];
  proofBoundary: string;
  retentionTargets: DailyDriverRetentionTarget[];
  returnReasons: DailyDriverReturnReason[];
  returnLoops: DailyDriverReturnLoop[];
  summary: string;
  telemetry: DailyDriverTelemetrySignal[];
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
  const activationMilestones = buildActivationMilestones({
    replayCandidateCount,
    rows,
    topOpportunity,
    watchlistSymbols,
  });
  const returnLoops = buildReturnLoops({
    replayCandidateCount,
    topOpportunity,
    topReplay,
    topWatchlist,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });

  const morningWorkflow = buildMorningWorkflow({
    marketCondition: input.marketCondition,
    rows,
    topOpportunity,
    topRisk,
    topWatchlist,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });
  const dailyBriefing = buildDailyBriefing({
    marketCondition: input.marketCondition,
    topOpportunity,
    topReplay,
    topRisk,
    topWatchlist,
    workflowEvolution,
  });
  const dependenceLoops = buildDependenceLoops({
    replayCandidateCount,
    topOpportunity,
    topReplay,
    topWatchlist,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });
  const continuity = buildContinuity({ preferences, triggerMonitorCount, watchlistSymbols, workflowEvolution });
  const continuationWorkflows = buildContinuationWorkflows({ preferences, topOpportunity, topReplay, topWatchlist, workflowEvolution });
  const personalization = buildPersonalization({ preferences, rows, watchlistSymbols });
  const notificationQuality = buildNotificationQualityControls({ triggerMonitorCount, watchlistSymbols, workflowEvolution });
  const alertQualityEngine = buildAlertQualityEngine({ triggerMonitorCount, watchlistSymbols, workflowEvolution });
  const changeVisualization = buildChangeVisualization({
    rows,
    topOpportunity,
    workflowEvolution,
  });
  const adaptivePriorities = buildAdaptivePriorities({
    preferences,
    replayCandidateCount,
    rows,
    topOpportunity,
    topReplay,
    topRisk,
    topWatchlist,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });
  const returnReasons = buildReturnReasons({
    replayCandidateCount,
    scoredRows,
    topOpportunity,
    topReplay,
    topRisk,
    topWatchlist,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });
  const dailySetupCard = buildDailySetupCard({
    marketCondition: input.marketCondition,
    replayCandidateCount,
    returnReasons,
    topOpportunity,
    topReplay,
    topWatchlist,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });
  const notificationContextRules = buildNotificationContextRules({ triggerMonitorCount, watchlistSymbols, workflowEvolution });
  const habitMetrics = buildHabitMetrics({ triggerMonitorCount, watchlistSymbols, workflowEvolution });
  const retentionTargets = buildRetentionTargets({
    persistedWorkspace,
    triggerMonitorCount,
    watchlistSymbols,
    workflowEvolution,
  });
  const telemetry = buildTelemetrySignals({
    persistedWorkspace,
    replayCandidateCount,
    watchlistSymbols,
    workflowEvolution,
  });
  const blockers = buildBlockers({ persistedWorkspace, replayCandidateCount, watchlistSymbols, workflowEvolution });
  const summary = summaryFor({ activationScore, blockers, marketCondition: input.marketCondition, watchlistCount: watchlistSymbols.length });

  return {
    activationScore,
    activationMilestones,
    adaptivePriorities,
    alertQualityEngine,
    blockers,
    changeVisualization,
    continuationWorkflows,
    continuity,
    dailyBriefing,
    dailySetupCard,
    dependenceLoops,
    funnel,
    habitMetrics,
    habitLoops,
    morningWorkflow,
    notificationContextRules,
    notificationQuality,
    personalization,
    primaryActions,
    proofBoundary: "This panel improves and instruments daily-driver workflows. It does not claim retention victory until elapsed production cohorts prove D2 > 10%, D7 > 6%, 2+ active-day > 15%, notification usefulness > 55%, and alert-return conversion > 12%.",
    retentionTargets,
    returnReasons,
    returnLoops,
    summary,
    telemetry,
  };
}

function buildMorningWorkflow(input: {
  marketCondition: string;
  rows: OpportunityViewModel[];
  topOpportunity: ScoredOpportunity | null;
  topRisk: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverMorningWorkflowItem[] {
  const workflowChangeCount = (input.workflowEvolution?.whatChanged.length ?? 0) + (input.workflowEvolution?.watchlistEvolution.length ?? 0);
  const overnightEventCount = workflowChangeCount + (input.workflowEvolution?.deterioratingSetups.length ?? 0) + (input.workflowEvolution?.improvingSetups.length ?? 0);
  const watchlistSymbol = input.topWatchlist?.row.symbol ?? input.watchlistSymbols[0] ?? null;
  const riskSymbol = input.topRisk?.row.symbol ?? null;
  const opportunitySymbol = input.topOpportunity?.row.symbol ?? null;
  const portfolioPressureScore = Math.round(clamp((input.topRisk?.riskScore ?? 0) * 0.68 + Math.min(24, input.watchlistSymbols.length * 4) + Math.min(16, input.triggerMonitorCount * 4)));
  const eventReviewSymbol = input.workflowEvolution?.deterioratingSetups[0]?.symbol
    ?? input.workflowEvolution?.triggerMonitors[0]?.symbol
    ?? input.workflowEvolution?.whatChanged[0]?.symbol
    ?? null;
  return [
    {
      detail: input.workflowEvolution?.dailyBrief[0] ?? `${input.marketCondition} is the current opening baseline. Start here before jumping into individual symbols.`,
      href: "/terminal#daily-market-command",
      key: "overnight_summary",
      label: "Overnight market summary",
      metricLabel: input.marketCondition,
      tone: "cyan",
      workflow: "terminal",
    },
    {
      detail: input.workflowEvolution?.whatChanged[0]?.detail
        ?? input.workflowEvolution?.dailyBrief[1]
        ?? "Open the feed to review overnight company, macro, watchlist, and event changes before drilling into a single chart.",
      href: "/feed",
      key: "overnight_events",
      label: "Overnight event summary",
      metricLabel: overnightEventCount ? `${overnightEventCount} signals` : "Feed",
      tone: overnightEventCount ? "violet" : "slate",
      workflow: "terminal",
    },
    {
      detail: eventReviewSymbol
        ? `${eventReviewSymbol} is the highest-priority event review for today's opening workflow.`
        : "Review today's scheduled and source-linked events before treating scanner movement as actionable.",
      href: eventReviewSymbol ? `/feed?symbol=${encodeURIComponent(eventReviewSymbol)}` : "/feed",
      key: "important_events_today",
      label: "Important events today",
      metricLabel: overnightEventCount ? `${overnightEventCount} events` : "Calendar",
      tone: overnightEventCount ? "amber" : "slate",
      workflow: "terminal",
    },
    {
      detail: watchlistSymbol
        ? `${watchlistSymbol} is the fastest tracked-symbol review anchor for this session.`
        : "No tracked symbols are saved yet; create a watchlist so future mornings can show personalized movement.",
      href: watchlistSymbol ? `/symbol/${watchlistSymbol}` : "/discover",
      key: "watchlist_movement",
      label: "Watchlist movement",
      metricLabel: `${input.watchlistSymbols.length} saved`,
      tone: input.watchlistSymbols.length ? "emerald" : "amber",
      workflow: "watchlist",
    },
    {
      detail: workflowChangeCount
        ? `${workflowChangeCount} workflow change${workflowChangeCount === 1 ? "" : "s"} are ready to compare against the prior baseline.`
        : "Open discovery to establish the next saved scanner baseline and make tomorrow's changed-since-last-visit loop stronger.",
      href: "/discover",
      key: "scanner_changes",
      label: "Scanner changes",
      metricLabel: input.rows.length ? `${input.rows.length.toLocaleString()} rows` : "No rows",
      tone: input.rows.length ? "violet" : "amber",
      workflow: "scanner",
    },
    {
      detail: riskSymbol
        ? `${riskSymbol} is the current highest-priority risk review before opening new setups.`
        : "Risk review is limited until scanner rows expose fragility, macro pressure, or event pressure.",
      href: riskSymbol ? `/symbol/${riskSymbol}` : "/macro",
      key: "risk_changes",
      label: "Risk changes",
      metricLabel: riskSymbol ? `${Math.round(input.topRisk?.riskScore ?? 0)}/100` : "Limited",
      tone: riskSymbol ? "rose" : "slate",
      workflow: riskSymbol ? "watchlist" : "macro",
    },
    {
      detail: riskSymbol
        ? `${riskSymbol} drives the current portfolio-pressure check. Review concentration, drawdown, and scenario exposure before adding new risk.`
        : "Portfolio pressure is visible as a daily command step, but needs watchlist and risk context to become personalized.",
      href: "/paper",
      key: "portfolio_pressure",
      label: "Portfolio pressure",
      metricLabel: portfolioPressureScore ? `${portfolioPressureScore}/100` : "Paper",
      tone: portfolioPressureScore >= 58 ? "rose" : portfolioPressureScore >= 35 ? "amber" : "slate",
      workflow: "strategy",
    },
    {
      detail: input.triggerMonitorCount
        ? `${input.triggerMonitorCount} trigger monitor${input.triggerMonitorCount === 1 ? "" : "s"} connect macro context to active research.`
        : "Macro review remains available, but no trigger monitor is active in the current workflow baseline.",
      href: "/macro",
      key: "macro_updates",
      label: "Macro updates",
      metricLabel: input.triggerMonitorCount ? `${input.triggerMonitorCount} triggers` : "Context",
      tone: input.triggerMonitorCount ? "amber" : "slate",
      workflow: "macro",
    },
    {
      detail: opportunitySymbol
        ? `${opportunitySymbol} is the current AI-ranked research anchor after blending setup quality, risk, replay context, and personalization.`
        : "The AI digest is waiting for enough ranked scanner context to produce a stronger first action.",
      href: opportunitySymbol ? `/symbol/${opportunitySymbol}` : "/feed",
      key: "ai_digest",
      label: "AI intelligence digest",
      metricLabel: opportunitySymbol ? `${Math.round(input.topOpportunity?.opportunityScore ?? 0)}/100` : "Learning",
      tone: opportunitySymbol ? "emerald" : "slate",
      workflow: "terminal",
    },
  ];
}

function buildDailyBriefing(input: {
  marketCondition: string;
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topRisk: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverBriefingItem[] {
  const workflowChangeCount = (input.workflowEvolution?.whatChanged.length ?? 0) + (input.workflowEvolution?.watchlistEvolution.length ?? 0);
  const improving = input.workflowEvolution?.improvingSetups[0] ?? null;
  const deteriorating = input.workflowEvolution?.deterioratingSetups[0] ?? null;
  const watchlist = input.workflowEvolution?.watchlistEvolution[0] ?? null;
  const opportunitySymbol = input.topOpportunity?.row.symbol ?? null;
  const replaySymbol = input.topReplay?.row.symbol ?? opportunitySymbol;
  const riskSymbol = input.topRisk?.row.symbol ?? deteriorating?.symbol ?? null;
  const watchlistSymbol = input.topWatchlist?.row.symbol ?? watchlist?.symbol ?? null;
  return [
    {
      detail: input.workflowEvolution?.dailyBrief[0] ?? `${input.marketCondition} is the current market baseline; today's first action is to establish what changed before opening isolated research.`,
      href: "/terminal#daily-market-command",
      key: "what_changed",
      label: "What changed overnight",
      metricLabel: workflowChangeCount ? `${workflowChangeCount} changes` : "Baseline",
      status: workflowChangeCount ? "ready" : "partial",
      tone: workflowChangeCount ? "cyan" : "amber",
      workflow: "terminal",
    },
    {
      detail: watchlistSymbol
        ? `${watchlistSymbol} is the highest-priority personalized review anchor from watchlist, scanner, or prior workflow memory.`
        : "The highest-value dependency loop is still the first watchlist; without it the briefing cannot become personally sticky.",
      href: watchlistSymbol ? `/symbol/${encodeURIComponent(watchlistSymbol)}` : "/discover",
      key: "matters",
      label: "What matters now",
      metricLabel: watchlistSymbol ?? "Watchlist",
      status: watchlistSymbol ? "ready" : "blocked",
      tone: watchlistSymbol ? "emerald" : "amber",
      workflow: "watchlist",
    },
    {
      detail: deteriorating?.detail
        ?? (riskSymbol ? `${riskSymbol} is the highest-risk symbol in the current opening review.` : "No source-backed deterioration is detected in this snapshot; keep risk review visible instead of hiding uncertainty."),
      href: riskSymbol ? `/symbol/${encodeURIComponent(riskSymbol)}` : "/macro",
      key: "deteriorated",
      label: "What deteriorated",
      metricLabel: deteriorating?.metricLabel ?? (riskSymbol ? `${Math.round(input.topRisk?.riskScore ?? 0)}/100 risk` : "Limited"),
      status: deteriorating || riskSymbol ? "partial" : "blocked",
      tone: deteriorating || riskSymbol ? "rose" : "slate",
      workflow: riskSymbol ? "watchlist" : "macro",
    },
    {
      detail: improving?.detail
        ?? (opportunitySymbol ? `${opportunitySymbol} has the best blended setup quality, evidence, replay, and risk context for today's opening workflow.` : "No improving setup is strong enough to promote as a daily-driver anchor yet."),
      href: opportunitySymbol ? `/symbol/${encodeURIComponent(opportunitySymbol)}` : "/discover",
      key: "improved",
      label: "What improved",
      metricLabel: improving?.metricLabel ?? (opportunitySymbol ? `${Math.round(input.topOpportunity?.opportunityScore ?? 0)}/100` : "Learning"),
      status: improving || opportunitySymbol ? "ready" : "partial",
      tone: improving || opportunitySymbol ? "emerald" : "slate",
      workflow: "scanner",
    },
    {
      detail: riskSymbol
        ? `${riskSymbol} should be reviewed before any new alert, compare, or strategy action because it currently carries the highest pressure.`
        : "Risk state remains a first-screen item even when the current data cannot name a single high-pressure symbol.",
      href: riskSymbol ? `/symbol/${encodeURIComponent(riskSymbol)}` : "/macro",
      key: "risk",
      label: "What risk changed",
      metricLabel: riskSymbol ? "Risk review" : "Macro",
      status: riskSymbol ? "ready" : "partial",
      tone: riskSymbol ? "amber" : "slate",
      workflow: "macro",
    },
    {
      detail: replaySymbol
        ? `${replaySymbol} is the best next investigation for replay, chart, compare, or alert follow-up after the morning briefing.`
        : "The next action is to save a scanner/watchlist baseline so tomorrow can show a real change delta.",
      href: replaySymbol ? `/history?symbol=${encodeURIComponent(replaySymbol)}` : "/discover",
      key: "next_action",
      label: "Next useful action",
      metricLabel: replaySymbol ? "Replay" : "Baseline",
      status: replaySymbol ? "ready" : "partial",
      tone: replaySymbol ? "cyan" : "amber",
      workflow: replaySymbol ? "replay" : "scanner",
    },
  ];
}

function buildDependenceLoops(input: {
  replayCandidateCount: number;
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverDependenceLoop[] {
  const continuationSymbol = workflowContinuationSymbol(input.workflowEvolution) ?? input.topWatchlist?.row.symbol ?? input.topOpportunity?.row.symbol ?? input.watchlistSymbols[0] ?? "AMD";
  const hasContinuity = Boolean(input.workflowEvolution?.lastSeenAt);
  const hasWatchlist = input.watchlistSymbols.length > 0;
  return [
    {
      detail: "Terminal opening in the morning creates the first-screen habit event and anchors the daily command workflow.",
      eventName: "morning_workflow_start",
      href: "/terminal#daily-driver-retention",
      key: "first_open",
      label: "First open dependence",
      status: "ready",
      targetLabel: "first screen",
      tone: "cyan",
    },
    {
      detail: hasContinuity ? "A prior workflow baseline exists, so return sessions can be tied to what changed instead of generic page views." : "This session can create the baseline needed for future return-session dependence proof.",
      eventName: "return_session",
      href: "/terminal#workflow-evolution",
      key: "return_sessions",
      label: "Return-session dependence",
      status: hasContinuity ? "ready" : "partial",
      targetLabel: "D2/D7 cohorts",
      tone: hasContinuity ? "emerald" : "amber",
    },
    {
      detail: "Scanner returns measure whether users repeatedly start market work from TradeVeto discovery instead of ad hoc external screens.",
      eventName: "scanner_return",
      href: "/discover",
      key: "repeat_scanner_usage",
      label: "Repeat scanner usage",
      status: "partial",
      targetLabel: "repeat scan",
      tone: "violet",
    },
    {
      detail: "Chart returns are tracked separately so saved chart context can become a repeat workflow rather than a transient visual.",
      eventName: "chart_return",
      href: `/symbol/${encodeURIComponent(continuationSymbol)}`,
      key: "repeat_chart_usage",
      label: "Repeat chart usage",
      status: hasContinuity ? "partial" : "blocked",
      targetLabel: "chart return",
      tone: hasContinuity ? "cyan" : "amber",
    },
    {
      detail: hasWatchlist ? `${input.watchlistSymbols.length} tracked symbols can create movement, risk, news, and replay return prompts.` : "Watchlist dependence is blocked until users save tracked symbols.",
      eventName: "watchlist_return",
      href: hasWatchlist ? `/symbol/${encodeURIComponent(continuationSymbol)}` : "/discover",
      key: "repeat_watchlist_usage",
      label: "Repeat watchlist usage",
      status: hasWatchlist ? "ready" : "blocked",
      targetLabel: "watchlist return",
      tone: hasWatchlist ? "emerald" : "amber",
    },
    {
      detail: input.replayCandidateCount || input.topReplay ? "Replay dependence can reopen prior evidence, history, and analog review from current candidates." : "Replay dependence remains partial until stronger candidates exist.",
      eventName: "replay_return",
      href: `/history?symbol=${encodeURIComponent(input.topReplay?.row.symbol ?? continuationSymbol)}`,
      key: "replay_dependence",
      label: "Replay dependence",
      status: input.replayCandidateCount || input.topReplay ? "ready" : "partial",
      targetLabel: "replay reuse",
      tone: input.replayCandidateCount || input.topReplay ? "cyan" : "slate",
    },
    {
      detail: input.triggerMonitorCount ? "Compare returns can be tied to trigger monitors and active research threads." : "Compare dependence needs more saved workflow context before it can be certified.",
      eventName: "compare_return",
      href: "/discover#compare",
      key: "compare_dependence",
      label: "Compare dependence",
      status: hasContinuity || input.triggerMonitorCount ? "partial" : "blocked",
      targetLabel: "compare return",
      tone: hasContinuity || input.triggerMonitorCount ? "violet" : "amber",
    },
  ];
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

  if (input.workflowEvolution?.lastSeenAt) {
    const restoreSymbol = workflowContinuationSymbol(input.workflowEvolution) ?? input.topWatchlist?.row.symbol ?? input.topOpportunity?.row.symbol ?? null;
    actions.push({
      continuityLabel: "Continue where you left off",
      detail: restoreSymbol
        ? `${restoreSymbol} has changed enough to restore yesterday's workflow before opening unrelated research.`
        : "Restore the prior workflow baseline, review what changed, and continue the same research thread.",
      firstUsefulAction: true,
      href: restoreSymbol ? `/symbol/${restoreSymbol}` : "/terminal#workflow-evolution",
      key: "workflow_restore",
      label: "Continue last workflow",
      metricLabel: input.workflowEvolution.whatChanged.length ? `${input.workflowEvolution.whatChanged.length} changes` : "Workflow memory",
      priority: 86,
      status: "ready",
      symbol: restoreSymbol,
      tone: "cyan",
      workflow: "terminal",
    });
  }

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
      detail: "Explicit useful and not-useful feedback turns notification delivery into a measurable return loop instead of a vanity alert count.",
      href: "/alerts",
      key: "notification_feedback",
      nextActionLabel: "Rate notifications",
      proofEvent: "notification_usefulness_feedback",
      status: "partial",
      title: "Notification usefulness",
      tone: "violet",
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

function buildActivationMilestones(input: {
  replayCandidateCount: number;
  rows: OpportunityViewModel[];
  topOpportunity: ScoredOpportunity | null;
  watchlistSymbols: string[];
}): DailyDriverActivationMilestone[] {
  const symbol = input.topOpportunity?.row.symbol ?? input.rows[0]?.symbol ?? "AMD";
  const hasRows = input.rows.length > 0;
  const hasWatchlist = input.watchlistSymbols.length > 0;
  return [
    {
      detail: hasWatchlist ? `${input.watchlistSymbols.length} tracked symbol${input.watchlistSymbols.length === 1 ? "" : "s"} can anchor every return session.` : "The first saved watchlist is still the highest-impact activation step.",
      eventName: "activation_milestone",
      href: "/discover",
      key: "first_watchlist",
      label: "First watchlist",
      status: hasWatchlist ? "ready" : "blocked",
      targetLabel: "< first session",
      tone: hasWatchlist ? "emerald" : "amber",
    },
    {
      detail: hasRows ? "Scanner activation is available from Terminal, Discover, Scanner, and first-run walkthrough entry points." : "Scanner activation is limited until current opportunity rows load.",
      eventName: "activation_milestone",
      href: "/scanner",
      key: "first_scanner",
      label: "First scanner run",
      status: hasRows ? "ready" : "blocked",
      targetLabel: "< 3 minutes",
      tone: hasRows ? "violet" : "rose",
    },
    {
      detail: "Compare activation gives users a concrete reason to evaluate alternatives instead of browsing isolated cards.",
      eventName: "activation_milestone",
      href: "/discover#compare",
      key: "first_compare",
      label: "First compare",
      status: hasRows ? "partial" : "blocked",
      targetLabel: "< first session",
      tone: hasRows ? "cyan" : "amber",
    },
    {
      detail: "Alert activation creates the return trigger needed to turn intelligence into a measured comeback loop.",
      eventName: "activation_milestone",
      href: "/alerts",
      key: "first_alert",
      label: "First alert",
      status: hasWatchlist ? "ready" : "partial",
      targetLabel: "> 12% return",
      tone: hasWatchlist ? "emerald" : "amber",
    },
    {
      detail: input.replayCandidateCount ? `${input.replayCandidateCount} replay candidates can become the first evidence review.` : "Replay activation exists but needs stronger current candidates.",
      eventName: "activation_milestone",
      href: `/history?symbol=${encodeURIComponent(symbol)}`,
      key: "first_replay",
      label: "First replay",
      status: input.replayCandidateCount ? "ready" : "partial",
      targetLabel: "Replay reuse",
      tone: input.replayCandidateCount ? "cyan" : "slate",
    },
    {
      detail: `${symbol} is the safest starter symbol for chart, risk, catalyst, and confidence investigation.`,
      eventName: "first_useful_action",
      href: `/symbol/${encodeURIComponent(symbol)}`,
      key: "first_symbol_investigation",
      label: "First symbol investigation",
      status: hasRows ? "ready" : "partial",
      targetLabel: "Useful action",
      tone: hasRows ? "emerald" : "amber",
    },
  ];
}

function buildReturnLoops(input: {
  replayCandidateCount: number;
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverReturnLoop[] {
  const continuationSymbol = workflowContinuationSymbol(input.workflowEvolution) ?? input.topWatchlist?.row.symbol ?? input.topOpportunity?.row.symbol ?? input.watchlistSymbols[0] ?? "AMD";
  const hasContinuity = Boolean(input.workflowEvolution?.lastSeenAt);
  const hasWatchlist = input.watchlistSymbols.length > 0;
  return [
    {
      detail: "Briefing return proves the user starts from the daily command workflow instead of landing in a random feature.",
      eventName: "briefing_return",
      href: "/terminal#daily-market-command",
      key: "briefing",
      label: "Briefing return",
      status: "ready",
      targetLabel: "first screen",
      tone: "cyan",
    },
    {
      detail: hasContinuity ? "Scanner return can compare today's row set against the prior workflow baseline." : "The next scanner visit will create the baseline needed for changed-since-last-visit proof.",
      eventName: "scanner_return",
      href: "/discover",
      key: "scanner",
      label: "Scanner return",
      status: hasContinuity ? "ready" : "partial",
      targetLabel: "scanner reuse",
      tone: hasContinuity ? "violet" : "amber",
    },
    {
      detail: "Repeated scanner entry is now separated from generic usage so addictive scanner-loop behavior can be measured directly.",
      eventName: "scanner_habit_loop",
      href: "/scanner",
      key: "scanner_habit",
      label: "Scanner habit loop",
      status: "partial",
      targetLabel: "repeat scan",
      tone: "violet",
    },
    {
      detail: hasWatchlist ? `${input.watchlistSymbols.length} saved symbols can produce movement, risk, news, and memory return prompts.` : "Watchlist returns remain weak until the user saves symbols.",
      eventName: "watchlist_return",
      href: continuationSymbol ? `/symbol/${encodeURIComponent(continuationSymbol)}` : "/discover",
      key: "watchlist",
      label: "Watchlist return",
      status: hasWatchlist ? "ready" : "blocked",
      targetLabel: "movement review",
      tone: hasWatchlist ? "emerald" : "amber",
    },
    {
      detail: "Symbol returns measure whether users come back to a specific research object, not only a generic route.",
      eventName: "symbol_return",
      href: `/symbol/${encodeURIComponent(continuationSymbol)}`,
      key: "symbol",
      label: "Symbol return",
      status: hasContinuity ? "partial" : "ready",
      targetLabel: "research loop",
      tone: hasContinuity ? "emerald" : "cyan",
    },
    {
      detail: input.topReplay || input.replayCandidateCount ? "History and Market Memory returns can reopen replay evidence from the current research thread." : "Replay returns need more comparable history before they become habit-forming.",
      eventName: "replay_return",
      href: `/history?symbol=${encodeURIComponent(input.topReplay?.row.symbol ?? continuationSymbol)}`,
      key: "replay",
      label: "Replay return",
      status: input.topReplay || input.replayCandidateCount ? "ready" : "partial",
      targetLabel: "replay reuse",
      tone: input.topReplay || input.replayCandidateCount ? "cyan" : "slate",
    },
    {
      detail: "Chart returns are tracked separately from symbol opens so restored chart workspaces can become a measured daily loop.",
      eventName: "chart_return",
      href: `/symbol/${encodeURIComponent(continuationSymbol)}`,
      key: "chart",
      label: "Chart return",
      status: hasContinuity ? "partial" : "blocked",
      targetLabel: "chart restore",
      tone: hasContinuity ? "cyan" : "amber",
    },
    {
      detail: "Compare return records whether users resume a side-by-side investigation instead of restarting from generic discovery.",
      eventName: "compare_return",
      href: "/discover#compare",
      key: "compare",
      label: "Compare return",
      status: hasContinuity ? "partial" : "blocked",
      targetLabel: "compare restore",
      tone: hasContinuity ? "cyan" : "amber",
    },
    {
      detail: "Alert returns measure whether notification triggers actually bring users back into a useful workflow.",
      eventName: "alert_return",
      href: "/alerts",
      key: "alert",
      label: "Alert return",
      status: hasWatchlist || input.triggerMonitorCount ? "partial" : "blocked",
      targetLabel: "> 12%",
      tone: hasWatchlist || input.triggerMonitorCount ? "rose" : "amber",
    },
    {
      detail: "Strategy returns prove that simulated strategy review becomes an ongoing operating habit, not a one-off feature tour.",
      eventName: "strategy_return",
      href: "/strategy-labs",
      key: "strategy",
      label: "Strategy return",
      status: "partial",
      targetLabel: "strategy reuse",
      tone: "emerald",
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

function buildContinuationWorkflows(input: {
  preferences: WorkspacePreferences;
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverContinuationItem[] {
  const symbol = workflowContinuationSymbol(input.workflowEvolution) ?? input.topWatchlist?.row.symbol ?? input.topOpportunity?.row.symbol ?? "AMD";
  const hasWorkflowMemory = Boolean(input.workflowEvolution?.lastSeenAt);
  const workspaceSaved = Boolean(input.preferences.updatedAt);
  return [
    {
      detail: workspaceSaved ? "Discovery filters, scanner preferences, and saved workspace choices reduce first-minute setup friction." : "Scanner state still needs a saved workspace preference to become reliably restorable.",
      href: "/discover",
      key: "scanner_state",
      label: "Restore scanner state",
      status: workspaceSaved ? "ready" : "partial",
      tone: workspaceSaved ? "emerald" : "amber",
      value: workspaceSaved ? "Saved" : "Default",
    },
    {
      detail: "Chart workspace persistence is treated as a return loop only when users reopen symbol research after an elapsed day.",
      href: `/symbol/${encodeURIComponent(symbol)}`,
      key: "chart_state",
      label: "Restore chart state",
      status: hasWorkflowMemory ? "partial" : "blocked",
      tone: hasWorkflowMemory ? "cyan" : "amber",
      value: symbol,
    },
    {
      detail: "Compare restore keeps side-by-side research from becoming throwaway browsing.",
      href: "/discover#compare",
      key: "compare_state",
      label: "Restore compare state",
      status: workspaceSaved ? "partial" : "blocked",
      tone: workspaceSaved ? "cyan" : "amber",
      value: workspaceSaved ? "Ready" : "Needs save",
    },
    {
      detail: input.topReplay ? `${input.topReplay.row.symbol} can resume the prior replay investigation.` : "History investigation resumes from the selected symbol when enough replay context exists.",
      href: `/history?symbol=${encodeURIComponent(input.topReplay?.row.symbol ?? symbol)}`,
      key: "history_investigation",
      label: "Continue history investigation",
      status: input.topReplay ? "ready" : "partial",
      tone: input.topReplay ? "cyan" : "slate",
      value: input.topReplay?.row.symbol ?? "Learning",
    },
    {
      detail: "Market Memory can reopen comparable replay evidence without inventing unsupported analogs.",
      href: `/market-memory?symbol=${encodeURIComponent(symbol)}`,
      key: "replay_workflow",
      label: "Continue replay workflow",
      status: input.topReplay ? "ready" : "partial",
      tone: input.topReplay ? "violet" : "slate",
      value: input.topReplay ? "Candidate" : "Limited",
    },
    {
      detail: "Strategy Labs stays connected to current risk and setup context, but habit proof still needs repeated strategy returns.",
      href: "/strategy-labs",
      key: "strategy_workflow",
      label: "Continue strategy workflow",
      status: "partial",
      tone: "emerald",
      value: input.preferences.preferredRiskStyle,
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

function buildNotificationQualityControls(input: {
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverNotificationQualityControl[] {
  const hasPersonalContext = input.watchlistSymbols.length > 0 || Boolean(input.workflowEvolution?.lastSeenAt);
  return [
    {
      detail: "Low-value notifications are explicitly measured through not-useful feedback and suppressed preference actions.",
      eventName: "notification_usefulness_feedback",
      key: "fatigue_suppression",
      label: "Fatigue suppression",
      status: "partial",
      targetLabel: "quiet noise",
      tone: "amber",
    },
    {
      detail: hasPersonalContext ? "Watchlist and workflow memory give notifications a personalized ranking basis." : "Adaptive relevance remains weak until watchlist or return-session context exists.",
      eventName: "notification_engagement",
      key: "adaptive_relevance",
      label: "Adaptive relevance",
      status: hasPersonalContext ? "partial" : "blocked",
      targetLabel: "return fit",
      tone: hasPersonalContext ? "cyan" : "amber",
    },
    {
      detail: "Useful/not-useful feedback is categorized so weak categories can be reduced instead of blindly increasing notification volume.",
      eventName: "notification_usefulness_feedback",
      key: "category_quality",
      label: "Category quality scoring",
      status: "partial",
      targetLabel: "> 55% useful",
      tone: "violet",
    },
    {
      detail: input.triggerMonitorCount ? `${input.triggerMonitorCount} trigger monitor${input.triggerMonitorCount === 1 ? "" : "s"} can raise only high-priority notifications.` : "Priority routing is present but has limited trigger-monitor evidence in this snapshot.",
      eventName: "notification_engagement",
      key: "intelligent_priority",
      label: "Intelligent prioritization",
      status: input.triggerMonitorCount ? "ready" : "partial",
      targetLabel: "high signal",
      tone: input.triggerMonitorCount ? "emerald" : "slate",
    },
    {
      detail: "Quieting low-value notifications is a retention protection, not a vanity engagement feature.",
      eventName: "notification_usefulness_feedback",
      key: "quiet_low_value",
      label: "Quiet low-value notifications",
      status: "partial",
      targetLabel: "fatigue down",
      tone: "cyan",
    },
  ];
}

function buildAlertQualityEngine(input: {
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverAlertQualityEngineItem[] {
  const hasPersonalContext = input.watchlistSymbols.length > 0 || Boolean(input.workflowEvolution?.lastSeenAt);
  const workflowChangeCount = (input.workflowEvolution?.whatChanged.length ?? 0) + (input.workflowEvolution?.watchlistEvolution.length ?? 0);
  return [
    {
      detail: hasPersonalContext
        ? "Alert relevance can use watchlist, workflow memory, and prior return context before notifying the user."
        : "Relevance scoring is limited until users create watchlist or workflow memory.",
      eventName: "notification_engagement",
      key: "relevance",
      label: "Relevance scoring",
      status: hasPersonalContext ? "partial" : "blocked",
      targetLabel: "high signal",
      tone: hasPersonalContext ? "cyan" : "amber",
    },
    {
      detail: "Category-level fatigue scoring is measured through not-useful feedback, suppression actions, and repeated ignored categories.",
      eventName: "notification_usefulness_feedback",
      key: "fatigue_score",
      label: "Fatigue score",
      status: "partial",
      targetLabel: "noise down",
      tone: "amber",
    },
    {
      detail: input.triggerMonitorCount
        ? `${input.triggerMonitorCount} trigger monitor${input.triggerMonitorCount === 1 ? "" : "s"} can promote only workflow-relevant alerts.`
        : "Adaptive importance exists, but trigger-monitor evidence is limited in this snapshot.",
      eventName: "notification_engagement",
      key: "adaptive_importance",
      label: "Adaptive importance",
      status: input.triggerMonitorCount ? "ready" : "partial",
      targetLabel: "priority fit",
      tone: input.triggerMonitorCount ? "emerald" : "slate",
    },
    {
      detail: workflowChangeCount
        ? `${workflowChangeCount} workflow change${workflowChangeCount === 1 ? "" : "s"} can be linked back to scanner, watchlist, chart, or replay return actions.`
        : "Workflow-linked alerts need a changed-since-last-session baseline before they can become a strong return loop.",
      eventName: "alert_return",
      key: "workflow_linked_alerts",
      label: "Workflow-linked alerts",
      status: workflowChangeCount ? "partial" : "blocked",
      targetLabel: "> 12% return",
      tone: workflowChangeCount ? "violet" : "amber",
    },
    {
      detail: "Alert return attribution separates notification opens that create useful workflows from notifications that merely create page views.",
      eventName: "alert_return",
      key: "return_attribution",
      label: "Return attribution",
      status: "partial",
      targetLabel: "useful return",
      tone: "rose",
    },
  ];
}

function buildChangeVisualization(input: {
  rows: OpportunityViewModel[];
  topOpportunity: ScoredOpportunity | null;
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverChangeSignal[] {
  const output: DailyDriverChangeSignal[] = [];
  const seen = new Set<string>();
  const pushChange = (item: WorkflowChangeItem, type: DailyDriverChangeSignal["type"]): void => {
    const symbol = normalizeSymbols([item.symbol])[0] ?? null;
    const key = `${type}:${symbol ?? item.symbol}:${item.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    output.push({
      detail: item.detail,
      href: symbol ? `/symbol/${symbol}` : "/terminal#workflow-evolution",
      key,
      label: item.title,
      metricLabel: item.metricLabel,
      symbol,
      tone: toneForChange(item.severity),
      type,
    });
  };

  for (const item of input.workflowEvolution?.watchlistEvolution ?? []) pushChange(item, "watchlist");
  for (const item of input.workflowEvolution?.whatChanged ?? []) pushChange(item, changeTypeFor(item));
  for (const item of input.workflowEvolution?.improvingSetups ?? []) pushChange(item, "improving");
  for (const item of input.workflowEvolution?.deterioratingSetups ?? []) pushChange(item, "deteriorating");

  for (const monitor of input.workflowEvolution?.triggerMonitors ?? []) {
    const symbol = normalizeSymbols([monitor.symbol])[0] ?? null;
    const key = `trigger:${symbol ?? monitor.symbol}:${monitor.condition}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      detail: monitor.reason,
      href: symbol ? `/symbol/${symbol}` : "/macro",
      key,
      label: monitor.condition,
      metricLabel: monitor.distanceLabel,
      symbol,
      tone: monitor.priority === "high" ? "amber" : "cyan",
      type: "trigger",
    });
  }

  if (!output.length) {
    const symbol = input.topOpportunity?.row.symbol ?? input.rows[0]?.symbol ?? null;
    output.push({
      detail: symbol
        ? `${symbol} can become the first saved baseline for tomorrow's changed-since-last-session review.`
        : "No current workflow delta exists yet; today's session will create the next retention baseline.",
      href: symbol ? `/symbol/${symbol}` : "/discover",
      key: "baseline:first-session",
      label: "Create tomorrow's baseline",
      metricLabel: "Baseline",
      symbol,
      tone: "amber",
      type: "baseline",
    });
  }

  return output.slice(0, 6);
}

function buildAdaptivePriorities(input: {
  preferences: WorkspacePreferences;
  replayCandidateCount: number;
  rows: OpportunityViewModel[];
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topRisk: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverAdaptivePriority[] {
  const workflowChangeCount = (input.workflowEvolution?.whatChanged.length ?? 0) + (input.workflowEvolution?.watchlistEvolution.length ?? 0);
  const preferredModule = input.preferences.favoriteModules[0] ?? null;
  const preferredModuleLabel = preferredModule ? moduleLabel(preferredModule) : "Default terminal";
  const preferredModuleHref = hrefForPreferredModule(preferredModule);
  const preferredModuleWorkflow = workflowForPreferredModule(preferredModule);
  const preferredAsset = input.topWatchlist?.row.symbol ?? input.topOpportunity?.row.symbol ?? input.watchlistSymbols[0] ?? null;
  const priorities: DailyDriverAdaptivePriority[] = [
    {
      detail: workflowChangeCount
        ? "The feed should open with changed watchlist, event, and workflow-memory items ahead of generic market noise."
        : "The feed can still establish a preference baseline, but personalized changes need repeat visits.",
      href: "/feed",
      key: "adaptive_feed",
      label: "Adaptive feed",
      priorityLabel: workflowChangeCount ? `${workflowChangeCount} changes` : "Learning",
      proofEvent: "feed_engagement + personalized_intelligence_return",
      rank: 1,
      score: clamp(48 + workflowChangeCount * 12 + (input.watchlistSymbols.length ? 14 : 0)),
      symbol: null,
      tone: workflowChangeCount ? "emerald" : "amber",
      workflow: "terminal",
    },
    {
      detail: input.rows.length
        ? "Scanner priority is biased toward rows that can become saved scans, alerts, watchlist additions, or chart drilldowns."
        : "Scanner personalization is limited until the current row set is available.",
      href: "/discover",
      key: "adaptive_scanner",
      label: "Adaptive scanner",
      priorityLabel: input.rows.length ? `${input.rows.length.toLocaleString()} rows` : "No rows",
      proofEvent: "scanner_return + scanner_usage",
      rank: 2,
      score: clamp(input.rows.length >= 250 ? 92 : input.rows.length >= 100 ? 82 : input.rows.length >= 30 ? 68 : input.rows.length ? 48 : 18),
      symbol: null,
      tone: input.rows.length ? "violet" : "rose",
      workflow: "scanner",
    },
    {
      detail: input.triggerMonitorCount
        ? "Macro priority should surface monitors that connect regime shifts to watchlist and scanner decisions."
        : "Macro remains a daily context loop, but no active monitor is currently pulling the user back.",
      href: "/macro",
      key: "adaptive_macro",
      label: "Adaptive macro priorities",
      priorityLabel: input.triggerMonitorCount ? `${input.triggerMonitorCount} monitors` : "Context",
      proofEvent: "workflow_continuity",
      rank: 3,
      score: clamp(44 + input.triggerMonitorCount * 14 + (input.topRisk ? 14 : 0)),
      symbol: input.topRisk?.row.symbol ?? null,
      tone: input.triggerMonitorCount ? "amber" : "slate",
      workflow: "macro",
    },
    {
      detail: `${preferredModuleLabel} is the best workspace entry point from the saved preference profile.`,
      href: preferredModuleHref,
      key: "preferred_workflow",
      label: "Preferred workflow ranking",
      priorityLabel: input.preferences.updatedAt ? "Saved" : "Default",
      proofEvent: "personalization_update + workflow_continuity",
      rank: 4,
      score: clamp(input.preferences.updatedAt ? 82 : 46),
      symbol: null,
      tone: input.preferences.updatedAt ? "cyan" : "amber",
      workflow: preferredModuleWorkflow,
    },
    {
      detail: preferredAsset
        ? `${preferredAsset} should stay near the top of the return session because it is watchlisted, ranked, risky, or replay-relevant.`
        : "A preferred asset cannot be ranked until the user saves a watchlist or opens repeat symbol workflows.",
      href: preferredAsset ? `/symbol/${preferredAsset}` : "/discover",
      key: "preferred_asset",
      label: "Preferred asset ranking",
      priorityLabel: preferredAsset ?? "Learning",
      proofEvent: "watchlist_return + symbol_open",
      rank: 5,
      score: clamp((input.topWatchlist?.opportunityScore ?? input.topOpportunity?.opportunityScore ?? 24) + (input.replayCandidateCount ? 8 : 0)),
      symbol: preferredAsset,
      tone: preferredAsset ? "emerald" : "amber",
      workflow: "watchlist",
    },
  ];

  return priorities.sort((left, right) => right.score - left.score || left.rank - right.rank);
}

function buildReturnReasons(input: {
  replayCandidateCount: number;
  scoredRows: ScoredOpportunity[];
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topRisk: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverReturnReason[] {
  const watchlistMoveCount = input.workflowEvolution?.watchlistEvolution.length ?? 0;
  const opportunityCount = input.scoredRows.filter((item) => item.opportunityScore >= 52).length;
  const confidenceChangeCount = input.workflowEvolution?.whatChanged.filter((item) => /confidence|score|quality|conviction/i.test(`${item.title} ${item.metricLabel} ${item.detail}`)).length ?? 0;
  const macroRiskCount = input.triggerMonitorCount + (input.workflowEvolution?.deterioratingSetups.length ?? 0);
  const missedOpportunityCount = input.workflowEvolution?.deterioratingSetups.length ?? 0;
  const watchlistSymbol = input.topWatchlist?.row.symbol ?? input.watchlistSymbols[0] ?? null;
  const opportunitySymbol = input.topOpportunity?.row.symbol ?? null;
  const replaySymbol = input.topReplay?.row.symbol ?? opportunitySymbol ?? watchlistSymbol;
  const riskSymbol = input.topRisk?.row.symbol ?? input.workflowEvolution?.deterioratingSetups[0]?.symbol ?? null;

  return [
    {
      detail: watchlistMoveCount
        ? "Tracked symbols changed enough to deserve a return review before opening unrelated research."
        : input.watchlistSymbols.length
          ? "Watchlist is present, but this snapshot has no measured changed-since-last-session movement yet."
          : "No watchlist is saved yet, so TradeVeto cannot create personalized mover return reasons.",
      eventName: "watchlist_return",
      href: watchlistSymbol ? `/symbol/${encodeURIComponent(watchlistSymbol)}` : "/discover",
      key: "watchlist_movers",
      label: pluralReason(watchlistMoveCount, "watchlist symbol moved", "watchlist symbols moved", input.watchlistSymbols.length ? "No watchlist movement yet" : "Create first watchlist"),
      metricLabel: watchlistMoveCount ? `${watchlistMoveCount} moved` : `${input.watchlistSymbols.length} saved`,
      status: watchlistMoveCount ? "ready" : input.watchlistSymbols.length ? "partial" : "blocked",
      tone: watchlistMoveCount ? "emerald" : input.watchlistSymbols.length ? "cyan" : "amber",
    },
    {
      detail: input.triggerMonitorCount
        ? "Trigger monitors provide a concrete alert-follow-up reason instead of a generic notification."
        : "Alert follow-up is instrumented, but no trigger monitor is currently available in this session snapshot.",
      eventName: "alert_return",
      href: "/alerts",
      key: "triggered_alerts",
      label: pluralReason(input.triggerMonitorCount, "alert triggered", "alerts triggered", "No triggered alerts yet"),
      metricLabel: input.triggerMonitorCount ? `${input.triggerMonitorCount} triggers` : "Needs alert",
      status: input.triggerMonitorCount ? "ready" : "partial",
      tone: input.triggerMonitorCount ? "rose" : "amber",
    },
    {
      detail: opportunitySymbol
        ? `${opportunitySymbol} is the strongest current opportunity anchor from the ranked scanner packet.`
        : "New opportunity return reasons need ranked scanner rows before they can be personalized.",
      eventName: "scanner_return",
      href: "/discover",
      key: "new_opportunities",
      label: pluralReason(opportunityCount, "new opportunity detected", "new opportunities detected", "No high-signal opportunities yet"),
      metricLabel: opportunityCount ? `${opportunityCount} candidates` : "Scanner",
      status: opportunityCount ? "ready" : "partial",
      tone: opportunityCount ? "violet" : "slate",
    },
    {
      detail: input.replayCandidateCount
        ? "Replay and market-memory candidates can reopen research with evidence instead of one-off browsing."
        : "Market memory is available, but this snapshot has limited replay-backed return reasons.",
      eventName: "replay_return",
      href: replaySymbol ? `/market-memory?symbol=${encodeURIComponent(replaySymbol)}` : "/market-memory",
      key: "market_memory_updated",
      label: input.replayCandidateCount ? "Market memory updated" : "Market memory limited",
      metricLabel: input.replayCandidateCount ? `${input.replayCandidateCount} replay candidates` : "Limited",
      status: input.replayCandidateCount ? "ready" : "partial",
      tone: input.replayCandidateCount ? "cyan" : "slate",
    },
    {
      detail: confidenceChangeCount
        ? "Confidence movement is tied to measured workflow evolution, not a fabricated claim."
        : "Confidence-change returns need elapsed workflow snapshots before the product can prove what changed.",
      eventName: "personalized_intelligence_return",
      href: opportunitySymbol ? `/symbol/${encodeURIComponent(opportunitySymbol)}` : "/feed",
      key: "ai_confidence_changed",
      label: confidenceChangeCount ? "AI confidence changed" : "Confidence baseline starting",
      metricLabel: confidenceChangeCount ? `${confidenceChangeCount} changes` : "Baseline",
      status: confidenceChangeCount ? "ready" : "partial",
      tone: confidenceChangeCount ? "emerald" : "amber",
    },
    {
      detail: riskSymbol
        ? `${riskSymbol} is the current macro/risk return anchor from ranked risk and trigger context.`
        : "Macro risk remains a daily check, but this snapshot does not name a single high-confidence risk mover.",
      eventName: "personalized_intelligence_return",
      href: riskSymbol ? `/symbol/${encodeURIComponent(riskSymbol)}` : "/macro",
      key: "macro_risk_changed",
      label: macroRiskCount ? "Macro risk changed" : "Macro risk check",
      metricLabel: macroRiskCount ? `${macroRiskCount} signals` : "Context",
      status: macroRiskCount ? "ready" : "partial",
      tone: macroRiskCount ? "amber" : "slate",
    },
    {
      detail: missedOpportunityCount
        ? "Deteriorating setups are promoted as missed-opportunity review candidates so users learn from what moved without them."
        : "Missed-opportunity review is not populated until deterioration appears in the workflow baseline.",
      eventName: "replay_return",
      href: riskSymbol ? `/history?symbol=${encodeURIComponent(riskSymbol)}` : "/history",
      key: "missed_opportunities",
      label: missedOpportunityCount ? pluralReason(missedOpportunityCount, "missed opportunity", "missed opportunities", "No missed opportunities") : "No missed opportunities",
      metricLabel: missedOpportunityCount ? `${missedOpportunityCount} review` : "Clean",
      status: missedOpportunityCount ? "ready" : "partial",
      tone: missedOpportunityCount ? "rose" : "emerald",
    },
  ];
}

function buildDailySetupCard(input: {
  marketCondition: string;
  replayCandidateCount: number;
  returnReasons: DailyDriverReturnReason[];
  topOpportunity: ScoredOpportunity | null;
  topReplay: ScoredOpportunity | null;
  topWatchlist: ScoredOpportunity | null;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverDailySetupCard {
  const symbol = input.topWatchlist?.row.symbol ?? input.topOpportunity?.row.symbol ?? input.watchlistSymbols[0] ?? "AMD";
  const readyReasons = input.returnReasons.filter((reason) => reason.status === "ready").length;
  const topReason = input.returnReasons.find((reason) => reason.status === "ready") ?? input.returnReasons[0] ?? null;
  const tasks: DailyDriverDailySetupTask[] = [
    {
      detail: `Start with ${input.marketCondition} and the changed-since-last-session summary before drilling into symbols.`,
      eventName: "briefing_return",
      href: "/terminal#daily-market-command",
      key: "daily_briefing",
      label: "Morning Briefing",
      metricLabel: input.workflowEvolution?.lastSeenAt ? "Returning" : "Baseline",
      status: "ready",
      tone: "cyan",
    },
    {
      detail: input.watchlistSymbols.length ? "Review saved symbols first so repeat behavior becomes personal." : "Create the first watchlist to unlock personalized daily movers.",
      eventName: "watchlist_return",
      href: input.watchlistSymbols.length ? `/symbol/${encodeURIComponent(symbol)}` : "/discover",
      key: "watchlist_review",
      label: "Watchlist Review",
      metricLabel: `${input.watchlistSymbols.length} saved`,
      status: input.watchlistSymbols.length ? "ready" : "blocked",
      tone: input.watchlistSymbols.length ? "emerald" : "amber",
    },
    {
      detail: input.topOpportunity ? `${input.topOpportunity.row.symbol} is the top current scanner anchor.` : "Open discovery to create today's market opportunity baseline.",
      eventName: "scanner_return",
      href: "/discover",
      key: "market_opportunities",
      label: "Market Opportunities",
      metricLabel: input.topOpportunity ? `${Math.round(input.topOpportunity.opportunityScore)}/100` : "Scanner",
      status: input.topOpportunity ? "ready" : "partial",
      tone: input.topOpportunity ? "violet" : "slate",
    },
    {
      detail: input.triggerMonitorCount ? "Review triggered monitors and turn only relevant ones into return actions." : "Create an alert so TradeVeto has a concrete reason to pull you back.",
      eventName: "alert_return",
      href: "/alerts",
      key: "alert_follow_up",
      label: "Alert Follow-up",
      metricLabel: input.triggerMonitorCount ? `${input.triggerMonitorCount} triggers` : "Needs alert",
      status: input.triggerMonitorCount ? "ready" : "partial",
      tone: input.triggerMonitorCount ? "rose" : "amber",
    },
    {
      detail: `${symbol} is the fastest symbol follow-up path for chart, risk, catalyst, and confidence review.`,
      eventName: "symbol_return",
      href: `/symbol/${encodeURIComponent(symbol)}`,
      key: "symbol_follow_up",
      label: "Symbol Follow-up",
      metricLabel: symbol,
      status: "ready",
      tone: "emerald",
    },
    {
      detail: "Performance review is a daily task so users learn which scanner, replay, and alert decisions are improving.",
      eventName: "personalized_intelligence_return",
      href: "/performance",
      key: "performance_review",
      label: "Performance Review",
      metricLabel: "Quality",
      status: "partial",
      tone: "cyan",
    },
    {
      detail: input.replayCandidateCount ? `${input.replayCandidateCount} replay candidates can become evidence-backed research follow-ups.` : "Replay review remains available while current candidates are limited.",
      eventName: "replay_return",
      href: `/history?symbol=${encodeURIComponent(input.topReplay?.row.symbol ?? symbol)}`,
      key: "replay_review",
      label: "Replay Review",
      metricLabel: input.replayCandidateCount ? `${input.replayCandidateCount} candidates` : "Limited",
      status: input.replayCandidateCount ? "ready" : "partial",
      tone: input.replayCandidateCount ? "cyan" : "slate",
    },
    {
      detail: "Market Memory updates should reopen prior setups, failures, and analogs without fabricating relationships.",
      eventName: "replay_return",
      href: `/market-memory?symbol=${encodeURIComponent(symbol)}`,
      key: "market_memory_updates",
      label: "Market Memory Updates",
      metricLabel: input.workflowEvolution?.whatChanged.length ? `${input.workflowEvolution.whatChanged.length} changes` : "Memory",
      status: input.workflowEvolution?.lastSeenAt ? "partial" : "blocked",
      tone: input.workflowEvolution?.lastSeenAt ? "violet" : "amber",
    },
  ];

  return {
    detail: readyReasons
      ? `${readyReasons} concrete return reason${readyReasons === 1 ? "" : "s"} are available before the user starts free-form browsing.`
      : "The daily setup card is ready, but the user still needs saved watchlist, alerts, and elapsed workflow memory for stronger return reasons.",
    eventName: "briefing_return",
    key: "daily_setup",
    label: topReason?.label ?? "Daily setup",
    primaryHref: topReason?.href ?? "/terminal#daily-market-command",
    primaryLabel: topReason ? "Open top return reason" : "Start daily setup",
    status: readyReasons >= 3 ? "ready" : readyReasons ? "partial" : "blocked",
    tasks,
    tone: readyReasons >= 3 ? "emerald" : readyReasons ? "cyan" : "amber",
  };
}

function buildNotificationContextRules(input: {
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverNotificationContextRule[] {
  const hasPersonalContext = input.watchlistSymbols.length > 0 || Boolean(input.workflowEvolution?.lastSeenAt);
  return [
    {
      detail: "Every notification must name the source context that caused it instead of sending generic market noise.",
      eventName: "notification_engagement",
      key: "why",
      label: "Why",
      status: hasPersonalContext || input.triggerMonitorCount ? "partial" : "blocked",
      targetLabel: "source context",
      tone: hasPersonalContext ? "cyan" : "amber",
    },
    {
      detail: "Notification cards must explain the concrete changed state, such as severity, category, symbol, trigger, or workflow delta.",
      eventName: "notification_engagement",
      key: "what_changed",
      label: "What changed",
      status: input.workflowEvolution?.whatChanged.length || input.triggerMonitorCount ? "partial" : "blocked",
      targetLabel: "change reason",
      tone: input.workflowEvolution?.whatChanged.length || input.triggerMonitorCount ? "violet" : "amber",
    },
    {
      detail: "Each notification must explain why the change matters to the user workflow before asking for attention.",
      eventName: "notification_engagement",
      key: "why_matters",
      label: "Why it matters",
      status: hasPersonalContext ? "partial" : "blocked",
      targetLabel: "user impact",
      tone: hasPersonalContext ? "emerald" : "amber",
    },
    {
      detail: "The next action must point into a real workflow: alert, scanner, symbol, replay, macro, feed, or briefing.",
      eventName: "notification_engagement",
      key: "next_action",
      label: "What to do next",
      status: "ready",
      targetLabel: "workflow action",
      tone: "cyan",
    },
    {
      detail: "Opened and converted actions are tracked separately so notification value is not confused with drawer opens.",
      eventName: "notification_engagement",
      key: "opened",
      label: "Opened / converted",
      status: "ready",
      targetLabel: "return attribution",
      tone: "emerald",
    },
    {
      detail: "Useful, not useful, ignored, and fatigue signals feed category suppression and alert quality review.",
      eventName: "notification_usefulness_feedback",
      key: "usefulness",
      label: "Useful / ignored",
      status: "ready",
      targetLabel: "> 55% useful",
      tone: "violet",
    },
  ];
}

function buildHabitMetrics(input: {
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverHabitMetric[] {
  const hasContinuity = Boolean(input.workflowEvolution?.lastSeenAt);
  const hasWatchlist = input.watchlistSymbols.length > 0;
  return [
    {
      detail: "Daily active users are read from server-side analytics rollups, not local client estimates.",
      eventName: "analytics_rollup",
      key: "daily_active_users",
      label: "Daily active users",
      status: "partial",
      targetLabel: "DAU",
      tone: "cyan",
    },
    {
      detail: "Weekly active users and DAU/WAU show whether the product is becoming a market routine.",
      eventName: "analytics_rollup",
      key: "weekly_active_users",
      label: "Weekly active users",
      status: "partial",
      targetLabel: "WAU",
      tone: "emerald",
    },
    {
      detail: "Monthly active users separate durable audience from one-week experiments.",
      eventName: "analytics_rollup",
      key: "monthly_active_users",
      label: "Monthly active users",
      status: "partial",
      targetLabel: "MAU",
      tone: "violet",
    },
    {
      detail: "Return sessions require an elapsed local active-day gap and are not counted from same-day browsing.",
      eventName: "return_session",
      key: "return_sessions",
      label: "Return sessions",
      status: hasContinuity ? "ready" : "partial",
      targetLabel: "D2/D7",
      tone: hasContinuity ? "emerald" : "amber",
    },
    {
      detail: "Briefing returns track whether the daily command center becomes the first screen.",
      eventName: "briefing_return",
      key: "briefing_returns",
      label: "Briefing returns",
      status: "ready",
      targetLabel: "morning habit",
      tone: "cyan",
    },
    {
      detail: "Watchlist returns require saved symbols so notifications and daily reviews are personal.",
      eventName: "watchlist_return",
      key: "watchlist_returns",
      label: "Watchlist returns",
      status: hasWatchlist ? "ready" : "blocked",
      targetLabel: "movement review",
      tone: hasWatchlist ? "emerald" : "amber",
    },
    {
      detail: "Alert returns connect a triggered notification to a real product workflow.",
      eventName: "alert_return",
      key: "alert_returns",
      label: "Alert returns",
      status: input.triggerMonitorCount ? "ready" : "partial",
      targetLabel: "> 12%",
      tone: input.triggerMonitorCount ? "rose" : "amber",
    },
    {
      detail: "Replay returns prove users reopen evidence and history rather than only watching current cards.",
      eventName: "replay_return",
      key: "replay_returns",
      label: "Replay returns",
      status: "partial",
      targetLabel: "evidence review",
      tone: "cyan",
    },
    {
      detail: "Compare returns show users are resuming side-by-side decision work.",
      eventName: "compare_return",
      key: "compare_returns",
      label: "Compare returns",
      status: hasContinuity ? "partial" : "blocked",
      targetLabel: "comparison habit",
      tone: hasContinuity ? "violet" : "amber",
    },
    {
      detail: "Symbol returns separate focused research follow-up from generic page traffic.",
      eventName: "symbol_return",
      key: "symbol_returns",
      label: "Symbol returns",
      status: "ready",
      targetLabel: "research loop",
      tone: "emerald",
    },
  ];
}

function buildRetentionTargets(input: {
  persistedWorkspace: boolean;
  triggerMonitorCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverRetentionTarget[] {
  const hasContinuity = Boolean(input.workflowEvolution?.lastSeenAt);
  const hasWatchlist = input.watchlistSymbols.length > 0;
  const hasReturnInfrastructure = hasContinuity && hasWatchlist && input.persistedWorkspace;
  return [
    {
      currentLabel: hasReturnInfrastructure ? "Instrumented" : "Needs cohort",
      detail: "D2 requires users whose first active day has elapsed by at least two days; same-day product work cannot certify it.",
      evidenceLabel: "Elapsed production cohort",
      key: "d2_retention",
      label: "D2 retention",
      status: hasReturnInfrastructure ? "partial" : "blocked",
      targetLabel: "> 10%",
      tone: hasReturnInfrastructure ? "cyan" : "amber",
    },
    {
      currentLabel: hasReturnInfrastructure ? "Instrumented" : "Needs cohort",
      detail: "D7 requires older cohorts and must remain a hard proof gate before any world-class retention claim.",
      evidenceLabel: "Elapsed production cohort",
      key: "d7_retention",
      label: "D7 retention",
      status: "blocked",
      targetLabel: "> 6%",
      tone: "rose",
    },
    {
      currentLabel: hasContinuity ? "Continuity live" : "Baseline starting",
      detail: "Return-session telemetry and active-day depth show whether users build a repeat workflow instead of a single visit.",
      evidenceLabel: "2+ active days",
      key: "active_day_depth",
      label: "2+ active-day retention",
      status: hasContinuity ? "partial" : "blocked",
      targetLabel: "> 15%",
      tone: hasContinuity ? "cyan" : "amber",
    },
    {
      currentLabel: "Feedback live",
      detail: "Useful and not-useful notification feedback is the quality gate for adaptive alerts and fatigue suppression.",
      evidenceLabel: "Useful / total feedback",
      key: "notification_useful_ratio",
      label: "Notification useful ratio",
      status: "partial",
      targetLabel: "> 55%",
      tone: "violet",
    },
    {
      currentLabel: hasWatchlist || input.triggerMonitorCount ? "Return hooks live" : "Needs hooks",
      detail: "Alert return conversion must prove notifications create valuable return sessions, not just noise.",
      evidenceLabel: "Alert returns / alert triggers",
      key: "alert_return_conversion",
      label: "Alert-return conversion",
      status: hasWatchlist || input.triggerMonitorCount ? "partial" : "blocked",
      targetLabel: "> 12%",
      tone: hasWatchlist || input.triggerMonitorCount ? "emerald" : "amber",
    },
  ];
}

function pluralReason(count: number, singular: string, plural: string, empty: string): string {
  if (count <= 0) return empty;
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildTelemetrySignals(input: {
  persistedWorkspace: boolean;
  replayCandidateCount: number;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): DailyDriverTelemetrySignal[] {
  return [
    {
      detail: input.watchlistSymbols.length ? "Activation milestone telemetry can distinguish first watchlist, first scanner, first compare, first alert, first replay, and first symbol investigation." : "Activation milestone telemetry is live, but users still need watchlist creation to complete the activation ladder.",
      eventName: "activation_milestone",
      label: "Activation milestones",
      status: input.watchlistSymbols.length ? "ready" : "partial",
      targetLabel: "First-session activation",
      tone: input.watchlistSymbols.length ? "emerald" : "amber",
    },
    {
      detail: "Route-level telemetry records the start of the morning workflow when users return through Terminal, Scanner, or Feed in morning hours.",
      eventName: "morning_workflow_start",
      label: "Morning workflow start",
      status: "ready",
      targetLabel: "Morning completion",
      tone: "cyan",
    },
    {
      detail: "Briefing return is emitted when users return to the daily setup path, separating first-screen habit from generic Terminal traffic.",
      eventName: "briefing_return",
      label: "Briefing return",
      status: "ready",
      targetLabel: "First screen",
      tone: "cyan",
    },
    {
      detail: "The Daily Driver panel now lets users explicitly complete the briefing, creating a measurable completion signal and local streak memory.",
      eventName: "morning_workflow_complete",
      label: "Morning workflow complete",
      status: "ready",
      targetLabel: "Daily habit UX",
      tone: "emerald",
    },
    {
      detail: input.workflowEvolution?.lastSeenAt ? "Return-session and personalized-return telemetry can connect this visit to a previous workflow baseline." : "The first visit creates the continuity baseline for future return-session measurement.",
      eventName: "return_session",
      label: "Return session",
      status: input.workflowEvolution?.lastSeenAt ? "ready" : "partial",
      targetLabel: "D2/D7 proof",
      tone: input.workflowEvolution?.lastSeenAt ? "emerald" : "amber",
    },
    {
      detail: input.watchlistSymbols.length ? "Watchlist and scanner return events are tied to tracked symbols and saved workflow routes." : "Watchlist return telemetry needs at least one tracked symbol.",
      eventName: "watchlist_return / scanner_return",
      label: "Scanner and watchlist returns",
      status: input.watchlistSymbols.length ? "ready" : "blocked",
      targetLabel: "Repeat workflow",
      tone: input.watchlistSymbols.length ? "violet" : "amber",
    },
    {
      detail: "Chart, compare, and history returns are separated from generic route opens so workflow restore can be audited directly.",
      eventName: "symbol_return / chart_return / compare_return / history_return",
      label: "Symbol, chart, and compare returns",
      status: input.workflowEvolution?.lastSeenAt ? "partial" : "blocked",
      targetLabel: "Continuation proof",
      tone: input.workflowEvolution?.lastSeenAt ? "cyan" : "amber",
    },
    {
      detail: input.replayCandidateCount ? "Replay return is measurable from current replay candidates." : "Replay return telemetry exists but this snapshot has limited replay candidates.",
      eventName: "replay_return",
      label: "Replay return",
      status: input.replayCandidateCount ? "ready" : "partial",
      targetLabel: "Replay reuse",
      tone: input.replayCandidateCount ? "cyan" : "slate",
    },
    {
      detail: input.persistedWorkspace ? "Saved workspace preferences reduce repeat-session setup friction." : "Workspace default state still weakens cross-session habit continuity.",
      eventName: "personalization_update / workflow_continuity",
      label: "Workspace continuity",
      status: input.persistedWorkspace ? "ready" : "partial",
      targetLabel: "Workflow memory",
      tone: input.persistedWorkspace ? "emerald" : "amber",
    },
    {
      detail: "Workflow dropoff records sessions that leave core surfaces without a useful interaction, making abandonment and first-session friction visible.",
      eventName: "workflow_dropoff",
      label: "Workflow dropoff",
      status: "partial",
      targetLabel: "Abandonment down",
      tone: "rose",
    },
    {
      detail: "Notification usefulness feedback feeds fatigue suppression and alert quality review.",
      eventName: "notification_usefulness_feedback",
      label: "Notification usefulness",
      status: "partial",
      targetLabel: "> 55% useful",
      tone: "violet",
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
  blockers.push("Real retention dominance cannot be claimed until production cohorts show D2 > 10%, D7 > 6%, 2+ active-day > 15%, notification usefulness > 55%, and alert-return conversion > 12%.");
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

function workflowContinuationSymbol(workflowEvolution: WorkflowEvolutionSummary | null): string | null {
  const symbol = workflowEvolution?.watchlistEvolution[0]?.symbol
    ?? workflowEvolution?.whatChanged[0]?.symbol
    ?? workflowEvolution?.improvingSetups[0]?.symbol
    ?? workflowEvolution?.deterioratingSetups[0]?.symbol
    ?? workflowEvolution?.triggerMonitors[0]?.symbol
    ?? null;
  return normalizeSymbols(symbol ? [symbol] : [])[0] ?? null;
}

function toneForChange(severity: WorkflowChangeItem["severity"]): DailyDriverTone {
  if (severity === "positive") return "emerald";
  if (severity === "warning") return "amber";
  return "cyan";
}

function changeTypeFor(item: WorkflowChangeItem): DailyDriverChangeSignal["type"] {
  if (item.changeType === "fragility_rising" || item.changeType === "macro_shift") return "deteriorating";
  if (item.changeType === "watchlist_momentum") return "watchlist";
  if (item.changeType === "trigger_approaching") return "trigger";
  if (item.changeType === "memory_starting") return "baseline";
  return "improving";
}

function hrefForPreferredModule(module: WorkspacePreferences["favoriteModules"][number] | null): string {
  if (module === "alerts") return "/alerts";
  if (module === "best_setups" || module === "dangerous" || module === "shock_watch") return "/discover";
  if (module === "macro") return "/macro";
  if (module === "replay") return "/history";
  if (module === "watchlist") return "/terminal#watchlist";
  if (module === "copilot") return "/terminal#copilot";
  return "/terminal#daily-driver-retention";
}

function workflowForPreferredModule(module: WorkspacePreferences["favoriteModules"][number] | null): DailyDriverAction["workflow"] {
  if (module === "alerts") return "alerts";
  if (module === "best_setups" || module === "dangerous" || module === "shock_watch") return "scanner";
  if (module === "macro") return "macro";
  if (module === "replay") return "replay";
  if (module === "watchlist") return "watchlist";
  return "terminal";
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
