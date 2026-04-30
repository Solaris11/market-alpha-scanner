import "server-only";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { QueryResultRow } from "pg";
import { dbQuery } from "./db";

export const SESSION_COOKIE_NAME = "market_alpha_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const BCRYPT_ROUNDS = 12;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  state: string;
  profileImageUrl: string | null;
  timezone: string | null;
  riskExperienceLevel: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AuthSession = {
  expiresAt: Date;
  token: string;
  user: AuthUser;
};

type UserRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  state: string;
  profile_image_url: string | null;
  timezone: string | null;
  risk_experience_level: string | null;
  onboarding_completed: boolean;
  created_at: string;
  last_login_at: string | null;
};

type UserWithPasswordRow = UserRow & {
  password_hash: string | null;
};

const USER_SELECT = `
  id::text,
  email,
  display_name,
  email_verified,
  state,
  profile_image_url,
  timezone,
  risk_experience_level,
  onboarding_completed,
  created_at::text,
  last_login_at::text
`;

const USER_SELECT_U = `
  u.id::text,
  u.email,
  u.display_name,
  u.email_verified,
  u.state,
  u.profile_image_url,
  u.timezone,
  u.risk_experience_level,
  u.onboarding_completed,
  u.created_at::text,
  u.last_login_at::text
`;

export function normalizeAuthEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validatePassword(value: unknown): string | null {
  const password = String(value ?? "");
  if (password.length < 8) return null;
  return password;
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

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.MARKET_ALPHA_ENABLE_DEV_LOGIN === "true";
}

export async function registerWithPassword(input: { displayName?: unknown; email?: unknown; ip?: string | null; password?: unknown }): Promise<AuthSession> {
  const email = normalizeAuthEmail(input.email);
  const password = validatePassword(input.password);
  if (!email || !password) throw new Error("Invalid registration input.");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const displayName = cleanNullableText(input.displayName, 120) ?? email.split("@")[0] ?? null;
  const existing = await findUserWithPassword(email);
  if (existing?.password_hash) throw new Error("Registration unavailable.");

  const userResult = existing
    ? await dbQuery<UserRow>(
      `
        UPDATE users
        SET password_hash = $2, display_name = COALESCE($3, display_name), state = 'active', updated_at = now()
        WHERE id = $1
        RETURNING ${USER_SELECT}
      `,
      [existing.id, passwordHash, displayName],
    )
    : await dbQuery<UserRow>(
      `
        INSERT INTO users (email, display_name, password_hash, state, created_at, updated_at)
        VALUES ($1, $2, $3, 'active', now(), now())
        RETURNING ${USER_SELECT}
      `,
      [email, displayName, passwordHash],
    );

  await updateLastLogin(userResult.rows[0].id, input.ip ?? null);
  return createSessionForUser(userResult.rows[0].id);
}

export async function loginWithPassword(input: { email?: unknown; ip?: string | null; password?: unknown }): Promise<AuthSession | null> {
  const email = normalizeAuthEmail(input.email);
  const password = String(input.password ?? "");
  if (!email || !password) return null;

  const user = await findUserWithPassword(email);
  if (!user?.password_hash || user.state !== "active") return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  await updateLastLogin(user.id, input.ip ?? null);
  return createSessionForUser(user.id);
}

export async function createDevLoginSession(rawEmail: unknown): Promise<AuthSession> {
  const email = normalizeAuthEmail(rawEmail);
  if (!email) throw new Error("Enter a valid email address.");

  const displayName = email.split("@")[0] || null;
  const userResult = await dbQuery<UserRow>(
    `
      INSERT INTO users (email, display_name, state, created_at, updated_at)
      VALUES ($1, $2, 'active', now(), now())
      ON CONFLICT (email)
      DO UPDATE SET updated_at = now()
      RETURNING ${USER_SELECT}
    `,
    [email, displayName],
  );
  return createSessionForUser(userResult.rows[0].id);
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
      SELECT ${USER_SELECT_U}
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token = $1
        AND s.expires_at > now()
        AND u.state = 'active'
      LIMIT 1
    `,
    [token],
  );
  const row = result.rows[0];
  return row ? userFromRow(row) : null;
}

export async function createSessionForUser(userId: string): Promise<AuthSession> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User is unavailable.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await dbQuery("INSERT INTO user_sessions (user_id, session_token, expires_at, created_at) VALUES ($1, $2, $3, now())", [user.id, token, expiresAt]);
  return { expiresAt, token, user };
}

export async function deleteSessionToken(token: string | undefined): Promise<void> {
  if (!token) return;
  await dbQuery("DELETE FROM user_sessions WHERE session_token = $1", [token]);
}

export function userFromRow(row: UserRow | undefined): AuthUser {
  if (!row) throw new Error("User record was not returned.");
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerified: Boolean(row.email_verified),
    state: row.state,
    profileImageUrl: row.profile_image_url,
    timezone: row.timezone,
    riskExperienceLevel: row.risk_experience_level,
    onboardingCompleted: Boolean(row.onboarding_completed),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

async function getUserById(userId: string): Promise<AuthUser | null> {
  const result = await dbQuery<UserRow>(`SELECT ${USER_SELECT} FROM users WHERE id = $1 AND state = 'active' LIMIT 1`, [userId]);
  return result.rows[0] ? userFromRow(result.rows[0]) : null;
}

async function findUserWithPassword(email: string): Promise<UserWithPasswordRow | null> {
  const result = await dbQuery<UserWithPasswordRow>(`SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1 LIMIT 1`, [email]);
  return result.rows[0] ?? null;
}

async function updateLastLogin(userId: string, ip: string | null): Promise<void> {
  await dbQuery("UPDATE users SET last_login_at = now(), last_login_ip = $2, updated_at = now() WHERE id = $1", [userId, ip]);
}

function cleanNullableText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}
