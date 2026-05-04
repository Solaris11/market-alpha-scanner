import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

const alertsRoot = process.argv[2];
const databaseUrl = process.env.FRONTEND_DATABASE_URL || process.env.DATABASE_URL;

if (!alertsRoot) {
  console.error("Usage: node scripts/import-alert-files.mjs /path/to/scanner_output/alerts");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("FRONTEND_DATABASE_URL or DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl.replace("postgresql+psycopg://", "postgresql://") });

await client.connect();
try {
  const userDirs = await listUserAlertDirs(alertsRoot);
  let importedRules = 0;
  let importedStates = 0;
  let skippedUsers = 0;

  for (const userId of userDirs) {
    if (!(await userExists(userId))) {
      skippedUsers += 1;
      console.log(`skip missing user ${userId}`);
      continue;
    }
    const rules = await readJsonArray(join(alertsRoot, "users", userId, "alert_rules.json"));
    const state = await readJsonObject(join(alertsRoot, "users", userId, "alert_state.json"));
    await client.query("BEGIN");
    try {
      for (const rule of rules) {
        await upsertRule(userId, rule);
        importedRules += 1;
      }
      for (const [stateKey, entry] of Object.entries(state?.alerts ?? {})) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        await upsertState(userId, stateKey, entry);
        importedStates += 1;
      }
      await client.query(
        `
          INSERT INTO alert_user_settings (user_id, defaults_seeded, created_at, updated_at)
          VALUES ($1, true, now(), now())
          ON CONFLICT (user_id) DO UPDATE SET defaults_seeded = true, updated_at = now()
        `,
        [userId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  }

  console.log(JSON.stringify({ importedRules, importedStates, skippedUsers, userDirs: userDirs.length }));
} finally {
  await client.end();
}

async function listUserAlertDirs(root) {
  const usersDir = join(root, "users");
  try {
    const entries = await readdir(usersDir);
    const dirs = [];
    for (const entry of entries) {
      const fullPath = join(usersDir, entry);
      if ((await stat(fullPath)).isDirectory()) dirs.push(entry);
    }
    return dirs;
  } catch {
    return [];
  }
}

async function readJsonArray(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
  } catch {
    return [];
  }
}

async function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function userExists(userId) {
  const result = await client.query("SELECT 1 FROM users WHERE id = $1 LIMIT 1", [userId]);
  return Boolean(result.rows[0]);
}

async function upsertRule(userId, rule) {
  const clientRuleId = text(rule.id) || `alert_${Date.now()}`;
  await client.query(
    `
      INSERT INTO alert_rules (
        user_id,
        client_rule_id,
        scope,
        symbol,
        alert_type,
        threshold,
        payload,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, COALESCE($9::timestamptz, now()), COALESCE($10::timestamptz, now()))
      ON CONFLICT (user_id, client_rule_id)
      DO UPDATE SET
        scope = EXCLUDED.scope,
        symbol = EXCLUDED.symbol,
        alert_type = EXCLUDED.alert_type,
        threshold = EXCLUDED.threshold,
        payload = EXCLUDED.payload,
        is_active = EXCLUDED.is_active,
        updated_at = EXCLUDED.updated_at
    `,
    [
      userId,
      clientRuleId,
      text(rule.scope) || "symbol",
      text(rule.symbol) || null,
      text(rule.type) || "price_above",
      numeric(rule.threshold),
      JSON.stringify(rule),
      Boolean(rule.enabled ?? true),
      validDate(rule.created_at_utc),
      validDate(rule.updated_at_utc),
    ],
  );
}

async function upsertState(userId, stateKey, entry) {
  await client.query(
    `
      INSERT INTO alert_rule_state (
        user_id,
        state_key,
        rule_client_id,
        symbol,
        payload,
        last_sent_at,
        last_skipped_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, now(), now())
      ON CONFLICT (user_id, state_key)
      DO UPDATE SET
        rule_client_id = EXCLUDED.rule_client_id,
        symbol = EXCLUDED.symbol,
        payload = EXCLUDED.payload,
        last_sent_at = EXCLUDED.last_sent_at,
        last_skipped_at = EXCLUDED.last_skipped_at,
        updated_at = now()
    `,
    [userId, stateKey, text(entry.alert_id) || null, text(entry.symbol) || null, JSON.stringify(entry), validDate(entry.last_sent_at), validDate(entry.last_skipped_at)],
  );
}

function text(value) {
  return String(value ?? "").trim();
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validDate(value) {
  const date = new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) ? date : null;
}
