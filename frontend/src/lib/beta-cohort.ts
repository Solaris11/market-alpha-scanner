import type { AnalyticsEventName } from "@/lib/analytics-policy";

export const CONTROLLED_BETA_USER_CAP = 25;

export const BETA_COHORT_EVENT_NAMES = [
  "onboarding_complete",
  "onboarding_skip",
  "first_useful_action",
  "watchlist_add",
  "replay_open",
  "strategy_labs_open",
  "support_open",
  "support_message_submit",
  "beta_feedback_open",
  "beta_feedback_submit",
] as const satisfies readonly AnalyticsEventName[];

export type BetaCohortCapStatus = "full" | "near_cap" | "open";
export type BetaCohortReadiness = "blocked" | "needs_attention" | "ready";
export type BetaCohortMetricTone = "bad" | "default" | "good" | "warn";

export type BetaCohortEventCount = {
  count: number;
  eventName: string;
};

export type BetaCohortFeedbackTypeCount = {
  count: number;
  feedbackType: string;
};

export type BetaCohortRecentFeedback = {
  createdAt: string | null;
  feedbackType: string;
  message: string | null;
  pagePath: string | null;
  rating: string;
  symbol: string | null;
};

export type BetaCohortAnalyticsLike = {
  betaCohort?: {
    keyEvents: BetaCohortEventCount[];
    supportTickets: {
      open: number;
      opened: number;
      urgent: number;
    };
  };
  feedback: {
    recent: BetaCohortRecentFeedback[];
    total: number;
    typeCounts: BetaCohortFeedbackTypeCount[];
  };
  journey: Array<{ count: number; key: string }>;
  onboarding: {
    completedUsers: number;
    completionRatePct: number | null;
    eventCompletions: number;
    totalUsers: number;
  };
  retention: {
    averageSessionDepth: number | null;
    dau: number;
    repeatSessions: number;
    totalSessions: number;
    wau: number;
  };
  supportUsage: {
    messages: number;
    promptClicks: number;
  };
  timeRange: string;
  topEvents: BetaCohortEventCount[];
};

export type BetaCohortInput = {
  averageSessionDepth: number | null;
  completedOnboardingUsers: number;
  eventCounts: Record<string, number>;
  feedback: {
    confusing: number;
    issue: number;
    recent: BetaCohortRecentFeedback[];
    total: number;
  };
  firstUsefulActionProxy: number;
  repeatSessions: number;
  support: {
    messages: number;
    openTickets: number;
    ticketsOpened: number;
    urgentTickets: number;
  };
  timeRange: string;
  totalSessions: number;
  totalUsers: number;
  uniqueDailyActiveUsers: number;
  uniqueWeeklyActiveUsers: number;
};

export type BetaCohortMetric = {
  label: string;
  meta: string;
  tone: BetaCohortMetricTone;
  value: string;
};

export type BetaCohortDashboardModel = {
  cap: {
    cap: number;
    enrolledUsers: number;
    label: string;
    remainingSeats: number;
    status: BetaCohortCapStatus;
  };
  escalationProcess: string[];
  feedbackWorkflow: string[];
  funnel: BetaCohortMetric[];
  operations: {
    dailyOpsReview: string[];
    incidentReview: string[];
    llmCostTracking: string[];
    routePerformanceTracking: string[];
    supportReview: string[];
  };
  readiness: {
    label: string;
    reasons: string[];
    status: BetaCohortReadiness;
  };
  recentFeedback: BetaCohortRecentFeedback[];
  retentionPlan: string[];
  rollbackConditions: string[];
  supportMacros: BetaSupportMacro[];
  topMetrics: BetaCohortMetric[];
};

export type BetaSupportMacro = {
  category: "bug" | "confusion" | "incident" | "onboarding" | "research_boundary" | "support";
  id: string;
  response: string;
  title: string;
  trigger: string;
};

