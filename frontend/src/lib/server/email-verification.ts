import "server-only";

import { randomBytes } from "node:crypto";
import type { QueryResultRow } from "pg";
import { emailVerificationTokenIsUsable, hashEmailVerificationToken } from "@/lib/security/email-verification";
import type { AuthUser } from "./auth";
import { dbQuery, getDbPool } from "./db";
import { canonicalAppUrl } from "./request-security";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;

export type EmailVerificationRequest = {
  email: string;
  expiresAt: Date;
  verificationUrl: string;
};

type VerificationTokenRow = QueryResultRow & {
  expires_at: Date | string | null;
  user_id: string;
  used_at: Date | string | null;
};

export async function createEmailVerification(user: AuthUser): Promise<EmailVerificationRequest> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  await dbQuery(
    `
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at)
      VALUES ($1, $2, $3, now())
    `,
    [user.id, hashEmailVerificationToken(token), expiresAt],
  );
  return {
    email: user.email,
    expiresAt,
    verificationUrl: verificationUrl(token),
  };
}

export async function verifyEmailToken(token: unknown): Promise<boolean> {
  const rawToken = String(token ?? "").trim();
  if (!rawToken) return false;

  const pool = getDbPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tokenResult = await client.query<VerificationTokenRow>(
      `
        SELECT user_id::text, expires_at, used_at
        FROM email_verification_tokens
        WHERE token_hash = $1
        LIMIT 1
      `,
      [hashEmailVerificationToken(rawToken)],
    );
    const tokenRow = tokenResult.rows[0];
    if (!tokenRow || !emailVerificationTokenIsUsable({ expiresAt: tokenRow.expires_at, usedAt: tokenRow.used_at })) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `
        UPDATE email_verification_tokens
        SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL
      `,
      [hashEmailVerificationToken(rawToken)],
    );
    await client.query(
      `
        UPDATE users
        SET email_verified = true,
            email_verified_at = now(),
            updated_at = now()
        WHERE id = $1
      `,
      [tokenRow.user_id],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function verificationUrl(token: string): string {
  const url = new URL("/api/auth/verify-email", canonicalAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}
