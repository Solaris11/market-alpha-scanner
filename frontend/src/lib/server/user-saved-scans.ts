import "server-only";

import type { QueryResultRow } from "pg";
import {
  discoverySavedScanNameKey,
  sanitizeDiscoverySavedScanName,
  sanitizeDiscoverySavedScanPayload,
  type DiscoverySavedScan,
  type DiscoverySavedScanPayload,
} from "@/lib/discovery-saved-scans";
import { dbQuery } from "./db";

type SavedScanRow = QueryResultRow & {
  created_at: string | Date | null;
  filter_payload: unknown;
  id: string;
  last_used_at: string | Date | null;
  name: string;
  name_key: string;
  updated_at: string | Date | null;
  use_count: number | string | null;
};

type SavedScanCacheEntry = {
  expiresAtMs: number;
  scans: DiscoverySavedScan[];
};

const SAVED_SCAN_LIMIT = 36;
const SAVED_SCAN_CACHE_TTL_MS = 15_000;
const SAVED_SCAN_CACHE_MAX = 1_000;

const savedScanCache = new Map<string, SavedScanCacheEntry>();

export async function readUserSavedScans(userId: string): Promise<DiscoverySavedScan[]> {
  const cached = readCachedSavedScans(userId);
  if (cached) return cached.map(cloneSavedScan);

  const result = await dbQuery<SavedScanRow>(
    `
      SELECT id::text, name, name_key, filter_payload, use_count, last_used_at::text, created_at::text, updated_at::text
      FROM user_saved_scans
      WHERE user_id = $1
      ORDER BY COALESCE(last_used_at, updated_at) DESC, updated_at DESC, name ASC
      LIMIT $2
    `,
    [userId, SAVED_SCAN_LIMIT],
  );
  const scans = result.rows.map(savedScanFromRow);
  writeCachedSavedScans(userId, scans);
  return scans.map(cloneSavedScan);
}

export async function upsertUserSavedScan(userId: string, input: { name: unknown; payload: unknown }): Promise<DiscoverySavedScan> {
  const name = sanitizeDiscoverySavedScanName(input.name);
  const nameKey = discoverySavedScanNameKey(name);
  const payload = sanitizeDiscoverySavedScanPayload(input.payload);
  const result = await dbQuery<SavedScanRow>(
    `
      INSERT INTO user_saved_scans (user_id, name, name_key, filter_payload, created_at, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, now(), now())
      ON CONFLICT (user_id, name_key)
      DO UPDATE SET
        name = EXCLUDED.name,
        filter_payload = EXCLUDED.filter_payload,
        updated_at = now()
      RETURNING id::text, name, name_key, filter_payload, use_count, last_used_at::text, created_at::text, updated_at::text
    `,
    [userId, name, nameKey, JSON.stringify(payload)],
  );
  invalidateUserSavedScans(userId);
  return savedScanFromRow(result.rows[0]);
}

export async function touchUserSavedScan(userId: string, id: string): Promise<DiscoverySavedScan | null> {
  const scanId = normalizeSavedScanId(id);
  if (!scanId) return null;

  const result = await dbQuery<SavedScanRow>(
    `
      UPDATE user_saved_scans
      SET last_used_at = now(), use_count = use_count + 1, updated_at = now()
      WHERE user_id = $1 AND id = $2::uuid
      RETURNING id::text, name, name_key, filter_payload, use_count, last_used_at::text, created_at::text, updated_at::text
    `,
    [userId, scanId],
  );
  invalidateUserSavedScans(userId);
  return result.rows[0] ? savedScanFromRow(result.rows[0]) : null;
}

export async function deleteUserSavedScan(userId: string, id: string): Promise<boolean> {
  const scanId = normalizeSavedScanId(id);
  if (!scanId) return false;

  const result = await dbQuery("DELETE FROM user_saved_scans WHERE user_id = $1 AND id = $2::uuid", [userId, scanId]);
  invalidateUserSavedScans(userId);
  return (result.rowCount ?? 0) > 0;
}

export function invalidateUserSavedScans(userId: string): void {
  savedScanCache.delete(userId);
}

function savedScanFromRow(row: SavedScanRow | undefined): DiscoverySavedScan {
  if (!row) throw new Error("Saved scan row was not returned.");
  return {
    createdAt: isoText(row.created_at),
    id: row.id,
    lastUsedAt: isoText(row.last_used_at),
    name: sanitizeDiscoverySavedScanName(row.name),
    nameKey: discoverySavedScanNameKey(row.name_key),
    payload: sanitizeDiscoverySavedScanPayload(row.filter_payload),
    updatedAt: isoText(row.updated_at),
    useCount: safeInteger(row.use_count),
  };
}

function cloneSavedScan(scan: DiscoverySavedScan): DiscoverySavedScan {
  return {
    ...scan,
    payload: { ...scan.payload },
  };
}

function readCachedSavedScans(userId: string): DiscoverySavedScan[] | null {
  const cached = savedScanCache.get(userId);
  if (!cached) return null;
  if (cached.expiresAtMs <= Date.now()) {
    savedScanCache.delete(userId);
    return null;
  }
  return cached.scans;
}

function writeCachedSavedScans(userId: string, scans: DiscoverySavedScan[]): void {
  trimSavedScanCache();
  savedScanCache.set(userId, {
    expiresAtMs: Date.now() + SAVED_SCAN_CACHE_TTL_MS,
    scans: scans.map(cloneSavedScan),
  });
}

function trimSavedScanCache(): void {
  if (savedScanCache.size < SAVED_SCAN_CACHE_MAX) return;
  const now = Date.now();
  for (const [key, value] of savedScanCache) {
    if (value.expiresAtMs <= now) savedScanCache.delete(key);
  }
  while (savedScanCache.size >= SAVED_SCAN_CACHE_MAX) {
    const firstKey = savedScanCache.keys().next().value;
    if (typeof firstKey !== "string") return;
    savedScanCache.delete(firstKey);
  }
}

function normalizeSavedScanId(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

function isoText(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? "").trim();
  return text || null;
}

function safeInteger(value: string | number | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export type { DiscoverySavedScan, DiscoverySavedScanPayload };
