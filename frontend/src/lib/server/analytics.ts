import "server-only";

import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";
import { BETA_COHORT_EVENT_NAMES } from "@/lib/beta-cohort";
import {
  normalizeAnalyticsDevice,
  normalizeAnalyticsEventName,
  normalizeAnalyticsRange,
  normalizeFeedbackRating,
  normalizeFeedbackType,
  sanitizeAnalyticsMetadata,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsSource,
  sanitizeAnalyticsSymbol,
  sanitizeFeedbackMessage,
  type AnalyticsEventName,
  type AnalyticsTimeRange,
  type SanitizedAnalyticsEvent,
} from "@/lib/analytics-policy";
import { buildRealUserDominanceProof, type RealUserDominanceProof } from "@/lib/real-user-dominance";
import type { AuthUser } from "./auth";
import { dbQuery } from "./db";
import { getEntitlementForUser, entitlementSummary } from "./entitlements";

export type AnalyticsEventPayload = {
  anonymousId?: unknown;
  deviceType?: unknown;
  eventName?: unknown;
  metadata?: unknown;
  occurredAt?: unknown;
  pagePath?: unknown;
  sessionId?: unknown;
  source?: unknown;
  symbol?: unknown;
};

export type BetaFeedbackPayload = {
  anonymousId?: unknown;
  feedbackType?: unknown;
  message?: unknown;
  metadata?: unknown;
  pagePath?: unknown;
  rating?: unknown;
  sessionId?: unknown;
  symbol?: unknown;
};

export type AnalyticsSummary = {
  activeUsersTrend: Array<{ activeUsers: number; bucket: string; events: number }>;
  betaCohort: {
    keyEvents: Array<{ count: number; eventName: string }>;
    supportTickets: {
      open: number;
      opened: number;
      urgent: number;
    };
  };
  feedback: {
    recent: Array<{ createdAt: string | null; feedbackType: string; message: string | null; pagePath: string | null; rating: string; symbol: string | null }>;
    total: number;
    typeCounts: Array<{ count: number; feedbackType: string }>;
  };
  journey: Array<{ count: number; description: string; key: string }>;
  livingTelemetry: {
    feedEngagement: number;
    firstUsefulAction: number;
    notificationEngagement: number;
    replayUsage: number;
    scannerUsage: number;
    strategyUsage: number;
    watchlistUsage: number;
  };
  onboarding: {
    completedUsers: number;
    completionRatePct: number | null;
    eventCompletions: number;
    totalUsers: number;
  };
  retention: {
    activeUsers: number;
    averageSessionDepth: number | null;
    averageSessionDurationSeconds: number | null;
    dau: number;
    repeatSessions: number;
    totalEvents: number;
    totalSessions: number;
    wau: number;
  };
  realUserProof: {
    adaptiveBehavior: {
      adaptiveProofScore: number;
      decisionMemoryActions: number;
      experimentExposure: number;
      personalizationUpdates: number;
      workflowContinuity: number;
      workflowVisits: number;
    };
    dominanceProof: RealUserDominanceProof;
    engagementTrends: Array<{ activeUsers: number; bucket: string; featureEvents: number; firstUsefulActions: number; frictionEvents: number; workflowContinuity: number }>;
    featureAdoption: Array<{ activeUsers: number; adoptionRatePct: number | null; events: number; feature: string }>;
    mobileEngagement: {
      activeUsers: number;
      events: number;
      feedEngagement: number;
      firstUsefulActions: number;
      frictionEvents: number;
      mobileSharePct: number | null;
      scannerUsage: number;
    };
    notificationUsefulness: {
      categoryBreakdown: Array<{
        category: string;
        fatigueSignals: number;
        notUseful: number;
        total: number;
        useful: number;
        usefulnessRatePct: number | null;
      }>;
      durableFeedbackTotal: number;
      durableNotUsefulFeedback: number;
      durableUsefulFeedback: number;
      eligibleSignals: number;
      engaged: number;
      explicitNotUsefulFeedback: number;
      explicitUsefulFeedback: number;
      fatigueSignals: number;
      preferenceUpdates: number;
      usefulInteractions: number;
      usefulnessRatePct: number | null;
    };
    dailyDriver: {
      cohortEvidence: {
        day2EligibleUsers: number;
        day2RetainedUsers: number;
        day2RetentionRatePct: number | null;
        day1EligibleUsers: number;
        day1RetainedUsers: number;
        day1RetentionRatePct: number | null;
        day7EligibleUsers: number;
        day7RetainedUsers: number;
        day7RetentionRatePct: number | null;
        sevenPlusActiveDayRatePct: number | null;
        sevenPlusActiveDayUsers: number;
        totalActiveDayUsers: number;
        twoPlusActiveDayRatePct: number | null;
        twoPlusActiveDayUsers: number;
      };
      habitLoops: {
        activationMilestones: number;
        alertReturns: number;
        chartReturns: number;
        compareReturns: number;
        historyReturns: number;
        morningWorkflowCompletions: number;
        morningWorkflows: number;
        personalizedReturns: number;
        replayReturns: number;
        returnSessions: number;
        scannerHabitLoops: number;
        scannerReturns: number;
        strategyReturns: number;
        watchlistReturns: number;
        workflowDropoffs: number;
      };
      notificationFeedback: {
        fatigueSignals: number;
        notUseful: number;
        total: number;
        useful: number;
        usefulnessFeedbackRatePct: number | null;
      };
    };
    watchlistRetention: {
      retainedSessions: number;
      retentionRatePct: number | null;
      returningWatchlistUsers: number;
      watchlistActions: number;
      watchlistUsers: number;
    };
    retentionCurve: Array<{ dayOffset: number; eligibleUsers: number; retainedUsers: number; retentionRatePct: number | null }>;
    workflowStickiness: {
      feedToWatchlistSessions: number;
      multiWorkflowSessions: number;
      replayToStrategySessions: number;
      scannerToSymbolSessions: number;
      stickySessionRatePct: number | null;
      totalSessions: number;
      workflowContinuityEvents: number;
    };
  };
  supportUsage: {
    helpful: number;
    messages: number;
    promptClicks: number;
    unhelpful: number;
  };
  timeRange: AnalyticsTimeRange;
  topEvents: Array<{ count: number; eventName: string }>;
  topPages: Array<{ count: number; pagePath: string }>;
  topSymbols: Array<{ count: number; symbol: string }>;
  visitorInsights: {
    anonymousVisitors: number;
    averageSessionDurationSeconds: number | null;
    browserBreakdown: Array<{ browserFamily: string; count: number }>;
    deviceBreakdown: Array<{ count: number; deviceType: string }>;
    geography: Array<{ city: string | null; count: number; country: string; region: string | null; timezone: string | null }>;
    pageViewsByDay: Array<{ bucket: string; pageViews: number; sessions: number; uniqueVisitors: number }>;
    repeatVisitorCount: number;
    signedInUsers: number;
    topEntryPages: Array<{ count: number; pagePath: string }>;
    topExitPages: Array<{ count: number; pagePath: string }>;
    topPagesOverTime: Array<{ bucket: string; count: number; pagePath: string }>;
    totalPageViews: number;
    uniqueVisitors: number;
  };
  waitFirst: {
    readinessOpens: number;
    signalDrilldowns: number;
    vetoExplanationOpens: number;
    waitEngagement: number;
  };
  uxInsights: {
    experimentExposure: Array<{ count: number; experiment: string; variant: string }>;
    firstUsefulAction: {
      averageElapsedSeconds: number | null;
      count: number;
      topActions: Array<{ action: string; averageElapsedSeconds: number | null; count: number }>;
    };
    flowAbandonment: Array<{ count: number; eventName: string; pagePath: string }>;
    frictionEvents: Array<{ count: number; eventName: string }>;
    frictionHotspots: Array<{ component: string; count: number; eventName: string; pagePath: string }>;
    interactionQuality: {
      backNavigations: number;
      duplicateClicks: number;
      failedActions: number;
      modalAbandons: number;
      rageClicks: number;
      scrollAbandons: number;
    };
  };
};

