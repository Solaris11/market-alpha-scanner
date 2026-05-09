import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery, dbTransaction, type DbExecutor } from "@/lib/server/db";
import {
  buildWorkflowEvolution,
  type WorkflowEvolutionSummary,
  type WorkflowSignalSnapshot,
  type WorkflowSurface,
} from "@/lib/trading/workflow-evolution";
import type { RankingRow } from "@/lib/types";

type WorkflowSnapshotRow = QueryResultRow & {
  captured_at: string;
  conviction_score: string | number | null;
  entry_distance_pct: string | number | null;
  event_pressure_score: string | number | null;
  final_decision: string | null;
  final_score: string | number | null;
  fragility_score: string | number | null;
  macro_alignment_score: string | number | null;
  maturity_state: string | null;
  metadata: unknown;
  return_1d: string | number | null;
  setup_type: string | null;
  shock_pressure_score: string | number | null;
  symbol: string;
};

type WorkflowVisitRow = QueryResultRow & {
  last_seen_at: string | null;
};

export async function getWorkflowEvolutionForUser(
  userId: string | null | undefined,
  rows: RankingRow[],
  options: { surface: WorkflowSurface; watchlistSymbols?: string[] },
): Promise<WorkflowEvolutionSummary> {
  if (!userId) {
    return buildWorkflowEvolution(rows, { watchlistSymbols: options.watchlistSymbols ?? [] });
  }

  const [previousSnapshots, lastSeenAt] = await Promise.all([
    readWorkflowSnapshots(userId, options.surface).catch(() => []),
    readLastSeenAt(userId, options.surface).catch(() => null),
  ]);
  return buildWorkflowEvolution(rows, {
    lastSeenAt,
    previousSnapshots,
    watchlistSymbols: options.watchlistSymbols ?? [],
  });
}

export async function recordWorkflowVisit(userId: string, input: { snapshots: WorkflowSignalSnapshot[]; surface: WorkflowSurface }): Promise<void> {
  const snapshots = input.snapshots.map(normalizeSnapshot).filter((snapshot): snapshot is WorkflowSignalSnapshot => Boolean(snapshot)).slice(0, 160);
  await dbTransaction(async (db) => {
    await db.query(
      `
        INSERT INTO user_workflow_visits (user_id, surface, last_seen_at, metadata, created_at, updated_at)
        VALUES ($1::uuid, $2, now(), $3::jsonb, now(), now())
        ON CONFLICT (user_id, surface)
        DO UPDATE SET last_seen_at = excluded.last_seen_at, metadata = excluded.metadata, updated_at = now()
      `,
      [userId, input.surface, JSON.stringify({ snapshotCount: snapshots.length })],
    );

    for (const snapshot of snapshots) {
      await upsertSnapshot(db, userId, input.surface, snapshot);
    }
  });
}

async function readWorkflowSnapshots(userId: string, surface: WorkflowSurface): Promise<WorkflowSignalSnapshot[]> {
  const result = await dbQuery<WorkflowSnapshotRow>(
    `
      SELECT
        symbol,
        final_score,
        conviction_score,
        fragility_score,
        macro_alignment_score,
        event_pressure_score,
        shock_pressure_score,
        entry_distance_pct,
        return_1d,
        final_decision,
        setup_type,
        maturity_state,
        metadata,
        captured_at::text
      FROM user_workflow_symbol_snapshots
      WHERE user_id = $1::uuid
        AND surface = $2
      ORDER BY captured_at DESC, symbol
      LIMIT 180
    `,
    [userId, surface],
  );
  return result.rows.map(snapshotFromDb).filter((snapshot): snapshot is WorkflowSignalSnapshot => Boolean(snapshot));
}

async function readLastSeenAt(userId: string, surface: WorkflowSurface): Promise<string | null> {
  const result = await dbQuery<WorkflowVisitRow>(
    `
      SELECT last_seen_at::text
      FROM user_workflow_visits
      WHERE user_id = $1::uuid
        AND surface = $2
      LIMIT 1
    `,
    [userId, surface],
  );
  return result.rows[0]?.last_seen_at ?? null;
}

