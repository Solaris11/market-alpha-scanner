import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery } from "@/lib/server/db";
import {
  buildDecisionMemorySummary,
  normalizeDecisionJournalAction,
  type DecisionJournalAction,
  type DecisionJournalEntry,
  type DecisionMemorySummary,
  type DecisionOutcomeQuality,
  type DecisionOutcomeStatus,
} from "@/lib/trading/decision-journal";

type DecisionJournalRow = QueryResultRow & {
  concerns: string | null;
  conviction_score: string | number | null;
  created_at: string;
  deterministic_snapshot: unknown;
  emotional_context: string | null;
  expected_catalyst: string | null;
  final_decision: string | null;
  followup_return_1d: string | number | null;
  followup_return_5d: string | number | null;
  followup_return_10d: string | number | null;
  fragility_score: string | number | null;
  id: string;
  invalidation_reasoning: string | null;
  macro_regime: string | null;
  macro_view: string | null;
  outcome_quality: string;
  outcome_status: string;
  personality_profile: string | null;
  reason: string | null;
  risk_reward_profile: string | null;
  setup_type: string | null;
  shock_state: string | null;
  symbol: string;
  thesis: string | null;
  updated_at: string;
  user_action: string;
};

export type DecisionJournalInput = {
  concerns?: unknown;
  convictionScore?: unknown;
  deterministicSnapshot?: unknown;
  emotionalContext?: unknown;
  expectedCatalyst?: unknown;
  finalDecision?: unknown;
  fragilityScore?: unknown;
  invalidationReasoning?: unknown;
  macroRegime?: unknown;
  macroView?: unknown;
  personalityProfile?: unknown;
  reason?: unknown;
  riskRewardProfile?: unknown;
  setupType?: unknown;
  shockState?: unknown;
  symbol?: unknown;
  thesis?: unknown;
  userAction?: unknown;
};

export async function listDecisionJournalEntries(userId: string, options: { limit?: number; symbol?: string | null } = {}): Promise<DecisionJournalEntry[]> {
  const limit = boundedLimit(options.limit ?? 80);
  const symbol = cleanSymbol(options.symbol);
  const params: unknown[] = [userId, limit];
  const symbolFilter = symbol ? "AND symbol = $3" : "";
  if (symbol) params.push(symbol);

  const result = await dbQuery<DecisionJournalRow>(
    `
      SELECT
        id::text,
        symbol,
        user_action,
        setup_type,
        macro_regime,
        final_decision,
        conviction_score,
        fragility_score,
        shock_state,
        risk_reward_profile,
        personality_profile,
        reason,
        thesis,
        concerns,
        macro_view,
        emotional_context,
        expected_catalyst,
        invalidation_reasoning,
        deterministic_snapshot,
        outcome_status,
        outcome_quality,
        followup_return_1d,
        followup_return_5d,
        followup_return_10d,
        created_at::text,
        updated_at::text
      FROM user_decision_journal
      WHERE user_id = $1::uuid
        ${symbolFilter}
      ORDER BY created_at DESC
      LIMIT $2
    `,
    params,
  );

  return result.rows.map(rowFromDb);
}

