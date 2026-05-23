import "server-only";

import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { betaPremiumAccessForEmail, devConfigPremiumEnabled, productionMockPremiumEnabled, subscriptionGrantsPremium } from "@/lib/security/entitlement-policy";
import { isAdminUser } from "./admin";
import { getCurrentUser, type AuthUser } from "./auth";
import { dbQuery } from "./db";
import { emptyLegalStatus, getLegalStatus, type LegalStatus } from "./legal";

export type RouteAccess = "public" | "free" | "premium" | "admin";

export type EntitlementPlan = "anonymous" | "free" | "premium" | "admin";

export type Entitlement = {
  authenticated: boolean;
  betaAccess: boolean;
  betaAccessLabel: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  legalStatus: LegalStatus;
  plan: EntitlementPlan;
  subscriptionStatus: string | null;
  user: AuthUser | null;
};

type SubscriptionRow = QueryResultRow & {
  current_period_end: Date | string | null;
  plan: string | null;
  status: string | null;
};

type EntitlementCacheEntry = {
  entitlement: Entitlement;
  expiresAtMs: number;
};

const ENTITLEMENT_CACHE_TTL_MS = 2_000;
const ENTITLEMENT_CACHE_MAX = 500;
const entitlementCache = new Map<string, EntitlementCacheEntry>();
const entitlementInflight = new Map<string, Promise<Entitlement>>();

export const ROUTE_CLASSIFICATION: Record<RouteAccess, string[]> = {
  public: [
    "/",
    "/terminal",
    "/support",
    "/support/*",
    "/intelligence",
    "/intelligence/*",
    "/discover",
    "/opportunities",
    "/symbol/[symbol]",
    "/api/health",
    "/api/auth/*",
    "/api/legal/status",
    "/api/stripe/webhook",
    "/api/stripe/test/webhook",
  ],
  free: [
    "/account",
    "/mobile",
    "/paper",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/session",
    "/api/account",
    "/api/support/tickets",
    "/api/support/tickets/*",
    "/api/profile",
    "/api/notifications",
    "/api/notifications/read",
    "/api/notifications/read-all",
    "/api/push/status",
    "/api/push/subscribe",
    "/api/push/unsubscribe",
    "/api/user/profile",
    "/api/user/watchlist",
    "/api/user/risk-profile",
    "/api/watchlist",
    "/api/risk-profile",
    "/api/legal/accept",
    "/api/support/contact",
    "/api/support/chat",
    "/api/stripe/checkout",
    "/api/stripe/portal",
    "/api/stripe/test/checkout",
    "/api/stripe/test/portal",
    "/api/paper/account",
    "/api/paper/events",
    "/api/paper/positions",
    "/api/paper/open",
  ],
  premium: [
    "/dashboard",
    "/team",
    "/community",
    "/developers",
    "/strategy-labs",
    "/performance",
    "/history",
    "/alerts",
    "/advanced",
    "/api/ranking",
    "/api/discovery",
    "/api/live-intelligence",
    "/api/live-intelligence/*",
    "/api/community",
    "/api/community/*",
    "/api/developer/*",
    "/api/v1/*",
    "/api/team/*",
    "/api/mobile/intelligence",
    "/api/push/intelligence",
    "/api/push/test",
    "/api/top-candidates",
    "/api/symbol/[symbol]",
    "/api/history/latest",
    "/api/history/symbol/[symbol]",
    "/api/performance/forward-returns",
    "/api/alerts/active-matches",
    "/api/alerts/rules",
    "/api/alerts/rules/[id]",
    "/api/paper/analytics/*",
  ],
  admin: [
    "/admin",
    "/admin/*",
    "/api/admin",
    "/api/admin/*",
    "/api/run-scanner",
    "/api/run-analysis",
    "/api/alerts/test-send",
    "/api/price-history/[symbol]",
  ],
};

export async function getEntitlement(): Promise<Entitlement> {
  const user = await getCurrentUser().catch(() => null);
  return getEntitlementForUser(user);
}

