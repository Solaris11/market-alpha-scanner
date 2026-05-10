import "server-only";

import type { QueryResultRow } from "pg";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { normalizeWatchlistSymbols } from "@/lib/server/user-watchlist";
import {
  buildCommunityIntelligence,
  type CommunityFollowAggregate,
  type CommunityInterest,
  type CommunityIntelligenceSystem,
  type CommunityReplayStudy,
  type CommunitySharedWatchlist,
} from "@/lib/trading/community-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import { dbQuery } from "./db";
import { getNarrativeMap } from "./narrative-intelligence";
import { getShockMovePatternMap } from "./shock-move-patterns";

export class CommunityIntelligenceError extends Error {
  readonly status: 400 | 403 | 404;

  constructor(message: string, status: 400 | 403 | 404 = 400) {
    super(message);
    this.name = "CommunityIntelligenceError";
    this.status = status;
  }
}

type SharedWatchlistRow = QueryResultRow & {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
  symbols: string[];
};

type ReplayStudyRow = QueryResultRow & {
  created_at: string;
  id: string;
  replay_timestamp: string | null;
  summary: string;
  symbol: string;
  tags: string[];
  title: string;
};

type FollowAggregateRow = QueryResultRow & {
  count: number | string;
  interest: string;
  symbol: string;
};

export async function loadCommunityIntelligenceSystem(userId?: string | null): Promise<CommunityIntelligenceSystem> {
  const [rows, sharedWatchlists, replayStudies, follows, myFollows] = await Promise.all([
    loadOpportunityRows(),
    readCommunitySharedWatchlists(),
    readCommunityReplayStudies(),
    readCommunityFollowAggregates(),
    userId ? readMyCommunityFollows(userId) : Promise.resolve([]),
  ]);

  return buildCommunityIntelligence({
    follows,
    myFollows,
    replayStudies,
    rows,
    sharedWatchlists,
  });
}

export async function createCommunitySharedWatchlist(input: { description?: unknown; name: unknown; symbols: unknown[]; userId: string }): Promise<CommunityIntelligenceSystem> {
  const name = cleanText(input.name, 120);
  const description = cleanText(input.description, 500) || null;
  const symbols = normalizeWatchlistSymbols(input.symbols).slice(0, 40);
  if (!name) throw new CommunityIntelligenceError("Shared watchlist needs a name.");
  if (!symbols.length) throw new CommunityIntelligenceError("Shared watchlist needs at least one symbol.");

  await dbQuery(
    `
      INSERT INTO community_shared_watchlists (user_id, name, description, symbols, visibility, moderation_status, created_at, updated_at)
      VALUES ($1::uuid, $2, $3, $4::text[], 'community', 'approved', now(), now())
    `,
    [input.userId, name, description, symbols],
  );
  return loadCommunityIntelligenceSystem(input.userId);
}

export async function createCommunityReplayStudy(input: {
  replayTimestamp?: unknown;
  summary: unknown;
  symbol: unknown;
  tags?: unknown[];
  title: unknown;
  userId: string;
}): Promise<CommunityIntelligenceSystem> {
  const [symbol] = normalizeWatchlistSymbols([input.symbol]);
  const title = cleanText(input.title, 140);
  const summary = cleanText(input.summary, 1_200);
  const tags = normalizeTags(input.tags ?? []).slice(0, 8);
  const replayTimestamp = normalizedTimestamp(input.replayTimestamp);
  if (!symbol) throw new CommunityIntelligenceError("Replay study needs a valid symbol.");
  if (!title || !summary) throw new CommunityIntelligenceError("Replay study needs a title and summary.");

  await dbQuery(
    `
      INSERT INTO community_replay_studies (user_id, symbol, replay_timestamp, title, summary, tags, visibility, moderation_status, created_at, updated_at)
      VALUES ($1::uuid, $2, $3::timestamptz, $4, $5, $6::text[], 'community', 'approved', now(), now())
    `,
    [input.userId, symbol, replayTimestamp, title, summary, tags],
  );
  return loadCommunityIntelligenceSystem(input.userId);
}

export async function setCommunityOpportunityFollow(input: { interest: unknown; symbol: unknown; userId: string }): Promise<CommunityIntelligenceSystem> {
  const [symbol] = normalizeWatchlistSymbols([input.symbol]);
  const interest = normalizeInterest(input.interest);
  if (!symbol) throw new CommunityIntelligenceError("Opportunity marker needs a valid symbol.");

  await dbQuery(
    `
      INSERT INTO community_opportunity_follows (user_id, symbol, interest, source, created_at, updated_at)
      VALUES ($1::uuid, $2, $3, 'community', now(), now())
      ON CONFLICT (user_id, symbol)
      DO UPDATE SET interest = EXCLUDED.interest, updated_at = now()
    `,
    [input.userId, symbol, interest],
  );
  return loadCommunityIntelligenceSystem(input.userId);
}

