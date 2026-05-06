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
  service: "market-alpha-frontend";
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

const DEFAULT_BACKUP_DIR = "/app/backups";
const BACKUP_WARN_MINUTES = 8 * 60;
const BACKUP_FAIL_MINUTES = 30 * 60;

export async function deepHealth(): Promise<DeepHealthResult> {
  const [db, scanner, backup] = await Promise.all([dbHealth(), scannerHealth(), backupHealth()]);
  return {
    backup,
    db,
    ok: db.status === "ok" && scanner.status !== "fail" && backup.status !== "failed",
    scanner,
    service: "market-alpha-frontend",
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
  await dbQuery(
    `
      INSERT INTO request_metrics (route, method, status_code, latency_ms, user_id, created_at)
      VALUES ($1, $2, $3, $4, $5::uuid, now())
    `,
    [metric.route, metric.method, metric.statusCode, metric.latencyMs, metric.userId],
  );
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
  const backupDir = process.env.MARKET_ALPHA_BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIR;
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