async function upsertSnapshot(db: DbExecutor, userId: string, surface: WorkflowSurface, snapshot: WorkflowSignalSnapshot): Promise<void> {
  await db.query(
    `
      INSERT INTO user_workflow_symbol_snapshots (
        user_id,
        surface,
        symbol,
        final_score,
        conviction_score,
        fragility_score,
        macro_alignment_score,
        event_pressure_score,
        shock_pressure_score,
        entry_distance_pct,
        return_1d,
        final_decision,
        setup_type,
        maturity_state,
        metadata,
        captured_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15::jsonb,
        now()
      )
      ON CONFLICT (user_id, surface, symbol)
      DO UPDATE SET
        final_score = excluded.final_score,
        conviction_score = excluded.conviction_score,
        fragility_score = excluded.fragility_score,
        macro_alignment_score = excluded.macro_alignment_score,
        event_pressure_score = excluded.event_pressure_score,
        shock_pressure_score = excluded.shock_pressure_score,
        entry_distance_pct = excluded.entry_distance_pct,
        return_1d = excluded.return_1d,
        final_decision = excluded.final_decision,
        setup_type = excluded.setup_type,
        maturity_state = excluded.maturity_state,
        metadata = excluded.metadata,
        captured_at = now()
    `,
    [
      userId,
      surface,
      snapshot.symbol,
      snapshot.finalScore,
      snapshot.convictionScore,
      snapshot.fragilityScore,
      snapshot.macroAlignmentScore,
      snapshot.eventPressureScore,
      snapshot.shockPressureScore,
      snapshot.entryDistancePct,
      snapshot.return1d,
      snapshot.finalDecision,
      snapshot.setupType,
      snapshot.maturityState,
      JSON.stringify(safeMetadata(snapshot.metadata)),
    ],
  );
}

function snapshotFromDb(row: WorkflowSnapshotRow): WorkflowSignalSnapshot | null {
  const symbol = cleanSymbol(row.symbol);
  if (!symbol) return null;
  return {
    capturedAt: row.captured_at,
    convictionScore: nullableNumber(row.conviction_score),
    entryDistancePct: nullableNumber(row.entry_distance_pct),
    eventPressureScore: nullableNumber(row.event_pressure_score),
    finalDecision: cleanNullableText(row.final_decision, 80),
    finalScore: nullableNumber(row.final_score),
    fragilityScore: nullableNumber(row.fragility_score),
    macroAlignmentScore: nullableNumber(row.macro_alignment_score),
    maturityState: normalizeMaturity(row.maturity_state),
    metadata: safeMetadata(row.metadata),
    return1d: nullableNumber(row.return_1d),
    setupType: cleanNullableText(row.setup_type, 80),
    shockPressureScore: nullableNumber(row.shock_pressure_score),
    symbol,
  };
}

function normalizeSnapshot(value: WorkflowSignalSnapshot): WorkflowSignalSnapshot | null {
  const symbol = cleanSymbol(value.symbol);
  if (!symbol) return null;
  return {
    capturedAt: null,
    convictionScore: nullableNumber(value.convictionScore),
    entryDistancePct: nullableNumber(value.entryDistancePct),
    eventPressureScore: nullableNumber(value.eventPressureScore),
    finalDecision: cleanNullableText(value.finalDecision, 80),
    finalScore: nullableNumber(value.finalScore),
    fragilityScore: nullableNumber(value.fragilityScore),
    macroAlignmentScore: nullableNumber(value.macroAlignmentScore),
    maturityState: normalizeMaturity(value.maturityState),
    metadata: safeMetadata(value.metadata),
    return1d: nullableNumber(value.return1d),
    setupType: cleanNullableText(value.setupType, 80),
    shockPressureScore: nullableNumber(value.shockPressureScore),
    symbol,
  };
}

function normalizeMaturity(value: unknown): WorkflowSignalSnapshot["maturityState"] {
  const text = String(value ?? "").trim();
  if (
    text === "Early Formation" ||
    text === "Improving" ||
    text === "Trigger Approaching" ||
    text === "Breakout Confirmed" ||
    text === "Extended" ||
    text === "Decaying" ||
    text === "High Chase Risk"
  ) {
    return text;
  }
  return "Early Formation";
}

function safeMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) continue;
    if (rawValue === null || typeof rawValue === "boolean" || typeof rawValue === "number") {
      output[key] = rawValue;
    } else if (typeof rawValue === "string") {
      output[key] = rawValue.slice(0, 180);
    }
    if (Object.keys(output).length >= 20) break;
  }
  return output;
}

function cleanSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return symbol || null;
}

function cleanNullableText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return null;
  return text.slice(0, maxLength);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
