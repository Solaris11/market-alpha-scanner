import "server-only";

import type { QueryResultRow } from "pg";
import {
  DEVELOPER_API_DEPRECATION_POLICY,
  DEVELOPER_API_ENDPOINTS,
  DEVELOPER_API_IP_QUOTA_PER_MINUTE,
  DEVELOPER_API_KEY_QUOTA_PER_MINUTE,
  DEVELOPER_API_SCOPES,
  DEVELOPER_API_VERSION,
  DEVELOPER_WEBHOOK_EVENT_TYPES,
  DEVELOPER_WEBHOOK_TIMEOUT_MS,
  buildWebhookSignatureHeader,
  developerApiStatusBucket,
  extractDeveloperApiKey,
  generateDeveloperApiKey,
  generateWebhookSigningSecret,
  hashDeveloperApiKey,
  hasDeveloperScope,
  normalizeDeveloperApiScopes,
  normalizeWebhookEventTypes,
  shouldRetryWebhookDelivery,
  validateWebhookUrl,
  webhookRetryDelayMs,
  type DeveloperApiScope,
  type DeveloperWebhookEventType,
} from "@/lib/security/developer-platform";
import { dbQuery, dbTransaction, type DbExecutor } from "./db";
import { rateLimit } from "./rate-limit";
import { requestIp } from "./request-security";

export type DeveloperApiKeyRecord = {
  createdAt: string;
  id: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  name: string;
  revokedAt: string | null;
  scopes: DeveloperApiScope[];
};

export type CreatedDeveloperApiKey = {
  key: string;
  record: DeveloperApiKeyRecord;
};

export type DeveloperWebhookEndpoint = {
  active: boolean;
  createdAt: string;
  deliveryCount: number;
  eventTypes: DeveloperWebhookEventType[];
  failureCount: number;
  id: string;
  lastDeliveredAt: string | null;
  lastDeliveryStatus: "delivered" | "failed" | "pending" | null;
  name: string;
  url: string;
};

export type DeveloperWebhookDelivery = {
  attemptCount: number;
  createdAt: string;
  deliveredAt: string | null;
  durationMs: number | null;
  endpointId: string;
  error: string | null;
  eventType: DeveloperWebhookEventType | string;
  httpStatus: number | null;
  id: string;
  status: "delivered" | "failed" | "pending";
};

export type DeveloperApiAccess = {
  keyId: string;
  scopes: DeveloperApiScope[];
  userId: string;
};

export type DeveloperApiUsageSummary = {
  apiKeyId: string;
  endpoint: string;
  lastStatus: number | null;
  lastUsedAt: string;
  method: string;
  requestCount: number;
  statusBucket: "2xx" | "3xx" | "4xx" | "5xx" | "unknown";
};

export class DeveloperApiAuthError extends Error {
  readonly status: 401 | 403 | 404 | 429;

  constructor(message: string, status: 401 | 403 | 404 | 429 = 401) {
    super(message);
    this.name = "DeveloperApiAuthError";
    this.status = status;
  }
}

type ApiKeyRow = QueryResultRow & {
  created_at: string;
  id: string;
  key_prefix: string;
  last_used_at: string | null;
  name: string;
  revoked_at: string | null;
  scopes: string[];
  user_id: string;
};

type WebhookEndpointRow = QueryResultRow & {
  active: boolean;
  created_at: string;
  delivery_count?: number | string;
  event_types: string[];
  failure_count?: number | string;
  id: string;
  last_delivered_at: string | null;
  last_delivery_status: string | null;
  name: string;
  signing_secret?: string;
  url: string;
  user_id: string;
};

type WebhookDeliveryRow = QueryResultRow & {
  attempt_count?: number | string;
  created_at: string;
  delivered_at: string | null;
  duration_ms?: number | string | null;
  endpoint_id: string;
  error: string | null;
  event_type: string;
  http_status: number | null;
  id: string;
  status: string;
};

type ApiUsageRow = QueryResultRow & {
  api_key_id: string;
  endpoint: string;
  last_status: number | string | null;
  last_used_at: string;
  method: string;
  request_count: number | string;
  status_bucket: string;
};

