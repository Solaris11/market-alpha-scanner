import "server-only";

import type { QueryResultRow } from "pg";
import { getScanDataHealth } from "@/lib/scanner-data";
import { deepHealth } from "./monitoring";
import { dbQuery } from "./db";

export type AdminDashboardSummary = {
  billing: {
    activeSubscriptions: number;
    canceledAtPeriodEnd: number;
  };
  latestBackupStatus: string;
  latestBillingEvents: BillingEventSummary[];
  latestScannerRun: ScannerRunSummary | null;
  monitoringWarnings: MonitoringEventSummary[];
  scannerFreshness: {
    ageMinutes: number | null;
    message: string;
    status: string;
  };
  users: {
    admins: number;
    free: number;
    premium: number;
    total: number;
  };
};

export type AdminUserListItem = {
  createdAt: string | null;
  currentPeriodEnd: string | null;
  email: string;
  emailVerified: boolean;
  id: string;
  onboardingCompleted: boolean;
  riskExperienceLevel: string | null;
  role: string;
  state: string;
  subscriptionStatus: string | null;
  timezone: string | null;
};

export type AdminBillingItem = {
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  email: string | null;
  plan: string | null;
  status: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  updatedAt: string | null;
  userId: string;
};

export type BillingEventSummary = {
  createdAt: string | null;
  eventType: string;
  id: string;
  stripeEventId: string | null;
  userId: string | null;
};

export type AdminAlertSummary = {
  activeRules: number;
  byUser: Array<{ active: number; email: string | null; total: number; userId: string }>;
  recentlyTriggered: Array<{ lastTriggeredAt: string | null; ruleId: string; symbol: string | null; userId: string | null }>;
  totalRules: number;
};

export type ScannerRunSummary = {
  completedAt: string | null;
  createdAt: string | null;
  durationSeconds: number | null;
  id: string;
  marketRegime: string | null;
  signalCount: number;
  status: string;
  symbolsScored: number | null;
};

export type AdminScannerSummary = {
  csvFallbackEnabled: boolean;
  dbSignalCount: number;
  freshness: {
    ageMinutes: number | null;
    message: string;
    status: string;
  };
  latestRun: ScannerRunSummary | null;
  latestValidation: MonitoringEventSummary | null;
  providerUsage: {
    alpacaCount: number;
    fallbackCount: number;
    providers: Array<{ count: number; provider: string }>;
    topFallbackReasons: Array<{ count: number; reason: string }>;
  };
};

export type MonitoringEventSummary = {
  createdAt: string | null;
  eventType: string;
  message: string;
  severity: string;
  status: string;
};

export type AdminMonitoringSummary = {
  appEvents: MonitoringEventSummary[];
  latestBackup: MonitoringEventSummary | null;
  requestMetrics: {
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    p99LatencyMs: number | null;
    recent4xx: number;
    recent5xx: number;
    requestsLastHour: number;
    slowestRoutes: Array<{ latencyMs: number; method: string; route: string; statusCode: number }>;
  };
  syntheticChecks: Array<{ checkName: string; createdAt: string | null; latencyMs: number; message: string; status: string }>;
  system: {
    backupDirBytes: number | null;
    scannerOutputBytes: number | null;
    cpuPercent: number | null;
    diskFreeBytes: number | null;
    diskPercent: number | null;
    memoryPercent: number | null;
    updatedAt: string | null;
  };
};

export type AdminAuditLogItem = {
  action: string;
  adminEmail: string | null;
  createdAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  targetId: string | null;
  targetType: string;
};

export type CalibrationGroupType = "asset_type" | "decision" | "market_regime" | "score_bucket" | "setup_type";

export type CalibrationMetricRow = {
  avgReturnPct: number | null;
  count: number;
  groupType: CalibrationGroupType;
  groupValue: string;
  horizon: string;
  lowConfidence: boolean;
  medianReturnPct: number | null;
  winRatePct: number | null;
  worstReturnPct: number | null;
};

export type CalibrationDistributionRow = {
  avgConfidence: number | null;
  avgScore: number | null;
  count: number;
  decision: string;
  tradePermittedCount: number;
};

export type AdminCalibrationSummary = {
  distributions: CalibrationDistributionRow[];
  generatedAt: string;
  groups: Record<CalibrationGroupType, CalibrationMetricRow[]>;
  latestRun: ScannerRunSummary | null;
  observationCount: number;
};