type CountRow = QueryResultRow & { count: string | number };
type RetentionRow = QueryResultRow & {
  active_users: string | number;
  avg_session_depth: string | number | null;
  avg_session_duration_seconds: string | number | null;
  repeat_sessions: string | number;
  total_events: string | number;
  total_sessions: string | number;
};
type TrendRow = QueryResultRow & {
  active_users: string | number;
  bucket: string;
  events: string | number;
};
type EventCountRow = QueryResultRow & {
  count: string | number;
  event_name: string;
};
type PageCountRow = QueryResultRow & {
  count: string | number;
  page_path: string;
};
type SymbolCountRow = QueryResultRow & {
  count: string | number;
  symbol: string;
};
type OnboardingRow = QueryResultRow & {
  completed_users: string | number;
  total_users: string | number;
};
type WaitFirstRow = QueryResultRow & {
  readiness_opens: string | number;
  signal_drilldowns: string | number;
  veto_explanation_opens: string | number;
  wait_engagement: string | number;
};
type SupportUsageRow = QueryResultRow & {
  helpful: string | number;
  messages: string | number;
  prompt_clicks: string | number;
  unhelpful: string | number;
};
type JourneyRow = QueryResultRow & {
  alerts_repeat: string | number;
  onboarding_symbol: string | number;
  opportunities_support: string | number;
  terminal_symbol_watchlist: string | number;
};
type FeedbackRow = QueryResultRow & {
  created_at: string | null;
  feedback_type: string;
  message: string | null;
  page_path: string | null;
  rating: string;
  symbol: string | null;
};
type FeedbackTypeRow = QueryResultRow & {
  count: string | number;
  feedback_type: string;
};
type SupportTicketCohortRow = QueryResultRow & {
  open_count: string | number;
  opened: string | number;
  urgent_count: string | number;
};
type VisitorSummaryRow = QueryResultRow & {
  anonymous_visitors: string | number;
  repeat_visitor_count: string | number;
  signed_in_users: string | number;
  total_page_views: string | number;
  unique_visitors: string | number;
};
type PageTrendRow = QueryResultRow & {
  bucket: string;
  page_views: string | number;
  sessions: string | number;
  unique_visitors: string | number;
};
type TopPageTimeRow = QueryResultRow & {
  bucket: string;
  count: string | number;
  page_path: string;
};
type GeoRow = QueryResultRow & {
  city: string | null;
  count: string | number;
  country: string;
  region: string | null;
  timezone: string | null;
};
type DeviceRow = QueryResultRow & {
  count: string | number;
  label: string;
};
type FrictionHotspotRow = QueryResultRow & {
  component: string;
  count: string | number;
  event_name: string;
  page_path: string;
};
type FirstUsefulActionRow = QueryResultRow & {
  avg_elapsed_ms: string | number | null;
  count: string | number;
};
type FirstUsefulActionByActionRow = QueryResultRow & {
  action: string;
  avg_elapsed_ms: string | number | null;
  count: string | number;
};
type FlowAbandonmentRow = QueryResultRow & {
  count: string | number;
  event_name: string;
  page_path: string;
};
type ExperimentExposureRow = QueryResultRow & {
  count: string | number;
  experiment: string;
  variant: string;
};
type LivingTelemetryRow = QueryResultRow & {
  feed_engagement: string | number;
  first_useful_action: string | number;
  notification_engagement: string | number;
  replay_usage: string | number;
  scanner_usage: string | number;
  strategy_usage: string | number;
  watchlist_usage: string | number;
};
type EngagementTrendProofRow = QueryResultRow & {
  active_users: string | number;
  bucket: string;
  feature_events: string | number;
  first_useful_actions: string | number;
  friction_events: string | number;
  workflow_continuity: string | number;
};
type FeatureAdoptionRow = QueryResultRow & {
  active_users: string | number;
  events: string | number;
  feature: string;
};
type WorkflowStickinessRow = QueryResultRow & {
  feed_to_watchlist_sessions: string | number;
  multi_workflow_sessions: string | number;
  replay_to_strategy_sessions: string | number;
  scanner_to_symbol_sessions: string | number;
  total_sessions: string | number;
  workflow_continuity_events: string | number;
};
type MobileEngagementProofRow = QueryResultRow & {
  active_users: string | number;
  events: string | number;
  feed_engagement: string | number;
  first_useful_actions: string | number;
  friction_events: string | number;
  scanner_usage: string | number;
};
type NotificationUsefulnessRow = QueryResultRow & {
  eligible_signals: string | number;
  engaged: string | number;
  explicit_not_useful_feedback: string | number;
  explicit_useful_feedback: string | number;
  fatigue_signals: string | number;
  preference_updates: string | number;
  useful_interactions: string | number;
};
type NotificationFeedbackCategoryRow = QueryResultRow & {
  category: string;
  not_useful: string | number;
  total: string | number;
  useful: string | number;
};
type DailyDriverHabitLoopRow = QueryResultRow & {
  activation_milestones: string | number;
  alert_returns: string | number;
  chart_returns: string | number;
  compare_returns: string | number;
  history_returns: string | number;
  morning_workflow_completions: string | number;
  morning_workflows: string | number;
  personalized_returns: string | number;
  replay_returns: string | number;
  return_sessions: string | number;
  scanner_habit_loops: string | number;
  scanner_returns: string | number;
  strategy_returns: string | number;
  watchlist_returns: string | number;
  workflow_dropoffs: string | number;
};
type AdaptiveBehaviorProofRow = QueryResultRow & {
  decision_memory_actions: string | number;
  experiment_exposure: string | number;
  personalization_updates: string | number;
  workflow_continuity: string | number;
  workflow_visits: string | number;
};
type WatchlistRetentionProofRow = QueryResultRow & {
  retained_sessions: string | number;
  returning_watchlist_users: string | number;
  watchlist_actions: string | number;
  watchlist_users: string | number;
};
type RetentionCurveProofRow = QueryResultRow & {
  day_offset: string | number;
  eligible_users: string | number;
  retained_users: string | number;
};
type ActiveDayDepthProofRow = QueryResultRow & {
  active_day_users: string | number;
  seven_plus_active_day_users: string | number;
  two_plus_active_day_users: string | number;
};

const MAX_EVENTS_PER_REQUEST = 24;
const FRICTION_EVENT_NAMES = [
  "back_navigation",
  "bottom_sheet_close",
  "duplicate_click",
  "failed_action",
  "modal_abandon",
  "nav_confusion",
  "rage_click",
  "scroll_abandon",
  "workflow_dropoff",
] as const;
const CORE_FEATURE_EVENT_NAMES = [
  "alert_create",
  "activation_milestone",
  "chart_expand",
  "chart_return",
  "compare_return",
  "feed_engagement",
  "history_return",
  "morning_workflow_complete",
  "morning_workflow_start",
  "notification_engagement",
  "personalized_intelligence_return",
  "return_session",
  "alert_return",
  "strategy_return",
  "replay_return",
  "scanner_habit_loop",
  "scanner_return",
  "replay_usage",
  "scanner_usage",
  "strategy_usage",
  "watchlist_return",
  "watchlist_usage",
  "workflow_continuity",
] as const;
const SCANNER_FEATURE_EVENTS = ["scanner_usage", "scanner_return", "scanner_habit_loop", "scanner_run", "opportunities_open", "signal_drilldown"] as const;
const FEED_FEATURE_EVENTS = ["feed_engagement", "feed_item_open"] as const;
const REPLAY_FEATURE_EVENTS = ["replay_usage", "replay_return", "replay_open"] as const;
const STRATEGY_FEATURE_EVENTS = ["strategy_usage", "strategy_labs_open", "strategy_return"] as const;
const WATCHLIST_FEATURE_EVENTS = ["watchlist_usage", "watchlist_return", "watchlist_add", "watch_add", "watchlist_retention"] as const;
const NOTIFICATION_FEATURE_EVENTS = ["notification_engagement", "notification_usefulness_feedback", "alert_create", "alert_return"] as const;
const MOBILE_FEATURE_EVENTS = ["mobile_engagement"] as const;

export async function recordAnalyticsEvents(input: { events: AnalyticsEventPayload[]; request: Request; user: AuthUser | null }): Promise<{ inserted: number }> {
  const events = input.events.map(sanitizeEventPayload).filter((event): event is SanitizedAnalyticsEvent => event !== null).slice(0, MAX_EVENTS_PER_REQUEST);
  if (!events.length) return { inserted: 0 };

  const entitlement = await getEntitlementForUser(input.user).catch(() => null);
  const plan = entitlement ? entitlementSummary(entitlement).plan : input.user ? "free" : "anonymous";
  const userId = input.user?.id ?? null;
  const requestContext = analyticsRequestContext(input.request);

  for (const event of events) {
    await dbQuery(
      `
        INSERT INTO analytics_events
          (user_id, anonymous_id_hash, session_id_hash, event_name, page_path, symbol, source, device_type, browser_family, os_family, country, region, city, timezone, plan, metadata, occurred_at, created_at)
        VALUES
          ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::timestamptz, now())
      `,
      [
        userId,
        hashIdentifier(event.anonymousId),
        hashIdentifier(event.sessionId),
        event.eventName,
        event.pagePath,
        event.symbol,
        event.source,
        event.deviceType,
        requestContext.browserFamily,
        requestContext.osFamily,
        requestContext.country,
        requestContext.region,
        requestContext.city,
        requestContext.timezone,
        plan,
        JSON.stringify(event.metadata),
        event.occurredAt,
      ],
    );
  }

  return { inserted: events.length };
}

