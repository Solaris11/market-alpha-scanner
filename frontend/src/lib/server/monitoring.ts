import "server-only";

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { QueryResultRow } from "pg";
import { classifyBackupHealth, type BackupEventSummary, type BackupHealthDetails } from "@/lib/backup-health";
import { cleanMonitoringText, normalizeRequestMetric, type MonitoringSeverity, type MonitoringStatus, type RequestMetricInput } from "@/lib/monitoring-policy";
import { getScanDataHealth } from "@/lib/scanner-data";
import { dbQuery } from "./db";

export type DeepHealthResult = {
  backup: BackupHealthDetails;
  db: ComponentHealth;
  ok: boolean;
  scanner: ComponentHealth;
  service: "tradeveto-frontend";
  timestamp: string;
};

export type ComponentHealth = {
  ageMinutes?: number | null;
  lastUpdated?: string | null;
  message: string;
  status: "fail" | "ok" | "unknown" | "warn";
};

type LatestTimestampRow = QueryResultRow & {
  latest: string | Date | null;
};

type BackupEventRow = QueryResultRow & {
  created_at: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  severity: string;
  status: string;
};

type NormalizedRequestMetric = Required<RequestMetricInput>;

type RequestMetricRollupInput = {
  bucketStart: string;
  errorCount: number;
  maxLatencyMs: number;
  method: string;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  requestCount: number;
  route: string;
  statusBucket: string;
};

type RequestMetricQueueState = {
  dropped: number;
  flushing: boolean;
  metrics: NormalizedRequestMetric[];
  timer: ReturnType<typeof setTimeout> | null;
};

const DEFAULT_BACKUP_DIR = "/app/backups";
const BACKUP_WARN_MINUTES = 8 * 60;
const BACKUP_FAIL_MINUTES = 30 * 60;
const REQUEST_METRIC_BATCH_SIZE = 500;
const REQUEST_METRIC_FLUSH_DELAY_MS = 250;
const REQUEST_METRIC_MAX_QUEUE = 5_000;
const REQUEST_METRIC_HOT_ROUTES = new Set([
  "/api/discovery",
  "/api/live-intelligence",
  "/api/v1/opportunities",
  "/api/v1/portfolio/scenario",
  "/api/v1/replay",
  "/api/history/replay",
  "/api/symbol/[symbol]",
  "/api/paper/account",
  "/api/paper/positions",
]);
const REQUEST_METRIC_RAW_SAMPLE_RATE = boundedSampleRate(process.env.TRADEVETO_REQUEST_METRIC_RAW_SAMPLE_RATE, 1);
const REQUEST_METRIC_HOT_RAW_SAMPLE_RATE = boundedSampleRate(process.env.TRADEVETO_REQUEST_METRIC_HOT_RAW_SAMPLE_RATE, 0.2);
const REQUEST_METRIC_HOT_QUEUE_SAMPLE_RATE = boundedSampleRate(process.env.TRADEVETO_REQUEST_METRIC_HOT_QUEUE_SAMPLE_RATE, 0.25);

const monitoringGlobal = globalThis as typeof globalThis & {
  __tradevetoRequestMetricQueue?: RequestMetricQueueState;
};

export async function deepHealth(): Promise<DeepHealthResult> {
  const [db, scanner, backup] = await Promise.all([dbHealth(), scannerHealth(), backupHealth()]);
  return {
    backup,
    db,
    ok: db.status === "ok" && scanner.status !== "fail" && backup.status !== "failed",
    scanner,
    service: "tradeveto-frontend",
    timestamp: new Date().toISOString(),
  };
}

export async function recordMonitoringEvent(input: {
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity: MonitoringSeverity;
  status: MonitoringStatus;
}): Promise<void> {
  await dbQuery(
    `
      INSERT INTO monitoring_events (event_type, severity, status, message, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
    `,
    [cleanKey(input.eventType), input.severity, input.status, cleanMonitoringText(input.message), JSON.stringify(safeMetadata(input.metadata ?? {}))],
  );
}

export async function recordRequestMetric(input: RequestMetricInput): Promise<void> {
  const metric = normalizeRequestMetric(input);
  enqueueRequestMetric(metric);
}

export async function recordSyntheticCheck(input: {
  checkName: string;
  latencyMs: number;
  message: string;
  metadata?: Record<string, unknown>;
  status: MonitoringStatus;
}): Promise<void> {
  await dbQuery(
    `
      INSERT INTO synthetic_check_results (check_name, status, latency_ms, message, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
    `,
    [cleanKey(input.checkName), input.status, safeLatency(input.latencyMs), cleanMonitoringText(input.message), JSON.stringify(safeMetadata(input.metadata ?? {}))],
  );
}

