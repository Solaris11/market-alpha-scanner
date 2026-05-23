import "server-only";

import type { QueryResultRow } from "pg";
import {
  buildVisibleTrustStates,
  classifyProviderOperationalState,
  type ProviderOperationalState,
  type VisibleTrustState,
} from "@/lib/production-trust-status";
import { getScanDataHealth } from "@/lib/scanner-data";
import { deepHealth } from "./monitoring";
import { dbQuery } from "./db";

export type PublicTrustIncident = {
  createdAt: string | null;
  eventType: string;
  message: string;
  severity: string;
  status: string;
};

export type PublicProviderTrustStatus = {
  fallbackCount: number;
  freshness: string;
  lastUpdated: string | null;
  operationalState: ProviderOperationalState;
  providers: Array<{ count: number; provider: string }>;
};

export type PublicSystemTrustStatus = {
  detail: string;
  label: string;
  status: "fail" | "ok" | "unknown" | "warn";
};

export type ProductionTrustStatus = {
  degradedSystems: PublicSystemTrustStatus[];
  delayedFeedDisclosure: string;
  generatedAt: string;
  incidents: PublicTrustIncident[];
  ok: boolean;
  overallStatus: "degraded" | "limited" | "operational";
  providerFreshness: PublicProviderTrustStatus;
  staleDataState: {
    ageMinutes: number | null;
    label: string;
    lastUpdated: string | null;
    message: string;
    status: string;
  };
  trustStates: VisibleTrustState[];
};

type ProviderUsageRow = QueryResultRow & {
  count: string | number;
  provider: string | null;
};

type ProviderFallbackRow = QueryResultRow & {
  count: string | number;
};

type PublicIncidentRow = QueryResultRow & {
  created_at: string | null;
  event_type: string;
  message: string;
  severity: string;
  status: string;
};

export async function getProductionTrustStatus(): Promise<ProductionTrustStatus> {
  const [deep, scanHealth, providerUsage, incidents] = await Promise.all([
    deepHealth().catch(() => null),
    getScanDataHealth().catch(() => ({ ageMinutes: null, lastUpdated: null, message: "Scanner freshness unavailable.", status: "unknown" })),
    latestProviderTrustUsage(),
    publicIncidents(),
  ]);
  const providerState = classifyProviderOperationalState({
    providerCount: providerUsage.providers.length,
    providerFallbackCount: providerUsage.fallbackCount,
    scannerAgeMinutes: scanHealth.ageMinutes,
    scannerStatus: scanHealth.status,
  });
  const degradedSystems = [
    {
      detail: deep?.db.message ?? "Database health unavailable.",
      label: "Database",
      status: deep?.db.status ?? "unknown",
    },
    {
      detail: deep?.scanner.message ?? scanHealth.message,
      label: "Scanner",
      status: deep?.scanner.status ?? statusFromScanner(scanHealth.status),
    },
    {
      detail: deep?.backup.message ?? "Backup health unavailable.",
      label: "Backups",
      status: backupStatus(deep?.backup.overallBackup),
    },
  ] satisfies PublicSystemTrustStatus[];
  const trustStates = buildVisibleTrustStates({
    backupStatus: deep?.backup.overallBackup ?? "unknown",
    dbStatus: deep?.db.status ?? "unknown",
    incidentCount: incidents.length,
    providerCount: providerUsage.providers.length,
    providerFallbackCount: providerUsage.fallbackCount,
    scannerAgeMinutes: scanHealth.ageMinutes,
    scannerStatus: scanHealth.status,
  });
  const ok = Boolean(deep?.ok) && incidents.length === 0 && !trustStates.some((state) => state.status === "active");
  return {
    degradedSystems,
    delayedFeedDisclosure: delayedFeedDisclosure(scanHealth.ageMinutes, scanHealth.status),
    generatedAt: new Date().toISOString(),
    incidents,
    ok,
    overallStatus: ok ? "operational" : incidents.length || degradedSystems.some((system) => system.status === "fail") ? "degraded" : "limited",
    providerFreshness: {
      fallbackCount: providerUsage.fallbackCount,
      freshness: providerFreshnessLabel(providerState, scanHealth.ageMinutes),
      lastUpdated: scanHealth.lastUpdated,
      operationalState: providerState,
      providers: providerUsage.providers,
    },
    staleDataState: {
      ageMinutes: scanHealth.ageMinutes,
      label: scanHealth.status === "fresh" ? "Fresh" : scanHealth.status === "slightly_stale" ? "Slightly stale" : scanHealth.status === "stale" ? "Stale" : "Limited",
      lastUpdated: scanHealth.lastUpdated,
      message: scanHealth.message,
      status: scanHealth.status,
    },
    trustStates,
  };
}