export async function recordBetaFeedback(input: { payload: BetaFeedbackPayload; request: Request; user: AuthUser | null }): Promise<{ id: string }> {
  const feedbackType = normalizeFeedbackType(input.payload.feedbackType);
  const rating = normalizeFeedbackRating(input.payload.rating);
  const pagePath = sanitizeAnalyticsPath(input.payload.pagePath);
  const symbol = sanitizeAnalyticsSymbol(input.payload.symbol);
  const message = sanitizeFeedbackMessage(input.payload.message);
  const metadata = sanitizeAnalyticsMetadata(input.payload.metadata);
  const anonymousIdHash = hashIdentifier(input.payload.anonymousId);
  const sessionIdHash = hashIdentifier(input.payload.sessionId);

  const result = await dbQuery<QueryResultRow & { id: string }>(
    `
      INSERT INTO beta_feedback
        (user_id, anonymous_id_hash, session_id_hash, feedback_type, page_path, symbol, rating, message, metadata, created_at)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
      RETURNING id::text
    `,
    [input.user?.id ?? null, anonymousIdHash, sessionIdHash, feedbackType, pagePath, symbol, rating, message, JSON.stringify(metadata)],
  );

  await recordAnalyticsEvents({
    events: [{
      anonymousId: input.payload.anonymousId,
      deviceType: metadata.deviceType,
      eventName: "beta_feedback_submit",
      metadata: { feedbackType, rating },
      occurredAt: new Date().toISOString(),
      pagePath,
      sessionId: input.payload.sessionId,
      source: "beta_feedback_widget",
      symbol,
    }],
    request: input.request,
    user: input.user,
  });

  return { id: result.rows[0]?.id ?? "" };
}