export async function getEntitlementForUser(user: AuthUser | null): Promise<Entitlement> {
  if (!user) return entitlementForUser(null);

  const cacheKey = entitlementCacheKey(user);
  const cached = readCachedEntitlement(cacheKey);
  if (cached) return cloneEntitlement(cached);

  const inflight = entitlementInflight.get(cacheKey);
  if (inflight) return cloneEntitlement(await inflight);

  const promise = loadEntitlementForUser(user);
  entitlementInflight.set(cacheKey, promise);
  try {
    const entitlement = await promise;
    writeCachedEntitlement(cacheKey, entitlement);
    return cloneEntitlement(entitlement);
  } finally {
    entitlementInflight.delete(cacheKey);
  }
}

async function loadEntitlementForUser(user: AuthUser): Promise<Entitlement> {
  const [subscription, legalStatus] = await Promise.all([getUserSubscription(user.id), getLegalStatusForEntitlement(user.id)]);
  const admin = isAdminUser(user);
  const betaPremium = betaPremiumAccessForEmail(user.email);
  const subscriptionPremium = subscriptionGrantsPremium(
    subscription
      ? {
          currentPeriodEnd: subscription.current_period_end,
          plan: subscription.plan,
          status: subscription.status,
        }
      : null,
  );
  const devPremium = devConfigPremiumEnabled(user.email);
  const premium = subscriptionPremium || devPremium || betaPremium.active;
  const plan: EntitlementPlan = admin ? "admin" : premium ? "premium" : "free";

  return {
    authenticated: true,
    betaAccess: betaPremium.active,
    betaAccessLabel: betaPremium.label,
    isAdmin: admin,
    isPremium: premium,
    legalStatus,
    plan,
    subscriptionStatus: subscription?.status ?? (betaPremium.active ? "beta" : null),
    user,
  };
}

export function entitlementForUser(user: AuthUser | null): Entitlement {
  const admin = isAdminUser(user);
  const devPremium = Boolean(user) && devConfigPremiumEnabled(user?.email ?? "");
  const betaPremium = user ? betaPremiumAccessForEmail(user.email) : { active: false, label: null };
  const premium = devPremium || betaPremium.active;
  const plan: EntitlementPlan = admin ? "admin" : premium ? "premium" : user ? "free" : "anonymous";

  return {
    authenticated: Boolean(user),
    betaAccess: betaPremium.active,
    betaAccessLabel: betaPremium.label,
    isAdmin: admin,
    isPremium: premium,
    legalStatus: emptyLegalStatus(),
    plan,
    subscriptionStatus: betaPremium.active ? "beta" : null,
    user,
  };
}

export function hasPremiumAccess(entitlement: Entitlement): boolean {
  return !requiresLegalAcceptance(entitlement) && (entitlement.isPremium || entitlement.isAdmin);
}

export function requiresLegalAcceptance(entitlement: Entitlement): boolean {
  return entitlement.authenticated && !entitlement.legalStatus.allAccepted;
}

export function entitlementSummary(entitlement: Entitlement): Omit<Entitlement, "user"> {
  return {
    authenticated: entitlement.authenticated,
    betaAccess: entitlement.betaAccess,
    betaAccessLabel: entitlement.betaAccessLabel,
    isAdmin: entitlement.isAdmin,
    isPremium: entitlement.isPremium,
    legalStatus: entitlement.legalStatus,
    plan: entitlement.plan,
    subscriptionStatus: entitlement.subscriptionStatus,
  };
}

export function premiumDeniedStatus(entitlement: Entitlement): 401 | 403 {
  return entitlement.authenticated ? 403 : 401;
}

export function premiumDeniedMessage(entitlement: Entitlement): string {
  if (requiresLegalAcceptance(entitlement)) return "Legal acceptance required.";
  return entitlement.authenticated ? "Premium plan required." : "Sign in to access premium features.";
}