type CountRow = QueryResultRow & { count: string | number };
type DashboardCountsRow = QueryResultRow & {
  admin_users: string | number;
  free_users: string | number;
  premium_users: string | number;
  total_users: string | number;
};
type BillingCountsRow = QueryResultRow & {
  active_subscriptions: string | number;
  canceled_at_period_end: string | number;
};
type UserRow = QueryResultRow & {
  created_at: string | null;
  current_period_end: string | null;
  email: string;
  email_verified: boolean;
  id: string;
  onboarding_completed: boolean;
  risk_experience_level: string | null;
  role: string;
  state: string;
  subscription_status: string | null;
  timezone: string | null;
};
type BillingRow = QueryResultRow & {
  cancel_at: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  email: string | null;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  updated_at: string | null;
  user_id: string;
};
type BillingEventRow = QueryResultRow & {
  created_at: string | null;
  event_type: string;
  id: string;
  stripe_event_id: string | null;
  user_id: string | null;
};
type AlertByUserRow = QueryResultRow & {
  active: string | number;
  email: string | null;
  total: string | number;
  user_id: string;
};
type AlertTriggeredRow = QueryResultRow & {
  last_triggered_at: string | null;
  rule_id: string;
  symbol: string | null;
  user_id: string | null;
};
type ScannerRunRow = QueryResultRow & {
  completed_at: string | null;
  created_at: string | null;
  duration_seconds: string | number | null;
  id: string;
  market_regime: string | null;
  signal_count: string | number;
  status: string;
  symbols_scored: string | number | null;
};
type MonitoringEventRow = QueryResultRow & {
  created_at: string | null;
  event_type: string;
  message: string;
  severity: string;
  status: string;
};
type SyntheticRow = QueryResultRow & {
  check_name: string;
  created_at: string | null;
  latency_ms: string | number;
  message: string;
  status: string;
};
type RequestMetricsRow = QueryResultRow & {
  p50_latency_ms: string | number | null;
  p95_latency_ms: string | number | null;
  p99_latency_ms: string | number | null;
  recent_4xx: string | number;
  recent_5xx: string | number;
  requests_last_hour: string | number;
};
type SlowRouteRow = QueryResultRow & {
  latency_ms: string | number;
  method: string;
  route: string;
  status_code: string | number;
};
type SystemMetricRow = QueryResultRow & {
  backup_dir_bytes: string | number | null;
  cpu_percent: string | number | null;
  disk_free_bytes: string | number | null;
  disk_percent: string | number | null;
  memory_percent: string | number | null;
  scanner_output_bytes: string | number | null;
  updated_at: string | null;
};
type AuditLogRow = QueryResultRow & {
  action: string;
  admin_email: string | null;
  created_at: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  target_id: string | null;
  target_type: string;
};
type CalibrationMetricDbRow = QueryResultRow & {
  avg_return: string | number | null;
  count: string | number;
  group_type: CalibrationGroupType;
  group_value: string | null;
  horizon: string | null;
  median_return: string | number | null;
  win_rate: string | number | null;
  worst_return: string | number | null;
};
type CalibrationDistributionDbRow = QueryResultRow & {
  avg_confidence: string | number | null;
  avg_score: string | number | null;
  count: string | number;
  decision: string | null;
  trade_permitted_count: string | number;
};
type ProviderUsageDbRow = QueryResultRow & {
  count: string | number;
  provider: string | null;
};
type FallbackReasonDbRow = QueryResultRow & {
  count: string | number;
  reason: string | null;
};

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const [users, billing, latestScannerRun, scanHealth, deep, monitoringWarnings, latestBillingEvents] = await Promise.all([
    dashboardUserCounts(),
    dashboardBillingCounts(),
    getLatestScannerRun(),
    getScanDataHealth().catch(() => ({ ageMinutes: null, message: "Scanner freshness unavailable.", status: "unknown" })),
    deepHealth().catch(() => null),
    recentMonitoringWarnings(5),
    recentBillingEvents(5),
  ]);
  return {
    billing,
    latestBackupStatus: deep?.backup.status ?? "unknown",
    latestBillingEvents,
    latestScannerRun,
    monitoringWarnings,
    scannerFreshness: {
      ageMinutes: scanHealth.ageMinutes,
      message: scanHealth.message,
      status: scanHealth.status,
    },
    users,
  };
}

