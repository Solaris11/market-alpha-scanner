import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { Pool, type QueryResultRow } from "pg";
import { renderOperationalAlertEmail, smtpSettingsFromEnv, type SmtpSettings } from "@/lib/email-policy";
import { EMAIL_MAX_ATTEMPTS, emailRetryDelayMs, shouldRetryEmailSend } from "@/lib/email-retry-policy";
import { cleanMonitoringText, type MonitoringSeverity, type MonitoringStatus } from "@/lib/monitoring-policy";

export type ExternalAlertInput = {
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity: MonitoringSeverity;
  status: MonitoringStatus;
};

export type ExternalAlertResult = {
  channels: string[];
  configured: string[];
  errors: string[];
  sent: boolean;
};

type AlertChannel = "email" | "slack" | "telegram";

type AlertEnvelope = {
  eventType: string;
  message: string;
  metadata: Record<string, unknown>;
  severity: MonitoringSeverity;
  status: MonitoringStatus;
};

type AlertDbGlobal = typeof globalThis & {
  __marketAlphaAlertDbPool?: Pool;
};

type AlertSentRow = QueryResultRow & {
  exists: boolean;
};

const SENSITIVE_KEY_PATTERN = /authorization|cookie|csrf|dsn|password|secret|session|set-cookie|stripe-signature|token|api[_-]?key/i;
const SENSITIVE_TEXT_PATTERN = /(Bearer\s+[A-Za-z0-9._~+/-]+=*|sk_(?:live|test)_[A-Za-z0-9_]+|pk_(?:live|test)_[A-Za-z0-9_]+|whsec_[A-Za-z0-9_]+|sess_[A-Za-z0-9_-]+)/gi;
const EMAIL_ALERT_THROTTLE_MINUTES = 15;

export async function sendExternalAlert(input: ExternalAlertInput, env: NodeJS.ProcessEnv = process.env): Promise<ExternalAlertResult> {
  const envelope = buildAlertEnvelope(input);
  const configured = configuredAlertChannels(env);
  const result: ExternalAlertResult = { channels: [], configured, errors: [], sent: false };

  for (const channel of configured) {
    try {
      if (channel === "slack") await sendSlackAlert(envelope, env);
      if (channel === "telegram") await sendTelegramAlert(envelope, env);
      if (channel === "email") await sendEmailAlert(envelope, env);
      result.channels.push(channel);
      result.sent = true;
    } catch (error) {
      result.errors.push(`${channel}:${safeErrorMessage(error)}`);
      if (channel === "email") {
        await recordExternalEmailFailure(envelope, error).catch((monitoringError: unknown) => {
          console.warn("[alerting] email failure monitoring write failed", monitoringError instanceof Error ? monitoringError.message : monitoringError);
        });
      }
    }
  }

  return result;
}

export function configuredAlertChannels(env: NodeJS.ProcessEnv = process.env): AlertChannel[] {
  const channels: AlertChannel[] = [];
  if (env.SLACK_WEBHOOK_URL?.trim()) channels.push("slack");
  if (env.TELEGRAM_BOT_TOKEN?.trim() && (env.TELEGRAM_CHAT_ID?.trim() || env.MARKET_ALPHA_ALERT_TELEGRAM_CHAT_ID?.trim())) channels.push("telegram");
  if (smtpConfig(env)) channels.push("email");
  return channels;
}

export function buildAlertEnvelope(input: ExternalAlertInput): AlertEnvelope {
  return {
    eventType: cleanKey(input.eventType),
    message: sanitizeAlertText(input.message, 500),
    metadata: sanitizeMetadata(input.metadata ?? {}),
    severity: input.severity,
    status: input.status,
  };
}

function smtpConfig(env: NodeJS.ProcessEnv): (SmtpSettings & { to: string }) | null {
  const settings = smtpSettingsFromEnv(env);
  const to = env.MARKET_ALPHA_ALERT_EMAIL_TO?.trim() || env.SUPPORT_EMAIL?.trim() || "support@marketalpha.co";
  if (!settings || !to) return null;
  return { ...settings, to };
}

