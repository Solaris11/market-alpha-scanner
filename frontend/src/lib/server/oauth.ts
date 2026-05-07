import "server-only";

import { randomBytes } from "node:crypto";
import type { QueryResultRow } from "pg";
import { betaSignupDecisionForRequest } from "./beta-access";
import { createSessionForUser, normalizeAuthEmail, type AuthSession } from "./auth";
import { dbQuery, getDbPool } from "./db";

export const GOOGLE_OAUTH_STATE_COOKIE = "market_alpha_google_oauth_state";

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub?: string;
};

type UserIdRow = QueryResultRow & {
  user_id: string;
};

type ExistingUserRow = QueryResultRow & {
  id: string;
};

export function googleOAuthConfigured(): boolean {
  return Boolean(getGoogleOAuthConfig());
}

export function createGoogleOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function googleOAuthStateCookieOptions(maxAge = 600) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function googleAuthUrl(state: string): string | null {
  const config = getGoogleOAuthConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: config.clientId,
    prompt: "select_account",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function authenticateGoogleCode(code: string, ip: string | null): Promise<AuthSession> {
  const config = getGoogleOAuthConfig();
  if (!config) throw new Error("Google OAuth is not configured.");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const tokenPayload = (await tokenResponse.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!tokenResponse.ok || !tokenPayload?.access_token) throw new Error("Google OAuth token exchange failed.");

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const profile = (await profileResponse.json().catch(() => null)) as GoogleUserInfo | null;
  const providerAccountId = String(profile?.sub ?? "").trim();
  const email = normalizeAuthEmail(profile?.email);
  if (!profileResponse.ok || !providerAccountId || !email) throw new Error("Google OAuth profile is unavailable.");

  const userId = await upsertOAuthUser({
    email,
    emailVerified: Boolean(profile?.email_verified),
    name: profile?.name ?? null,
    picture: profile?.picture ?? null,
    providerAccountId,
  });
  await dbQuery("UPDATE users SET last_login_at = now(), last_login_ip = $2, updated_at = now() WHERE id = $1", [userId, ip]);
  return createSessionForUser(userId);
}

function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

async function upsertOAuthUser(input: {
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  providerAccountId: string;
}): Promise<string> {
  const clientPool = getDbPool();
  if (!clientPool) throw new Error("DATABASE_URL is not configured.");
  const client = await clientPool.connect();
  try {
    await client.query("BEGIN");
    const linked = await client.query<UserIdRow>(
      "SELECT user_id::text FROM user_oauth_accounts WHERE provider = 'google' AND provider_account_id = $1 LIMIT 1",
      [input.providerAccountId],
    );
    let userId = linked.rows[0]?.user_id ?? null;

    if (!userId) {
      const existingUser = await client.query<ExistingUserRow>("SELECT id::text FROM users WHERE email = $1 AND state = 'active' LIMIT 1", [input.email]);
      userId = existingUser.rows[0]?.id ?? null;
      if (!userId) {
        const betaDecision = betaSignupDecisionForRequest({ email: input.email });
        if (!betaDecision.allowed) throw new Error("Closed beta signup requires access.");
        const createdUser = await client.query<ExistingUserRow>(
          `
            INSERT INTO users (
              email,
              display_name,
              email_verified,
              email_verified_at,
              profile_image_url,
              state,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, CASE WHEN $3 THEN now() ELSE NULL END, $4, 'active', now(), now())
            RETURNING id::text
          `,
          [input.email, input.name, input.emailVerified, input.picture],
        );
        userId = createdUser.rows[0].id;
      }

      await client.query(
        `
          INSERT INTO user_oauth_accounts (user_id, provider, provider_account_id, email, created_at)
          VALUES ($1, 'google', $2, $3, now())
          ON CONFLICT (provider, provider_account_id) DO NOTHING
        `,
        [userId, input.providerAccountId, input.email],
      );
    }

    await client.query(
      `
        UPDATE users
        SET
          email_verified = email_verified OR $2,
          email_verified_at = CASE WHEN $2 AND email_verified_at IS NULL THEN now() ELSE email_verified_at END,
          profile_image_url = COALESCE(profile_image_url, $3),
          updated_at = now()
        WHERE id = $1
      `,
      [userId, input.emailVerified, input.picture],
    );
    await client.query("COMMIT");
    return userId;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