export async function listDeveloperApiKeys(userId: string): Promise<DeveloperApiKeyRecord[]> {
  const result = await dbQuery<ApiKeyRow>(
    `
      SELECT id::text, name, key_prefix, scopes, last_used_at::text, revoked_at::text, created_at::text, user_id::text
      FROM developer_api_keys
      WHERE user_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [userId],
  );
  return result.rows.map(apiKeyFromRow);
}

export async function createDeveloperApiKey(input: { name: unknown; scopes: unknown; userId: string }): Promise<CreatedDeveloperApiKey> {
  const material = generateDeveloperApiKey();
  const name = cleanText(input.name, 120) || "TradeVeto API key";
  const scopes = normalizeDeveloperApiScopes(input.scopes, ["read:opportunities", "read:macro", "read:shocks"]);
  const result = await dbQuery<ApiKeyRow>(
    `
      INSERT INTO developer_api_keys (user_id, name, key_hash, key_prefix, scopes, created_at, updated_at)
      VALUES ($1::uuid, $2, $3, $4, $5::text[], now(), now())
      RETURNING id::text, name, key_prefix, scopes, last_used_at::text, revoked_at::text, created_at::text, user_id::text
    `,
    [input.userId, name, material.hash, material.prefix, scopes],
  );
  return {
    key: material.key,
    record: apiKeyFromRow(result.rows[0]),
  };
}

export async function revokeDeveloperApiKey(input: { id: string; userId: string }): Promise<DeveloperApiKeyRecord | null> {
  const result = await dbQuery<ApiKeyRow>(
    `
      UPDATE developer_api_keys
      SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING id::text, name, key_prefix, scopes, last_used_at::text, revoked_at::text, created_at::text, user_id::text
    `,
    [input.id, input.userId],
  );
  const row = result.rows[0];
  return row ? apiKeyFromRow(row) : null;
}

export async function authenticateDeveloperApiRequest(request: Request, requiredScope: DeveloperApiScope): Promise<DeveloperApiAccess> {
  await enforceDeveloperApiIpQuota(request);
  const rawKey = extractDeveloperApiKey(request);
  if (!rawKey) throw new DeveloperApiAuthError("TradeVeto API key required.", 401);
  let keyHash: string;
  try {
    keyHash = hashDeveloperApiKey(rawKey);
  } catch {
    throw new DeveloperApiAuthError("Invalid TradeVeto API key.", 401);
  }
  await enforceDeveloperApiKeyQuota(keyHash);

  const result = await dbQuery<ApiKeyRow>(
    `
      SELECT id::text, user_id::text, name, key_prefix, scopes, last_used_at::text, revoked_at::text, created_at::text
      FROM developer_api_keys
      WHERE key_hash = $1
        AND revoked_at IS NULL
      LIMIT 1
    `,
    [keyHash],
  );
  const row = result.rows[0];
  if (!row) throw new DeveloperApiAuthError("Invalid TradeVeto API key.", 401);
  const scopes = scopesFromArray(row.scopes);
  if (!hasDeveloperScope(scopes, requiredScope)) {
    throw new DeveloperApiAuthError(`API key does not include ${requiredScope}.`, 403);
  }
  await dbQuery("UPDATE developer_api_keys SET last_used_at = now(), updated_at = now() WHERE id = $1::uuid", [row.id]).catch(() => undefined);
  return { keyId: row.id, scopes, userId: row.user_id };
}

export async function recordDeveloperApiUsage(input: { access: DeveloperApiAccess; endpoint: string; method: string; status: number }): Promise<void> {
  const method = cleanText(input.method, 12).toUpperCase() || "GET";
  const endpoint = cleanText(input.endpoint, 160) || "unknown";
  const statusBucket = developerApiStatusBucket(input.status);
  await dbQuery(
    `
      INSERT INTO developer_api_usage_hourly (
        hour_start,
        user_id,
        api_key_id,
        endpoint,
        method,
        status_bucket,
        request_count,
        last_status,
        last_used_at,
        updated_at
      )
      VALUES (
        date_trunc('hour', now()),
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        1,
        $6,
        now(),
        now()
      )
      ON CONFLICT (hour_start, user_id, api_key_id, endpoint, method, status_bucket)
      DO UPDATE SET
        request_count = developer_api_usage_hourly.request_count + 1,
        last_status = EXCLUDED.last_status,
        last_used_at = now(),
        updated_at = now()
    `,
    [input.access.userId, input.access.keyId, endpoint, method, statusBucket, input.status],
  );
}

export async function listDeveloperApiUsageSummary(userId: string): Promise<DeveloperApiUsageSummary[]> {
  try {
    const result = await dbQuery<ApiUsageRow>(
      `
        SELECT
          api_key_id::text,
          endpoint,
          method,
          status_bucket,
          sum(request_count)::integer AS request_count,
          (array_agg(last_status ORDER BY last_used_at DESC))[1] AS last_status,
          max(last_used_at)::text AS last_used_at
        FROM developer_api_usage_hourly
        WHERE user_id = $1::uuid
          AND hour_start >= date_trunc('hour', now()) - interval '7 days'
        GROUP BY api_key_id, endpoint, method, status_bucket
        ORDER BY request_count DESC, last_used_at DESC
        LIMIT 100
      `,
      [userId],
    );
    return result.rows.map(apiUsageFromRow);
  } catch (error) {
    console.warn("[developer] api usage summary unavailable", error instanceof Error ? error.message : error);
    return [];
  }
}

async function enforceDeveloperApiIpQuota(request: Request): Promise<void> {
  await enforceDeveloperApiQuota({
    key: `developer-api:ip=${requestIp(request)}`,
    limit: DEVELOPER_API_IP_QUOTA_PER_MINUTE,
    scope: "developer-api:ip",
    windowMs: 60_000,
  });
}

async function enforceDeveloperApiKeyQuota(keyHash: string): Promise<void> {
  await enforceDeveloperApiQuota({
    key: `developer-api:key=${keyHash}`,
    limit: DEVELOPER_API_KEY_QUOTA_PER_MINUTE,
    scope: "developer-api:key",
    windowMs: 60_000,
  });
}

async function enforceDeveloperApiQuota(input: { key: string; limit: number; scope: string; windowMs: number }): Promise<void> {
  try {
    const result = await rateLimit(input);
    if (!result.allowed) {
      throw new DeveloperApiAuthError("Too many API requests.", 429);
    }
  } catch (error) {
    if (error instanceof DeveloperApiAuthError) throw error;
    console.warn("[developer-api] rate-limit check failed closed", error instanceof Error ? error.message : error);
    throw new DeveloperApiAuthError("Too many API requests.", 429);
  }
}

export async function listDeveloperWebhookEndpoints(userId: string): Promise<DeveloperWebhookEndpoint[]> {
  const result = await dbQuery<WebhookEndpointRow>(
    `
      SELECT
        e.id::text,
        e.name,
        e.url,
        e.event_types,
        e.active,
        e.last_delivery_status,
        e.last_delivered_at::text,
        e.created_at::text,
        e.user_id::text,
        COALESCE(stats.delivery_count, 0)::integer AS delivery_count,
        COALESCE(stats.failure_count, 0)::integer AS failure_count
      FROM developer_webhook_endpoints e
      LEFT JOIN (
        SELECT
          endpoint_id,
          count(*)::integer AS delivery_count,
          count(*) FILTER (WHERE status = 'failed')::integer AS failure_count
        FROM developer_webhook_deliveries
        WHERE user_id = $1::uuid
        GROUP BY endpoint_id
      ) stats ON stats.endpoint_id = e.id
      WHERE e.user_id = $1::uuid
      ORDER BY e.created_at DESC
      LIMIT 50
    `,
    [userId],
  );
  return result.rows.map(webhookFromRow);
}

export async function createDeveloperWebhookEndpoint(input: { eventTypes: unknown; name: unknown; url: unknown; userId: string }): Promise<{ endpoint: DeveloperWebhookEndpoint; signingSecret: string }> {
  const url = validateWebhookUrl(input.url);
  if (!url.ok) throw new DeveloperApiAuthError(url.reason, 403);
  const eventTypes = normalizeWebhookEventTypes(input.eventTypes);
  const name = cleanText(input.name, 120) || "TradeVeto webhook";
  const signingSecret = generateWebhookSigningSecret();
  const result = await dbQuery<WebhookEndpointRow>(
    `
      INSERT INTO developer_webhook_endpoints (user_id, name, url, event_types, signing_secret, active, created_at, updated_at)
      VALUES ($1::uuid, $2, $3, $4::text[], $5, true, now(), now())
      RETURNING id::text, name, url, event_types, active, last_delivery_status, last_delivered_at::text, created_at::text, user_id::text
    `,
    [input.userId, name, url.url, eventTypes, signingSecret],
  );
  return { endpoint: webhookFromRow(result.rows[0]), signingSecret };
}

export async function deactivateDeveloperWebhookEndpoint(input: { id: string; userId: string }): Promise<DeveloperWebhookEndpoint | null> {
  const result = await dbQuery<WebhookEndpointRow>(
    `
      UPDATE developer_webhook_endpoints
      SET active = false, updated_at = now()
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      RETURNING id::text, name, url, event_types, active, last_delivery_status, last_delivered_at::text, created_at::text, user_id::text
    `,
    [input.id, input.userId],
  );
  const row = result.rows[0];
  return row ? webhookFromRow(row) : null;
}

export async function listDeveloperWebhookDeliveries(userId: string): Promise<DeveloperWebhookDelivery[]> {
  const result = await dbQuery<WebhookDeliveryRow>(
    `
      SELECT d.id::text, d.endpoint_id::text, d.event_type, d.status, d.http_status, d.error, d.created_at::text, d.delivered_at::text
        , d.attempt_count, d.duration_ms
      FROM developer_webhook_deliveries d
      WHERE d.user_id = $1::uuid
      ORDER BY d.created_at DESC
      LIMIT 50
    `,
    [userId],
  );
  return result.rows.map(deliveryFromRow);
}

export async function sendDeveloperWebhookTest(input: { endpointId: string; userId: string }): Promise<DeveloperWebhookDelivery> {
  const endpointResult = await dbQuery<WebhookEndpointRow>(
    `
      SELECT id::text, user_id::text, name, url, event_types, signing_secret, active, last_delivery_status, last_delivered_at::text, created_at::text
      FROM developer_webhook_endpoints
      WHERE id = $1::uuid
        AND user_id = $2::uuid
      LIMIT 1
    `,
    [input.endpointId, input.userId],
  );
  const endpoint = endpointResult.rows[0];
  if (!endpoint || !endpoint.active || !endpoint.signing_secret) throw new DeveloperApiAuthError("Webhook endpoint unavailable.", 404);

  const payload = {
    created_at: new Date().toISOString(),
    data: {
      message: "TradeVeto test webhook delivery.",
    },
    event_type: "opportunity.created",
    id: cryptoSafeId(),
  };
  return deliverWebhook({
    endpoint,
    eventType: "opportunity.created",
    payload,
    userId: input.userId,
  });
}

export function developerPlatformCatalog() {
  return {
    apiScopes: DEVELOPER_API_SCOPES,
    apiVersion: DEVELOPER_API_VERSION,
    deprecationPolicy: DEVELOPER_API_DEPRECATION_POLICY,
    endpoints: DEVELOPER_API_ENDPOINTS,
    quotaPolicy: {
      apiKeyPerMinute: DEVELOPER_API_KEY_QUOTA_PER_MINUTE,
      ipPerMinute: DEVELOPER_API_IP_QUOTA_PER_MINUTE,
    },
    webhookEvents: DEVELOPER_WEBHOOK_EVENT_TYPES,
    webhookPolicy: {
      retryDelaysMs: [webhookRetryDelayMs(0), webhookRetryDelayMs(1), webhookRetryDelayMs(2)],
      timeoutMs: DEVELOPER_WEBHOOK_TIMEOUT_MS,
    },
    sdkExamples: {
      curl: 'curl -H "Authorization: Bearer tvk_live_..." https://tradeveto.com/api/v1/opportunities',
      javascript: 'const res = await fetch("https://tradeveto.com/api/v1/shocks", { headers: { Authorization: `Bearer ${process.env.TRADEVETO_API_KEY}` } });',
      typescript: 'const client = new TradeVetoClient({ apiKey: process.env.TRADEVETO_API_KEY! });\nconst opportunities = await client.opportunities({ limit: 10 });',
    },
  };
}

async function deliverWebhook(input: {
  endpoint: WebhookEndpointRow;
  eventType: DeveloperWebhookEventType;
  payload: Record<string, unknown>;
  userId: string;
}): Promise<DeveloperWebhookDelivery> {
  const payload = JSON.stringify(input.payload);
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "TradeVeto-Webhooks/1.0",
    "X-TradeVeto-Event": input.eventType,
    "X-TradeVeto-Signature": buildWebhookSignatureHeader({ payload, secret: input.endpoint.signing_secret ?? "" }),
  };
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let status: "delivered" | "failed" = "failed";
  let httpStatus: number | null = null;
  let error: string | null = null;
  let attemptCount = 0;

  for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
    attemptCount = attemptIndex + 1;
    const delayMs = webhookRetryDelayMs(attemptIndex);
    if (delayMs > 0) await sleep(delayMs);
    try {
      const response = await fetch(input.endpoint.url, {
        body: payload,
        headers,
        method: "POST",
        signal: AbortSignal.timeout(DEVELOPER_WEBHOOK_TIMEOUT_MS),
      });
      httpStatus = response.status;
      status = response.ok ? "delivered" : "failed";
      error = response.ok ? null : `Webhook returned HTTP ${response.status}.`;
    } catch (deliveryError) {
      httpStatus = null;
      status = "failed";
      error = deliveryError instanceof Error ? deliveryError.message.slice(0, 300) : "Webhook delivery failed.";
    }

    if (status === "delivered" || !shouldRetryWebhookDelivery(httpStatus, error) || attemptCount >= 3) break;
  }

  const durationMs = Math.max(0, Date.now() - startedMs);
  return dbTransaction(async (db) => {
    const delivery = await db.query<WebhookDeliveryRow>(
      `
        INSERT INTO developer_webhook_deliveries (endpoint_id, user_id, event_type, payload, status, http_status, error, created_at, delivered_at, attempt_count, duration_ms, next_retry_at)
        VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7, $8::timestamptz, CASE WHEN $5 = 'delivered' THEN now() ELSE NULL END, $9, $10, NULL)
        RETURNING id::text, endpoint_id::text, event_type, status, http_status, error, created_at::text, delivered_at::text, attempt_count, duration_ms
      `,
      [input.endpoint.id, input.userId, input.eventType, payload, status, httpStatus, error, startedAt, attemptCount, durationMs],
    );
    await db.query(
      `
        UPDATE developer_webhook_endpoints
        SET last_delivery_status = $2, last_delivered_at = now(), updated_at = now()
        WHERE id = $1::uuid
      `,
      [input.endpoint.id, status],
    );
    return deliveryFromRow(delivery.rows[0]);
  });
}

function apiKeyFromRow(row: ApiKeyRow): DeveloperApiKeyRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at,
    name: row.name,
    revokedAt: row.revoked_at,
    scopes: scopesFromArray(row.scopes),
  };
}

function apiUsageFromRow(row: ApiUsageRow): DeveloperApiUsageSummary {
  const statusBucket = apiUsageStatusBucket(row.status_bucket);
  return {
    apiKeyId: row.api_key_id,
    endpoint: row.endpoint,
    lastStatus: row.last_status === null ? null : Number(row.last_status),
    lastUsedAt: row.last_used_at,
    method: row.method,
    requestCount: Number(row.request_count),
    statusBucket,
  };
}

function apiUsageStatusBucket(value: string): "2xx" | "3xx" | "4xx" | "5xx" | "unknown" {
  if (value === "2xx" || value === "3xx" || value === "4xx" || value === "5xx" || value === "unknown") return value;
  return "unknown";
}

function webhookFromRow(row: WebhookEndpointRow): DeveloperWebhookEndpoint {
  return {
    active: row.active,
    createdAt: row.created_at,
    deliveryCount: Number(row.delivery_count ?? 0),
    eventTypes: webhookEventsFromArray(row.event_types),
    failureCount: Number(row.failure_count ?? 0),
    id: row.id,
    lastDeliveredAt: row.last_delivered_at,
    lastDeliveryStatus: row.last_delivery_status === "delivered" || row.last_delivery_status === "failed" || row.last_delivery_status === "pending" ? row.last_delivery_status : null,
    name: row.name,
    url: row.url,
  };
}

function deliveryFromRow(row: WebhookDeliveryRow): DeveloperWebhookDelivery {
  return {
    attemptCount: Number(row.attempt_count ?? 1),
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    endpointId: row.endpoint_id,
    error: row.error,
    eventType: row.event_type,
    httpStatus: row.http_status,
    id: row.id,
    status: row.status === "delivered" || row.status === "failed" || row.status === "pending" ? row.status : "failed",
  };
}

function scopesFromArray(value: unknown): DeveloperApiScope[] {
  return normalizeDeveloperApiScopes(value, []).filter((scope) => DEVELOPER_API_SCOPES.includes(scope));
}

function webhookEventsFromArray(value: unknown): DeveloperWebhookEventType[] {
  return normalizeWebhookEventTypes(value, []).filter((eventType) => DEVELOPER_WEBHOOK_EVENT_TYPES.includes(eventType));
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cryptoSafeId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