export async function getAnalyticsSummary(rangeInput: unknown): Promise<AnalyticsSummary> {
  const timeRange = normalizeAnalyticsRange(rangeInput);
  const interval = intervalForRange(timeRange);
  const bucket = bucketForRange(timeRange);
  const [
    retention,
    dau,
    wau,
    trend,
    topPages,
    topEvents,
    topSymbols,
    onboarding,
    onboardingEvents,
    waitFirst,
    supportUsage,
    betaCohortEvents,
    supportTickets,
    journey,
    feedbackTotal,
    feedbackTypes,
    feedbackRecent,
    visitorSummary,
    entryPages,
    exitPages,
    pageTrend,
    topPagesOverTime,
    geography,
    deviceBreakdown,
    browserBreakdown,
    osBreakdown,
    frictionEvents,
    frictionHotspots,
    firstUsefulAction,
    firstUsefulActionsByAction,
    flowAbandonment,
    experimentExposure,
    livingTelemetry,
    engagementTrendProof,
    featureAdoptionProof,
    workflowStickinessProof,
    mobileEngagementProof,
    notificationUsefulnessProof,
    notificationFeedbackCategoryProof,
    dailyDriverHabitLoopProof,
    adaptiveBehaviorProof,
    watchlistRetentionProof,
    retentionCurveProof,
    activeDayDepthProof,
  ] = await Promise.all([
    dbQuery<RetentionRow>(
      `
        WITH session_rollup AS (
          SELECT
            COALESCE(session_id_hash, user_id::text, anonymous_id_hash, id::text) AS session_key,
            COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text) AS actor_key,
            count(*) AS event_count,
            EXTRACT(EPOCH FROM (max(occurred_at) - min(occurred_at))) AS duration_seconds
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval}
          GROUP BY 1, 2
        )
        SELECT
          count(DISTINCT actor_key) AS active_users,
          count(*) AS total_sessions,
          COALESCE(sum(event_count), 0) AS total_events,
          count(*) FILTER (WHERE event_count > 1) AS repeat_sessions,
          avg(event_count)::float AS avg_session_depth,
          avg(duration_seconds)::float AS avg_session_duration_seconds
        FROM session_rollup
      `,
    ),
    activeUsersForInterval("interval '24 hours'"),
    activeUsersForInterval("interval '7 days'"),
    dbQuery<TrendRow>(
      `
        SELECT
          date_trunc('${bucket}', occurred_at)::text AS bucket,
          count(*) AS events,
          count(DISTINCT COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text)) AS active_users
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
        GROUP BY 1
        ORDER BY 1
      `,
    ),
    dbQuery<PageCountRow>(
      `
        SELECT COALESCE(page_path, 'unknown') AS page_path, count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval} AND event_name = 'page_view'
        GROUP BY 1
        ORDER BY count DESC, page_path ASC
        LIMIT 10
      `,
    ),
    dbQuery<EventCountRow>(
      `
        SELECT event_name, count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval} AND event_name <> 'page_view'
        GROUP BY 1
        ORDER BY count DESC, event_name ASC
        LIMIT 12
      `,
    ),
    dbQuery<SymbolCountRow>(
      `
        SELECT symbol, count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval} AND symbol IS NOT NULL
        GROUP BY 1
        ORDER BY count DESC, symbol ASC
        LIMIT 10
      `,
    ),
    dbQuery<OnboardingRow>("SELECT count(*) AS total_users, count(*) FILTER (WHERE onboarding_completed) AS completed_users FROM users"),
    eventCount("onboarding_complete", interval),
    dbQuery<WaitFirstRow>(
      `
        SELECT
          count(*) FILTER (WHERE event_name IN ('veto_explanation_open', 'readiness_expand')) AS wait_engagement,
          count(*) FILTER (WHERE event_name = 'veto_explanation_open') AS veto_explanation_opens,
          count(*) FILTER (WHERE event_name = 'readiness_expand') AS readiness_opens,
          count(*) FILTER (WHERE event_name = 'signal_drilldown') AS signal_drilldowns
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
      `,
    ),
    dbQuery<SupportUsageRow>(
      `
        SELECT
          count(*) FILTER (WHERE event_name = 'support_prompt_click') AS prompt_clicks,
          count(*) FILTER (WHERE event_name = 'support_message_submit') AS messages,
          count(*) FILTER (WHERE event_name = 'support_helpful_feedback') AS helpful,
          count(*) FILTER (WHERE event_name = 'support_unhelpful_feedback') AS unhelpful
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
      `,
    ),
    dbQuery<EventCountRow>(
      `
        SELECT event_name, count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND event_name = ANY($1::text[])
        GROUP BY 1
        ORDER BY count DESC, event_name ASC
      `,
      [BETA_COHORT_EVENT_NAMES],
    ),
    dbQuery<SupportTicketCohortRow>(
      `
        SELECT
          count(*) FILTER (WHERE created_at >= now() - ${interval}) AS opened,
          count(*) FILTER (WHERE status IN ('open', 'pending')) AS open_count,
          count(*) FILTER (WHERE status IN ('open', 'pending') AND priority IN ('high', 'urgent')) AS urgent_count
        FROM support_tickets
      `,
    ),
    dbQuery<JourneyRow>(
      `
        WITH sessions AS (
          SELECT
            COALESCE(session_id_hash, user_id::text, anonymous_id_hash, id::text) AS session_key,
            bool_or(event_name = 'terminal_open') AS terminal_open,
            bool_or(event_name = 'symbol_open') AS symbol_open,
            bool_or(event_name = 'watchlist_add') AS watchlist_add,
            bool_or(event_name = 'opportunities_open') AS opportunities_open,
            bool_or(event_name = 'support_open' OR event_name = 'support_message_submit') AS support_used,
            bool_or(event_name = 'onboarding_complete') AS onboarding_complete,
            bool_or(event_name = 'alert_create') AS alert_create,
            count(*) > 1 AS repeated
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval}
          GROUP BY 1
        )
        SELECT
          count(*) FILTER (WHERE terminal_open AND symbol_open AND watchlist_add) AS terminal_symbol_watchlist,
          count(*) FILTER (WHERE opportunities_open AND support_used) AS opportunities_support,
          count(*) FILTER (WHERE onboarding_complete AND symbol_open) AS onboarding_symbol,
          count(*) FILTER (WHERE alert_create AND repeated) AS alerts_repeat
        FROM sessions
      `,
    ),
    dbQuery<CountRow>(`SELECT count(*) AS count FROM beta_feedback WHERE created_at >= now() - ${interval}`),
    dbQuery<FeedbackTypeRow>(
      `
        SELECT feedback_type, count(*) AS count
        FROM beta_feedback
        WHERE created_at >= now() - ${interval}
        GROUP BY 1
        ORDER BY count DESC, feedback_type ASC
      `,
    ),
    dbQuery<FeedbackRow>(
      `
        SELECT feedback_type, page_path, symbol, rating, message, created_at::text
        FROM beta_feedback
        WHERE created_at >= now() - ${interval}
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ),
    dbQuery<VisitorSummaryRow>(
      `
        WITH page_views AS (
          SELECT *
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval} AND event_name = 'page_view'
        ),
        actors AS (
          SELECT
            COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text) AS actor_key,
            count(DISTINCT COALESCE(session_id_hash, id::text)) AS session_count
          FROM page_views
          GROUP BY 1
        )
        SELECT
          count(*) AS total_page_views,
          count(DISTINCT COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text)) AS unique_visitors,
          count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS signed_in_users,
          count(DISTINCT anonymous_id_hash) FILTER (WHERE user_id IS NULL AND anonymous_id_hash IS NOT NULL) AS anonymous_visitors,
          (SELECT count(*) FROM actors WHERE session_count > 1) AS repeat_visitor_count
        FROM page_views
      `,
    ),
    topSessionPages(interval, "ASC"),
    topSessionPages(interval, "DESC"),
    dbQuery<PageTrendRow>(
      `
        SELECT
          date_trunc('${bucket}', occurred_at)::text AS bucket,
          count(*) AS page_views,
          count(DISTINCT COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text)) AS unique_visitors,
          count(DISTINCT COALESCE(session_id_hash, id::text)) AS sessions
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval} AND event_name = 'page_view'
        GROUP BY 1
        ORDER BY 1
      `,
    ),
    dbQuery<TopPageTimeRow>(
      `
        WITH top_pages AS (
          SELECT COALESCE(page_path, 'unknown') AS page_path
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval} AND event_name = 'page_view'
          GROUP BY 1
          ORDER BY count(*) DESC
          LIMIT 5
        )
        SELECT date_trunc('${bucket}', e.occurred_at)::text AS bucket, COALESCE(e.page_path, 'unknown') AS page_path, count(*) AS count
        FROM analytics_events e
        JOIN top_pages t ON t.page_path = COALESCE(e.page_path, 'unknown')
        WHERE e.occurred_at >= now() - ${interval} AND e.event_name = 'page_view'
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
    ),
    dbQuery<GeoRow>(
      `
        SELECT COALESCE(country, 'unknown') AS country, region, city, timezone, count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval} AND event_name = 'page_view'
        GROUP BY 1, 2, 3, 4
        ORDER BY count DESC
        LIMIT 12
      `,
    ),
    breakdownQuery("device_type", interval),
    breakdownQuery("browser_family", interval),
    breakdownQuery("os_family", interval),
    dbQuery<EventCountRow>(
      `
        SELECT event_name, count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND event_name = ANY($1::text[])
        GROUP BY 1
        ORDER BY count DESC, event_name ASC
      `,
      [FRICTION_EVENT_NAMES],
    ),
    dbQuery<FrictionHotspotRow>(
      `
        SELECT
          event_name,
          COALESCE(page_path, 'unknown') AS page_path,
          COALESCE(metadata->>'component', metadata->>'surface', source, 'unknown') AS component,
          count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND event_name = ANY($1::text[])
        GROUP BY 1, 2, 3
        ORDER BY count DESC, event_name ASC, page_path ASC
        LIMIT 12
      `,
      [FRICTION_EVENT_NAMES],
    ),
    dbQuery<FirstUsefulActionRow>(
      `
        SELECT
          count(*) AS count,
          avg(
            CASE
              WHEN metadata->>'sessionElapsedMs' ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (metadata->>'sessionElapsedMs')::float
              ELSE NULL
            END
          ) AS avg_elapsed_ms
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND event_name = 'first_useful_action'
      `,
    ),
    dbQuery<FirstUsefulActionByActionRow>(
      `
        SELECT
          COALESCE(metadata->>'action', 'unknown') AS action,
          count(*) AS count,
          avg(
            CASE
              WHEN metadata->>'sessionElapsedMs' ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (metadata->>'sessionElapsedMs')::float
              ELSE NULL
            END
          ) AS avg_elapsed_ms
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND event_name = 'first_useful_action'
        GROUP BY 1
        ORDER BY count DESC, action ASC
        LIMIT 8
      `,
    ),
    dbQuery<FlowAbandonmentRow>(
      `
        SELECT
          event_name,
          COALESCE(page_path, 'unknown') AS page_path,
          count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND event_name = ANY($1::text[])
        GROUP BY 1, 2
        ORDER BY count DESC, event_name ASC
        LIMIT 10
      `,
      [["modal_abandon", "scroll_abandon", "failed_action"]],
    ),
    dbQuery<ExperimentExposureRow>(
      `
        SELECT
          COALESCE(metadata->>'experiment', 'unknown') AS experiment,
          COALESCE(metadata->>'variant', 'unknown') AS variant,
          count(*) AS count
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND event_name IN ('experiment_assigned', 'experiment_exposed')
        GROUP BY 1, 2
        ORDER BY count DESC, experiment ASC, variant ASC
        LIMIT 12
      `,
    ),
    dbQuery<LivingTelemetryRow>(
      `
        SELECT
          count(*) FILTER (WHERE event_name = 'first_useful_action') AS first_useful_action,
          count(*) FILTER (WHERE event_name = 'feed_engagement') AS feed_engagement,
          count(*) FILTER (WHERE event_name = 'watchlist_usage') AS watchlist_usage,
          count(*) FILTER (WHERE event_name = 'scanner_usage') AS scanner_usage,
          count(*) FILTER (WHERE event_name = 'strategy_usage') AS strategy_usage,
          count(*) FILTER (WHERE event_name = 'replay_usage') AS replay_usage,
          count(*) FILTER (WHERE event_name = 'notification_engagement') AS notification_engagement
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
      `,
    ),
    dbQuery<EngagementTrendProofRow>(
      `
        SELECT
          date_trunc('${bucket}', occurred_at)::text AS bucket,
          count(DISTINCT COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text)) AS active_users,
          count(*) FILTER (WHERE event_name = ANY($1::text[])) AS feature_events,
          count(*) FILTER (WHERE event_name = 'first_useful_action') AS first_useful_actions,
          count(*) FILTER (WHERE event_name = ANY($2::text[])) AS friction_events,
          count(*) FILTER (WHERE event_name = 'workflow_continuity') AS workflow_continuity
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
        GROUP BY 1
        ORDER BY 1
      `,
      [CORE_FEATURE_EVENT_NAMES, FRICTION_EVENT_NAMES],
    ),
    dbQuery<FeatureAdoptionRow>(
      `
        WITH feature_events AS (
          SELECT
            CASE
              WHEN event_name = ANY($1::text[]) THEN 'Scanner'
              WHEN event_name = ANY($2::text[]) THEN 'Feed'
              WHEN event_name = ANY($3::text[]) THEN 'Replay'
              WHEN event_name = ANY($4::text[]) THEN 'Strategy'
              WHEN event_name = ANY($5::text[]) THEN 'Watchlist'
              WHEN event_name = ANY($6::text[]) THEN 'Notifications'
              WHEN event_name = ANY($7::text[]) THEN 'Mobile'
              ELSE NULL
            END AS feature,
            COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text) AS actor_key
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval}
        )
        SELECT feature, count(*) AS events, count(DISTINCT actor_key) AS active_users
        FROM feature_events
        WHERE feature IS NOT NULL
        GROUP BY 1
        ORDER BY events DESC, feature ASC
      `,
      [SCANNER_FEATURE_EVENTS, FEED_FEATURE_EVENTS, REPLAY_FEATURE_EVENTS, STRATEGY_FEATURE_EVENTS, WATCHLIST_FEATURE_EVENTS, NOTIFICATION_FEATURE_EVENTS, MOBILE_FEATURE_EVENTS],
    ),
    dbQuery<WorkflowStickinessRow>(
      `
        WITH session_flags AS (
          SELECT
            COALESCE(session_id_hash, user_id::text, anonymous_id_hash, id::text) AS session_key,
            bool_or(event_name = ANY($1::text[])) AS scanner,
            bool_or(event_name = 'symbol_open') AS symbol,
            bool_or(event_name = ANY($2::text[])) AS feed,
            bool_or(event_name = ANY($3::text[])) AS watchlist,
            bool_or(event_name = ANY($4::text[])) AS replay,
            bool_or(event_name = ANY($5::text[])) AS strategy,
            count(*) FILTER (WHERE event_name = 'workflow_continuity') AS workflow_continuity_events
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval}
          GROUP BY 1
        )
        SELECT
          count(*) AS total_sessions,
          count(*) FILTER (WHERE scanner AND symbol) AS scanner_to_symbol_sessions,
          count(*) FILTER (WHERE feed AND watchlist) AS feed_to_watchlist_sessions,
          count(*) FILTER (WHERE replay AND strategy) AS replay_to_strategy_sessions,
          count(*) FILTER (WHERE ((scanner::int + symbol::int + feed::int + watchlist::int + replay::int + strategy::int) >= 2)) AS multi_workflow_sessions,
          COALESCE(sum(workflow_continuity_events), 0) AS workflow_continuity_events
        FROM session_flags
      `,
      [SCANNER_FEATURE_EVENTS, FEED_FEATURE_EVENTS, WATCHLIST_FEATURE_EVENTS, REPLAY_FEATURE_EVENTS, STRATEGY_FEATURE_EVENTS],
    ),
    dbQuery<MobileEngagementProofRow>(
      `
        SELECT
          count(*) AS events,
          count(DISTINCT COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text)) AS active_users,
          count(*) FILTER (WHERE event_name = 'first_useful_action') AS first_useful_actions,
          count(*) FILTER (WHERE event_name = 'scanner_usage') AS scanner_usage,
          count(*) FILTER (WHERE event_name = 'feed_engagement') AS feed_engagement,
          count(*) FILTER (WHERE event_name = ANY($1::text[])) AS friction_events
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
          AND device_type IN ('mobile', 'tablet')
      `,
      [FRICTION_EVENT_NAMES],
    ),
    dbQuery<NotificationUsefulnessRow>(
      `
        SELECT
          count(*) FILTER (WHERE event_name = 'notification_engagement') AS engaged,
          count(*) FILTER (WHERE event_name = 'notification_engagement' AND metadata->>'action' = 'feed_notification_candidate') AS eligible_signals,
          count(*) FILTER (WHERE event_name = 'notification_engagement' AND metadata->>'action' IN ('open_action', 'mark_read', 'mark_all_read', 'useful_feedback')) AS useful_interactions,
          count(*) FILTER (WHERE event_name = 'notification_engagement' AND metadata->>'action' = 'preference_update') AS preference_updates,
          count(*) FILTER (WHERE event_name = 'notification_usefulness_feedback' AND metadata->>'action' = 'useful_feedback') AS explicit_useful_feedback,
          count(*) FILTER (WHERE event_name = 'notification_usefulness_feedback' AND metadata->>'action' = 'not_useful_feedback') AS explicit_not_useful_feedback,
          count(*) FILTER (
            WHERE (event_name = 'notification_usefulness_feedback' AND metadata->>'action' = 'not_useful_feedback')
               OR (event_name = 'notification_engagement' AND metadata->>'action' IN ('close_menu', 'preference_update'))
          ) AS fatigue_signals
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
      `,
    ),
    notificationFeedbackCategoryBreakdown(interval),
    dbQuery<DailyDriverHabitLoopRow>(
      `
        SELECT
          count(*) FILTER (WHERE event_name = 'activation_milestone') AS activation_milestones,
          count(*) FILTER (WHERE event_name = 'return_session') AS return_sessions,
          count(*) FILTER (WHERE event_name = 'morning_workflow_start') AS morning_workflows,
          count(*) FILTER (WHERE event_name = 'morning_workflow_complete') AS morning_workflow_completions,
          count(*) FILTER (WHERE event_name = 'scanner_return') AS scanner_returns,
          count(*) FILTER (WHERE event_name = 'scanner_habit_loop') AS scanner_habit_loops,
          count(*) FILTER (WHERE event_name = 'replay_return') AS replay_returns,
          count(*) FILTER (WHERE event_name = 'chart_return') AS chart_returns,
          count(*) FILTER (WHERE event_name = 'compare_return') AS compare_returns,
          count(*) FILTER (WHERE event_name = 'history_return') AS history_returns,
          count(*) FILTER (WHERE event_name = 'alert_return') AS alert_returns,
          count(*) FILTER (WHERE event_name = 'strategy_return') AS strategy_returns,
          count(*) FILTER (WHERE event_name = 'watchlist_return') AS watchlist_returns,
          count(*) FILTER (WHERE event_name = 'personalized_intelligence_return') AS personalized_returns,
          count(*) FILTER (WHERE event_name = 'workflow_dropoff') AS workflow_dropoffs
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
      `,
    ),
    dbQuery<AdaptiveBehaviorProofRow>(
      `
        SELECT
          count(*) FILTER (WHERE event_name = 'workflow_visit_recorded') AS workflow_visits,
          count(*) FILTER (WHERE event_name = 'workflow_continuity') AS workflow_continuity,
          count(*) FILTER (WHERE event_name = 'personalization_update') AS personalization_updates,
          count(*) FILTER (WHERE event_name IN ('decision_journal_save', 'decision_memory_clear')) AS decision_memory_actions,
          count(*) FILTER (WHERE event_name = 'experiment_exposed') AS experiment_exposure
        FROM analytics_events
        WHERE occurred_at >= now() - ${interval}
      `,
    ),
    dbQuery<WatchlistRetentionProofRow>(
      `
        WITH actors AS (
          SELECT
            COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text) AS actor_key,
            COALESCE(session_id_hash, user_id::text, anonymous_id_hash, id::text) AS session_key,
            bool_or(event_name IN ('watch_add', 'watchlist_add', 'watchlist_usage', 'watchlist_return')) AS used_watchlist,
            bool_or(event_name IN ('watchlist_retention', 'watchlist_return')) AS retained_watchlist,
            count(*) FILTER (WHERE event_name IN ('watch_add', 'watchlist_add', 'watchlist_usage', 'watchlist_return')) AS watchlist_actions
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval}
          GROUP BY 1, 2
        )
        SELECT
          count(DISTINCT actor_key) FILTER (WHERE used_watchlist OR retained_watchlist) AS watchlist_users,
          count(DISTINCT actor_key) FILTER (WHERE retained_watchlist) AS returning_watchlist_users,
          count(*) FILTER (WHERE retained_watchlist) AS retained_sessions,
          COALESCE(sum(watchlist_actions), 0) AS watchlist_actions
        FROM actors
      `,
    ),
    dbQuery<RetentionCurveProofRow>(
      `
        WITH actor_days AS (
          SELECT DISTINCT
            COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text) AS actor_key,
            occurred_at::date AS active_day
          FROM analytics_events
          WHERE occurred_at >= now() - interval '120 days'
        ),
        cohorts AS (
          SELECT actor_key, min(active_day) AS cohort_day
          FROM actor_days
          GROUP BY 1
        ),
        offsets(day_offset) AS (
          VALUES (0), (1), (2), (7), (14), (30)
        )
        SELECT
          offsets.day_offset,
          count(DISTINCT cohorts.actor_key) FILTER (WHERE cohorts.cohort_day <= current_date - offsets.day_offset) AS eligible_users,
          count(DISTINCT retained.actor_key) AS retained_users
        FROM offsets
        LEFT JOIN cohorts ON cohorts.cohort_day >= current_date - ${interval}
        LEFT JOIN actor_days retained
          ON retained.actor_key = cohorts.actor_key
          AND retained.active_day = cohorts.cohort_day + offsets.day_offset
        GROUP BY 1
        ORDER BY 1
      `,
    ),
    dbQuery<ActiveDayDepthProofRow>(
      `
        WITH actor_day_counts AS (
          SELECT
            COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text) AS actor_key,
            count(DISTINCT occurred_at::date) AS active_days
          FROM analytics_events
          WHERE occurred_at >= now() - ${interval}
          GROUP BY 1
        )
        SELECT
          count(*) AS active_day_users,
          count(*) FILTER (WHERE active_days >= 2) AS two_plus_active_day_users,
          count(*) FILTER (WHERE active_days >= 7) AS seven_plus_active_day_users
        FROM actor_day_counts
      `,
    ),
  ]);

  const retentionRow = retention.rows[0];
  const onboardingRow = onboarding.rows[0];
  const totalUsers = numberFromRow(onboardingRow?.total_users);
  const completedUsers = numberFromRow(onboardingRow?.completed_users);
  const waitRow = waitFirst.rows[0];
  const supportRow = supportUsage.rows[0];
  const journeyRow = journey.rows[0];
  const visitorRow = visitorSummary.rows[0];
  const firstUsefulRow = firstUsefulAction.rows[0];
  const livingTelemetryRow = livingTelemetry.rows[0];
  const workflowStickinessRow = workflowStickinessProof.rows[0];
  const mobileEngagementRow = mobileEngagementProof.rows[0];
  const notificationUsefulnessRow = notificationUsefulnessProof.rows[0];
  const dailyDriverHabitLoopRow = dailyDriverHabitLoopProof.rows[0];
  const adaptiveBehaviorRow = adaptiveBehaviorProof.rows[0];
  const watchlistRetentionRow = watchlistRetentionProof.rows[0];
  const activeDayDepthRow = activeDayDepthProof.rows[0];
  const frictionCount = (eventName: string) => numberFromRow(frictionEvents.rows.find((row) => row.event_name === eventName)?.count);
  const totalEvents = numberFromRow(retentionRow?.total_events);
  const activeUsers = numberFromRow(retentionRow?.active_users);
  const totalSessions = numberFromRow(workflowStickinessRow?.total_sessions);
  const multiWorkflowSessions = numberFromRow(workflowStickinessRow?.multi_workflow_sessions);
  const mobileEvents = numberFromRow(mobileEngagementRow?.events);
  const notificationEligibleSignals = numberFromRow(notificationUsefulnessRow?.eligible_signals);
  const notificationUsefulInteractions = numberFromRow(notificationUsefulnessRow?.useful_interactions);
  const explicitUsefulFeedback = numberFromRow(notificationUsefulnessRow?.explicit_useful_feedback);
  const explicitNotUsefulFeedback = numberFromRow(notificationUsefulnessRow?.explicit_not_useful_feedback);
  const notificationFatigueSignals = numberFromRow(notificationUsefulnessRow?.fatigue_signals);
  const notificationFeedbackCategories = notificationFeedbackCategoryProof.rows.map((row) => {
    const useful = numberFromRow(row.useful);
    const notUseful = numberFromRow(row.not_useful);
    const total = numberFromRow(row.total);
    return {
      category: row.category,
      fatigueSignals: notUseful,
      notUseful,
      total,
      useful,
      usefulnessRatePct: pctOrNull(useful, total),
    };
  });
  const durableUsefulFeedback = notificationFeedbackCategories.reduce((total, row) => total + row.useful, 0);
  const durableNotUsefulFeedback = notificationFeedbackCategories.reduce((total, row) => total + row.notUseful, 0);
  const durableFeedbackTotal = durableUsefulFeedback + durableNotUsefulFeedback;
  const usefulFeedbackForSummary = durableFeedbackTotal > 0 ? durableUsefulFeedback : explicitUsefulFeedback;
  const notUsefulFeedbackForSummary = durableFeedbackTotal > 0 ? durableNotUsefulFeedback : explicitNotUsefulFeedback;
  const feedbackTotalForSummary = usefulFeedbackForSummary + notUsefulFeedbackForSummary;
  const watchlistUsers = numberFromRow(watchlistRetentionRow?.watchlist_users);
  const returningWatchlistUsers = numberFromRow(watchlistRetentionRow?.returning_watchlist_users);
  const stickySessionRatePct = pctOrNull(multiWorkflowSessions, totalSessions);
  const watchlistRetentionRatePct = pctOrNull(returningWatchlistUsers, watchlistUsers);
  const notificationFeedbackUsefulnessRatePct = pctOrNull(usefulFeedbackForSummary, feedbackTotalForSummary);
  const notificationUsefulnessRatePct = notificationFeedbackUsefulnessRatePct ?? pctOrNull(notificationUsefulInteractions, notificationEligibleSignals);
  const mobileSharePct = pctOrNull(mobileEvents, totalEvents);
  const featureAdoptionRows = featureAdoptionProof.rows.map((row) => ({
    activeUsers: numberFromRow(row.active_users),
    adoptionRatePct: pctOrNull(numberFromRow(row.active_users), activeUsers),
    events: numberFromRow(row.events),
    feature: row.feature,
  }));
  const retentionCurveRows = retentionCurveProof.rows.map((row) => {
    const eligibleUsers = numberFromRow(row.eligible_users);
    const retainedUsers = numberFromRow(row.retained_users);
    return {
      dayOffset: numberFromRow(row.day_offset),
      eligibleUsers,
      retainedUsers,
      retentionRatePct: pctOrNull(retainedUsers, eligibleUsers),
    };
  });
  const day1Retention = retentionCurveRows.find((row) => row.dayOffset === 1) ?? null;
  const day2Retention = retentionCurveRows.find((row) => row.dayOffset === 2) ?? null;
  const day7Retention = retentionCurveRows.find((row) => row.dayOffset === 7) ?? null;
  const totalActiveDayUsers = numberFromRow(activeDayDepthRow?.active_day_users);
  const twoPlusActiveDayUsers = numberFromRow(activeDayDepthRow?.two_plus_active_day_users);
  const sevenPlusActiveDayUsers = numberFromRow(activeDayDepthRow?.seven_plus_active_day_users);
  const adaptiveBehaviorScore = adaptiveProofScore({
    decisionMemoryActions: numberFromRow(adaptiveBehaviorRow?.decision_memory_actions),
    experimentExposure: numberFromRow(adaptiveBehaviorRow?.experiment_exposure),
    personalizationUpdates: numberFromRow(adaptiveBehaviorRow?.personalization_updates),
    workflowContinuity: numberFromRow(adaptiveBehaviorRow?.workflow_continuity),
    workflowVisits: numberFromRow(adaptiveBehaviorRow?.workflow_visits),
  });
  const dominanceProof = buildRealUserDominanceProof({
    activeUsers,
    adaptiveProofScore: adaptiveBehaviorScore,
    averageSessionDepth: nullableNumberFromRow(retentionRow?.avg_session_depth),
    averageTimeToFirstUsefulActionSeconds: nullableMillisecondsToSeconds(firstUsefulRow?.avg_elapsed_ms),
    dau: numberFromRow(dau.rows[0]?.count),
    failedActions: frictionCount("failed_action"),
    featureAdoption: featureAdoptionRows,
    feedEngagement: numberFromRow(livingTelemetryRow?.feed_engagement),
    firstUsefulActions: numberFromRow(firstUsefulRow?.count),
    mobileFrictionEvents: numberFromRow(mobileEngagementRow?.friction_events),
    mobileSharePct,
    modalAbandons: frictionCount("modal_abandon"),
    notificationEngagement: numberFromRow(livingTelemetryRow?.notification_engagement),
    notificationUsefulnessRatePct,
    rageClicks: frictionCount("rage_click"),
    retentionDay2EligibleUsers: day2Retention?.eligibleUsers ?? 0,
    retentionDay2RatePct: day2Retention?.retentionRatePct ?? null,
    retentionDay7EligibleUsers: day7Retention?.eligibleUsers ?? 0,
    retentionDay7RatePct: day7Retention?.retentionRatePct ?? null,
    replayUsage: numberFromRow(livingTelemetryRow?.replay_usage),
    scannerUsage: numberFromRow(livingTelemetryRow?.scanner_usage),
    scrollAbandons: frictionCount("scroll_abandon"),
    strategyUsage: numberFromRow(livingTelemetryRow?.strategy_usage),
    stickySessionRatePct,
    totalEvents,
    totalSessions,
    watchlistRetentionRatePct,
    watchlistUsage: numberFromRow(livingTelemetryRow?.watchlist_usage),
    wau: numberFromRow(wau.rows[0]?.count),
    workflowContinuityEvents: numberFromRow(workflowStickinessRow?.workflow_continuity_events),
  });

  return {
    activeUsersTrend: trend.rows.map((row) => ({ activeUsers: numberFromRow(row.active_users), bucket: row.bucket, events: numberFromRow(row.events) })),
    betaCohort: {
      keyEvents: betaCohortEvents.rows.map((row) => ({ count: numberFromRow(row.count), eventName: row.event_name })),
      supportTickets: {
        open: numberFromRow(supportTickets.rows[0]?.open_count),
        opened: numberFromRow(supportTickets.rows[0]?.opened),
        urgent: numberFromRow(supportTickets.rows[0]?.urgent_count),
      },
    },
    feedback: {
      recent: feedbackRecent.rows.map((row) => ({
        createdAt: row.created_at,
        feedbackType: row.feedback_type,
        message: row.message,
        pagePath: row.page_path,
        rating: row.rating,
        symbol: row.symbol,
      })),
      total: numberFromRow(feedbackTotal.rows[0]?.count),
      typeCounts: feedbackTypes.rows.map((row) => ({ count: numberFromRow(row.count), feedbackType: row.feedback_type })),
    },
    journey: [
      { count: numberFromRow(journeyRow?.terminal_symbol_watchlist), description: "Terminal to symbol detail to watchlist", key: "terminal_symbol_watchlist" },
      { count: numberFromRow(journeyRow?.opportunities_support), description: "Opportunities to support assistance", key: "opportunities_support" },
      { count: numberFromRow(journeyRow?.onboarding_symbol), description: "Onboarding completion to first symbol research", key: "onboarding_symbol" },
      { count: numberFromRow(journeyRow?.alerts_repeat), description: "Alert creation inside repeat sessions", key: "alerts_repeat" },
    ],
    livingTelemetry: {
      feedEngagement: numberFromRow(livingTelemetryRow?.feed_engagement),
      firstUsefulAction: numberFromRow(livingTelemetryRow?.first_useful_action),
      notificationEngagement: numberFromRow(livingTelemetryRow?.notification_engagement),
      replayUsage: numberFromRow(livingTelemetryRow?.replay_usage),
      scannerUsage: numberFromRow(livingTelemetryRow?.scanner_usage),
      strategyUsage: numberFromRow(livingTelemetryRow?.strategy_usage),
      watchlistUsage: numberFromRow(livingTelemetryRow?.watchlist_usage),
    },
    onboarding: {
      completedUsers,
      completionRatePct: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : null,
      eventCompletions: numberFromRow(onboardingEvents.rows[0]?.count),
      totalUsers,
    },
    retention: {
      activeUsers,
      averageSessionDepth: nullableNumberFromRow(retentionRow?.avg_session_depth),
      averageSessionDurationSeconds: nullableNumberFromRow(retentionRow?.avg_session_duration_seconds),
      dau: numberFromRow(dau.rows[0]?.count),
      repeatSessions: numberFromRow(retentionRow?.repeat_sessions),
      totalEvents,
      totalSessions: numberFromRow(retentionRow?.total_sessions),
      wau: numberFromRow(wau.rows[0]?.count),
    },
    realUserProof: {
      adaptiveBehavior: {
        adaptiveProofScore: adaptiveBehaviorScore,
        decisionMemoryActions: numberFromRow(adaptiveBehaviorRow?.decision_memory_actions),
        experimentExposure: numberFromRow(adaptiveBehaviorRow?.experiment_exposure),
        personalizationUpdates: numberFromRow(adaptiveBehaviorRow?.personalization_updates),
        workflowContinuity: numberFromRow(adaptiveBehaviorRow?.workflow_continuity),
        workflowVisits: numberFromRow(adaptiveBehaviorRow?.workflow_visits),
      },
      dominanceProof,
      engagementTrends: engagementTrendProof.rows.map((row) => ({
        activeUsers: numberFromRow(row.active_users),
        bucket: row.bucket,
        featureEvents: numberFromRow(row.feature_events),
        firstUsefulActions: numberFromRow(row.first_useful_actions),
        frictionEvents: numberFromRow(row.friction_events),
        workflowContinuity: numberFromRow(row.workflow_continuity),
      })),
      featureAdoption: featureAdoptionRows,
      mobileEngagement: {
        activeUsers: numberFromRow(mobileEngagementRow?.active_users),
        events: mobileEvents,
        feedEngagement: numberFromRow(mobileEngagementRow?.feed_engagement),
        firstUsefulActions: numberFromRow(mobileEngagementRow?.first_useful_actions),
        frictionEvents: numberFromRow(mobileEngagementRow?.friction_events),
        mobileSharePct,
        scannerUsage: numberFromRow(mobileEngagementRow?.scanner_usage),
      },
      notificationUsefulness: {
        categoryBreakdown: notificationFeedbackCategories,
        durableFeedbackTotal,
        durableNotUsefulFeedback,
        durableUsefulFeedback,
        eligibleSignals: notificationEligibleSignals,
        engaged: numberFromRow(notificationUsefulnessRow?.engaged),
        explicitNotUsefulFeedback,
        explicitUsefulFeedback,
        fatigueSignals: notificationFatigueSignals + durableNotUsefulFeedback,
        preferenceUpdates: numberFromRow(notificationUsefulnessRow?.preference_updates),
        usefulInteractions: notificationUsefulInteractions,
        usefulnessRatePct: notificationUsefulnessRatePct,
      },
      dailyDriver: {
        cohortEvidence: {
          day1EligibleUsers: day1Retention?.eligibleUsers ?? 0,
          day1RetainedUsers: day1Retention?.retainedUsers ?? 0,
          day1RetentionRatePct: day1Retention?.retentionRatePct ?? null,
          day2EligibleUsers: day2Retention?.eligibleUsers ?? 0,
          day2RetainedUsers: day2Retention?.retainedUsers ?? 0,
          day2RetentionRatePct: day2Retention?.retentionRatePct ?? null,
          day7EligibleUsers: day7Retention?.eligibleUsers ?? 0,
          day7RetainedUsers: day7Retention?.retainedUsers ?? 0,
          day7RetentionRatePct: day7Retention?.retentionRatePct ?? null,
          sevenPlusActiveDayRatePct: pctOrNull(sevenPlusActiveDayUsers, totalActiveDayUsers),
          sevenPlusActiveDayUsers,
          totalActiveDayUsers,
          twoPlusActiveDayRatePct: pctOrNull(twoPlusActiveDayUsers, totalActiveDayUsers),
          twoPlusActiveDayUsers,
        },
        habitLoops: {
          activationMilestones: numberFromRow(dailyDriverHabitLoopRow?.activation_milestones),
          alertReturns: numberFromRow(dailyDriverHabitLoopRow?.alert_returns),
          chartReturns: numberFromRow(dailyDriverHabitLoopRow?.chart_returns),
          compareReturns: numberFromRow(dailyDriverHabitLoopRow?.compare_returns),
          historyReturns: numberFromRow(dailyDriverHabitLoopRow?.history_returns),
          morningWorkflowCompletions: numberFromRow(dailyDriverHabitLoopRow?.morning_workflow_completions),
          morningWorkflows: numberFromRow(dailyDriverHabitLoopRow?.morning_workflows),
          personalizedReturns: numberFromRow(dailyDriverHabitLoopRow?.personalized_returns),
          replayReturns: numberFromRow(dailyDriverHabitLoopRow?.replay_returns),
          returnSessions: numberFromRow(dailyDriverHabitLoopRow?.return_sessions),
          scannerHabitLoops: numberFromRow(dailyDriverHabitLoopRow?.scanner_habit_loops),
          scannerReturns: numberFromRow(dailyDriverHabitLoopRow?.scanner_returns),
          strategyReturns: numberFromRow(dailyDriverHabitLoopRow?.strategy_returns),
          watchlistReturns: numberFromRow(dailyDriverHabitLoopRow?.watchlist_returns),
          workflowDropoffs: numberFromRow(dailyDriverHabitLoopRow?.workflow_dropoffs),
        },
        notificationFeedback: {
          fatigueSignals: notificationFatigueSignals + notUsefulFeedbackForSummary,
          notUseful: notUsefulFeedbackForSummary,
          total: feedbackTotalForSummary,
          useful: usefulFeedbackForSummary,
          usefulnessFeedbackRatePct: pctOrNull(usefulFeedbackForSummary, feedbackTotalForSummary),
        },
      },
      watchlistRetention: {
        retainedSessions: numberFromRow(watchlistRetentionRow?.retained_sessions),
        retentionRatePct: watchlistRetentionRatePct,
        returningWatchlistUsers,
        watchlistActions: numberFromRow(watchlistRetentionRow?.watchlist_actions),
        watchlistUsers,
      },
      retentionCurve: retentionCurveRows,
      workflowStickiness: {
        feedToWatchlistSessions: numberFromRow(workflowStickinessRow?.feed_to_watchlist_sessions),
        multiWorkflowSessions,
        replayToStrategySessions: numberFromRow(workflowStickinessRow?.replay_to_strategy_sessions),
        scannerToSymbolSessions: numberFromRow(workflowStickinessRow?.scanner_to_symbol_sessions),
        stickySessionRatePct,
        totalSessions,
        workflowContinuityEvents: numberFromRow(workflowStickinessRow?.workflow_continuity_events),
      },
    },
    supportUsage: {
      helpful: numberFromRow(supportRow?.helpful),
      messages: numberFromRow(supportRow?.messages),
      promptClicks: numberFromRow(supportRow?.prompt_clicks),
      unhelpful: numberFromRow(supportRow?.unhelpful),
    },
    timeRange,
    topEvents: topEvents.rows.map((row) => ({ count: numberFromRow(row.count), eventName: row.event_name })),
    topPages: topPages.rows.map((row) => ({ count: numberFromRow(row.count), pagePath: row.page_path })),
    topSymbols: topSymbols.rows.map((row) => ({ count: numberFromRow(row.count), symbol: row.symbol })),
    visitorInsights: {
      anonymousVisitors: numberFromRow(visitorRow?.anonymous_visitors),
      averageSessionDurationSeconds: nullableNumberFromRow(retentionRow?.avg_session_duration_seconds),
      browserBreakdown: browserBreakdown.rows.map((row) => ({ browserFamily: row.label, count: numberFromRow(row.count) })),
      deviceBreakdown: deviceBreakdown.rows.map((row) => ({ deviceType: row.label, count: numberFromRow(row.count) })),
      geography: geography.rows.map((row) => ({ city: row.city, count: numberFromRow(row.count), country: row.country, region: row.region, timezone: row.timezone })),
      pageViewsByDay: pageTrend.rows.map((row) => ({ bucket: row.bucket, pageViews: numberFromRow(row.page_views), sessions: numberFromRow(row.sessions), uniqueVisitors: numberFromRow(row.unique_visitors) })),
      repeatVisitorCount: numberFromRow(visitorRow?.repeat_visitor_count),
      signedInUsers: numberFromRow(visitorRow?.signed_in_users),
      topEntryPages: entryPages.rows.map((row) => ({ count: numberFromRow(row.count), pagePath: row.page_path })),
      topExitPages: exitPages.rows.map((row) => ({ count: numberFromRow(row.count), pagePath: row.page_path })),
      topPagesOverTime: topPagesOverTime.rows.map((row) => ({ bucket: row.bucket, count: numberFromRow(row.count), pagePath: row.page_path })),
      totalPageViews: numberFromRow(visitorRow?.total_page_views),
      uniqueVisitors: numberFromRow(visitorRow?.unique_visitors),
    },
    waitFirst: {
      readinessOpens: numberFromRow(waitRow?.readiness_opens),
      signalDrilldowns: numberFromRow(waitRow?.signal_drilldowns),
      vetoExplanationOpens: numberFromRow(waitRow?.veto_explanation_opens),
      waitEngagement: numberFromRow(waitRow?.wait_engagement),
    },
    uxInsights: {
      experimentExposure: experimentExposure.rows.map((row) => ({ count: numberFromRow(row.count), experiment: row.experiment, variant: row.variant })),
      firstUsefulAction: {
        averageElapsedSeconds: nullableMillisecondsToSeconds(firstUsefulRow?.avg_elapsed_ms),
        count: numberFromRow(firstUsefulRow?.count),
        topActions: firstUsefulActionsByAction.rows.map((row) => ({
          action: row.action,
          averageElapsedSeconds: nullableMillisecondsToSeconds(row.avg_elapsed_ms),
          count: numberFromRow(row.count),
        })),
      },
      flowAbandonment: flowAbandonment.rows.map((row) => ({ count: numberFromRow(row.count), eventName: row.event_name, pagePath: row.page_path })),
      frictionEvents: frictionEvents.rows.map((row) => ({ count: numberFromRow(row.count), eventName: row.event_name })),
      frictionHotspots: frictionHotspots.rows.map((row) => ({
        component: row.component,
        count: numberFromRow(row.count),
        eventName: row.event_name,
        pagePath: row.page_path,
      })),
      interactionQuality: {
        backNavigations: frictionCount("back_navigation"),
        duplicateClicks: frictionCount("duplicate_click"),
        failedActions: frictionCount("failed_action"),
        modalAbandons: frictionCount("modal_abandon"),
        rageClicks: frictionCount("rage_click"),
        scrollAbandons: frictionCount("scroll_abandon"),
      },
    },
  };
}

