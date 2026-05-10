import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type DeveloperApiScope =
  | "read:macro"
  | "read:opportunities"
  | "read:portfolio"
  | "read:replay"
  | "read:shocks"
  | "write:webhooks";

export type DeveloperWebhookEventType =
  | "macro.regime_changed"
  | "opportunity.created"
  | "portfolio.scenario_ready"
  | "replay.ready"
  | "shock.detected";

export const DEVELOPER_API_SCOPES: DeveloperApiScope[] = [
  "read:opportunities",
  "read:macro",
  "read:shocks",
  "read:replay",
  "read:portfolio",
  "write:webhooks",
];

export const DEVELOPER_WEBHOOK_EVENT_TYPES: DeveloperWebhookEventType[] = [
  "opportunity.created",
  "macro.regime_changed",
  "shock.detected",
  "replay.ready",
  "portfolio.scenario_ready",
];

export type DeveloperApiEndpointDefinition = {
  description: string;
  method: "GET" | "POST";
  path: string;
  requiredScope: DeveloperApiScope;
};

export const DEVELOPER_API_VERSION = "v1";
export const DEVELOPER_API_DEPRECATION_POLICY = "Stable during controlled public beta. Breaking changes require a new /api/vN path.";
export const DEVELOPER_API_IP_QUOTA_PER_MINUTE = 120;
export const DEVELOPER_API_KEY_QUOTA_PER_MINUTE = 600;
export const DEVELOPER_WEBHOOK_TIMEOUT_MS = 8_000;
export const DEVELOPER_WEBHOOK_RETRY_DELAYS_MS = [0, 750, 2_000] as const;

export const DEVELOPER_API_ENDPOINTS: DeveloperApiEndpointDefinition[] = [
  {
    description: "Ranked opportunity intelligence feed.",
    method: "GET",
    path: "/api/v1/opportunities",
    requiredScope: "read:opportunities",
  },
  {
    description: "Current macro and market-regime context.",
    method: "GET",
    path: "/api/v1/macro",
    requiredScope: "read:macro",
  },
  {
    description: "High-volatility shock research feed.",
    method: "GET",
    path: "/api/v1/shocks",
    requiredScope: "read:shocks",
  },
  {
    description: "Historical decision replay lookup.",
    method: "GET",
    path: "/api/v1/replay",
    requiredScope: "read:replay",
  },
  {
    description: "Manual portfolio scenario stress test.",
    method: "POST",
    path: "/api/v1/portfolio/scenario",
    requiredScope: "read:portfolio",
  },
];

const API_KEY_PREFIX = "tvk_live_";
const WEBHOOK_SECRET_PREFIX = "tvwhsec_";
const API_KEY_RANDOM_BYTES = 32;
const WEBHOOK_SECRET_RANDOM_BYTES = 32;

export type DeveloperApiKeyMaterial = {
  hash: string;
  key: string;
  prefix: string;
};

export function generateDeveloperApiKey(): DeveloperApiKeyMaterial {
  const key = `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString("base64url")}`;
  return {
    hash: hashDeveloperApiKey(key),
    key,
    prefix: apiKeyPrefix(key),
  };
}

