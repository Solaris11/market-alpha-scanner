import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "./auth";
import { rateLimit, rateLimitExceededResponse } from "./rate-limit";

export const CSRF_COOKIE_NAME = "market_alpha_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

const CSRF_TTL_MS = 1000 * 60 * 60 * 8;
const DEFAULT_PUBLIC_APP_URL = "https://app.marketalpha.co";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function canonicalAppUrl(): URL {
  const raw = process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim() || (process.env.NODE_ENV === "production" ? DEFAULT_PUBLIC_APP_URL : "http://localhost:3001");
  try {
    return new URL(raw);
  } catch {
    return new URL(process.env.NODE_ENV === "production" ? DEFAULT_PUBLIC_APP_URL : "http://localhost:3001");
  }
}

export function requestIp(request: Request): string {
  const cfIp = cleanIp(request.headers.get("cf-connecting-ip"));
  if (cfIp) return cfIp;

  const forwardedIp = cleanIp(request.headers.get("x-forwarded-for")?.split(",")[0]);
  if (forwardedIp) return forwardedIp;

  return cleanIp(request.headers.get("x-real-ip")) ?? "unknown";
}

export function validateMutationRequest(request: Request): NextResponse<{ ok: false; message: string }> | null {
  if (process.env.NODE_ENV !== "production") return null;

  const hostHeaders = [request.headers.get("host"), request.headers.get("x-forwarded-host")].filter((value): value is string => Boolean(value));
  if (!hostHeaders.length || hostHeaders.some((host) => !isAllowedHost(host))) {
    return forbidden("Request host is not allowed.");
  }

  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return forbidden("Request origin is not allowed.");
  }

  return null;
}

export async function rateLimitRequest(request: Request, scope: string, options: { limit: number; windowMs: number }): Promise<NextResponse<{ error: "rate_limited"; retryAfter: number }> | null> {
  const ip = requestIp(request);
  const userId = await userIdFromRequest(request);
  try {
    const result = await rateLimit({
      key: `${scope}:ip=${ip}:user=${userId ?? "anonymous"}`,
      limit: options.limit,
      scope,
      windowMs: options.windowMs,
    });
    if (!result.allowed) {
      return rateLimitExceededResponse(result.retryAfter);
    }
  } catch (error) {
    console.warn("[rate-limit] check failed closed", error instanceof Error ? error.message : error);
    return rateLimitExceededResponse(60);
  }
  return null;
}

async function userIdFromRequest(request: Request): Promise<string | null> {
  const sessionToken = sessionTokenFromRequest(request);
  if (!sessionToken) return null;
  try {
    const user = await getUserForSessionToken(sessionToken);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export function issueCsrfToken(request: Request): NextResponse<{ csrfToken?: string; message?: string; ok: boolean }> {
  const sessionToken = sessionTokenFromRequest(request);
  if (!sessionToken) {
    return NextResponse.json({ ok: false, message: "Sign in to continue." }, { status: 401 });
  }

  const token = createCsrfToken(sessionToken);
  const response = NextResponse.json({ ok: true, csrfToken: token });
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    ...sessionCookieOptions(new Date(Date.now() + CSRF_TTL_MS)),
  });
  return response;
}

export function clearCsrfCookie(response: NextResponse): void {
  response.cookies.set(CSRF_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}

export function requireCsrf(request: Request): NextResponse<{ ok: false; message: string }> | null {
  const sessionToken = sessionTokenFromRequest(request);
  const headerToken = request.headers.get(CSRF_HEADER_NAME)?.trim() ?? "";
  const cookieToken = csrfCookieFromRequest(request);

  if (!sessionToken || !headerToken || !cookieToken || headerToken !== cookieToken || !verifyCsrfToken(headerToken, sessionToken)) {
    return forbidden("Security check failed.");
  }

  return null;
}

function createCsrfToken(sessionToken: string): string {
  const issuedAt = Date.now().toString(36);
  const nonce = randomBytes(24).toString("base64url");
  const payload = `${issuedAt}.${nonce}`;
  return `${payload}.${signCsrfPayload(payload, sessionToken)}`;
}

function verifyCsrfToken(token: string, sessionToken: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issuedAt, nonce, signature] = parts;
  const issuedAtMs = Number.parseInt(issuedAt, 36);
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > CSRF_TTL_MS || issuedAtMs > Date.now() + 60_000) {
    return false;
  }

  const payload = `${issuedAt}.${nonce}`;
  return safeEqual(signature, signCsrfPayload(payload, sessionToken));
}

function signCsrfPayload(payload: string, sessionToken: string): string {
  return createHmac("sha256", sessionToken).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionTokenFromRequest(request: Request): string | null {
  return cookieValue(request, SESSION_COOKIE_NAME);
}

function csrfCookieFromRequest(request: Request): string | null {
  return cookieValue(request, CSRF_COOKIE_NAME);
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return rawValue.join("=");
      }
    }
  }
  return null;
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return isAllowedHost(parsed.host);
  } catch {
    return false;
  }
}

function isAllowedHost(value: string): boolean {
  const host = normalizeHost(value);
  if (!host) return false;
  if (LOCAL_HOSTS.has(host)) return true;
  return host === canonicalAppUrl().hostname.toLowerCase();
}

function normalizeHost(value: string | null | undefined): string | null {
  const first = String(value ?? "").split(",")[0].trim().toLowerCase();
  if (!first) return null;
  if (first.startsWith("[") && first.includes("]")) return first.slice(1, first.indexOf("]"));
  return first.split(":")[0] || null;
}

function cleanIp(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text && text.length <= 80 ? text : null;
}

function forbidden(message: string): NextResponse<{ ok: false; message: string }> {
  return NextResponse.json({ ok: false, message }, { status: 403 });
}