export async function recordSystemMetric(input: {
  cpuPercent: number | null;
  diskFreeBytes: number | null;
  diskPercent: number | null;
  memoryPercent: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await dbQuery(
    `
      INSERT INTO system_metrics (cpu_percent, memory_percent, disk_percent, disk_free_bytes, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
    `,
    [safeNullablePercent(input.cpuPercent), safeNullablePercent(input.memoryPercent), safeNullablePercent(input.diskPercent), safeNullableInteger(input.diskFreeBytes), JSON.stringify(safeMetadata(input.metadata ?? {}))],
  );
}

export async function cleanupMonitoringRetention(): Promise<{ deleted: Record<string, number> }> {
  const tables = ["request_metrics", "synthetic_check_results", "system_metrics", "monitoring_events"] as const;
  const deleted: Record<string, number> = {};
  for (const table of tables) {
    const result = await dbQuery(`DELETE FROM ${table} WHERE created_at < now() - interval '30 days'`);
    deleted[table] = result.rowCount ?? 0;
  }
  return { deleted };
}

export async function withRequestMetrics(request: Request, route: string, work: () => Promise<Response>): Promise<Response> {
  const startedAt = Date.now();
  let statusCode = 500;
  try {
    const response = await work();
    statusCode = response.status;
    return response;
  } finally {
    const latencyMs = Date.now() - startedAt;
    recordRequestMetric({
      latencyMs,
      method: request.method,
      route,
      statusCode,
      userId: null,
    }).catch((error: unknown) => {
      console.warn("[monitoring] request metric write failed", error instanceof Error ? error.message : error);
    });
  }
}

async function dbHealth(): Promise<ComponentHealth> {
  try {
    await dbQuery("SELECT 1");
    return { message: "Database connectivity ok.", status: "ok" };
  } catch {
    return { message: "Database connectivity failed.", status: "fail" };
  }
}

async function scannerHealth(): Promise<ComponentHealth> {
  try {
    const health = await getScanDataHealth();
    if (health.status === "missing" || health.status === "schema_mismatch") {
      return { ageMinutes: health.ageMinutes, lastUpdated: health.lastUpdated, message: health.message, status: "fail" };
    }
    return {
      ageMinutes: health.ageMinutes,
      lastUpdated: health.lastUpdated,
      message: health.message,
      status: health.status === "stale" ? "warn" : "ok",
    };
  } catch {
    return { message: "Scanner freshness check failed.", status: "fail" };
  }
}

async function backupHealth(): Promise<BackupHealthDetails> {
  const backupDir = process.env.TRADEVETO_BACKUP_DIR?.trim() || process.env.MARKET_ALPHA_BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIR;
  try {
    const [latest, events] = await Promise.all([latestFileMtime(backupDir), recentBackupEvents()]);
    let localBackup: ComponentHealth;
    if (!latest) {
      localBackup = { message: "No local backup files found.", status: "unknown" };
    } else {
      const ageMinutes = Math.max(0, (Date.now() - latest.getTime()) / 60000);
      const base = { ageMinutes, lastUpdated: latest.toISOString(), message: `Latest local backup updated ${Math.round(ageMinutes)} minutes ago.` };
      if (ageMinutes > BACKUP_FAIL_MINUTES) localBackup = { ...base, status: "fail" };
      else if (ageMinutes > BACKUP_WARN_MINUTES) localBackup = { ...base, status: "warn" };
      else localBackup = { ...base, status: "ok" };
    }
    return classifyBackupHealth({
      events,
      localBackup: {
        ...localBackup,
        status: localBackup.status === "fail" ? "failed" : localBackup.status,
      },
    });
  } catch {
    return classifyBackupHealth({
      events: [],
      localBackup: { message: "Local backup freshness unavailable.", status: "unknown" },
    });
  }
}

async function recentBackupEvents(): Promise<BackupEventSummary[]> {
  const result = await dbQuery<BackupEventRow>(
    `
      SELECT status, severity, message, metadata, created_at::text
      FROM monitoring_events
      WHERE event_type = 'backup'
      ORDER BY created_at DESC
      LIMIT 50
    `,
  ).catch(() => ({ rows: [] as BackupEventRow[] }));
  return result.rows.map((row) => ({
    createdAt: row.created_at,
    message: row.message,
    metadata: row.metadata,
    severity: row.severity,
    status: row.status,
  }));
}

async function latestFileMtime(root: string): Promise<Date | null> {
  let latest: Date | null = null;
  await walkFiles(root);
  return latest;

  async function walkFiles(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walkFiles(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const fileStat = await stat(fullPath);
      if (!latest || fileStat.mtime > latest) latest = fileStat.mtime;
    }
  }
}

function cleanKey(value: string): string {
  return cleanMonitoringText(value, 120).replace(/[^A-Za-z0-9:_.-]/g, "_") || "unknown";
}

function safeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 40)) {
    if (/token|secret|password|cookie|authorization|stripe_secret/i.test(key)) continue;
    safe[cleanKey(key)] = safeMetadataValue(value);
  }
  return safe;
}

function safeMetadataValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return cleanMonitoringText(value, 240);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeMetadataValue(item));
  if (typeof value === "object") return safeMetadata(value as Record<string, unknown>);
  return String(value).slice(0, 120);
}

function safeLatency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(3_600_000, Math.round(value)));
}

function safeNullableInteger(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value);
}

function safeNullablePercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function requestMetricQueue(): RequestMetricQueueState {
  if (!monitoringGlobal.__tradevetoRequestMetricQueue) {
    monitoringGlobal.__tradevetoRequestMetricQueue = {
      dropped: 0,
      flushing: false,
      metrics: [],
      timer: null,
    };
  }
  return monitoringGlobal.__tradevetoRequestMetricQueue;
}

function enqueueRequestMetric(metric: NormalizedRequestMetric): void {
  if (!shouldQueueRequestMetric(metric)) return;
  const queue = requestMetricQueue();
  if (queue.metrics.length >= REQUEST_METRIC_MAX_QUEUE) {
    queue.metrics.shift();
    queue.dropped += 1;
  }
  queue.metrics.push(metric);
  scheduleRequestMetricFlush(queue);
}

function shouldQueueRequestMetric(metric: NormalizedRequestMetric): boolean {
  if (!REQUEST_METRIC_HOT_ROUTES.has(metric.route)) return true;
  if (REQUEST_METRIC_HOT_QUEUE_SAMPLE_RATE >= 1) return true;
  if (REQUEST_METRIC_HOT_QUEUE_SAMPLE_RATE <= 0) return false;
  return Math.random() < REQUEST_METRIC_HOT_QUEUE_SAMPLE_RATE;
}

function scheduleRequestMetricFlush(queue: RequestMetricQueueState): void {
  if (queue.timer || queue.flushing) return;
  queue.timer = setTimeout(() => {
    queue.timer = null;
    flushRequestMetrics().catch((error: unknown) => {
      console.warn("[monitoring] request metric batch write failed", error instanceof Error ? error.message : error);
    });
  }, REQUEST_METRIC_FLUSH_DELAY_MS);
  queue.timer.unref?.();
}

async function flushRequestMetrics(): Promise<void> {
  const queue = requestMetricQueue();
  if (queue.flushing) return;
  queue.flushing = true;
  try {
    while (queue.metrics.length > 0) {
      const batch = queue.metrics.splice(0, REQUEST_METRIC_BATCH_SIZE);
      await writeRequestMetricBatch(batch);
    }
  } finally {
    queue.flushing = false;
    if (queue.metrics.length > 0) scheduleRequestMetricFlush(queue);
  }
}

async function writeRequestMetricBatch(batch: NormalizedRequestMetric[]): Promise<void> {
  if (!batch.length) return;
  const rawBatch = sampleRawRequestMetricBatch(batch);
  await Promise.all([
    rawBatch.length
      ? dbQuery(
      `
        INSERT INTO request_metrics (route, method, status_code, latency_ms, user_id, created_at)
        SELECT route, method, status_code, latency_ms, user_id, now()
        FROM unnest($1::text[], $2::text[], $3::int[], $4::int[], $5::uuid[]) AS metric(route, method, status_code, latency_ms, user_id)
      `,
      [
        rawBatch.map((metric) => metric.route),
        rawBatch.map((metric) => metric.method),
        rawBatch.map((metric) => metric.statusCode),
        rawBatch.map((metric) => metric.latencyMs),
        rawBatch.map((metric) => metric.userId),
      ],
      )
      : Promise.resolve(),
    writeRequestMetricRollupBatch(batch).catch((error: unknown) => {
      console.warn("[monitoring] request metric rollup write failed", error instanceof Error ? error.message : error);
    }),
  ]);
}

