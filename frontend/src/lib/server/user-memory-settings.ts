import "server-only";

import type { QueryResultRow } from "pg";
import { dbQuery, dbTransaction } from "@/lib/server/db";
import { buildDecisionMemorySummary, type DecisionJournalEntry, type DecisionMemorySummary } from "@/lib/trading/decision-journal";
import { DEFAULT_USER_MEMORY_SETTINGS, normalizeUserMemorySettings, type UserMemorySettings } from "@/lib/trading/user-memory-settings";
import { listDecisionJournalEntries } from "./decision-journal";

type MemorySettingsRow = QueryResultRow & {
  behavioral_learning_enabled: boolean;
  journal_coaching_enabled: boolean;
  updated_at: string | null;
};

export type UserMemoryExport = {
  decisionJournalEntries: DecisionJournalEntry[];
  exportedAt: string;
  memory: DecisionMemorySummary;
  privacyNote: string;
  settings: UserMemorySettings;
  version: 1;
};

export async function readUserMemorySettings(userId: string): Promise<UserMemorySettings> {
  const result = await dbQuery<MemorySettingsRow>(
    `
      SELECT
        behavioral_learning_enabled,
        journal_coaching_enabled,
        updated_at::text
      FROM user_memory_settings
      WHERE user_id = $1::uuid
      LIMIT 1
    `,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return DEFAULT_USER_MEMORY_SETTINGS;
  return normalizeUserMemorySettings({
    behavioralLearningEnabled: row.behavioral_learning_enabled,
    journalCoachingEnabled: row.journal_coaching_enabled,
    updatedAt: row.updated_at,
  });
}

export async function upsertUserMemorySettings(userId: string, input: Partial<UserMemorySettings>): Promise<UserMemorySettings> {
  const current = await readUserMemorySettings(userId).catch(() => DEFAULT_USER_MEMORY_SETTINGS);
  const next = normalizeUserMemorySettings({ ...current, ...input, updatedAt: current.updatedAt });
  const result = await dbQuery<MemorySettingsRow>(
    `
      INSERT INTO user_memory_settings (
        user_id,
        behavioral_learning_enabled,
        journal_coaching_enabled,
        created_at,
        updated_at
      )
      VALUES ($1::uuid, $2, $3, now(), now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        behavioral_learning_enabled = EXCLUDED.behavioral_learning_enabled,
        journal_coaching_enabled = EXCLUDED.journal_coaching_enabled,
        updated_at = now()
      RETURNING
        behavioral_learning_enabled,
        journal_coaching_enabled,
        updated_at::text
    `,
    [userId, next.behavioralLearningEnabled, next.journalCoachingEnabled],
  );
  const row = result.rows[0];
  return normalizeUserMemorySettings({
    behavioralLearningEnabled: row?.behavioral_learning_enabled,
    journalCoachingEnabled: row?.journal_coaching_enabled,
    updatedAt: row?.updated_at,
  });
}

export async function clearUserMemoryData(userId: string): Promise<void> {
  await dbTransaction(async (db) => {
    await db.query("DELETE FROM user_decision_journal WHERE user_id = $1::uuid", [userId]);
    await db.query("DELETE FROM user_workflow_symbol_snapshots WHERE user_id = $1::uuid", [userId]);
    await db.query("DELETE FROM user_workflow_visits WHERE user_id = $1::uuid", [userId]);
  });
}

export async function exportUserMemory(userId: string): Promise<UserMemoryExport> {
  const [entries, settings] = await Promise.all([
    listDecisionJournalEntries(userId, { limit: 200 }),
    readUserMemorySettings(userId).catch(() => DEFAULT_USER_MEMORY_SETTINGS),
  ]);
  return {
    decisionJournalEntries: entries,
    exportedAt: new Date().toISOString(),
    memory: buildDecisionMemorySummary(entries),
    privacyNote: "This export contains TradeVeto decision journal memory and memory settings for this account. It does not include passwords, billing data, or secrets.",
    settings,
    version: 1,
  };
}
