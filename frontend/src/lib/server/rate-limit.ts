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

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const safeLimit = Math.max(1, Math.trunc(options.limit));
  const safeWindowMs = Math.max(1_000, Math.trunc(options.windowMs));
  const keyHash = hashRateLimitKey(options.key);
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
    [keyHash, cleanScope(options.scope), safeWindowMs],
  );

  const row = result.rows[0];
  const count = Number(row?.count ?? 0);
  const retryAfter = retryAfterSeconds(row?.expires_at ?? null);
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

function retryAfterSeconds(value: string | Date | null): number {
  if (!value) return 60;
  const expiresAt = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(expiresAt.getTime())) return 60;
  return Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}
