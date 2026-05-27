import "server-only";

import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { hashRateLimitKey, rateLimitPayload } from "@/lib/security/rate-limit-policy";
import { dbQuery } from "./db";

export type RateLimitOptions = {
  key: string;
  limit: number;
  scope: string;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  retryAfter: number;
};

type RateLimitRow = QueryResultRow & {
  count: number | string;
  expires_at: string | Date;
};

type LocalRateLimitBucket = {
  count: number;
  expiresAtMs: number;
  limit: number;
  scope: string;
};

const LOCAL_RATE_LIMIT_CACHE_MAX = 5_000;
const LOCAL_RATE_LIMIT_FAST_PATH_ENABLED = process.env.TRADEVETO_RATE_LIMIT_FAST_PATH !== "false";
const localRateLimitBuckets = new Map<string, LocalRateLimitBucket>();

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const safeLimit = Math.max(1, Math.trunc(options.limit));
  const safeWindowMs = Math.max(1_000, Math.trunc(options.windowMs));
  const keyHash = hashRateLimitKey(options.key);
  const scope = cleanScope(options.scope);
  const localResult = readLocalRateLimitBucket(keyHash, scope, safeLimit);
  if (localResult) return localResult;

  const result = await dbQuery<RateLimitRow>(
    `
      INSERT INTO rate_limit_buckets (key_hash, scope, count, window_start, expires_at, updated_at)
      VALUES ($1, $2, 1, now(), now() + ($3::integer * interval '1 millisecond'), now())
      ON CONFLICT (key_hash)
      DO UPDATE SET
        count = CASE
          WHEN rate_limit_buckets.expires_at <= now() THEN 1
          ELSE rate_limit_buckets.count + 1
        END,
        window_start = CASE
          WHEN rate_limit_buckets.expires_at <= now() THEN now()
          ELSE rate_limit_buckets.window_start
        END,
        expires_at = CASE
          WHEN rate_limit_buckets.expires_at <= now() THEN now() + ($3::integer * interval '1 millisecond')
          ELSE rate_limit_buckets.expires_at
        END,
        updated_at = now(),
        scope = EXCLUDED.scope
      RETURNING count, expires_at::text
    `,
    [keyHash, scope, safeWindowMs],
  );

  const row = result.rows[0];
  const count = Number(row?.count ?? 0);
  const expiresAtMs = expiresAtMilliseconds(row?.expires_at ?? null);
  writeLocalRateLimitBucket(keyHash, {
    count,
    expiresAtMs,
    limit: safeLimit,
    scope,
  });
  const retryAfter = retryAfterSecondsFromMs(expiresAtMs);
  return {
    allowed: count <= safeLimit,
    count,
    retryAfter,
  };
}

export function rateLimitExceededResponse(retryAfter = 60): NextResponse<{ error: "rate_limited"; retryAfter: number }> {
  const payload = rateLimitPayload(retryAfter);
  return NextResponse.json(
    payload,
    {
      headers: {
        "Retry-After": String(payload.retryAfter),
      },
      status: 429,
    },
  );
}

function cleanScope(value: string): string {
  return value.trim().slice(0, 120) || "unknown";
}

function readLocalRateLimitBucket(keyHash: string, scope: string, limit: number): RateLimitResult | null {
  if (!LOCAL_RATE_LIMIT_FAST_PATH_ENABLED) return null;
  const bucket = localRateLimitBuckets.get(keyHash);
  const now = Date.now();
  if (!bucket) return null;
  if (bucket.expiresAtMs <= now || bucket.scope !== scope || bucket.limit !== limit) {
    localRateLimitBuckets.delete(keyHash);
    return null;
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    count: bucket.count,
    retryAfter: retryAfterSecondsFromMs(bucket.expiresAtMs),
  };
}

function writeLocalRateLimitBucket(keyHash: string, bucket: LocalRateLimitBucket): void {
  if (!LOCAL_RATE_LIMIT_FAST_PATH_ENABLED) return;
  localRateLimitBuckets.set(keyHash, bucket);
  while (localRateLimitBuckets.size > LOCAL_RATE_LIMIT_CACHE_MAX) {
    const oldest = localRateLimitBuckets.keys().next().value;
    if (!oldest) return;
    localRateLimitBuckets.delete(oldest);
  }
}

function expiresAtMilliseconds(value: string | Date | null): number {
  if (!value) return Date.now() + 60_000;
  const expiresAt = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(expiresAt.getTime())) return Date.now() + 60_000;
  return expiresAt.getTime();
}

function retryAfterSecondsFromMs(expiresAtMs: number): number {
  if (!Number.isFinite(expiresAtMs)) return 60;
  return Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
}