function sampleRawRequestMetricBatch(batch: NormalizedRequestMetric[]): NormalizedRequestMetric[] {
  return batch.filter((metric) => {
    const sampleRate = REQUEST_METRIC_HOT_ROUTES.has(metric.route) ? REQUEST_METRIC_HOT_RAW_SAMPLE_RATE : REQUEST_METRIC_RAW_SAMPLE_RATE;
    if (sampleRate >= 1) return true;
    if (sampleRate <= 0) return false;
    return Math.random() < sampleRate;
  });
}

async function writeRequestMetricRollupBatch(batch: NormalizedRequestMetric[]): Promise<void> {
  const rollups = buildRequestMetricRollups(batch);
  if (!rollups.length) return;
  await dbQuery(
    `
      INSERT INTO request_metric_rollups_minute (
        bucket_start,
        route,
        method,
        status_bucket,
        request_count,
        error_count,
        p50_latency_ms,
        p95_latency_ms,
        p99_latency_ms,
        max_latency_ms,
        updated_at
      )
      SELECT
        bucket_start,
        route,
        method,
        status_bucket,
        request_count,
        error_count,
        p50_latency_ms,
        p95_latency_ms,
        p99_latency_ms,
        max_latency_ms,
        now()
      FROM unnest(
        $1::timestamptz[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::int[],
        $6::int[],
        $7::int[],
        $8::int[],
        $9::int[],
        $10::int[]
      ) AS rollup(bucket_start, route, method, status_bucket, request_count, error_count, p50_latency_ms, p95_latency_ms, p99_latency_ms, max_latency_ms)
      ON CONFLICT (bucket_start, route, method, status_bucket)
      DO UPDATE SET
        request_count = request_metric_rollups_minute.request_count + EXCLUDED.request_count,
        error_count = request_metric_rollups_minute.error_count + EXCLUDED.error_count,
        p50_latency_ms = GREATEST(request_metric_rollups_minute.p50_latency_ms, EXCLUDED.p50_latency_ms),
        p95_latency_ms = GREATEST(request_metric_rollups_minute.p95_latency_ms, EXCLUDED.p95_latency_ms),
        p99_latency_ms = GREATEST(request_metric_rollups_minute.p99_latency_ms, EXCLUDED.p99_latency_ms),
        max_latency_ms = GREATEST(request_metric_rollups_minute.max_latency_ms, EXCLUDED.max_latency_ms),
        updated_at = now()
    `,
    [
      rollups.map((rollup) => rollup.bucketStart),
      rollups.map((rollup) => rollup.route),
      rollups.map((rollup) => rollup.method),
      rollups.map((rollup) => rollup.statusBucket),
      rollups.map((rollup) => rollup.requestCount),
      rollups.map((rollup) => rollup.errorCount),
      rollups.map((rollup) => rollup.p50LatencyMs),
      rollups.map((rollup) => rollup.p95LatencyMs),
      rollups.map((rollup) => rollup.p99LatencyMs),
      rollups.map((rollup) => rollup.maxLatencyMs),
    ],
  );
}

function buildRequestMetricRollups(batch: NormalizedRequestMetric[]): RequestMetricRollupInput[] {
  const groups = new Map<string, NormalizedRequestMetric[]>();
  const bucketStart = minuteBucketIso(new Date());
  for (const metric of batch) {
    const statusBucket = metric.statusCode >= 500 ? "5xx" : metric.statusCode >= 400 ? "4xx" : metric.statusCode >= 300 ? "3xx" : "2xx";
    const key = `${bucketStart}\u0000${metric.route}\u0000${metric.method}\u0000${statusBucket}`;
    const current = groups.get(key) ?? [];
    current.push(metric);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, metrics]) => {
    const [bucket, route, method, statusBucket] = key.split("\u0000");
    const latencies = metrics.map((metric) => metric.latencyMs).sort((left, right) => left - right);
    return {
      bucketStart: bucket ?? bucketStart,
      errorCount: metrics.filter((metric) => metric.statusCode >= 400).length,
      maxLatencyMs: latencies[latencies.length - 1] ?? 0,
      method: method ?? "GET",
      p50LatencyMs: percentileFromSorted(latencies, 0.50),
      p95LatencyMs: percentileFromSorted(latencies, 0.95),
      p99LatencyMs: percentileFromSorted(latencies, 0.99),
      requestCount: metrics.length,
      route: route ?? "unknown",
      statusBucket: statusBucket ?? "unknown",
    };
  });
}

function minuteBucketIso(value: Date): string {
  value.setSeconds(0, 0);
  return value.toISOString();
}

function percentileFromSorted(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentileValue) - 1));
  return values[index] ?? 0;
}

function boundedSampleRate(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}