function sanitizeEventPayload(payload: AnalyticsEventPayload): SanitizedAnalyticsEvent | null {
  const eventName = normalizeAnalyticsEventName(payload.eventName);
  if (!eventName) return null;
  const occurredAt = safeDate(payload.occurredAt);
  return {
    anonymousId: cleanIdentifier(payload.anonymousId),
    deviceType: normalizeAnalyticsDevice(payload.deviceType),
    eventName,
    metadata: sanitizeAnalyticsMetadata(payload.metadata),
    occurredAt,
    pagePath: sanitizeAnalyticsPath(payload.pagePath),
    sessionId: cleanIdentifier(payload.sessionId),
    source: sanitizeAnalyticsSource(payload.source),
    symbol: sanitizeAnalyticsSymbol(payload.symbol),
  };
}

function safeDate(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return new Date().toISOString();
  const now = Date.now();
  const min = now - 1000 * 60 * 60 * 24;
  const max = now + 1000 * 60 * 5;
  return new Date(Math.min(max, Math.max(min, date.getTime()))).toISOString();
}

function cleanIdentifier(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.length > 120) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(text)) return null;
  return text;
}

function hashIdentifier(value: unknown): string | null {
  const clean = cleanIdentifier(value);
  if (!clean) return null;
  return createHash("sha256").update(clean).digest("hex");
}