async function sendSlackAlert(envelope: AlertEnvelope, env: NodeJS.ProcessEnv): Promise<void> {
  const url = env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return;
  const response = await fetch(url, {
    body: JSON.stringify({ text: alertText(envelope) }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error(`slack HTTP ${response.status}`);
}

async function sendTelegramAlert(envelope: AlertEnvelope, env: NodeJS.ProcessEnv): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim() || env.MARKET_ALPHA_ALERT_TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      disable_web_page_preview: true,
      text: alertText(envelope),
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error(`telegram HTTP ${response.status}`);
}

async function sendEmailAlert(envelope: AlertEnvelope, env: NodeJS.ProcessEnv): Promise<void> {
  const config = smtpConfig(env);
  if (!config) return;
  const dedupeKey = emailAlertDedupeKey(envelope);
  if (await externalEmailRecentlySent(dedupeKey)) return;
  const email = renderOperationalAlertEmail({
    contacts: config,
    eventType: envelope.eventType,
    message: envelope.message,
    metadata: envelope.metadata,
    severity: envelope.severity,
    status: envelope.status,
  });
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt < EMAIL_MAX_ATTEMPTS) {
    attempt += 1;
    try {
      const result = await nodemailer
        .createTransport({
          auth: { pass: config.pass, user: config.user },
          host: config.host,
          port: config.port,
          secure: config.secure,
        })
        .sendMail({
          from: email.from,
          html: email.html,
          replyTo: email.replyTo,
          subject: email.subject,
          text: email.text,
          to: config.to,
        });
      if (!result.messageId) throw new Error("email send did not return message id");
      await recordExternalEmailSent(envelope, dedupeKey);
      return;
    } catch (error) {
      lastError = error;
      if (!shouldRetryEmailSend(attempt)) break;
      await sleep(emailRetryDelayMs(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("email send failed");
}

function alertText(envelope: AlertEnvelope): string {
  const metadata = Object.entries(envelope.metadata)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  return [`Market Alpha alert`, `event: ${envelope.eventType}`, `severity: ${envelope.severity}`, `status: ${envelope.status}`, `message: ${envelope.message}`, metadata ? `metadata:\n${metadata}` : ""]
    .filter(Boolean)
    .join("\n");
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 30)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    safe[cleanKey(key)] = sanitizeMetadataValue(value);
  }
  return safe;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return sanitizeAlertText(value, 240);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadataValue(item));
  if (typeof value === "object") return sanitizeMetadata(value as Record<string, unknown>);
  return sanitizeAlertText(String(value), 120);
}

function sanitizeAlertText(value: unknown, maxLength: number): string {
  return cleanMonitoringText(value, maxLength).replace(SENSITIVE_TEXT_PATTERN, "[redacted]");
}

function cleanKey(value: string): string {
  return cleanMonitoringText(value, 120).replace(/[^A-Za-z0-9:_.-]/g, "_") || "unknown";
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? sanitizeAlertText(error.message, 160) : "unknown error";
}

async function recordExternalEmailFailure(envelope: AlertEnvelope, error: unknown): Promise<void> {
  await tryRecordAlertMonitoringEvent({
    eventType: "email:external_alert_failed",
    message: "SMTP external alert delivery failed after retries.",
    metadata: {
      alertEventType: envelope.eventType,
      category: "alert",
      error: safeErrorMessage(error),
      severity: envelope.severity,
      status: envelope.status,
    },
    severity: "warning",
    status: "fail",
  });
}

async function externalEmailRecentlySent(dedupeKey: string): Promise<boolean> {
  try {
    const pool = getAlertDbPool();
    if (!pool) throw new Error("DATABASE_URL is not configured.");
    const result = await pool.query<AlertSentRow>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM monitoring_events
          WHERE event_type = 'email:external_alert_sent'
            AND metadata->>'dedupeKey' = $1
            AND created_at > now() - interval '15 minutes'
        ) AS exists
      `,
      [dedupeKey],
    );
    return Boolean(result.rows[0]?.exists);
  } catch (error) {
    if (alertDebugEnabled()) console.warn("[alerting] email throttle DB check failed", error instanceof Error ? error.message : error);
    return localExternalEmailRecentlySent(dedupeKey);
  }
}

async function recordExternalEmailSent(envelope: AlertEnvelope, dedupeKey: string): Promise<void> {
  await markLocalExternalEmailSent(dedupeKey);
  await tryRecordAlertMonitoringEvent({
    eventType: "email:external_alert_sent",
    message: "SMTP external alert email sent.",
    metadata: {
      alertEventType: envelope.eventType,
      category: "alert",
      dedupeKey,
      throttleMinutes: 15,
    },
    severity: "info",
    status: "ok",
  });
}

function emailAlertDedupeKey(envelope: AlertEnvelope): string {
  return createHash("sha256")
    .update([envelope.eventType, envelope.severity, envelope.status, envelope.message].join("|"))
    .digest("hex");
}

async function tryRecordAlertMonitoringEvent(input: {
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity: MonitoringSeverity;
  status: MonitoringStatus;
}): Promise<void> {
  try {
    await recordAlertMonitoringEvent(input);
  } catch (dbError) {
    try {
      await postAlertMonitoringEvent(input);
    } catch (httpError) {
      if (alertDebugEnabled()) {
        const dbMessage = dbError instanceof Error ? dbError.message : "unknown db error";
        const httpMessage = httpError instanceof Error ? httpError.message : "unknown ingest error";
        console.warn("[alerting] monitoring write failed", `${dbMessage}; ${httpMessage}`);
      }
    }
  }
}

async function recordAlertMonitoringEvent(input: {
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity: MonitoringSeverity;
  status: MonitoringStatus;
}): Promise<void> {
  const pool = getAlertDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  await pool.query(
    `
      INSERT INTO monitoring_events (event_type, severity, status, message, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
    `,
    [cleanKey(input.eventType), input.severity, input.status, sanitizeAlertText(input.message, 500), JSON.stringify(sanitizeMetadata(input.metadata ?? {}))],
  );
}

async function postAlertMonitoringEvent(input: {
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity: MonitoringSeverity;
  status: MonitoringStatus;
}): Promise<void> {
  const token = process.env.MARKET_ALPHA_MONITORING_TOKEN?.trim();
  if (!token) throw new Error("MARKET_ALPHA_MONITORING_TOKEN is not configured.");
  const baseUrl = (process.env.MONITORING_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim() || process.env.APP_URL?.trim() || "https://app.marketalpha.co").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/monitoring/ingest`, {
    body: JSON.stringify({
      eventType: cleanKey(input.eventType),
      kind: "monitoring_event",
      message: sanitizeAlertText(input.message, 500),
      metadata: sanitizeMetadata(input.metadata ?? {}),
      severity: input.severity,
      status: input.status,
    }),
    headers: {
      "Content-Type": "application/json",
      "x-market-alpha-monitoring-token": token,
    },
    method: "POST",
  });
  if (!response.ok) throw new Error(`monitoring ingest HTTP ${response.status}`);
}

function getAlertDbPool(env: NodeJS.ProcessEnv = process.env): Pool | null {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  const globalPool = globalThis as AlertDbGlobal;
  if (!globalPool.__marketAlphaAlertDbPool) {
    globalPool.__marketAlphaAlertDbPool = new Pool({ connectionString: databaseUrl });
  }
  return globalPool.__marketAlphaAlertDbPool;
}

async function localExternalEmailRecentlySent(dedupeKey: string): Promise<boolean> {
  try {
    const throttlePath = localThrottlePath(dedupeKey);
    const details = await stat(throttlePath);
    return Date.now() - details.mtimeMs < EMAIL_ALERT_THROTTLE_MINUTES * 60 * 1000;
  } catch {
    return false;
  }
}

async function markLocalExternalEmailSent(dedupeKey: string): Promise<void> {
  try {
    const directory = localThrottleDir();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(localThrottlePath(dedupeKey), new Date().toISOString(), { mode: 0o600 });
  } catch (error) {
    if (alertDebugEnabled()) console.warn("[alerting] local throttle write failed", error instanceof Error ? error.message : error);
  }
}

function localThrottlePath(dedupeKey: string): string {
  return path.join(localThrottleDir(), `${dedupeKey}.sent`);
}

function localThrottleDir(): string {
  return process.env.MARKET_ALPHA_ALERT_THROTTLE_DIR?.trim() || "/tmp/market-alpha-alert-throttle";
}

function alertDebugEnabled(): boolean {
  return process.env.MARKET_ALPHA_ALERT_DEBUG === "1";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
