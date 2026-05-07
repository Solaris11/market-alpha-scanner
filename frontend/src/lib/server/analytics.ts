import "server-only";

import { createHash } from "node:crypto";
import type { QueryResultRow } from "pg";
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
  feedback: {
    recent: Array<{ createdAt: string | null; feedbackType: string; message: string | null; pagePath: string | null; rating: string; symbol: string | null }>;
    total: number;
    typeCounts: Array<{ count: number; feedbackType: string }>;
  };
  journey: Array<{ count: number; description: string; key: string }>;
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

const MAX_EVENTS_PER_REQUEST = 24;

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
  ]);

  const retentionRow = retention.rows[0];
  const onboardingRow = onboarding.rows[0];
  const totalUsers = numberFromRow(onboardingRow?.total_users);
  const completedUsers = numberFromRow(onboardingRow?.completed_users);
  const waitRow = waitFirst.rows[0];
  const supportRow = supportUsage.rows[0];
  const journeyRow = journey.rows[0];
  const visitorRow = visitorSummary.rows[0];

  return {
    activeUsersTrend: trend.rows.map((row) => ({ activeUsers: numberFromRow(row.active_users), bucket: row.bucket, events: numberFromRow(row.events) })),
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
    onboarding: {
      completedUsers,
      completionRatePct: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : null,
      eventCompletions: numberFromRow(onboardingEvents.rows[0]?.count),
      totalUsers,
    },
    retention: {
      activeUsers: numberFromRow(retentionRow?.active_users),
      averageSessionDepth: nullableNumberFromRow(retentionRow?.avg_session_depth),
      averageSessionDurationSeconds: nullableNumberFromRow(retentionRow?.avg_session_duration_seconds),
      dau: numberFromRow(dau.rows[0]?.count),
      repeatSessions: numberFromRow(retentionRow?.repeat_sessions),
      totalEvents: numberFromRow(retentionRow?.total_events),
      totalSessions: numberFromRow(retentionRow?.total_sessions),
      wau: numberFromRow(wau.rows[0]?.count),
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