function intervalForRange(range: AnalyticsTimeRange): string {
  if (range === "today") return "interval '24 hours'";
  if (range === "7d") return "interval '7 days'";
  if (range === "90d") return "interval '90 days'";
  return "interval '30 days'";
}

function bucketForRange(range: AnalyticsTimeRange): "day" | "hour" {
  return range === "today" ? "hour" : "day";
}

function activeUsersForInterval(intervalSql: string) {
  return dbQuery<CountRow>(
    `
      SELECT count(DISTINCT COALESCE(user_id::text, anonymous_id_hash, session_id_hash, id::text)) AS count
      FROM analytics_events
      WHERE occurred_at >= now() - ${intervalSql}
    `,
  );
}

function eventCount(eventName: AnalyticsEventName, intervalSql: string) {
  return dbQuery<CountRow>(
    `
      SELECT count(*) AS count
      FROM analytics_events
      WHERE event_name = $1 AND occurred_at >= now() - ${intervalSql}
    `,
    [eventName],
  );
}

async function notificationFeedbackCategoryBreakdown(intervalSql: string): Promise<{ rows: NotificationFeedbackCategoryRow[] }> {
  try {
    return await dbQuery<NotificationFeedbackCategoryRow>(
      `
        SELECT
          COALESCE(NULLIF(notification_type, ''), 'unknown') AS category,
          count(*) FILTER (WHERE feedback = 'useful') AS useful,
          count(*) FILTER (WHERE feedback = 'not_useful') AS not_useful,
          count(*) AS total
        FROM notification_feedback
        WHERE updated_at >= now() - ${intervalSql}
        GROUP BY 1
        ORDER BY total DESC, category ASC
        LIMIT 8
      `,
    );
  } catch (error) {
    console.warn("[analytics] notification feedback breakdown unavailable", error instanceof Error ? error.message : error);
    return { rows: [] };
  }
}