export function generateWebhookSigningSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(WEBHOOK_SECRET_RANDOM_BYTES).toString("base64url")}`;
}

export function hashDeveloperApiKey(key: string): string {
  const cleaned = key.trim();
  if (!cleaned.startsWith(API_KEY_PREFIX)) throw new Error("Invalid TradeVeto API key format.");
  return createHash("sha256").update(cleaned).digest("hex");
}

export function apiKeyPrefix(key: string): string {
  const cleaned = key.trim();
  return cleaned.length <= 18 ? cleaned : `${cleaned.slice(0, 14)}...${cleaned.slice(-4)}`;
}

export function extractDeveloperApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    return token || null;
  }
  const headerKey = request.headers.get("x-tradeveto-api-key")?.trim() ?? "";
  return headerKey || null;
}

export function normalizeDeveloperApiScopes(input: unknown, fallback: DeveloperApiScope[] = ["read:opportunities"]): DeveloperApiScope[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\s]+/) : [];
  const scopes = raw.filter((item): item is DeveloperApiScope => isDeveloperApiScope(item));
  const unique = Array.from(new Set(scopes));
  return unique.length ? unique : fallback;
}

export function normalizeWebhookEventTypes(input: unknown, fallback: DeveloperWebhookEventType[] = ["opportunity.created", "shock.detected"]): DeveloperWebhookEventType[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\s]+/) : [];
  const events = raw.filter((item): item is DeveloperWebhookEventType => isWebhookEventType(item));
  const unique = Array.from(new Set(events));
  return unique.length ? unique : fallback;
}

export function hasDeveloperScope(scopes: readonly string[], required: DeveloperApiScope): boolean {
  return scopes.includes(required);
}

export function validateWebhookUrl(value: unknown): { ok: true; url: string } | { ok: false; reason: string } {
  const text = String(value ?? "").trim();
  if (!text || text.length > 500) return { ok: false, reason: "Enter an HTTPS webhook URL." };
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, reason: "Enter a valid webhook URL." };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "Webhook URLs must use HTTPS." };
  if (isLocalWebhookHost(parsed.hostname)) return { ok: false, reason: "Webhook URL cannot target local or private hosts." };
  parsed.hash = "";
  return { ok: true, url: parsed.toString() };
}

export function signWebhookPayload(input: { payload: string; secret: string; timestamp: number }): string {
  const signedPayload = `${input.timestamp}.${input.payload}`;
  return createHmac("sha256", input.secret).update(signedPayload).digest("hex");
}

export function buildWebhookSignatureHeader(input: { payload: string; secret: string; timestamp?: number }): string {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload({ payload: input.payload, secret: input.secret, timestamp });
  return `t=${timestamp},v1=${signature}`;
}

export function verifyWebhookSignature(input: { header: string; payload: string; secret: string; toleranceSeconds?: number }): boolean {
  const parsed = parseSignatureHeader(input.header);
  if (!parsed) return false;
  const tolerance = Math.max(30, input.toleranceSeconds ?? 300);
  const age = Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp);
  if (age > tolerance) return false;
  const expected = signWebhookPayload({ payload: input.payload, secret: input.secret, timestamp: parsed.timestamp });
  return safeEqual(expected, parsed.signature);
}

export function developerApiStatusBucket(status: number | null | undefined): "2xx" | "3xx" | "4xx" | "5xx" | "unknown" {
  if (!Number.isInteger(status)) return "unknown";
  const safeStatus = Number(status);
  if (safeStatus >= 200 && safeStatus <= 299) return "2xx";
  if (safeStatus >= 300 && safeStatus <= 399) return "3xx";
  if (safeStatus >= 400 && safeStatus <= 499) return "4xx";
  if (safeStatus >= 500 && safeStatus <= 599) return "5xx";
  return "unknown";
}

export function shouldRetryWebhookDelivery(status: number | null, error: string | null): boolean {
  if (error) return true;
  if (status === null) return true;
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function webhookRetryDelayMs(attemptIndex: number): number {
  return DEVELOPER_WEBHOOK_RETRY_DELAYS_MS[Math.max(0, Math.min(DEVELOPER_WEBHOOK_RETRY_DELAYS_MS.length - 1, Math.trunc(attemptIndex)))] ?? 0;
}

function isDeveloperApiScope(value: unknown): value is DeveloperApiScope {
  return DEVELOPER_API_SCOPES.includes(value as DeveloperApiScope);
}

function isWebhookEventType(value: unknown): value is DeveloperWebhookEventType {
  return DEVELOPER_WEBHOOK_EVENT_TYPES.includes(value as DeveloperWebhookEventType);
}

function isLocalWebhookHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host === "127.0.0.1" || host === "::" || host === "::1") return true;
  if (host.startsWith("10.") || host.startsWith("127.") || host.startsWith("169.254.") || host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^(fc|fd)[0-9a-f]{0,2}:/i.test(host) || /^fe80:/i.test(host)) return true;
  return false;
}

function parseSignatureHeader(header: string): { signature: string; timestamp: number } | null {
  const parts = new Map(header.split(",").map((part) => {
    const [key, value = ""] = part.trim().split("=", 2);
    return [key, value] as const;
  }));
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1") ?? "";
  if (!Number.isFinite(timestamp) || !signature) return null;
  return { signature, timestamp };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
