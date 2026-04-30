import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { QueryResultRow } from "pg";
import { dbQuery } from "./db";

export const SESSION_COOKIE_NAME = "market_alpha_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

export type DevLoginSession = {
  expiresAt: Date;
  token: string;
  user: AuthUser;
};

type UserRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export function normalizeAuthEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export async function createDevLoginSession(rawEmail: unknown): Promise<DevLoginSession> {
  const email = normalizeAuthEmail(rawEmail);
  if (!email) {
    throw new Error("Enter a valid email address.");
  }

  const displayName = email.split("@")[0] || null;
  const userResult = await dbQuery<UserRow>(
    `
      INSERT INTO users (email, display_name, created_at, updated_at)
      VALUES ($1, $2, now(), now())
      ON CONFLICT (email)
      DO UPDATE SET updated_at = now()
      RETURNING id::text, email, display_name, created_at::text
    `,
    [email, displayName],
  );
  const user = userFromRow(userResult.rows[0]);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await dbQuery(
    `
      INSERT INTO user_sessions (user_id, session_token, expires_at, created_at)
      VALUES ($1, $2, $3, now())
    `,
    [user.id, token, expiresAt],
  );

  return { expiresAt, token, user };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserForSessionToken(token);
}

export async function getUserForSessionToken(token: string): Promise<AuthUser | null> {
  if (!token.trim()) return null;
  const result = await dbQuery<UserRow>(
    `
      SELECT u.id::text, u.email, u.display_name, u.created_at::text
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token = $1
        AND s.expires_at > now()
      LIMIT 1
    `,
    [token],
  );
  const row = result.rows[0];
  return row ? userFromRow(row) : null;
}

export async function deleteSessionToken(token: string | undefined): Promise<void> {
  if (!token) return;
  await dbQuery("DELETE FROM user_sessions WHERE session_token = $1", [token]);
}

function userFromRow(row: UserRow | undefined): AuthUser {
  if (!row) {
    throw new Error("User record was not returned.");
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}
