import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type MonitoringStatus = "fail" | "ok" | "warn";

export function loadEnvFiles(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "..", ".env"), resolve(scriptDir, "..", ".env")];
  for (const filePath of candidates) {
    loadEnvFile(filePath);
  }
}

export function monitoringBaseUrl(): string {
  const raw = process.env.MONITORING_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim() || process.env.APP_URL?.trim() || "https://app.marketalpha.co";
  return raw.replace(/\/$/, "");
}

export function monitoringToken(): string {
  const token = process.env.MARKET_ALPHA_MONITORING_TOKEN?.trim() || process.env.MARKET_ALPHA_SESSION_SECRET?.trim();
  if (!token) throw new Error("MARKET_ALPHA_MONITORING_TOKEN or MARKET_ALPHA_SESSION_SECRET is required.");
  return token;
}

export async function postMonitoringPayload(payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${monitoringBaseUrl()}/api/monitoring/ingest`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      "x-market-alpha-monitoring-token": monitoringToken(),
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`monitoring ingest failed with HTTP ${response.status}`);
  }
}

export function statusFromHttp(statusCode: number, allowed: number[]): MonitoringStatus {
  if (allowed.includes(statusCode)) return "ok";
  return statusCode >= 500 ? "fail" : "warn";
}

export function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  return error.message.trim().replace(/\s+/g, " ").slice(0, 180);
}

function loadEnvFile(filePath: string): void {
  let raw = "";
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    process.env[key] = unquote(trimmed.slice(equalsIndex + 1).trim());
  }
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