export async function createDecisionJournalEntry(userId: string, input: DecisionJournalInput): Promise<DecisionJournalEntry> {
  const symbol = cleanSymbol(input.symbol);
  if (!symbol) throw new Error("A valid symbol is required.");

  const action = normalizeDecisionJournalAction(input.userAction);
  const snapshot = safeSnapshot(input.deterministicSnapshot);

  const result = await dbQuery<DecisionJournalRow>(
    `
      INSERT INTO user_decision_journal (
        user_id,
        symbol,
        user_action,
        setup_type,
        macro_regime,
        final_decision,
        conviction_score,
        fragility_score,
        shock_state,
        risk_reward_profile,
        personality_profile,
        reason,
        thesis,
        concerns,
        macro_view,
        emotional_context,
        expected_catalyst,
        invalidation_reasoning,
        deterministic_snapshot
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
        $15,
        $16,
        $17,
        $18,
        $19::jsonb
      )
      RETURNING
        id::text,
        symbol,
        user_action,
        setup_type,
        macro_regime,
        final_decision,
        conviction_score,
        fragility_score,
        shock_state,
        risk_reward_profile,
        personality_profile,
        reason,
        thesis,
        concerns,
        macro_view,
        emotional_context,
        expected_catalyst,
        invalidation_reasoning,
        deterministic_snapshot,
        outcome_status,
        outcome_quality,
        followup_return_1d,
        followup_return_5d,
        followup_return_10d,
        created_at::text,
        updated_at::text
    `,
    [
      userId,
      symbol,
      action,
      cleanNullableText(input.setupType, 80),
      cleanNullableText(input.macroRegime, 80),
      cleanNullableText(input.finalDecision, 80),
      nullableNumber(input.convictionScore),
      nullableNumber(input.fragilityScore),
      cleanNullableText(input.shockState, 80),
      cleanNullableText(input.riskRewardProfile, 80),
      cleanNullableText(input.personalityProfile, 80),
      cleanNullableText(input.reason, 600),
      cleanNullableText(input.thesis, 900),
      cleanNullableText(input.concerns, 900),
      cleanNullableText(input.macroView, 900),
      cleanNullableText(input.emotionalContext, 400),
      cleanNullableText(input.expectedCatalyst, 500),
      cleanNullableText(input.invalidationReasoning, 700),
      JSON.stringify(snapshot),
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error("Decision journal entry was not returned.");
  return rowFromDb(row);
}

export async function clearDecisionJournal(userId: string): Promise<void> {
  await dbQuery("DELETE FROM user_decision_journal WHERE user_id = $1::uuid", [userId]);
}

export async function getDecisionMemoryForUser(userId: string, options: { limit?: number; symbol?: string | null } = {}): Promise<{ entries: DecisionJournalEntry[]; memory: DecisionMemorySummary }> {
  const entries = await listDecisionJournalEntries(userId, { limit: options.limit ?? 120 });
  return {
    entries,
    memory: buildDecisionMemorySummary(entries, { symbol: options.symbol }),
  };
}

function rowFromDb(row: DecisionJournalRow): DecisionJournalEntry {
  return {
    concerns: row.concerns,
    convictionScore: nullableNumber(row.conviction_score),
    createdAt: row.created_at,
    deterministicSnapshot: safeSnapshot(row.deterministic_snapshot),
    emotionalContext: row.emotional_context,
    expectedCatalyst: row.expected_catalyst,
    finalDecision: row.final_decision,
    followupReturn1d: nullableNumber(row.followup_return_1d),
    followupReturn5d: nullableNumber(row.followup_return_5d),
    followupReturn10d: nullableNumber(row.followup_return_10d),
    fragilityScore: nullableNumber(row.fragility_score),
    id: row.id,
    invalidationReasoning: row.invalidation_reasoning,
    macroRegime: row.macro_regime,
    macroView: row.macro_view,
    outcomeQuality: normalizeOutcomeQuality(row.outcome_quality),
    outcomeStatus: normalizeOutcomeStatus(row.outcome_status),
    personalityProfile: row.personality_profile,
    reason: row.reason,
    riskRewardProfile: row.risk_reward_profile,
    setupType: row.setup_type,
    shockState: row.shock_state,
    symbol: cleanSymbol(row.symbol) ?? "UNKNOWN",
    thesis: row.thesis,
    updatedAt: row.updated_at,
    userAction: normalizeDecisionJournalAction(row.user_action),
  };
}

function normalizeOutcomeStatus(value: unknown): DecisionOutcomeStatus {
  const text = String(value ?? "").trim();
  return text === "tracking" || text === "updated" || text === "resolved" ? text : "pending";
}

function normalizeOutcomeQuality(value: unknown): DecisionOutcomeQuality {
  const text = String(value ?? "").trim();
  return text === "helped" || text === "hurt" || text === "neutral" || text === "unknown" ? text : "pending";
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

function safeSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) continue;
    if (rawValue === null || typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      output[key] = typeof rawValue === "string" ? rawValue.slice(0, 300) : rawValue;
    }
    if (Object.keys(output).length >= 32) break;
  }
  return output;
}

function boundedLimit(value: number): number {
  if (!Number.isFinite(value)) return 80;
  return Math.max(1, Math.min(200, Math.floor(value)));
}