export const BETA_SUPPORT_MACROS: BetaSupportMacro[] = [
  {
    category: "onboarding",
    id: "onboarding-start-here",
    title: "First session guidance",
    trigger: "User is unsure where to begin.",
    response: "Start with What Matters Now, review one opportunity, then save a small watchlist. TradeVeto is research software, so the first goal is understanding risk and evidence, not making a trade.",
  },
  {
    category: "confusion",
    id: "wait-framing",
    title: "WAIT or Risk Review confusion",
    trigger: "User thinks WAIT means the product is broken or too negative.",
    response: "WAIT means the current evidence does not meet TradeVeto's quality bar. Use What To Watch to see which condition would make the setup cleaner. It is not a prediction and not financial advice.",
  },
  {
    category: "bug",
    id: "bug-report",
    title: "Bug report request",
    trigger: "User reports a broken page, layout issue, stale data, or confusing result.",
    response: "Please send the page, symbol if relevant, device/browser, approximate time, and a safe screenshot. Do not include passwords, payment details, tokens, or private account credentials.",
  },
  {
    category: "support",
    id: "billing-or-account",
    title: "Billing or account routing",
    trigger: "User has checkout, entitlement, renewal, cancellation, or account-access trouble.",
    response: "Open a support ticket with the account email and a brief description. Stripe billing details should be handled through the billing portal; support can help if app access and Stripe state disagree.",
  },
  {
    category: "incident",
    id: "incident-pause-invites",
    title: "Possible launch incident",
    trigger: "Repeated reports affect login, billing, core routes, data freshness, or premium access.",
    response: "Pause new invites, capture the impacted route, user count, first report time, health state, and recent deploy SHA, then escalate as P0/P1 based on user impact.",
  },
  {
    category: "research_boundary",
    id: "not-financial-advice",
    title: "Research-only boundary",
    trigger: "User asks whether they should buy, sell, enter, or exit.",
    response: "TradeVeto cannot tell you to buy or sell. It can explain evidence, risks, timing quality, and what conditions to monitor so you can do independent research.",
  },
];

export function betaCohortInputFromAnalytics(analytics: BetaCohortAnalyticsLike): BetaCohortInput {
  const eventCounts = eventCountsFromAnalytics(analytics);
  const feedbackTypeCounts = new Map(analytics.feedback.typeCounts.map((row) => [row.feedbackType, safeCount(row.count)]));
  const journeyCount = countByKey(analytics.journey);
  const supportTickets = analytics.betaCohort?.supportTickets ?? { open: 0, opened: 0, urgent: 0 };
  const replayUsage = eventCounts.replay_open ?? 0;
  const strategyLabsUsage = eventCounts.strategy_labs_open ?? 0;
  const watchlistCreates = eventCounts.watchlist_add ?? 0;
  const firstUsefulActionProxy = Math.max(eventCounts.first_useful_action ?? 0, watchlistCreates, replayUsage, strategyLabsUsage, journeyCount.get("terminal_symbol_watchlist") ?? 0);

  return {
    averageSessionDepth: analytics.retention.averageSessionDepth,
    completedOnboardingUsers: safeCount(analytics.onboarding.completedUsers),
    eventCounts,
    feedback: {
      confusing: safeCount(feedbackTypeCounts.get("confusing_signal")) + safeCount(feedbackTypeCounts.get("onboarding_confusion")),
      issue: safeCount(feedbackTypeCounts.get("issue")) + safeCount(feedbackTypeCounts.get("bug_report")) + safeCount(feedbackTypeCounts.get("performance_issue")),
      recent: analytics.feedback.recent,
      total: safeCount(analytics.feedback.total),
    },
    firstUsefulActionProxy,
    repeatSessions: safeCount(analytics.retention.repeatSessions),
    support: {
      messages: safeCount(analytics.supportUsage.messages),
      openTickets: safeCount(supportTickets.open),
      ticketsOpened: safeCount(supportTickets.opened),
      urgentTickets: safeCount(supportTickets.urgent),
    },
    timeRange: analytics.timeRange,
    totalSessions: safeCount(analytics.retention.totalSessions),
    totalUsers: safeCount(analytics.onboarding.totalUsers),
    uniqueDailyActiveUsers: safeCount(analytics.retention.dau),
    uniqueWeeklyActiveUsers: safeCount(analytics.retention.wau),
  };
}

