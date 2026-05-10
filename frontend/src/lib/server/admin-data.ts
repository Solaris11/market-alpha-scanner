import "server-only";

import type { QueryResultRow } from "pg";
import type { BackupHealthDetails } from "@/lib/backup-health";
import { llmBudgetCapsFromEnv } from "@/lib/llm-cost-policy";
import { getScanDataHealth } from "@/lib/scanner-data";
import { buildEvidenceDepthSummary, type EvidenceDepthDuplicateCheck, type EvidenceDepthSummary, type EvidenceDepthSymbol, type EvidenceDepthTableCount, type EvidenceDepthWindow } from "@/lib/trading/evidence-depth";
import { buildScoreCalibrationSystem, type CalibrationAxisDirection, type ScoreCalibrationAnomaly, type ScoreCalibrationAnomalyType, type ScoreCalibrationBucketInput, type ScoreCalibrationSystem } from "@/lib/trading/score-calibration";
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
  stripeMode: string | null;
  stripeSubscriptionId: string | null;
  updatedAt: string | null;
  userId: string;
};

export type BillingEventSummary = {
  createdAt: string | null;
  eventType: string;
  id: string;
  stripeEventId: string | null;
  stripeMode: string | null;
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
  metadata?: Record<string, unknown> | null;
  severity: string;
  status: string;
};

export type AdminMonitoringSummary = {
  appEvents: MonitoringEventSummary[];
  backupHealth: BackupHealthDetails | null;
  backupSeries: Array<{ bucket: string; failed: number; ok: number; warned: number }>;
  latestBackup: MonitoringEventSummary | null;
  llmUsage: {
    budgetCaps: {
      globalDailyUsd: number;
      routeDailyUsd: number;
      surfaceDailyUsd: number;
      userDailyUsd: number;
    };
    byRoute: Array<{ blocked: number; cacheHits: number; costUsd: number; failed: number; requests: number; route: string }>;
    bySurface: Array<{ blocked: number; cacheHits: number; costUsd: number; failed: number; requests: number; surface: string }>;
    recentEvents: Array<{ cacheStatus: string; costUsd: number; createdAt: string | null; model: string; route: string; status: string; surface: string }>;
    today: {
      blocked: number;
      cacheHits: number;
      costUsd: number;
      failed: number;
      monthlyRunRateUsd: number;
      requests: number;
    };
  };
  requestMetrics: {
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    p99LatencyMs: number | null;
    recent4xx: number;
    recent5xx: number;
    requestsLastHour: number;
    series: Array<{ bucket: string; fiveXx: number; fourXx: number; p50LatencyMs: number | null; p95LatencyMs: number | null; requests: number }>;
    slowestRoutes: Array<{
      count: number;
      errors: number;
      fiveXx: number;
      fourXx: number;
      latencyMs: number;
      maxLatencyMs: number;
      method: string;
      p95LatencyMs: number | null;
      recentErrors: Array<{ createdAt: string | null; statusCode: number }>;
      route: string;
      series: Array<{ bucket: string; errors: number; p50LatencyMs: number | null; p95LatencyMs: number | null; requests: number }>;
      statusCode: number;
      statusCounts: Array<{ count: number; statusCode: number }>;
    }>;
  };
  syntheticChecks: Array<{ checkName: string; createdAt: string | null; latencyMs: number; message: string; status: string }>;
  syntheticCheckSeries: Array<{ bucket: string; checkName: string; failed: number; latencyMs: number | null; ok: number; warned: number }>;
  syntheticSeries: Array<{ bucket: string; failed: number; ok: number; warned: number }>;
  system: {
    backupDirBytes: number | null;
    scannerOutputBytes: number | null;
    cpuPercent: number | null;
    diskFreeBytes: number | null;
    diskPercent: number | null;
    memoryPercent: number | null;
    updatedAt: string | null;
  };
  systemSeries: Array<{ bucket: string; cpuPercent: number | null; diskPercent: number | null; memoryPercent: number | null }>;
  timeRange: MonitoringTimeRange;
};