function topSessionPages(intervalSql: string, direction: "ASC" | "DESC") {
  return dbQuery<PageCountRow>(
    `
      WITH ranked AS (
        SELECT
          COALESCE(page_path, 'unknown') AS page_path,
          row_number() OVER (
            PARTITION BY COALESCE(session_id_hash, user_id::text, anonymous_id_hash, id::text)
            ORDER BY occurred_at ${direction}
          ) AS page_rank
        FROM analytics_events
        WHERE occurred_at >= now() - ${intervalSql} AND event_name = 'page_view'
      )
      SELECT page_path, count(*) AS count
      FROM ranked
      WHERE page_rank = 1
      GROUP BY 1
      ORDER BY count DESC, page_path ASC
      LIMIT 10
    `,
  );
}

function breakdownQuery(column: "browser_family" | "device_type" | "os_family", intervalSql: string) {
  return dbQuery<DeviceRow>(
    `
      SELECT COALESCE(${column}, 'unknown') AS label, count(*) AS count
      FROM analytics_events
      WHERE occurred_at >= now() - ${intervalSql} AND event_name = 'page_view'
      GROUP BY 1
      ORDER BY count DESC, label ASC
      LIMIT 10
    `,
  );
}

function analyticsRequestContext(request: Request): {
  browserFamily: string;
  city: string | null;
  country: string | null;
  osFamily: string;
  region: string | null;
  timezone: string | null;
} {
  const userAgent = request.headers.get("user-agent") ?? "";
  return {
    browserFamily: browserFamilyFromUserAgent(userAgent),
    city: cleanGeoHeader(request.headers.get("cf-ipcity")),
    country: cleanCountry(request.headers.get("cf-ipcountry")),
    osFamily: osFamilyFromUserAgent(userAgent),
    region: cleanGeoHeader(request.headers.get("cf-region") ?? request.headers.get("cf-region-code")),
    timezone: cleanGeoHeader(request.headers.get("cf-timezone")),
  };
}

