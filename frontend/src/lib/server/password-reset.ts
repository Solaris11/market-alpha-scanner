import "server-only";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { QueryResultRow } from "pg";
import { normalizeAuthEmail, validatePassword } from "./auth";
import { dbQuery, getDbPool } from "./db";

const RESET_TTL_MS = 1000 * 60 * 60;
const BCRYPT_ROUNDS = 12;

type UserResetRow = QueryResultRow & {
  id: string;
  state: string;
};

type ResetTokenRow = QueryResultRow & {
  user_id: string;
};

export async function createPasswordReset(rawEmail: unknown, origin: string): Promise<string | null> {
  const email = normalizeAuthEmail(rawEmail);
  if (!email) return null;
  const result = await dbQuery<UserResetRow>("SELECT id::text, state FROM users WHERE email = $1 LIMIT 1", [email]);
  const user = result.rows[0];
  if (!user || user.state !== "active") return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await dbQuery(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
      VALUES ($1, $2, $3, now())
    `,
    [user.id, hashToken(token), expiresAt],
  );
  return `${origin}/terminal?resetToken=${encodeURIComponent(token)}`;
}

export async function resetPassword(token: unknown, newPassword: unknown): Promise<boolean> {
  const rawToken = String(token ?? "").trim();
  const password = validatePassword(newPassword);
  if (!rawToken || !password) return false;

  const clientPool = getDbPool();
  if (!clientPool) throw new Error("DATABASE_URL is not configured.");
  const client = await clientPool.connect();
  try {
    await client.query("BEGIN");
    const tokenResult = await client.query<ResetTokenRow>(
      `
        UPDATE password_reset_tokens
        SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id::text
      `,
      [hashToken(rawToken)],
    );
    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      await client.query("ROLLBACK");
      return false;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await client.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [tokenRow.user_id, passwordHash]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