export function buildBetaCohortDashboardModel(input: BetaCohortInput, cap = CONTROLLED_BETA_USER_CAP): BetaCohortDashboardModel {
  const enrolledUsers = Math.min(safeCount(input.totalUsers), cap);
  const remainingSeats = Math.max(0, cap - enrolledUsers);
  const capStatus = betaCapStatus(enrolledUsers, cap);
  const onboardingPct = pct(input.completedOnboardingUsers, enrolledUsers);
  const firstUsefulPct = pct(input.firstUsefulActionProxy, enrolledUsers);
  const watchlistCreates = safeCount(input.eventCounts.watchlist_add);
  const replayUsage = safeCount(input.eventCounts.replay_open);
  const strategyLabsUsage = safeCount(input.eventCounts.strategy_labs_open);
  const confusionPoints = input.feedback.confusing + input.feedback.issue + input.support.messages;
  const supportPressure = input.support.openTickets + input.support.urgentTickets;
  const readiness = betaReadiness({ capStatus, confusionPoints, firstUsefulPct, onboardingPct, supportPressure });

  return {
    cap: {
      cap,
      enrolledUsers,
      label: `${enrolledUsers}/${cap} seats used`,
      remainingSeats,
      status: capStatus,
    },
    escalationProcess: [
      "P0: app down, broken auth, wrong billing entitlement, secret exposure, or data corruption. Pause invites and roll back if deploy-related.",
      "P1: deep health failure, repeated scanner/data freshness failures, Stripe webhook failures, email auth failures, or LLM cost runaway. Pause paid growth until mitigated.",
      "P2: repeated onboarding confusion, route budget miss, mobile layout blocker, or support backlog. Hold at current cap until fixed.",
      "P3: copy polish, isolated UI awkwardness, or docs gaps. Track during daily review without blocking the cohort.",
    ],
    feedbackWorkflow: [
      "Use the floating Beta Feedback form for quick confusion, issue, feature request, and bug signals.",
      "Escalate account-specific, billing, or reproducible workflow bugs into Support Tickets.",
      "Tag feedback by page, symbol, device type, and severity; never request passwords, tokens, payment credentials, or private brokerage data.",
      "Review confusing-signal and bug-report feedback every day before sending more invites.",
    ],
    funnel: [
      metric("Onboarding completion", formatPct(onboardingPct), `${input.completedOnboardingUsers}/${enrolledUsers || cap} users`, toneForPct(onboardingPct, 70, 45)),
      metric("First useful action", formatPct(firstUsefulPct), `${input.firstUsefulActionProxy} watchlist, replay, Strategy Labs, or symbol-depth actions`, toneForPct(firstUsefulPct, 60, 35)),
      metric("Watchlist creation", formatCount(watchlistCreates), "Primary activation action", watchlistCreates > 0 ? "good" : "warn"),
      metric("Replay usage", formatCount(replayUsage), "Proof and trust workflow", replayUsage > 0 ? "good" : "default"),
      metric("Strategy Labs engagement", formatCount(strategyLabsUsage), "Advanced beta workflow", strategyLabsUsage > 0 ? "good" : "default"),
      metric("Daily revisits", formatCount(input.uniqueDailyActiveUsers), `${input.uniqueWeeklyActiveUsers} weekly active users`, input.uniqueDailyActiveUsers > 0 ? "good" : "default"),
    ],
    operations: {
      dailyOpsReview: [
        "Check /api/health, /api/health/deep, monitoring synthetics, system metrics, and latest backup status.",
        "Review new users, onboarding completion, first useful actions, daily revisits, support tickets, and confusion feedback.",
        "Check Stripe webhook delivery, email canaries, LLM spend, cache hits, blocked LLM calls, and route performance budgets.",
        "Record GO / HOLD / PAUSE before sending additional invites.",
      ],
      incidentReview: [
        "Capture time, severity, impacted route, user impact, health state, recent deploy SHA, suspected cause, action taken, owner, and next update time.",
        "Preserve examples from support tickets and beta feedback before changing code or data.",
        "After recovery, document whether invites can resume, remain paused, or require rollback.",
      ],
      llmCostTracking: [
        "Use /admin/monitoring for LLM spend today, monthly run-rate, cache hits, blocked calls, and recent LLM events.",
        "Hold invites if daily spend passes 80% of the configured cap before the planned cohort usage level.",
      ],
      routePerformanceTracking: [
        "Use /admin/monitoring and the performance budget check for terminal, dashboard, opportunities, symbol detail, history/replay, and Strategy Labs.",
        "Hold invite expansion if route p95 budget misses repeat or if mobile users report loading confusion.",
      ],
      supportReview: [
        "Review open and urgent tickets first, then beta feedback themes.",
        "Convert repeated confusion into onboarding copy, support FAQ, or UI wording fixes.",
        "Pause expansion if unresolved P1/P2 support load exceeds operator capacity.",
      ],
    },
    readiness,
    recentFeedback: input.feedback.recent.slice(0, 8),
    retentionPlan: [
      "Activation: onboarding completed and first useful action within the first session.",
      "Engagement: watchlist creation, symbol detail visits, replay usage, Strategy Labs visits, and support/help interactions.",
      "Retention: DAU/WAU, repeat sessions, session depth, daily revisits, and watchlist revisit behavior.",
      "Quality: confusion feedback, bug reports, support ticket severity, route performance, and LLM budget pressure.",
    ],
    rollbackConditions: [
      "/api/health fails for more than two minutes.",
      "/api/health/deep reports DB, backup, scanner, or critical dependency failure.",
      "Signup, login, onboarding, billing, cancellation, or premium entitlement becomes misleading or broken.",
      "Repeated support reports show the same blocking workflow or data trust issue.",
      "LLM spend crosses 80% of daily cap before expected cohort usage.",
      "Terminal, dashboard, opportunities, symbol detail, replay, or Strategy Labs p95 latency stays over budget.",
    ],
    supportMacros: BETA_SUPPORT_MACROS,
    topMetrics: [
      metric("Cohort cap", `${enrolledUsers}/${cap}`, `${remainingSeats} seats remaining`, capStatus === "full" ? "warn" : capStatus === "near_cap" ? "warn" : "good"),
      metric("Onboarding", formatPct(onboardingPct), `${input.completedOnboardingUsers} completed`, toneForPct(onboardingPct, 70, 45)),
      metric("First useful action", formatPct(firstUsefulPct), `${input.firstUsefulActionProxy} activation actions`, toneForPct(firstUsefulPct, 60, 35)),
      metric("Support tickets", formatCount(input.support.openTickets), `${input.support.ticketsOpened} opened in range`, input.support.urgentTickets > 0 ? "bad" : input.support.openTickets > 3 ? "warn" : "good"),
      metric("Confusion points", formatCount(confusionPoints), "Feedback issues + support messages", confusionPoints > 8 ? "warn" : "default"),
      metric("Avg session depth", input.averageSessionDepth === null ? "N/A" : input.averageSessionDepth.toFixed(1), `${input.repeatSessions} repeat sessions`, input.averageSessionDepth !== null && input.averageSessionDepth >= 4 ? "good" : "default"),
    ],
  };
}

