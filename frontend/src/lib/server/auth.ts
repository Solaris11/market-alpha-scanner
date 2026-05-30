import "server-only";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { QueryResultRow } from "pg";
import { hashSessionToken } from "@/lib/security/session-token";
import { normalizeUserRole, type UserRole } from "@/lib/security/admin-policy";
import { dbQuery } from "./db";

export const SESSION_COOKIE_NAME = "market_alpha_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const BCRYPT_ROUNDS = 12;
const SESSION_USER_CACHE_TTL_MS = boundedAuthCacheMs(process.env.TRADEVETO_SESSION_USER_CACHE_TTL_MS, 120_000, 10_000, 300_000);
const SESSION_USER_NEGATIVE_CACHE_TTL_MS = 250;
const SESSION_USER_CACHE_MAX = 500;

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
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

export type SessionMetadata = {
  authMethod?: string;
  ip?: string | null;
  request?: Request;
  userAgent?: string | null;
};

type UserRow = QueryResultRow & {
  id: string;
  email: string;
  role: string;
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

type SessionUserCacheEntry = {
  expiresAtMs: number;
  user: AuthUser | null;
};

const sessionUserCache = new Map<string, SessionUserCacheEntry>();
const sessionUserInflight = new Map<string, Promise<AuthUser | null>>();

const USER_SELECT = `
  id::text,
  email,
  role,
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
  u.role,
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
  return process.env.NODE_ENV !== "production" && process.env.TRADEVETO_ENABLE_DEV_LOGIN !== "false" && process.env.MARKET_ALPHA_ENABLE_DEV_LOGIN !== "false";
}

export async function registerWithPassword(input: { displayName?: unknown; email?: unknown; ip?: string | null; password?: unknown; request?: Request; userAgent?: string | null }): Promise<AuthSession> {
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
  return createSessionForUser(userResult.rows[0].id, { authMethod: "password_register", ip: input.ip ?? null, request: input.request, userAgent: input.userAgent ?? null });
}

export async function loginWithPassword(input: { email?: unknown; ip?: string | null; password?: unknown; request?: Request; userAgent?: string | null }): Promise<AuthSession | null> {
  const email = normalizeAuthEmail(input.email);
  const password = String(input.password ?? "");
  if (!email || !password) return null;

  const user = await findUserWithPassword(email);
  if (!user?.password_hash || user.state !== "active") return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  await updateLastLogin(user.id, input.ip ?? null);
  return createSessionForUser(user.id, { authMethod: "password", ip: input.ip ?? null, request: input.request, userAgent: input.userAgent ?? null });
}

export async function createDevLoginSession(rawEmail: unknown, metadata: SessionMetadata = {}): Promise<AuthSession> {
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
  return createSessionForUser(userResult.rows[0].id, { ...metadata, authMethod: metadata.authMethod ?? "dev_login" });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserForSessionToken(token);
}

export async function getUserForSessionToken(token: string): Promise<AuthUser | null> {
  if (!token.trim()) return null;
  const tokenHash = hashSessionToken(token);
  const cached = readCachedSessionUser(tokenHash);
  if (cached !== undefined) return cloneAuthUserOrNull(cached);

  const inflight = sessionUserInflight.get(tokenHash);
  if (inflight) return cloneAuthUserOrNull(await inflight);

  const promise = loadUserForSessionTokenHash(tokenHash);
  sessionUserInflight.set(tokenHash, promise);

  try {
    const user = await promise;
    writeCachedSessionUser(tokenHash, user);
    return cloneAuthUserOrNull(user);
  } finally {
    sessionUserInflight.delete(tokenHash);
  }
}

async function loadUserForSessionTokenHash(tokenHash: string): Promise<AuthUser | null> {
  const result = await dbQuery<UserRow>(
    `
      SELECT ${USER_SELECT_U}
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_token_hash = $1
        AND s.expires_at > now()
        AND u.state = 'active'
      LIMIT 1
    `,
    [tokenHash],
  );
  const row = result.rows[0];
  return row ? userFromRow(row) : null;
}

export async function createSessionForUser(userId: string, metadata: SessionMetadata = {}): Promise<AuthSession> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User is unavailable.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const ip = metadata.ip ?? (metadata.request ? clientIp(metadata.request) : null);
  const userAgent = cleanNullableText(metadata.userAgent ?? metadata.request?.headers.get("user-agent"), 240);
  await dbQuery(
    `
      INSERT INTO user_sessions (
        user_id,
        session_token_hash,
        expires_at,
        created_at,
        created_ip,
        user_agent,
        device_label,
        auth_method,
        last_seen_at
      )
      VALUES ($1, $2, $3, now(), $4, $5, $6, $7, now())
    `,
    [user.id, tokenHash, expiresAt, ip, userAgent, deviceLabelFromUserAgent(userAgent), cleanNullableText(metadata.authMethod, 60) ?? "password"],
  );
  return { expiresAt, token, user };
}

export async function touchSessionActivity(token: string | undefined, request?: Request): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  await dbQuery(
    `
      UPDATE user_sessions
      SET last_seen_at = now(),
          user_agent = COALESCE(user_agent, $2),
          created_ip = COALESCE(created_ip, $3)
      WHERE session_token_hash = $1
        AND expires_at > now()
        AND revoked_at IS NULL
    `,
    [tokenHash, request ? cleanNullableText(request.headers.get("user-agent"), 240) : null, request ? clientIp(request) : null],
  ).catch(() => undefined);
}

export async function deleteSessionToken(token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  await dbQuery("DELETE FROM user_sessions WHERE session_token_hash = $1", [tokenHash]);
  sessionUserCache.delete(tokenHash);
  sessionUserInflight.delete(tokenHash);
}

export function userFromRow(row: UserRow | undefined): AuthUser {
  if (!row) throw new Error("User record was not returned.");
  return {
    id: row.id,
    email: row.email,
    role: normalizeUserRole(row.role),
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

function deviceLabelFromUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const lower = userAgent.toLowerCase();
  if (lower.includes("iphone")) return "iPhone";
  if (lower.includes("ipad")) return "iPad";
  if (lower.includes("android")) return "Android";
  if (lower.includes("firefox")) return "Firefox";
  if (lower.includes("safari") && !lower.includes("chrome")) return "Safari";
  if (lower.includes("chrome") || lower.includes("chromium")) return "Chrome";
  return "Browser";
}

function readCachedSessionUser(tokenHash: string): AuthUser | null | undefined {
  const cached = sessionUserCache.get(tokenHash);
  if (!cached) return undefined;
  if (cached.expiresAtMs <= Date.now()) {
    sessionUserCache.delete(tokenHash);
    return undefined;
  }
  return cached.user;
}

function writeCachedSessionUser(tokenHash: string, user: AuthUser | null): void {
  trimSessionUserCache();
  sessionUserCache.set(tokenHash, {
    expiresAtMs: Date.now() + (user ? SESSION_USER_CACHE_TTL_MS : SESSION_USER_NEGATIVE_CACHE_TTL_MS),
    user: cloneAuthUserOrNull(user),
  });
}

function trimSessionUserCache(): void {
  if (sessionUserCache.size < SESSION_USER_CACHE_MAX) return;
  const now = Date.now();
  for (const [key, value] of sessionUserCache) {
    if (value.expiresAtMs <= now) sessionUserCache.delete(key);
  }
  while (sessionUserCache.size >= SESSION_USER_CACHE_MAX) {
    const firstKey = sessionUserCache.keys().next().value;
    if (typeof firstKey !== "string") return;
    sessionUserCache.delete(firstKey);
  }
}

function cloneAuthUserOrNull(user: AuthUser | null): AuthUser | null {
  return user ? { ...user } : null;
}

function boundedAuthCacheMs(rawValue: string | undefined, fallbackMs: number, minMs: number, maxMs: number): number {
  if (!rawValue) return fallbackMs;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallbackMs;
  return Math.max(minMs, Math.min(maxMs, Math.round(value)));
}
