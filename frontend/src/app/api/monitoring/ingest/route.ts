import { NextResponse } from "next/server";
import { monitoringTokenFromEnv } from "@/lib/monitoring-policy";
import { cleanupMonitoringRetention, recordMonitoringEvent, recordRequestMetric, recordSyntheticCheck, recordSystemMetric } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IngestPayload = {
  cpuPercent?: unknown;
  diskFreeBytes?: unknown;
  diskPercent?: unknown;
  eventType?: unknown;
  kind?: unknown;
  latencyMs?: unknown;
  memoryPercent?: unknown;
  message?: unknown;
  metadata?: unknown;
  method?: unknown;
  route?: unknown;
  severity?: unknown;
  status?: unknown;
  statusCode?: unknown;
  checkName?: unknown;
};

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  }

  let payload: IngestPayload;
  try {
    payload = (await request.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid monitoring payload." }, { status: 400 });
  }

  try {
    switch (payload.kind) {
      case "request_metric":
        await recordRequestMetric({
          latencyMs: numberValue(payload.latencyMs),
          method: stringValue(payload.method),
          route: stringValue(payload.route),
          statusCode: numberValue(payload.statusCode),
          userId: null,
        });
        break;
      case "synthetic_check":
        await recordSyntheticCheck({
          checkName: stringValue(payload.checkName),
          latencyMs: numberValue(payload.latencyMs),
          message: stringValue(payload.message),
          metadata: objectValue(payload.metadata),
          status: statusValue(payload.status),
        });
        break;
      case "system_metric":
        await recordSystemMetric({
          cpuPercent: nullableNumberValue(payload.cpuPercent),
          diskFreeBytes: nullableNumberValue(payload.diskFreeBytes),
          diskPercent: nullableNumberValue(payload.diskPercent),
          memoryPercent: nullableNumberValue(payload.memoryPercent),
          metadata: objectValue(payload.metadata),
        });
        break;
      case "monitoring_event":
        await recordMonitoringEvent({
          eventType: stringValue(payload.eventType),
          message: stringValue(payload.message),
          metadata: objectValue(payload.metadata),
          severity: severityValue(payload.severity),
          status: statusValue(payload.status),
        });
        break;
      case "cleanup":
        await cleanupMonitoringRetention();
        break;
      default:
        return NextResponse.json({ ok: false, message: "Unsupported monitoring payload." }, { status: 400 });
    }
  } catch (error) {
    console.warn("[monitoring] ingest failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: "Monitoring ingest failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function authorized(request: Request): boolean {
  const expected = monitoringTokenFromEnv();
  const actual = request.headers.get("x-market-alpha-monitoring-token")?.trim();
  return Boolean(expected && actual && actual === expected);
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function severityValue(value: unknown): "critical" | "info" | "warning" {
  return value === "critical" || value === "warning" ? value : "info";
}

function statusValue(value: unknown): "fail" | "ok" | "warn" {
  return value === "fail" || value === "warn" ? value : "ok";
}