export type MonitoringTimeRange = "15m" | "1h" | "6h" | "24h" | "1w" | "1m" | "6m";

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
  avgDrawdownPct: number | null;
  avgLossPct: number | null;
  avgReturnPct: number | null;
  avgWinPct: number | null;
  count: number;
  expectancyPct: number | null;
  groupType: CalibrationGroupType;
  groupValue: string;
  horizon: string;
  lowConfidence: boolean;
  medianReturnPct: number | null;
  sampleSize: "LOW" | "MEDIUM" | "HIGH";
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
  evidenceDepth: EvidenceDepthSummary;
  generatedAt: string;
  groups: Record<CalibrationGroupType, CalibrationMetricRow[]>;
  hints: string[];
  latestRun: ScannerRunSummary | null;
  observationCount: number;
  scoreCalibration: ScoreCalibrationSystem;
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
  stripe_mode: string | null;
  stripe_subscription_id: string | null;
  updated_at: string | null;
  user_id: string;
};
type BillingEventRow = QueryResultRow & {
  created_at: string | null;
  event_type: string;
  id: string;
  stripe_event_id: string | null;
  stripe_mode: string | null;
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
  metadata: Record<string, unknown> | null;
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
  count: string | number;
  errors: string | number;
  five_xx: string | number;
  four_xx: string | number;
  latency_ms: string | number;
  max_latency_ms: string | number;
  method: string;
  p95_latency_ms: string | number | null;
  recent_errors: Array<{ created_at?: string | null; status_code?: string | number | null }> | null;
  route: string;
  route_series: Array<{ bucket?: string | null; errors?: string | number | null; p50_latency_ms?: string | number | null; p95_latency_ms?: string | number | null; requests?: string | number | null }> | null;
  status_code: string | number;
  status_counts: Array<{ count?: string | number | null; status_code?: string | number | null }> | null;
};
type RequestSeriesRow = QueryResultRow & {
  bucket: string;
  five_xx: string | number;
  four_xx: string | number;
  p50_latency_ms: string | number | null;
  p95_latency_ms: string | number | null;
  requests: string | number;
};
type SyntheticCheckSeriesRow = QueryResultRow & {
  bucket: string;
  check_name: string;
  failed: string | number;
  latency_ms: string | number | null;
  ok: string | number;
  warned: string | number;
};
type SyntheticSeriesRow = QueryResultRow & {
  bucket: string;
  failed: string | number;
  ok: string | number;
  warned: string | number;
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
type LlmUsageDailyRow = QueryResultRow & {
  blocked_count: string | number;
  cache_hit_count: string | number;
  estimated_cost_usd: string | number;
  failed_count: string | number;
  request_count: string | number;
  scope: string;
  subject: string;
};
type LlmUsageEventRow = QueryResultRow & {
  cache_status: string;
  created_at: string | null;
  estimated_cost_usd: string | number;
  model: string;
  route: string;
  status: string;
  surface: string;
};
type SystemSeriesRow = QueryResultRow & {
  bucket: string;
  cpu_percent: string | number | null;
  disk_percent: string | number | null;
  memory_percent: string | number | null;
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
  avg_drawdown: string | number | null;
  avg_loss: string | number | null;
  avg_return: string | number | null;
  avg_win: string | number | null;
  count: string | number;
  expectancy: string | number | null;
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
type ScoreCalibrationBucketDbRow = QueryResultRow & {
  adverse_rate: string | number | null;
  avg_drawdown: string | number | null;
  avg_return: string | number | null;
  avg_signal: string | number | null;
  axis_id: string;
  axis_label: string;
  bucket_label: string;
  bucket_order: string | number;
  count: string | number;
  direction: CalibrationAxisDirection;
  horizon: string;
  large_gain_rate: string | number | null;
  median_return: string | number | null;
  outcome_stddev: string | number | null;
  volatility_rate: string | number | null;
  win_rate: string | number | null;
  worst_return: string | number | null;
};
type ScoreCalibrationAnomalyDbRow = QueryResultRow & {
  anomaly_type: string;
  decision: string | null;
  drawdown_pct: string | number | null;
  final_score: string | number | null;
  horizon: string | null;
  reason: string;
  return_pct: string | number;
  signal_date: string | null;
  symbol: string;
};
type EvidenceDepthCountDbRow = QueryResultRow & {
  area: string;
  count: string | number;
};
type EvidenceDepthDuplicateDbRow = QueryResultRow & {
  duplicate_groups: string | number;
  label: string;
};
type EvidenceDepthSymbolDbRow = QueryResultRow & {
  forward_return_count: string | number;
  historical_depth_days: string | number | null;
  memory_snapshot_count: string | number;
  outcome_coverage: string | number | null;
  scanner_signal_count: string | number;
  symbol: string;
};
type EvidenceDepthWindowDbRow = QueryResultRow & {
  completed_forward_return_count: string | number;
  forward_return_count: string | number;
  historical_depth_days: string | number | null;
  memory_snapshot_count: string | number;
  scan_run_count: string | number;
  signal_count: string | number;
  unique_signal_days: string | number;
  unique_symbol_count: string | number;
  window_label: string;
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
          s.stripe_mode,
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
      stripeMode: row.stripe_mode,
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

export async function getAdminMonitoringSummary(timeRange: MonitoringTimeRange = "1h"): Promise<AdminMonitoringSummary> {
  const window = monitoringWindow(timeRange);
  const [synthetics, requestMetrics, requestSeries, slowestRoutes, system, systemSeries, syntheticSeries, syntheticCheckSeries, backupSeries, appEvents, latestBackup, llmUsage, deep] = await Promise.all([
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
        WHERE created_at > now() - ${window.intervalSql}
      `,
    ).catch(() => ({ rows: [] as RequestMetricsRow[] })),
    dbQuery<RequestSeriesRow>(
      `
        SELECT
          date_bin(${window.bucketSql}, created_at, TIMESTAMPTZ '2000-01-01')::text AS bucket,
          count(*) AS requests,
          count(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS four_xx,
          count(*) FILTER (WHERE status_code >= 500) AS five_xx,
          percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
        FROM request_metrics
        WHERE created_at > now() - ${window.intervalSql}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    ).catch(() => ({ rows: [] as RequestSeriesRow[] })),
    dbQuery<SlowRouteRow>(
      `
        WITH grouped AS (
          SELECT
            route,
            method,
            count(*) AS count,
            count(*) FILTER (WHERE status_code >= 400) AS errors,
            count(*) FILTER (WHERE status_code >= 400 AND status_code < 500) AS four_xx,
            count(*) FILTER (WHERE status_code >= 500) AS five_xx,
            max(latency_ms) AS max_latency_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
          FROM request_metrics
          WHERE created_at > now() - ${window.intervalSql}
          GROUP BY route, method
        ),
        slowest AS (
          SELECT route, method, status_code, latency_ms
          FROM request_metrics
          WHERE created_at > now() - ${window.intervalSql}
          ORDER BY latency_ms DESC
          LIMIT 40
        )
        SELECT
          g.route,
          g.method,
          COALESCE(s.status_code, 0) AS status_code,
          COALESCE(s.latency_ms, g.max_latency_ms) AS latency_ms,
          g.count,
          g.errors,
          g.four_xx,
          g.five_xx,
          g.max_latency_ms,
          g.p95_latency_ms,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'bucket', series.bucket,
                  'requests', series.requests,
                  'errors', series.errors,
                  'p50_latency_ms', series.p50_latency_ms,
                  'p95_latency_ms', series.p95_latency_ms
                )
                ORDER BY series.bucket
              )
              FROM (
                SELECT
                  date_bin(${window.bucketSql}, created_at, TIMESTAMPTZ '2000-01-01')::text AS bucket,
                  count(*) AS requests,
                  count(*) FILTER (WHERE status_code >= 400) AS errors,
                  percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
                  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
                FROM request_metrics
                WHERE route = g.route
                  AND method = g.method
                  AND created_at > now() - ${window.intervalSql}
                GROUP BY bucket
                ORDER BY bucket ASC
              ) series
            ),
            '[]'::jsonb
          ) AS route_series,
          COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object('status_code', status_code, 'count', count) ORDER BY status_code)
              FROM (
                SELECT status_code, count(*) AS count
                FROM request_metrics
                WHERE route = g.route
                  AND method = g.method
                  AND created_at > now() - ${window.intervalSql}
                GROUP BY status_code
                ORDER BY status_code
              ) statuses
            ),
            '[]'::jsonb
          ) AS status_counts,
          COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object('status_code', rm.status_code, 'created_at', rm.created_at::text) ORDER BY rm.created_at DESC)
              FROM (
                SELECT status_code, created_at
                FROM request_metrics
                WHERE route = g.route
                  AND method = g.method
                  AND status_code >= 400
                  AND created_at > now() - ${window.intervalSql}
                ORDER BY created_at DESC
                LIMIT 5
              ) rm
            ),
            '[]'::jsonb
          ) AS recent_errors
        FROM grouped g
        LEFT JOIN LATERAL (
          SELECT status_code, latency_ms
          FROM slowest s
          WHERE s.route = g.route AND s.method = g.method
          ORDER BY s.latency_ms DESC
          LIMIT 1
        ) s ON true
        ORDER BY g.max_latency_ms DESC
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
    dbQuery<SystemSeriesRow>(
      `
        SELECT
          date_bin(${window.bucketSql}, created_at, TIMESTAMPTZ '2000-01-01')::text AS bucket,
          avg(cpu_percent) AS cpu_percent,
          avg(memory_percent) AS memory_percent,
          avg(disk_percent) AS disk_percent
        FROM system_metrics
        WHERE created_at > now() - ${window.intervalSql}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    ).catch(() => ({ rows: [] as SystemSeriesRow[] })),
    dbQuery<SyntheticSeriesRow>(
      `
        SELECT
          date_bin(${window.bucketSql}, created_at, TIMESTAMPTZ '2000-01-01')::text AS bucket,
          count(*) FILTER (WHERE status = 'ok') AS ok,
          count(*) FILTER (WHERE status = 'warn') AS warned,
          count(*) FILTER (WHERE status = 'fail') AS failed
        FROM synthetic_check_results
        WHERE created_at > now() - ${window.intervalSql}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    ).catch(() => ({ rows: [] as SyntheticSeriesRow[] })),
    dbQuery<SyntheticCheckSeriesRow>(
      `
        SELECT
          date_bin(${window.bucketSql}, created_at, TIMESTAMPTZ '2000-01-01')::text AS bucket,
          check_name,
          avg(latency_ms) AS latency_ms,
          count(*) FILTER (WHERE status = 'ok') AS ok,
          count(*) FILTER (WHERE status = 'warn') AS warned,
          count(*) FILTER (WHERE status = 'fail') AS failed
        FROM synthetic_check_results
        WHERE created_at > now() - ${window.intervalSql}
        GROUP BY bucket, check_name
        ORDER BY bucket ASC, check_name ASC
      `,
    ).catch(() => ({ rows: [] as SyntheticCheckSeriesRow[] })),
    dbQuery<SyntheticSeriesRow>(
      `
        SELECT
          date_bin(${window.bucketSql}, created_at, TIMESTAMPTZ '2000-01-01')::text AS bucket,
          count(*) FILTER (WHERE severity = 'info' AND status IN ('backup_success', 'backup_r2_success', 'offsite_sync_ok', 'local_backup_ok', 'ok')) AS ok,
          count(*) FILTER (WHERE severity IN ('warning', 'warn') OR status IN ('backup_partial')) AS warned,
          count(*) FILTER (WHERE severity = 'error' OR status IN ('backup_failed', 'backup_r2_failure', 'offsite_sync_failed', 'error', 'fail', 'failed')) AS failed
        FROM monitoring_events
        WHERE created_at > now() - ${window.intervalSql}
          AND event_type = 'backup'
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    ).catch(() => ({ rows: [] as SyntheticSeriesRow[] })),
    recentMonitoringWarnings(20),
    recentMonitoringEventByType("backup"),
    getLlmUsageSummary(),
    deepHealth().catch(() => null),
  ]);
  const metrics = requestMetrics.rows[0];
  const latestSystem = system.rows[0];
  return {
    appEvents,
    backupHealth: deep?.backup ?? null,
    backupSeries: backupSeries.rows.map((row) => ({ bucket: row.bucket, failed: toNumber(row.failed), ok: toNumber(row.ok), warned: toNumber(row.warned) })),
    latestBackup,
    llmUsage,
    requestMetrics: {
      p50LatencyMs: toNullableNumber(metrics?.p50_latency_ms),
      p95LatencyMs: toNullableNumber(metrics?.p95_latency_ms),
      p99LatencyMs: toNullableNumber(metrics?.p99_latency_ms),
      recent4xx: toNumber(metrics?.recent_4xx),
      recent5xx: toNumber(metrics?.recent_5xx),
      requestsLastHour: toNumber(metrics?.requests_last_hour),
      series: requestSeries.rows.map((row) => ({
        bucket: row.bucket,
        fiveXx: toNumber(row.five_xx),
        fourXx: toNumber(row.four_xx),
        p50LatencyMs: toNullableNumber(row.p50_latency_ms),
        p95LatencyMs: toNullableNumber(row.p95_latency_ms),
        requests: toNumber(row.requests),
      })),
      slowestRoutes: slowestRoutes.rows.map((row) => ({
        count: toNumber(row.count),
        errors: toNumber(row.errors),
        fiveXx: toNumber(row.five_xx),
        fourXx: toNumber(row.four_xx),
        latencyMs: toNumber(row.latency_ms),
        maxLatencyMs: toNumber(row.max_latency_ms),
        method: row.method,
        p95LatencyMs: toNullableNumber(row.p95_latency_ms),
        recentErrors: Array.isArray(row.recent_errors)
          ? row.recent_errors.map((item) => ({ createdAt: item.created_at ?? null, statusCode: toNumber(item.status_code) }))
          : [],
        route: row.route,
        series: Array.isArray(row.route_series)
          ? row.route_series.map((item) => ({
            bucket: String(item.bucket ?? ""),
            errors: toNumber(item.errors),
            p50LatencyMs: toNullableNumber(item.p50_latency_ms),
            p95LatencyMs: toNullableNumber(item.p95_latency_ms),
            requests: toNumber(item.requests),
          })).filter((item) => item.bucket)
          : [],
        statusCode: toNumber(row.status_code),
        statusCounts: Array.isArray(row.status_counts)
          ? row.status_counts.map((item) => ({ count: toNumber(item.count), statusCode: toNumber(item.status_code) }))
          : [],
      })),
    },
    syntheticCheckSeries: syntheticCheckSeries.rows.map((row) => ({ bucket: row.bucket, checkName: row.check_name, failed: toNumber(row.failed), latencyMs: toNullableNumber(row.latency_ms), ok: toNumber(row.ok), warned: toNumber(row.warned) })),
    syntheticChecks: synthetics.rows.map((row) => ({ checkName: row.check_name, createdAt: row.created_at, latencyMs: toNumber(row.latency_ms), message: row.message, status: row.status })),
    syntheticSeries: syntheticSeries.rows.map((row) => ({ bucket: row.bucket, failed: toNumber(row.failed), ok: toNumber(row.ok), warned: toNumber(row.warned) })),
    system: {
      backupDirBytes: toNullableNumber(latestSystem?.backup_dir_bytes),
      scannerOutputBytes: toNullableNumber(latestSystem?.scanner_output_bytes),
      cpuPercent: toNullableNumber(latestSystem?.cpu_percent),
      diskFreeBytes: toNullableNumber(latestSystem?.disk_free_bytes),
      diskPercent: toNullableNumber(latestSystem?.disk_percent),
      memoryPercent: toNullableNumber(latestSystem?.memory_percent),
      updatedAt: latestSystem?.updated_at ?? null,
    },
    systemSeries: systemSeries.rows.map((row) => ({ bucket: row.bucket, cpuPercent: toNullableNumber(row.cpu_percent), diskPercent: toNullableNumber(row.disk_percent), memoryPercent: toNullableNumber(row.memory_percent) })),
    timeRange,
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

async function getLlmUsageSummary(): Promise<AdminMonitoringSummary["llmUsage"]> {
  const budgetCaps = llmBudgetCapsFromEnv();
  const empty = {
    budgetCaps,
    byRoute: [],
    bySurface: [],
    recentEvents: [],
    today: {
      blocked: 0,
      cacheHits: 0,
      costUsd: 0,
      failed: 0,
      monthlyRunRateUsd: 0,
      requests: 0,
    },
  };
  try {
    const [daily, recent] = await Promise.all([
      dbQuery<LlmUsageDailyRow>(
        `
          SELECT
            scope,
            subject,
            request_count,
            cache_hit_count,
            blocked_count,
            failed_count,
            estimated_cost_usd
          FROM llm_usage_daily
          WHERE day = current_date
            AND scope IN ('global', 'surface', 'route')
          ORDER BY estimated_cost_usd DESC
          LIMIT 40
        `,
      ),
      dbQuery<LlmUsageEventRow>(
        `
          SELECT
            surface,
            route,
            model,
            status,
            cache_status,
            estimated_cost_usd,
            created_at::text
          FROM llm_usage_events
          ORDER BY created_at DESC
          LIMIT 12
        `,
      ),
    ]);
    const global = daily.rows.find((row) => row.scope === "global" && row.subject === "all");
    return {
      budgetCaps,
      byRoute: daily.rows
        .filter((row) => row.scope === "route")
        .map((row) => ({
          blocked: toNumber(row.blocked_count),
          cacheHits: toNumber(row.cache_hit_count),
          costUsd: toNumber(row.estimated_cost_usd),
          failed: toNumber(row.failed_count),
          requests: toNumber(row.request_count),
          route: row.subject,
        })),
      bySurface: daily.rows
        .filter((row) => row.scope === "surface")
        .map((row) => ({
          blocked: toNumber(row.blocked_count),
          cacheHits: toNumber(row.cache_hit_count),
          costUsd: toNumber(row.estimated_cost_usd),
          failed: toNumber(row.failed_count),
          requests: toNumber(row.request_count),
          surface: row.subject,
        })),
      recentEvents: recent.rows.map((row) => ({
        cacheStatus: row.cache_status,
        costUsd: toNumber(row.estimated_cost_usd),
        createdAt: row.created_at,
        model: row.model,
        route: row.route,
        status: row.status,
        surface: row.surface,
      })),
      today: {
        blocked: toNumber(global?.blocked_count),
        cacheHits: toNumber(global?.cache_hit_count),
        costUsd: toNumber(global?.estimated_cost_usd),
        failed: toNumber(global?.failed_count),
        monthlyRunRateUsd: Math.round(toNumber(global?.estimated_cost_usd) * 30 * 100) / 100,
        requests: toNumber(global?.request_count),
      },
    };
  } catch {
    return empty;
  }
}

function monitoringWindow(range: MonitoringTimeRange): { bucketSql: string; intervalSql: string } {
  switch (range) {
    case "15m":
      return { bucketSql: "INTERVAL '1 minute'", intervalSql: "INTERVAL '15 minutes'" };
    case "6h":
      return { bucketSql: "INTERVAL '15 minutes'", intervalSql: "INTERVAL '6 hours'" };
    case "24h":
      return { bucketSql: "INTERVAL '1 hour'", intervalSql: "INTERVAL '24 hours'" };
    case "1w":
      return { bucketSql: "INTERVAL '6 hours'", intervalSql: "INTERVAL '7 days'" };
    case "1m":
      return { bucketSql: "INTERVAL '1 day'", intervalSql: "INTERVAL '30 days'" };
    case "6m":
      return { bucketSql: "INTERVAL '7 days'", intervalSql: "INTERVAL '6 months'" };
    case "1h":
    default:
      return { bucketSql: "INTERVAL '5 minutes'", intervalSql: "INTERVAL '1 hour'" };
  }
}

export async function getAdminCalibrationSummary(): Promise<AdminCalibrationSummary> {
  const [latestRun, observationCount, scoreBucket, decision, setupType, assetType, marketRegime, distributions, evidenceDepth, scoreCalibration] = await Promise.all([
    getLatestScannerRun(),
    countQuery("SELECT count(*) AS count FROM forward_returns WHERE return_pct IS NOT NULL").catch(() => 0),
    calibrationGroupQuery("score_bucket"),
    calibrationGroupQuery("decision"),
    calibrationGroupQuery("setup_type"),
    calibrationGroupQuery("asset_type"),
    calibrationGroupQuery("market_regime"),
    latestDecisionDistribution(),
    getEvidenceDepthSummary(),
    getScoreCalibrationSystem(),
  ]);
  return {
    distributions,
    evidenceDepth,
    generatedAt: new Date().toISOString(),
    groups: {
      asset_type: assetType,
      decision,
      market_regime: marketRegime,
      score_bucket: scoreBucket,
      setup_type: setupType,
    },
    hints: calibrationHints({ asset_type: assetType, decision, market_regime: marketRegime, score_bucket: scoreBucket, setup_type: setupType }),
    latestRun,
    observationCount,
    scoreCalibration,
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
      SELECT id::text, user_id::text, event_type, stripe_event_id, stripe_mode, created_at::text
      FROM billing_events
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  ).catch(() => ({ rows: [] as BillingEventRow[] }));
  return result.rows.map((row) => ({ createdAt: row.created_at, eventType: row.event_type, id: row.id, stripeEventId: row.stripe_event_id, stripeMode: row.stripe_mode, userId: row.user_id }));
}

async function recentMonitoringWarnings(limit: number): Promise<MonitoringEventSummary[]> {
  const result = await dbQuery<MonitoringEventRow>(
    `
      SELECT event_type, severity, status, message, metadata, created_at::text
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
      SELECT event_type, severity, status, message, metadata, created_at::text
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
    metadata: row.metadata ?? null,
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
          return_pct::numeric AS return_pct,
          NULLIF(metrics->>'max_drawdown_after_signal', '')::numeric AS max_drawdown_after_signal
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
        avg(CASE WHEN return_pct > 0 THEN return_pct ELSE NULL END) AS avg_win,
        abs(avg(CASE WHEN return_pct <= 0 THEN return_pct ELSE NULL END)) AS avg_loss,
        avg(CASE WHEN return_pct <= 0 THEN 1.0 ELSE 0.0 END) AS loss_rate,
        (
          avg(CASE WHEN return_pct > 0 THEN 1.0 ELSE 0.0 END) * COALESCE(avg(CASE WHEN return_pct > 0 THEN return_pct ELSE NULL END), 0)
          -
          avg(CASE WHEN return_pct <= 0 THEN 1.0 ELSE 0.0 END) * COALESCE(abs(avg(CASE WHEN return_pct <= 0 THEN return_pct ELSE NULL END)), 0)
        ) AS expectancy,
        avg(max_drawdown_after_signal) AS avg_drawdown,
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
    avgDrawdownPct: toPercent(row.avg_drawdown),
    avgLossPct: toPercent(row.avg_loss),
    avgReturnPct: toPercent(row.avg_return),
    avgWinPct: toPercent(row.avg_win),
    count: toNumber(row.count),
    expectancyPct: toPercent(row.expectancy),
    groupType: row.group_type,
    groupValue: row.group_value ?? "UNKNOWN",
    horizon: row.horizon ?? "UNKNOWN",
    lowConfidence: toNumber(row.count) < 30,
    medianReturnPct: toPercent(row.median_return),
    sampleSize: sampleSizeLabel(toNumber(row.count)),
    winRatePct: toPercent(row.win_rate),
    worstReturnPct: toPercent(row.worst_return),
  }));
}

async function getScoreCalibrationSystem(): Promise<ScoreCalibrationSystem> {
  const [bucketRows, anomalies] = await Promise.all([
    scoreCalibrationBuckets(),
    scoreCalibrationAnomalies(),
  ]);
  return buildScoreCalibrationSystem({ anomalies, bucketRows });
}

async function scoreCalibrationBuckets(): Promise<ScoreCalibrationBucketInput[]> {
  const result = await dbQuery<ScoreCalibrationBucketDbRow>(
    `
      ${scoreCalibrationBaseCte()}
      , axis_values AS (
        SELECT 'final_score' AS axis_id, 'Final score' AS axis_label, 'higher_better' AS direction, horizon, final_score AS axis_value, return_pct, drawdown_pct FROM base WHERE final_score IS NOT NULL
        UNION ALL SELECT 'macro_adjusted_score', 'Macro-adjusted score', 'higher_better', horizon, macro_adjusted_score, return_pct, drawdown_pct FROM base WHERE macro_adjusted_score IS NOT NULL
        UNION ALL SELECT 'conviction', 'Conviction', 'higher_better', horizon, conviction_score, return_pct, drawdown_pct FROM base WHERE conviction_score IS NOT NULL
        UNION ALL SELECT 'fragility', 'Fragility', 'higher_risk', horizon, fragility_score, return_pct, drawdown_pct FROM base WHERE fragility_score IS NOT NULL
        UNION ALL SELECT 'shock_score', 'Upside shock score', 'higher_better', horizon, shock_score, return_pct, drawdown_pct FROM base WHERE shock_score IS NOT NULL
        UNION ALL SELECT 'downside_shock_score', 'Downside shock score', 'higher_risk', horizon, downside_shock_score, return_pct, drawdown_pct FROM base WHERE downside_shock_score IS NOT NULL
        UNION ALL SELECT 'macro_alignment', 'Macro alignment', 'higher_better', horizon, macro_alignment_score, return_pct, drawdown_pct FROM base WHERE macro_alignment_score IS NOT NULL
        UNION ALL SELECT 'risk_reward', 'Risk/reward score', 'higher_better', horizon, risk_reward_score, return_pct, drawdown_pct FROM base WHERE risk_reward_score IS NOT NULL
        UNION ALL SELECT 'event_pressure', 'Event pressure', 'higher_risk', horizon, event_pressure_score, return_pct, drawdown_pct FROM base WHERE event_pressure_score IS NOT NULL
      ),
      bucketed AS (
        SELECT
          axis_id,
          axis_label,
          direction,
          horizon,
          axis_value,
          return_pct,
          drawdown_pct,
          CASE
            WHEN axis_id = 'risk_reward' AND axis_value < 1 THEN 1
            WHEN axis_id = 'risk_reward' AND axis_value < 1.5 THEN 2
            WHEN axis_id = 'risk_reward' AND axis_value < 2 THEN 3
            WHEN axis_id = 'risk_reward' AND axis_value < 3 THEN 4
            WHEN axis_id = 'risk_reward' THEN 5
            WHEN axis_value < 40 THEN 1
            WHEN axis_value < 50 THEN 2
            WHEN axis_value < 60 THEN 3
            WHEN axis_value < 70 THEN 4
            WHEN axis_value < 80 THEN 5
            WHEN axis_value < 90 THEN 6
            ELSE 7
          END AS bucket_order,
          CASE
            WHEN axis_id = 'risk_reward' AND axis_value < 1 THEN '<1.0'
            WHEN axis_id = 'risk_reward' AND axis_value < 1.5 THEN '1.0-1.49'
            WHEN axis_id = 'risk_reward' AND axis_value < 2 THEN '1.5-1.99'
            WHEN axis_id = 'risk_reward' AND axis_value < 3 THEN '2.0-2.99'
            WHEN axis_id = 'risk_reward' THEN '3.0+'
            WHEN axis_value < 40 THEN '0-39'
            WHEN axis_value < 50 THEN '40-49'
            WHEN axis_value < 60 THEN '50-59'
            WHEN axis_value < 70 THEN '60-69'
            WHEN axis_value < 80 THEN '70-79'
            WHEN axis_value < 90 THEN '80-89'
            ELSE '90-100'
          END AS bucket_label
        FROM axis_values
      )
      SELECT
        axis_id,
        axis_label,
        direction,
        horizon,
        bucket_order,
        bucket_label,
        count(*) AS count,
        avg(axis_value) AS avg_signal,
        avg(return_pct) AS avg_return,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY return_pct) AS median_return,
        avg(CASE WHEN return_pct > 0 THEN 1.0 ELSE 0.0 END) AS win_rate,
        avg(drawdown_pct) AS avg_drawdown,
        min(return_pct) AS worst_return,
        avg(CASE WHEN return_pct >= 0.05 THEN 1.0 ELSE 0.0 END) AS large_gain_rate,
        avg(CASE WHEN return_pct <= -0.03 OR drawdown_pct <= -0.03 THEN 1.0 ELSE 0.0 END) AS adverse_rate,
        avg(CASE WHEN abs(return_pct) >= 0.03 OR abs(drawdown_pct) >= 0.03 THEN 1.0 ELSE 0.0 END) AS volatility_rate,
        stddev_pop(return_pct) AS outcome_stddev
      FROM bucketed
      GROUP BY axis_id, axis_label, direction, horizon, bucket_order, bucket_label
      ORDER BY
        CASE horizon
          WHEN '1D' THEN 1
          WHEN '2D' THEN 2
          WHEN '3D' THEN 3
          WHEN '5D' THEN 5
          WHEN '10D' THEN 10
          ELSE 999
        END,
        axis_id,
        bucket_order
      LIMIT 600
    `,
  ).catch(() => ({ rows: [] as ScoreCalibrationBucketDbRow[] }));

  return result.rows.map((row) => ({
    adverseRatePct: toPercent(row.adverse_rate),
    avgDrawdownPct: toPercent(row.avg_drawdown),
    avgReturnPct: toPercent(row.avg_return),
    avgSignal: toNullableNumber(row.avg_signal),
    axisId: row.axis_id,
    axisLabel: row.axis_label,
    bucketLabel: row.bucket_label,
    bucketOrder: toNumber(row.bucket_order),
    count: toNumber(row.count),
    direction: calibrationDirection(row.direction),
    horizon: row.horizon ?? "UNKNOWN",
    largeGainRatePct: toPercent(row.large_gain_rate),
    medianReturnPct: toPercent(row.median_return),
    outcomeStdDevPct: toPercent(row.outcome_stddev),
    volatilityRatePct: toPercent(row.volatility_rate),
    winRatePct: toPercent(row.win_rate),
    worstReturnPct: toPercent(row.worst_return),
  }));
}

async function scoreCalibrationAnomalies(): Promise<ScoreCalibrationAnomaly[]> {
  const result = await dbQuery<ScoreCalibrationAnomalyDbRow>(
    `
      ${scoreCalibrationBaseCte()}
      , anomalies AS (
        SELECT
          'false_positive' AS anomaly_type,
          symbol,
          signal_date::text,
          horizon,
          decision,
          final_score,
          return_pct,
          drawdown_pct,
          'High final-score bucket failed to follow through or produced material drawdown.' AS reason,
          abs(return_pct) + abs(drawdown_pct) AS severity_value
        FROM base
        WHERE final_score >= 70
          AND (return_pct <= 0 OR drawdown_pct <= -0.03)
        UNION ALL
        SELECT
          'false_negative',
          symbol,
          signal_date::text,
          horizon,
          decision,
          final_score,
          return_pct,
          drawdown_pct,
          'Lower score bucket later produced a large forward gain.',
          abs(return_pct) + abs(drawdown_pct)
        FROM base
        WHERE final_score < 55
          AND return_pct >= 0.05
        UNION ALL
        SELECT
          'missed_winner',
          symbol,
          signal_date::text,
          horizon,
          decision,
          final_score,
          return_pct,
          drawdown_pct,
          'Potential missed winner: low/mid score later produced an outsized forward gain.',
          abs(return_pct) + abs(drawdown_pct)
        FROM base
        WHERE final_score < 60
          AND return_pct >= 0.08
        UNION ALL
        SELECT
          'overly_conservative',
          symbol,
          signal_date::text,
          horizon,
          decision,
          final_score,
          return_pct,
          drawdown_pct,
          'WAIT/AVOID style decision later produced a strong positive outcome.',
          abs(return_pct) + abs(drawdown_pct)
        FROM base
        WHERE decision ~* '(WAIT|AVOID|NO_TRADE|NO TRADE|EXIT)'
          AND return_pct >= 0.05
        UNION ALL
        SELECT
          'overly_aggressive',
          symbol,
          signal_date::text,
          horizon,
          decision,
          final_score,
          return_pct,
          drawdown_pct,
          'ENTER/BUY style decision later produced adverse outcome or drawdown.',
          abs(return_pct) + abs(drawdown_pct)
        FROM base
        WHERE decision ~* '(ENTER|BUY|STRONG)'
          AND (return_pct <= -0.03 OR drawdown_pct <= -0.05)
        UNION ALL
        SELECT
          'avoided_loser',
          symbol,
          signal_date::text,
          horizon,
          decision,
          final_score,
          return_pct,
          drawdown_pct,
          'WAIT/AVOID style decision avoided a later adverse move or drawdown.',
          abs(return_pct) + abs(drawdown_pct)
        FROM base
        WHERE decision ~* '(WAIT|AVOID|NO_TRADE|NO TRADE|EXIT)'
          AND (return_pct <= -0.03 OR drawdown_pct <= -0.05)
      )
      SELECT
        anomaly_type,
        symbol,
        signal_date,
        horizon,
        decision,
        final_score,
        return_pct,
        drawdown_pct,
        reason
      FROM anomalies
      ORDER BY severity_value DESC, signal_date DESC NULLS LAST
      LIMIT 160
    `,
  ).catch(() => ({ rows: [] as ScoreCalibrationAnomalyDbRow[] }));

  return result.rows.map((row) => ({
    anomalyType: calibrationAnomalyType(row.anomaly_type),
    decision: row.decision ?? "UNKNOWN",
    drawdownPct: toPercent(row.drawdown_pct),
    finalScore: toNullableNumber(row.final_score),
    horizon: row.horizon ?? "UNKNOWN",
    reason: row.reason,
    returnPct: toPercent(row.return_pct) ?? 0,
    signalDate: row.signal_date,
    symbol: row.symbol,
  }));
}

function scoreCalibrationBaseCte(): string {
  return `
    WITH latest_patterns AS (
      SELECT DISTINCT ON (symbol)
        symbol,
        upside_shock_score,
        downside_risk_score,
        opportunity_score
      FROM shock_move_patterns
      ORDER BY
        symbol,
        CASE lookback_window
          WHEN '3y' THEN 1
          WHEN '5y' THEN 2
          WHEN '1y' THEN 3
          ELSE 4
        END,
        last_updated DESC NULLS LAST
    ),
    base AS (
      SELECT
        fr.symbol,
        fr.signal_date,
        COALESCE(NULLIF(fr.horizon, ''), 'UNKNOWN') AS horizon,
        fr.return_pct::numeric AS return_pct,
        COALESCE(${safeNumeric("fr.metrics->>'max_drawdown_after_signal'")}, LEAST(fr.return_pct::numeric, 0)) AS drawdown_pct,
        COALESCE(NULLIF(fr.metrics->>'final_decision', ''), NULLIF(ss.final_decision, ''), NULLIF(fr.metrics->>'action', ''), NULLIF(ss.action, ''), 'UNKNOWN') AS decision,
        COALESCE(${safeNumeric("fr.metrics->>'final_score'")}, ss.final_score) AS final_score,
        COALESCE(${safeNumeric("ss.payload->>'macro_adjusted_score'")}, ss.final_score_adjusted, ${safeNumeric("fr.metrics->>'final_score'")}, ss.final_score) AS macro_adjusted_score,
        COALESCE(${safeNumeric("fr.metrics->>'confidence_score'")}, ${safeNumeric("ss.payload->>'confidence_score'")}, ${safeNumeric("ss.payload->>'conviction_score'")}, ${safeNumeric("fr.metrics->>'final_score'")}, ss.final_score) AS conviction_score,
        COALESCE(${safeNumeric("ss.payload->>'fragility_score'")}, ${safeNumeric("ss.payload->>'event_risk_score'")}, ${safeNumeric("ss.payload->>'volatility_pressure'")}, ${safeNumeric("ss.payload->>'risk_penalty'")}, 100 - COALESCE(${safeNumeric("fr.metrics->>'confidence_score'")}, ${safeNumeric("ss.payload->>'confidence_score'")}, ss.final_score, 50)) AS fragility_score,
        COALESCE(${safeNumeric("ss.payload->>'macro_alignment_score'")}, ${safeNumeric("ss.payload->>'macro_score'")}, ${safeNumeric("fr.metrics->>'macro_score'")}, ${safeNumeric("ss.payload->>'macro_adjusted_score'")}) AS macro_alignment_score,
        COALESCE(lp.upside_shock_score, ${safeNumeric("ss.payload->>'event_shock_pressure_score'")}, ${safeNumeric("ss.payload->>'upside_shock_score'")}) AS shock_score,
        COALESCE(lp.downside_risk_score, ${safeNumeric("ss.payload->>'downside_shock_score'")}, ${safeNumeric("ss.payload->>'event_risk_score'")}, ${safeNumeric("ss.payload->>'volatility_pressure'")}) AS downside_shock_score,
        COALESCE(ss.risk_reward, ${safeNumeric("ss.payload->>'risk_reward'")}, ${safeNumeric("fr.metrics->>'risk_reward'")}) AS risk_reward_score,
        COALESCE(${safeNumeric("ss.payload->>'verified_event_pressure_score'")}, ${safeNumeric("ss.payload->>'event_risk_score'")}, ${safeNumeric("ss.payload->>'event_shock_pressure_score'")}) AS event_pressure_score
      FROM forward_returns fr
      LEFT JOIN scanner_signals ss ON ss.id = fr.scanner_signal_id
      LEFT JOIN latest_patterns lp ON lp.symbol = fr.symbol
      WHERE fr.return_pct IS NOT NULL
        AND COALESCE(NULLIF(fr.horizon, ''), 'UNKNOWN') IN ('1D', '2D', '3D', '5D', '10D')
    )
  `;
}

function safeNumeric(expression: string): string {
  return `CASE WHEN NULLIF(${expression}, '') ~ '^-?[0-9]+([.][0-9]+)?$' THEN NULLIF(${expression}, '')::numeric ELSE NULL END`;
}

function calibrationDirection(value: string): CalibrationAxisDirection {
  return value === "higher_risk" ? "higher_risk" : "higher_better";
}

function calibrationAnomalyType(value: string): ScoreCalibrationAnomalyType {
  if (value === "avoided_loser" || value === "false_negative" || value === "false_positive" || value === "missed_winner" || value === "overly_aggressive" || value === "overly_conservative") {
    return value;
  }
  return "false_positive";
}

function sampleSizeLabel(count: number): "LOW" | "MEDIUM" | "HIGH" {
  if (count < 30) return "LOW";
  if (count <= 100) return "MEDIUM";
  return "HIGH";
}

function calibrationHints(groups: Record<CalibrationGroupType, CalibrationMetricRow[]>): string[] {
  const hints: string[] = [];
  if (Object.values(groups).flat().every((row) => row.sampleSize === "LOW")) {
    hints.push("All calibration groups still have early/low evidence. Do not tune weights from this data yet.");
  }
  const setupRows = groups.setup_type.filter((row) => ["10D", "20D"].includes(row.horizon) && row.expectancyPct !== null);
  if (setupRows.length >= 2) {
    const sorted = [...setupRows].sort((left, right) => Number(right.expectancyPct ?? -Infinity) - Number(left.expectancyPct ?? -Infinity));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && worst && Number(best.expectancyPct) > Number(worst.expectancyPct)) {
      hints.push(`${best.groupValue} setups currently show stronger expectancy than ${worst.groupValue} setups on ${best.horizon}. Treat as directional until sample size improves.`);
    }
  }
  const scoreRows = groups.score_bucket.filter((row) => ["10D", "20D"].includes(row.horizon) && row.expectancyPct !== null);
  const highScoreAvg = average(scoreRows.filter((row) => /80|90/.test(row.groupValue)).map((row) => row.expectancyPct));
  const midScoreAvg = average(scoreRows.filter((row) => /60|70/.test(row.groupValue)).map((row) => row.expectancyPct));
  if (highScoreAvg !== null && midScoreAvg !== null && midScoreAvg > highScoreAvg) {
    hints.push("Mid-score buckets are currently ahead of higher-score buckets. Wait for more observations before changing thresholds.");
  }
  return hints.slice(0, 4);
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
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

async function getEvidenceDepthSummary(): Promise<EvidenceDepthSummary> {
  const [tableCounts, windows, duplicateChecks, representativeSymbols] = await Promise.all([
    evidenceDepthTableCounts(),
    evidenceDepthWindows(),
    evidenceDuplicateChecks(),
    evidenceRepresentativeSymbols(),
  ]);
  return buildEvidenceDepthSummary({
    duplicateChecks,
    representativeSymbols,
    tableCounts,
    windows,
  });
}

async function evidenceDepthTableCounts(): Promise<EvidenceDepthTableCount[]> {
  const result = await dbQuery<EvidenceDepthCountDbRow>(
    `
      SELECT 'scan_runs' AS area, count(*) AS count FROM scan_runs
      UNION ALL SELECT 'scanner_signals', count(*) FROM scanner_signals
      UNION ALL SELECT 'market_memory_snapshots', count(*) FROM market_memory_snapshots
      UNION ALL SELECT 'shock_move_patterns', count(*) FROM shock_move_patterns
      UNION ALL SELECT 'shock_move_events', count(*) FROM shock_move_events
      UNION ALL SELECT 'forward_returns', count(*) FROM forward_returns
      UNION ALL SELECT 'forward_returns_completed', count(*) FROM forward_returns WHERE return_pct IS NOT NULL
    `,
  ).catch(() => ({ rows: [] as EvidenceDepthCountDbRow[] }));
  return result.rows.map((row) => ({ area: row.area, count: toNumber(row.count) }));
}

async function evidenceDepthWindows(): Promise<EvidenceDepthWindow[]> {
  const result = await dbQuery<EvidenceDepthWindowDbRow>(
    `
      WITH windows(window_label, days) AS (
        VALUES ('30D'::text, 30), ('60D'::text, 60), ('90D'::text, 90)
      )
      SELECT
        w.window_label,
        COALESCE((SELECT count(*) FROM scan_runs sr WHERE sr.status = 'success' AND COALESCE(sr.completed_at, sr.created_at) >= now() - make_interval(days => w.days)), 0) AS scan_run_count,
        COALESCE((SELECT count(*) FROM scanner_signals ss JOIN scan_runs sr ON sr.id = ss.scan_run_id WHERE sr.status = 'success' AND COALESCE(sr.completed_at, sr.created_at) >= now() - make_interval(days => w.days)), 0) AS signal_count,
        COALESCE((SELECT count(*) FROM market_memory_snapshots m WHERE m.signal_ts >= now() - make_interval(days => w.days)), 0) AS memory_snapshot_count,
        COALESCE((SELECT count(DISTINCT ss.symbol) FROM scanner_signals ss JOIN scan_runs sr ON sr.id = ss.scan_run_id WHERE sr.status = 'success' AND COALESCE(sr.completed_at, sr.created_at) >= now() - make_interval(days => w.days)), 0) AS unique_symbol_count,
        COALESCE((SELECT count(DISTINCT COALESCE(sr.completed_at, sr.created_at)::date) FROM scan_runs sr WHERE sr.status = 'success' AND COALESCE(sr.completed_at, sr.created_at) >= now() - make_interval(days => w.days)), 0) AS unique_signal_days,
        COALESCE((SELECT count(*) FROM forward_returns fr WHERE fr.signal_date >= (current_date - w.days)), 0) AS forward_return_count,
        COALESCE((SELECT count(*) FROM forward_returns fr WHERE fr.signal_date >= (current_date - w.days) AND fr.return_pct IS NOT NULL), 0) AS completed_forward_return_count,
        COALESCE((SELECT (max(COALESCE(sr.completed_at, sr.created_at)::date) - min(COALESCE(sr.completed_at, sr.created_at)::date) + 1)::int FROM scan_runs sr WHERE sr.status = 'success' AND COALESCE(sr.completed_at, sr.created_at) >= now() - make_interval(days => w.days)), 0) AS historical_depth_days
      FROM windows w
      ORDER BY w.days
    `,
  ).catch(() => ({ rows: [] as EvidenceDepthWindowDbRow[] }));
  return result.rows.map((row) => ({
    completedForwardReturnCount: toNumber(row.completed_forward_return_count),
    forwardReturnCount: toNumber(row.forward_return_count),
    historicalDepthDays: toNumber(row.historical_depth_days),
    memorySnapshotCount: toNumber(row.memory_snapshot_count),
    scanRunCount: toNumber(row.scan_run_count),
    signalCount: toNumber(row.signal_count),
    uniqueSignalDays: toNumber(row.unique_signal_days),
    uniqueSymbolCount: toNumber(row.unique_symbol_count),
    windowLabel: row.window_label === "30D" || row.window_label === "60D" || row.window_label === "90D" ? row.window_label : "90D",
  }));
}

async function evidenceDuplicateChecks(): Promise<EvidenceDepthDuplicateCheck[]> {
  const result = await dbQuery<EvidenceDepthDuplicateDbRow>(
    `
      SELECT 'history backfill source files' AS label, count(*) AS duplicate_groups FROM (
        SELECT metadata->>'source_file' FROM scan_runs WHERE run_type='history_backfill' AND metadata ? 'source_file' GROUP BY 1 HAVING count(*) > 1
      ) d
      UNION ALL SELECT 'scanner signal run/symbol pairs', count(*) FROM (
        SELECT scan_run_id, symbol FROM scanner_signals GROUP BY 1,2 HAVING count(*) > 1
      ) d
      UNION ALL SELECT 'market memory scanner signal links', count(*) FROM (
        SELECT scanner_signal_id FROM market_memory_snapshots GROUP BY 1 HAVING count(*) > 1
      ) d
      UNION ALL SELECT 'shock pattern symbol/windows', count(*) FROM (
        SELECT symbol, lookback_window FROM shock_move_patterns GROUP BY 1,2 HAVING count(*) > 1
      ) d
      UNION ALL SELECT 'shock event symbol/date/types', count(*) FROM (
        SELECT symbol, event_date, move_type FROM shock_move_events GROUP BY 1,2,3 HAVING count(*) > 1
      ) d
    `,
  ).catch(() => ({ rows: [] as EvidenceDepthDuplicateDbRow[] }));
  return result.rows.map((row) => ({ duplicateGroups: toNumber(row.duplicate_groups), label: row.label }));
}

async function evidenceRepresentativeSymbols(): Promise<Array<Omit<EvidenceDepthSymbol, "evidenceMaturity">>> {
  const symbols = ["AMD", "MU", "DDOG", "NVDA", "AVGO", "ASML", "CRWD", "TSM", "OXY", "QQQ", "SPY"];
  const result = await dbQuery<EvidenceDepthSymbolDbRow>(
    `
      WITH symbols(symbol) AS (
        SELECT unnest($1::text[])
      ),
      signal_counts AS (
        SELECT
          ss.symbol,
          count(*) AS scanner_signal_count,
          COALESCE((max(COALESCE(sr.completed_at, sr.created_at)::date) - min(COALESCE(sr.completed_at, sr.created_at)::date) + 1)::int, 0) AS historical_depth_days
        FROM scanner_signals ss
        JOIN scan_runs sr ON sr.id = ss.scan_run_id
        WHERE ss.symbol = ANY($1::text[])
        GROUP BY ss.symbol
      ),
      memory_counts AS (
        SELECT symbol, count(*) AS memory_snapshot_count
        FROM market_memory_snapshots
        WHERE symbol = ANY($1::text[])
        GROUP BY symbol
      ),
      forward_counts AS (
        SELECT symbol, count(*) AS forward_return_count
        FROM forward_returns
        WHERE symbol = ANY($1::text[])
          AND return_pct IS NOT NULL
        GROUP BY symbol
      )
      SELECT
        symbols.symbol,
        COALESCE(signal_counts.scanner_signal_count, 0) AS scanner_signal_count,
        COALESCE(signal_counts.historical_depth_days, 0) AS historical_depth_days,
        COALESCE(memory_counts.memory_snapshot_count, 0) AS memory_snapshot_count,
        COALESCE(forward_counts.forward_return_count, 0) AS forward_return_count,
        CASE
          WHEN COALESCE(signal_counts.scanner_signal_count, 0) <= 0 THEN 0
          ELSE LEAST(100, (COALESCE(forward_counts.forward_return_count, 0)::numeric / signal_counts.scanner_signal_count::numeric) * 100)
        END AS outcome_coverage
      FROM symbols
      LEFT JOIN signal_counts ON signal_counts.symbol = symbols.symbol
      LEFT JOIN memory_counts ON memory_counts.symbol = symbols.symbol
      LEFT JOIN forward_counts ON forward_counts.symbol = symbols.symbol
      ORDER BY symbols.symbol
    `,
    [symbols],
  ).catch(() => ({ rows: [] as EvidenceDepthSymbolDbRow[] }));
  return result.rows.map((row) => ({
    forwardReturnCount: toNumber(row.forward_return_count),
    historicalDepthDays: toNumber(row.historical_depth_days),
    memorySnapshotCount: toNumber(row.memory_snapshot_count),
    outcomeCoverage: toNullableNumber(row.outcome_coverage) ?? 0,
    scannerSignalCount: toNumber(row.scanner_signal_count),
    symbol: row.symbol,
  }));
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