export async function listAdminUsers(input: { role?: string | null; search?: string | null; subscriptionStatus?: string | null } = {}): Promise<AdminUserListItem[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  const search = cleanSearch(input.search);
  if (search) {
    params.push(`%${search}%`);
    where.push(`u.email ILIKE $${params.length}`);
  }
  if (input.role === "admin" || input.role === "user") {
    params.push(input.role);
    where.push(`u.role = $${params.length}`);
  }
  if (input.subscriptionStatus) {
    params.push(input.subscriptionStatus);
    where.push(`s.status = $${params.length}`);
  }
  const result = await dbQuery<UserRow>(
    `
      SELECT
        u.id::text,
        u.email,
        u.role,
        u.email_verified,
        u.onboarding_completed,
        u.timezone,
        u.risk_experience_level,
        u.state,
        u.created_at::text,
        s.status AS subscription_status,
        s.current_period_end::text
      FROM users u
      LEFT JOIN user_subscriptions s ON s.user_id = u.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY u.created_at DESC
      LIMIT 100
    `,
    params,
  );
  return result.rows.map((row) => ({
    createdAt: row.created_at,
    currentPeriodEnd: row.current_period_end,
    email: row.email,
    emailVerified: Boolean(row.email_verified),
    id: row.id,
    onboardingCompleted: Boolean(row.onboarding_completed),
    riskExperienceLevel: row.risk_experience_level,
    role: row.role,
    state: row.state,
    subscriptionStatus: row.subscription_status,
    timezone: row.timezone,
  }));
}

export async function listAdminBilling(): Promise<{ events: BillingEventSummary[]; subscriptions: AdminBillingItem[] }> {
  const [subscriptions, events] = await Promise.all([
    dbQuery<BillingRow>(
      `
        SELECT
          s.user_id::text,
          u.email,
          s.status,
          s.plan,
          s.current_period_end::text,
          s.canceled_at::text AS cancel_at,
          s.cancel_at_period_end,
          s.stripe_customer_id,
          s.stripe_subscription_id,
          s.updated_at::text
        FROM user_subscriptions s
        LEFT JOIN users u ON u.id = s.user_id
        ORDER BY s.updated_at DESC NULLS LAST
        LIMIT 100
      `,
    ),
    recentBillingEvents(30),
  ]);
  return {
    events,
    subscriptions: subscriptions.rows.map((row) => ({
      cancelAt: row.cancel_at,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      currentPeriodEnd: row.current_period_end,
      email: row.email,
      plan: row.plan,
      status: row.status,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      updatedAt: row.updated_at,
      userId: row.user_id,
    })),
  };
}

export async function getAdminAlertSummary(): Promise<AdminAlertSummary> {
  const [total, active, byUser, triggered] = await Promise.all([
    countQuery("SELECT count(*) AS count FROM alert_rules"),
    countQuery("SELECT count(*) AS count FROM alert_rules WHERE is_active = true"),
    dbQuery<AlertByUserRow>(
      `
        SELECT
          r.user_id::text,
          u.email,
          count(*) AS total,
          count(*) FILTER (WHERE r.is_active = true) AS active
        FROM alert_rules r
        LEFT JOIN users u ON u.id = r.user_id
        GROUP BY r.user_id, u.email
        ORDER BY active DESC, total DESC
        LIMIT 50
      `,
    ).catch(() => ({ rows: [] as AlertByUserRow[] })),
    dbQuery<AlertTriggeredRow>(
      `
        SELECT
          s.rule_id,
          r.user_id::text,
          r.symbol,
          s.last_triggered_at::text
        FROM alert_rule_state s
        LEFT JOIN alert_rules r ON r.id = s.rule_id
        ORDER BY s.last_triggered_at DESC NULLS LAST
        LIMIT 25
      `,
    ).catch(() => ({ rows: [] as AlertTriggeredRow[] })),
  ]);
  return {
    activeRules: active,
    byUser: byUser.rows.map((row) => ({ active: toNumber(row.active), email: row.email, total: toNumber(row.total), userId: row.user_id })),
    recentlyTriggered: triggered.rows.map((row) => ({ lastTriggeredAt: row.last_triggered_at, ruleId: row.rule_id, symbol: row.symbol, userId: row.user_id })),
    totalRules: total,
  };
}