function browserFamilyFromUserAgent(userAgent: string): string {
  const text = userAgent.toLowerCase();
  if (!text) return "unknown";
  if (text.includes("edg/")) return "edge";
  if (text.includes("firefox/")) return "firefox";
  if (text.includes("safari/") && !text.includes("chrome/") && !text.includes("chromium/")) return "safari";
  if (text.includes("chrome/") || text.includes("crios/") || text.includes("chromium/")) return "chrome";
  return "other";
}

function osFamilyFromUserAgent(userAgent: string): string {
  const text = userAgent.toLowerCase();
  if (!text) return "unknown";
  if (text.includes("iphone") || text.includes("ipad") || text.includes("mac os x")) return "apple";
  if (text.includes("android")) return "android";
  if (text.includes("windows")) return "windows";
  if (text.includes("linux")) return "linux";
  return "other";
}

function cleanCountry(value: string | null): string | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(text) || text === "XX") return null;
  return text;
}

function cleanGeoHeader(value: string | null): string | null {
  const text = String(value ?? "").trim().replace(/[^A-Za-z0-9 _./+-]/g, "").slice(0, 80);
  return text || null;
}

function numberFromRow(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberFromRow(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableMillisecondsToSeconds(value: string | number | null | undefined): number | null {
  const parsed = nullableNumberFromRow(value);
  return parsed === null ? null : parsed / 1000;
}

function pctOrNull(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

function adaptiveProofScore(input: {
  decisionMemoryActions: number;
  experimentExposure: number;
  personalizationUpdates: number;
  workflowContinuity: number;
  workflowVisits: number;
}): number {
  const workflowScore = Math.min(30, input.workflowContinuity * 3 + input.workflowVisits * 2);
  const personalizationScore = Math.min(25, input.personalizationUpdates * 5);
  const memoryScore = Math.min(25, input.decisionMemoryActions * 4);
  const experimentScore = Math.min(20, input.experimentExposure * 2);
  return Math.round(Math.min(100, workflowScore + personalizationScore + memoryScore + experimentScore));
}