async function latestProviderTrustUsage(): Promise<{ fallbackCount: number; providers: Array<{ count: number; provider: string }> }> {
  const [providers, fallback] = await Promise.all([
    dbQuery<ProviderUsageRow>(
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
        LIMIT 12
      `,
    ).catch(() => ({ rows: [] as ProviderUsageRow[] })),
    dbQuery<ProviderFallbackRow>(
      `
        WITH latest AS (
          SELECT id
          FROM scan_runs
          WHERE status = 'success'
          ORDER BY completed_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        )
        SELECT count(*) AS count
        FROM scanner_signals
        WHERE scan_run_id = (SELECT id FROM latest)
          AND payload->>'data_provider_fallback_used' = 'true'
      `,
    ).catch(() => ({ rows: [] as ProviderFallbackRow[] })),
  ]);
  return {
    fallbackCount: toNumber(fallback.rows[0]?.count),
    providers: providers.rows.map((row) => ({ count: toNumber(row.count), provider: row.provider ?? "unknown" })),
  };
}

async function publicIncidents(): Promise<PublicTrustIncident[]> {
  const result = await dbQuery<PublicIncidentRow>(
    `
      SELECT event_type, severity, status, message, created_at::text
      FROM monitoring_events
      WHERE severity IN ('warn', 'warning', 'error')
        AND created_at > now() - interval '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `,
  ).catch(() => ({ rows: [] as PublicIncidentRow[] }));
  return result.rows.map((row) => ({
    createdAt: row.created_at,
    eventType: row.event_type,
    message: row.message,
    severity: row.severity,
    status: row.status,
  }));
}

function backupStatus(status: string | null | undefined): PublicSystemTrustStatus["status"] {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "ok") return "ok";
  if (normalized === "failed" || normalized === "fail") return "fail";
  if (normalized === "partial" || normalized === "warn") return "warn";
  return "unknown";
}

function delayedFeedDisclosure(ageMinutes: number | null, status: string): string {
  if (status === "stale") return `Scanner data is stale${ageMinutes === null ? "" : ` at ${Math.round(ageMinutes)} minutes old`}; TradeVeto should show cautious, stale-state intelligence until freshness recovers.`;
  if (status === "slightly_stale" || ageMinutes !== null && ageMinutes >= 45) return `Scanner data is delayed${ageMinutes === null ? "" : ` at ${Math.round(ageMinutes)} minutes old`}; live labels should stay bounded by freshness evidence.`;
  return "No delayed-feed disclosure is active from current scanner freshness evidence.";
}

function providerFreshnessLabel(state: ProviderOperationalState, ageMinutes: number | null): string {
  const age = ageMinutes === null ? "unknown age" : `${Math.round(ageMinutes)} min old`;
  if (state === "active") return `Active provider packet, ${age}.`;
  if (state === "delayed") return `Provider packet is delayed, ${age}.`;
  if (state === "stale") return `Provider packet is stale, ${age}.`;
  if (state === "partial-outage") return `Provider fallback is visible, ${age}.`;
  if (state === "outage") return `Provider packet unavailable or failing, ${age}.`;
  return `Provider evidence is limited, ${age}.`;
}

function statusFromScanner(status: string): PublicSystemTrustStatus["status"] {
  if (status === "fresh" || status === "slightly_stale") return "ok";
  if (status === "stale" || status === "unknown") return "warn";
  return "fail";
}

function toNumber(value: string | number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