export async function getAdminScannerSummary(): Promise<AdminScannerSummary> {
  const [latestRun, signalCount, health, latestValidation, providerUsage] = await Promise.all([
    getLatestScannerRun(),
    countQuery("SELECT count(*) AS count FROM scanner_signals").catch(() => 0),
    getScanDataHealth().catch(() => ({ ageMinutes: null, message: "Scanner freshness unavailable.", status: "unknown" })),
    recentMonitoringEventByType("scanner_db_csv_validation"),
    latestProviderUsage(),
  ]);
  return {
    csvFallbackEnabled: process.env.SCANNER_CSV_FALLBACK === "true",
    dbSignalCount: signalCount,
    freshness: {
      ageMinutes: health.ageMinutes,
      message: health.message,
      status: health.status,
    },
    latestRun,
    latestValidation,
    providerUsage,
  };
}

export async function getAdminMonitoringSummary(): Promise<AdminMonitoringSummary> {
  const [synthetics, requestMetrics, slowestRoutes, system, appEvents, latestBackup] = await Promise.all([
    dbQuery<SyntheticRow>(
      `
        SELECT DISTINCT ON (check_name)
          check_name,
          status,
          latency_ms,
          message,
          created_at::text
        FROM synthetic_check_results
        ORDER BY check_name, created_at DESC
      `,
    ).catch(() => ({ rows: [] as SyntheticRow[] })),
    dbQuery<RequestMetricsRow>(
      `
        SELECT
          count(*) AS requests_last_hour,
          count(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS recent_4xx,
          count(*) FILTER (WHERE status_code >= 500) AS recent_5xx,
          percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
          percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency_ms
        FROM request_metrics
        WHERE created_at > now() - interval '1 hour'
      `,
    ).catch(() => ({ rows: [] as RequestMetricsRow[] })),
    dbQuery<SlowRouteRow>(
      `
        SELECT route, method, status_code, latency_ms
        FROM request_metrics
        WHERE created_at > now() - interval '1 hour'
        ORDER BY latency_ms DESC
        LIMIT 10
      `,
    ).catch(() => ({ rows: [] as SlowRouteRow[] })),
    dbQuery<SystemMetricRow>(
      `
        SELECT
          cpu_percent,
          memory_percent,
          disk_percent,
          disk_free_bytes,
          (metadata->>'backupDirBytes')::bigint AS backup_dir_bytes,
          (metadata->>'scannerOutputBytes')::bigint AS scanner_output_bytes,
          created_at::text AS updated_at
        FROM system_metrics
        ORDER BY created_at DESC
        LIMIT 1
      `,
    ).catch(() => ({ rows: [] as SystemMetricRow[] })),
    recentMonitoringWarnings(20),
    recentMonitoringEventByType("backup"),
  ]);
  const metrics = requestMetrics.rows[0];
  const latestSystem = system.rows[0];
  return {
    appEvents,
    latestBackup,
    requestMetrics: {
      p50LatencyMs: toNullableNumber(metrics?.p50_latency_ms),
      p95LatencyMs: toNullableNumber(metrics?.p95_latency_ms),
      p99LatencyMs: toNullableNumber(metrics?.p99_latency_ms),
      recent4xx: toNumber(metrics?.recent_4xx),
      recent5xx: toNumber(metrics?.recent_5xx),
      requestsLastHour: toNumber(metrics?.requests_last_hour),
      slowestRoutes: slowestRoutes.rows.map((row) => ({ latencyMs: toNumber(row.latency_ms), method: row.method, route: row.route, statusCode: toNumber(row.status_code) })),
    },
    syntheticChecks: synthetics.rows.map((row) => ({ checkName: row.check_name, createdAt: row.created_at, latencyMs: toNumber(row.latency_ms), message: row.message, status: row.status })),
    system: {
      backupDirBytes: toNullableNumber(latestSystem?.backup_dir_bytes),
      scannerOutputBytes: toNullableNumber(latestSystem?.scanner_output_bytes),
      cpuPercent: toNullableNumber(latestSystem?.cpu_percent),
      diskFreeBytes: toNullableNumber(latestSystem?.disk_free_bytes),
      diskPercent: toNullableNumber(latestSystem?.disk_percent),
      memoryPercent: toNullableNumber(latestSystem?.memory_percent),
      updatedAt: latestSystem?.updated_at ?? null,
    },
  };
}