export function betaCapStatus(enrolledUsers: number, cap = CONTROLLED_BETA_USER_CAP): BetaCohortCapStatus {
  const normalizedCap = Math.max(1, safeCount(cap));
  const normalizedUsers = safeCount(enrolledUsers);
  if (normalizedUsers >= normalizedCap) return "full";
  if (normalizedUsers >= Math.ceil(normalizedCap * 0.8)) return "near_cap";
  return "open";
}

function betaReadiness(input: {
  capStatus: BetaCohortCapStatus;
  confusionPoints: number;
  firstUsefulPct: number | null;
  onboardingPct: number | null;
  supportPressure: number;
}): BetaCohortDashboardModel["readiness"] {
  const reasons: string[] = [];
  if (input.capStatus === "full") reasons.push("25-user cap is full. Pause invites unless an operator explicitly expands the cohort.");
  if (input.supportPressure >= 5) reasons.push("Support pressure is elevated. Clear open or urgent tickets before adding more users.");
  if (input.confusionPoints >= 10) reasons.push("Confusion or issue reports are clustering. Review feedback before expanding invites.");
  if (input.onboardingPct !== null && input.onboardingPct < 45) reasons.push("Onboarding completion is weak for a controlled cohort.");
  if (input.firstUsefulPct !== null && input.firstUsefulPct < 30) reasons.push("Too few users are reaching a useful first action.");

  if (input.capStatus === "full" || input.supportPressure >= 8) {
    return { label: "Hold invites", reasons: reasons.length ? reasons : ["Cohort needs operator review before expansion."], status: "blocked" };
  }
  if (reasons.length) return { label: "Needs attention", reasons, status: "needs_attention" };
  return { label: "Ready for measured invites", reasons: ["Core beta funnel and support pressure are inside the controlled-cohort guardrails."], status: "ready" };
}

function eventCountsFromAnalytics(analytics: BetaCohortAnalyticsLike): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of [...analytics.topEvents, ...(analytics.betaCohort?.keyEvents ?? [])]) {
    counts[row.eventName] = Math.max(safeCount(row.count), counts[row.eventName] ?? 0);
  }
  return counts;
}

function countByKey(rows: Array<{ count: number; key: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.key, safeCount(row.count));
  return counts;
}

function metric(label: string, value: string, meta: string, tone: BetaCohortMetricTone): BetaCohortMetric {
  return { label, meta, tone, value };
}

function toneForPct(value: number | null, goodThreshold: number, warnThreshold: number): BetaCohortMetricTone {
  if (value === null) return "default";
  if (value >= goodThreshold) return "good";
  if (value >= warnThreshold) return "warn";
  return "bad";
}

function pct(numerator: number, denominator: number): number | null {
  const safeDenominator = safeCount(denominator);
  if (safeDenominator <= 0) return null;
  return Math.min(100, Math.max(0, (safeCount(numerator) / safeDenominator) * 100));
}

function formatPct(value: number | null): string {
  if (value === null) return "N/A";
  return `${Math.round(value)}%`;
}

function formatCount(value: number): string {
  return safeCount(value).toLocaleString();
}

function safeCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}