export async function removeCommunityOpportunityFollow(input: { symbol: string; userId: string }): Promise<CommunityIntelligenceSystem> {
  const [symbol] = normalizeWatchlistSymbols([input.symbol]);
  if (!symbol) return loadCommunityIntelligenceSystem(input.userId);
  await dbQuery("DELETE FROM community_opportunity_follows WHERE user_id = $1::uuid AND symbol = $2", [input.userId, symbol]);
  return loadCommunityIntelligenceSystem(input.userId);
}

async function readCommunitySharedWatchlists(): Promise<CommunitySharedWatchlist[]> {
  const result = await dbQuery<SharedWatchlistRow>(
    `
      SELECT id::text, name, description, symbols, created_at::text
      FROM community_shared_watchlists
      WHERE visibility = 'community'
        AND moderation_status = 'approved'
      ORDER BY updated_at DESC
      LIMIT 40
    `,
  );
  return result.rows.map((row) => ({
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    ownerLabel: "Community member",
    symbols: normalizeWatchlistSymbols(row.symbols ?? []),
  }));
}

async function readCommunityReplayStudies(): Promise<CommunityReplayStudy[]> {
  const result = await dbQuery<ReplayStudyRow>(
    `
      SELECT id::text, symbol, replay_timestamp::text, title, summary, tags, created_at::text
      FROM community_replay_studies
      WHERE visibility = 'community'
        AND moderation_status = 'approved'
      ORDER BY created_at DESC
      LIMIT 40
    `,
  );
  return result.rows.map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    ownerLabel: "Community member",
    replayTimestamp: row.replay_timestamp,
    summary: row.summary,
    symbol: normalizeWatchlistSymbols([row.symbol])[0] ?? row.symbol.toUpperCase(),
    tags: normalizeTags(row.tags ?? []),
    title: row.title,
  }));
}

async function readCommunityFollowAggregates(): Promise<CommunityFollowAggregate[]> {
  const result = await dbQuery<FollowAggregateRow>(
    `
      SELECT symbol, interest, COUNT(*)::int AS count
      FROM community_opportunity_follows
      GROUP BY symbol, interest
      ORDER BY COUNT(*) DESC, symbol ASC
      LIMIT 300
    `,
  );
  return result.rows.map(followAggregateFromRow).filter((row): row is CommunityFollowAggregate => Boolean(row));
}

async function readMyCommunityFollows(userId: string): Promise<CommunityFollowAggregate[]> {
  const result = await dbQuery<FollowAggregateRow>(
    `
      SELECT symbol, interest, 1::int AS count
      FROM community_opportunity_follows
      WHERE user_id = $1::uuid
      ORDER BY updated_at DESC
      LIMIT 100
    `,
    [userId],
  );
  return result.rows.map(followAggregateFromRow).filter((row): row is CommunityFollowAggregate => Boolean(row));
}

async function loadOpportunityRows() {
  const adapter = new ScannerDataAdapter();
  const rows = await adapter.getOverviewSignals();
  const symbols = rows.map((row) => row.symbol);
  const [performance, shockPatterns, narratives] = await Promise.all([
    getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    getShockMovePatternMap(symbols).catch(() => new Map()),
    getNarrativeMap(symbols).catch(() => new Map()),
  ]);
  return buildOpportunitiesPageModel(rows, performance, shockPatterns, narratives).rows;
}

function followAggregateFromRow(row: FollowAggregateRow): CommunityFollowAggregate | null {
  const [symbol] = normalizeWatchlistSymbols([row.symbol]);
  const interest = normalizeInterest(row.interest);
  const count = Number(row.count);
  if (!symbol || !Number.isFinite(count) || count <= 0) return null;
  return { count: Math.floor(count), interest, symbol };
}

function normalizeInterest(value: unknown): CommunityInterest {
  return value === "learning" || value === "cautious" || value === "monitoring" ? value : "monitoring";
}

function normalizeTags(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value, 36).toLowerCase().replace(/[^a-z0-9 _-]/g, "").trim()).filter(Boolean))).slice(0, 8);
}

function normalizedTimestamp(value: unknown): string | null {
  const text = cleanText(value, 80);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}