export async function listAdminAuditLog(): Promise<AdminAuditLogItem[]> {
  const result = await dbQuery<AuditLogRow>(
    `
      SELECT
        a.id::text,
        a.action,
        a.target_type,
        a.target_id,
        a.metadata,
        a.created_at::text,
        u.email AS admin_email
      FROM admin_audit_log a
      LEFT JOIN users u ON u.id = a.admin_user_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `,
  );
  return result.rows.map((row) => ({
    action: row.action,
    adminEmail: row.admin_email,
    createdAt: row.created_at,
    id: row.id,
    metadata: row.metadata ?? {},
    targetId: row.target_id,
    targetType: row.target_type,
  }));
}

export async function getAdminCalibrationSummary(): Promise<AdminCalibrationSummary> {
  const [latestRun, observationCount, scoreBucket, decision, setupType, assetType, marketRegime, distributions] = await Promise.all([
    getLatestScannerRun(),
    countQuery("SELECT count(*) AS count FROM forward_returns WHERE return_pct IS NOT NULL").catch(() => 0),
    calibrationGroupQuery("score_bucket"),
    calibrationGroupQuery("decision"),
    calibrationGroupQuery("setup_type"),
    calibrationGroupQuery("asset_type"),
    calibrationGroupQuery("market_regime"),
    latestDecisionDistribution(),
  ]);
  return {
    distributions,
    generatedAt: new Date().toISOString(),
    groups: {
      asset_type: assetType,
      decision,
      market_regime: marketRegime,
      score_bucket: scoreBucket,
      setup_type: setupType,
    },
    latestRun,
    observationCount,
  };
}

async function dashboardUserCounts(): Promise<AdminDashboardSummary["users"]> {
  const result = await dbQuery<DashboardCountsRow>(
    `
      SELECT
        count(*) AS total_users,
        count(*) FILTER (WHERE role = 'admin') AS admin_users,
        count(*) FILTER (WHERE role <> 'admin') AS free_users,
        count(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM user_subscriptions s
            WHERE s.user_id = users.id
              AND s.status IN ('active', 'trialing')
              AND s.current_period_end > now()
          )
        ) AS premium_users
      FROM users
    `,
  );
  const row = result.rows[0];
  return {
    admins: toNumber(row?.admin_users),
    free: Math.max(0, toNumber(row?.free_users) - toNumber(row?.premium_users)),
    premium: toNumber(row?.premium_users),
    total: toNumber(row?.total_users),
  };
}

async function dashboardBillingCounts(): Promise<AdminDashboardSummary["billing"]> {
  const result = await dbQuery<BillingCountsRow>(
    `
      SELECT
        count(*) FILTER (WHERE status IN ('active', 'trialing') AND current_period_end > now()) AS active_subscriptions,
        count(*) FILTER (WHERE cancel_at_period_end = true AND status IN ('active', 'trialing') AND current_period_end > now()) AS canceled_at_period_end
      FROM user_subscriptions
    `,
  );
  const row = result.rows[0];
  return {
    activeSubscriptions: toNumber(row?.active_subscriptions),
    canceledAtPeriodEnd: toNumber(row?.canceled_at_period_end),
  };
}

async function getLatestScannerRun(): Promise<ScannerRunSummary | null> {
  const result = await dbQuery<ScannerRunRow>(
    `
      SELECT
        r.id::text,
        r.status,
        r.completed_at::text,
        r.created_at::text,
        r.symbols_scored,
        r.market_regime,
        EXTRACT(epoch FROM (COALESCE(r.completed_at, r.created_at) - r.started_at)) AS duration_seconds,
        count(s.id) AS signal_count
      FROM scan_runs r
      LEFT JOIN scanner_signals s ON s.scan_run_id = r.id
      GROUP BY r.id
      ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
      LIMIT 1
    `,
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    durationSeconds: toNullableNumber(row.duration_seconds),
    id: row.id,
    marketRegime: row.market_regime,
    signalCount: toNumber(row.signal_count),
    status: row.status,
    symbolsScored: toNullableNumber(row.symbols_scored),
  };
}