export function premiumDeniedResponse(entitlement: Entitlement): NextResponse<{ ok: false; error?: string; limited: true; message: string; entitlement: Omit<Entitlement, "user"> }> {
  if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);
  return NextResponse.json(
    {
      ok: false,
      limited: true,
      message: premiumDeniedMessage(entitlement),
      entitlement: entitlementSummary(entitlement),
    },
    { status: premiumDeniedStatus(entitlement) },
  );
}

export function legalNotAcceptedResponse(entitlement: Entitlement): NextResponse<{ ok: false; error: "legal_not_accepted"; limited: true; message: string; entitlement: Omit<Entitlement, "user"> }> {
  return NextResponse.json(
    {
      ok: false,
      error: "legal_not_accepted",
      limited: true,
      message: "Accept the Terms, Privacy Policy, and Risk Disclosure to continue.",
      entitlement: entitlementSummary(entitlement),
    },
    { status: 403 },
  );
}

export function classifyRoute(pathname: string): RouteAccess {
  if (matchesRoute(pathname, ROUTE_CLASSIFICATION.admin)) return "admin";
  if (matchesRoute(pathname, ROUTE_CLASSIFICATION.premium)) return "premium";
  if (matchesRoute(pathname, ROUTE_CLASSIFICATION.free)) return "free";
  return "public";
}

async function getUserSubscription(userId: string): Promise<SubscriptionRow | null> {
  try {
    const result = await dbQuery<SubscriptionRow>(
      `
        SELECT status, plan, current_period_end
        FROM user_subscriptions
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  } catch {
    if (productionMockPremiumEnabled()) {
      console.warn("[entitlements] mock premium env is ignored in production.");
    }
    console.warn("[entitlements] subscription lookup unavailable; defaulting to free access.");
    return null;
  }
}

async function getLegalStatusForEntitlement(userId: string): Promise<LegalStatus> {
  try {
    return await getLegalStatus(userId);
  } catch {
    console.warn("[entitlements] legal status lookup unavailable; blocking authenticated product access.");
    return emptyLegalStatus();
  }
}

function matchesRoute(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => routePatternToRegExp(pattern).test(pathname));
}

function routePatternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\/\*/g, "(?:/.*)?")
    .replace(/\\\[.+?\\\]/g, "[^/]+");
  return new RegExp(`^${escaped}/?$`);
}

function entitlementCacheKey(user: AuthUser): string {
  return `${user.id}:${user.email}:${user.role}:${user.state}`;
}

function readCachedEntitlement(cacheKey: string): Entitlement | null {
  const cached = entitlementCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAtMs <= Date.now()) {
    entitlementCache.delete(cacheKey);
    return null;
  }
  return cached.entitlement;
}

function writeCachedEntitlement(cacheKey: string, entitlement: Entitlement): void {
  trimEntitlementCache();
  entitlementCache.set(cacheKey, {
    entitlement: cloneEntitlement(entitlement),
    expiresAtMs: Date.now() + ENTITLEMENT_CACHE_TTL_MS,
  });
}

function trimEntitlementCache(): void {
  if (entitlementCache.size < ENTITLEMENT_CACHE_MAX) return;
  const now = Date.now();
  for (const [key, value] of entitlementCache) {
    if (value.expiresAtMs <= now) entitlementCache.delete(key);
  }
  while (entitlementCache.size >= ENTITLEMENT_CACHE_MAX) {
    const firstKey = entitlementCache.keys().next().value;
    if (typeof firstKey !== "string") return;
    entitlementCache.delete(firstKey);
  }
}

function cloneEntitlement(entitlement: Entitlement): Entitlement {
  return {
    authenticated: entitlement.authenticated,
    betaAccess: entitlement.betaAccess,
    betaAccessLabel: entitlement.betaAccessLabel,
    isAdmin: entitlement.isAdmin,
    isPremium: entitlement.isPremium,
    legalStatus: { ...entitlement.legalStatus },
    plan: entitlement.plan,
    subscriptionStatus: entitlement.subscriptionStatus,
    user: entitlement.user ? { ...entitlement.user } : null,
  };
}