async function recentBillingEvents(limit: number): Promise<BillingEventSummary[]> {
  const result = await dbQuery<BillingEventRow>(
    `
      SELECT id::text, user_id::text, event_type, stripe_event_id, created_at::text
      FROM billing_events
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  ).catch(() => ({ rows: [] as BillingEventRow[] }));
  return result.rows.map((row) => ({ createdAt: row.created_at, eventType: row.event_type, id: row.id, stripeEventId: row.stripe_event_id, userId: row.user_id }));
}

async function recentMonitoringWarnings(limit: number): Promise<MonitoringEventSummary[]> {
  const result = await dbQuery<MonitoringEventRow>(
    `
      SELECT event_type, severity, status, message, created_at::text
      FROM monitoring_events
      WHERE severity IN ('warn', 'error')
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  ).catch(() => ({ rows: [] as MonitoringEventRow[] }));
  return result.rows.map(monitoringEventFromRow);
}

async function recentMonitoringEventByType(eventType: string): Promise<MonitoringEventSummary | null> {
  const result = await dbQuery<MonitoringEventRow>(
    `
      SELECT event_type, severity, status, message, created_at::text
      FROM monitoring_events
      WHERE event_type = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [eventType],
  ).catch(() => ({ rows: [] as MonitoringEventRow[] }));
  const row = result.rows[0];
  return row ? monitoringEventFromRow(row) : null;
}

async function countQuery(sql: string): Promise<number> {
  const result = await dbQuery<CountRow>(sql);
  return toNumber(result.rows[0]?.count);
}

function monitoringEventFromRow(row: MonitoringEventRow): MonitoringEventSummary {
  return {
    createdAt: row.created_at,
    eventType: row.event_type,
    message: row.message,
    severity: row.severity,
    status: row.status,
  };
}

function cleanSearch(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 160);
}

function toNumber(value: string | number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function calibrationGroupQuery(groupType: CalibrationGroupType): Promise<CalibrationMetricRow[]> {
  const groupExpression = calibrationGroupExpression(groupType);
  const result = await dbQuery<CalibrationMetricDbRow>(
    `
      WITH base AS (
        SELECT
          ${groupExpression} AS group_value,
          COALESCE(NULLIF(horizon, ''), 'UNKNOWN') AS horizon,
          return_pct::numeric AS return_pct
        FROM forward_returns
        WHERE return_pct IS NOT NULL
      )
      SELECT
        $1::text AS group_type,
        COALESCE(NULLIF(group_value, ''), 'UNKNOWN') AS group_value,
        horizon,
        count(*) AS count,
        avg(return_pct) AS avg_return,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY return_pct) AS median_return,
        avg(CASE WHEN return_pct > 0 THEN 1.0 ELSE 0.0 END) AS win_rate,
        min(return_pct) AS worst_return
      FROM base
      GROUP BY group_value, horizon
      ORDER BY
        CASE horizon
          WHEN '1D' THEN 1
          WHEN '2D' THEN 2
          WHEN '3D' THEN 3
          WHEN '5D' THEN 5
          WHEN '10D' THEN 10
          WHEN '20D' THEN 20
          WHEN '60D' THEN 60
          ELSE 999
        END,
        count(*) DESC,
        group_value ASC
      LIMIT 160
    `,
    [groupType],
  ).catch(() => ({ rows: [] as CalibrationMetricDbRow[] }));
  return result.rows.map((row) => ({
    avgReturnPct: toPercent(row.avg_return),
    count: toNumber(row.count),
    groupType: row.group_type,
    groupValue: row.group_value ?? "UNKNOWN",
    horizon: row.horizon ?? "UNKNOWN",
    lowConfidence: toNumber(row.count) < 30,
    medianReturnPct: toPercent(row.median_return),
    winRatePct: toPercent(row.win_rate),
    worstReturnPct: toPercent(row.worst_return),
  }));
}

function calibrationGroupExpression(groupType: CalibrationGroupType): string {
  if (groupType === "score_bucket") {
    return `
      COALESCE(
        NULLIF(metrics->>'score_bucket', ''),
        CASE
          WHEN NULLIF(metrics->>'final_score', '') IS NULL THEN 'UNKNOWN'
          WHEN NULLIF(metrics->>'final_score', '')::numeric < 40 THEN '0-39'
          WHEN NULLIF(metrics->>'final_score', '')::numeric < 50 THEN '40-49'
          WHEN NULLIF(metrics->>'final_score', '')::numeric < 60 THEN '50-59'
          WHEN NULLIF(metrics->>'final_score', '')::numeric < 70 THEN '60-69'
          WHEN NULLIF(metrics->>'final_score', '')::numeric < 80 THEN '70-79'
          WHEN NULLIF(metrics->>'final_score', '')::numeric < 90 THEN '80-89'
          ELSE '90-100'
        END
      )
    `;
  }
  if (groupType === "decision") return "COALESCE(NULLIF(metrics->>'final_decision', ''), NULLIF(metrics->>'action', ''), 'UNKNOWN')";
  if (groupType === "setup_type") return "COALESCE(NULLIF(metrics->>'setup_type', ''), 'UNKNOWN')";
  if (groupType === "asset_type") return "COALESCE(NULLIF(metrics->>'asset_type', ''), 'UNKNOWN')";
  return "COALESCE(NULLIF(metrics->>'market_regime', ''), 'UNKNOWN')";
}

async function latestDecisionDistribution(): Promise<CalibrationDistributionRow[]> {
  const result = await dbQuery<CalibrationDistributionDbRow>(
    `
      WITH latest AS (
        SELECT id
        FROM scan_runs
        WHERE status = 'success'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      )
      SELECT
        COALESCE(NULLIF(s.final_decision, ''), 'UNKNOWN') AS decision,
        count(*) AS count,
        avg(s.final_score) AS avg_score,
        avg(NULLIF(s.payload->>'confidence_score', '')::numeric) AS avg_confidence,
        count(*) FILTER (WHERE s.payload->>'trade_permitted' = 'true') AS trade_permitted_count
      FROM scanner_signals s
      INNER JOIN latest ON latest.id = s.scan_run_id
      GROUP BY COALESCE(NULLIF(s.final_decision, ''), 'UNKNOWN')
      ORDER BY count(*) DESC, decision ASC
    `,
  ).catch(() => ({ rows: [] as CalibrationDistributionDbRow[] }));
  return result.rows.map((row) => ({
    avgConfidence: toNullableNumber(row.avg_confidence),
    avgScore: toNullableNumber(row.avg_score),
    count: toNumber(row.count),
    decision: row.decision ?? "UNKNOWN",
    tradePermittedCount: toNumber(row.trade_permitted_count),
  }));
}

function toPercent(value: string | number | null | undefined): number | null {
  const numeric = toNullableNumber(value);
  return numeric === null ? null : numeric * 100;
}

async function latestProviderUsage(): Promise<AdminScannerSummary["providerUsage"]> {
  const [providers, fallbackReasons] = await Promise.all([
    dbQuery<ProviderUsageDbRow>(
      `
        WITH latest AS (
          SELECT id
          FROM scan_runs
          WHERE status = 'success'
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        )
        SELECT COALESCE(NULLIF(payload->>'data_provider', ''), 'unknown') AS provider, count(*) AS count
        FROM scanner_signals
        WHERE scan_run_id = (SELECT id FROM latest)
        GROUP BY COALESCE(NULLIF(payload->>'data_provider', ''), 'unknown')
        ORDER BY count(*) DESC, provider ASC
      `,
    ).catch(() => ({ rows: [] as ProviderUsageDbRow[] })),
    dbQuery<FallbackReasonDbRow>(
      `
        WITH latest AS (
          SELECT id
          FROM scan_runs
          WHERE status = 'success'
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        )
        SELECT COALESCE(NULLIF(payload->>'fallback_reason', ''), 'unknown') AS reason, count(*) AS count
        FROM scanner_signals
        WHERE scan_run_id = (SELECT id FROM latest)
          AND payload->>'data_provider_fallback_used' = 'true'
        GROUP BY COALESCE(NULLIF(payload->>'fallback_reason', ''), 'unknown')
        ORDER BY count(*) DESC, reason ASC
        LIMIT 8
      `,
    ).catch(() => ({ rows: [] as FallbackReasonDbRow[] })),
  ]);
  const providerRows = providers.rows.map((row) => ({ count: toNumber(row.count), provider: row.provider ?? "unknown" }));
  const fallbackRows = fallbackReasons.rows.map((row) => ({ count: toNumber(row.count), reason: row.reason ?? "unknown" }));
  return {
    alpacaCount: providerRows.find((row) => row.provider === "alpaca")?.count ?? 0,
    fallbackCount: fallbackRows.reduce((sum, row) => sum + row.count, 0),
    providers: providerRows,
    topFallbackReasons: fallbackRows,
  };
}
