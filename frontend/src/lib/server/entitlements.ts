import "server-only";

import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { devConfigPremiumEnabled, productionMockPremiumEnabled, subscriptionGrantsPremium } from "@/lib/security/entitlement-policy";
import { isAdminUser } from "./admin";
import { getCurrentUser, type AuthUser } from "./auth";
import { dbQuery } from "./db";

export type RouteAccess = "public" | "free" | "premium" | "admin";

export type EntitlementPlan = "anonymous" | "free" | "premium" | "admin";

export type Entitlement = {
  authenticated: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  plan: EntitlementPlan;
  subscriptionStatus: string | null;
  user: AuthUser | null;
};

type SubscriptionRow = QueryResultRow & {
  current_period_end: Date | string | null;
  plan: string | null;
  status: string | null;
};

export const ROUTE_CLASSIFICATION: Record<RouteAccess, string[]> = {
  public: [
    "/",
    "/terminal",
    "/opportunities",
    "/symbol/[symbol]",
    "/api/health",
    "/api/auth/*",
  ],
  free: [
    "/account",
    "/paper",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/session",
    "/api/profile",
    "/api/user/profile",
    "/api/user/watchlist",
    "/api/user/risk-profile",
    "/api/watchlist",
    "/api/risk-profile",
    "/api/paper/account",
    "/api/paper/events",
    "/api/paper/positions",
    "/api/paper/open",
  ],
  premium: [
    "/performance",
    "/history",
    "/alerts",
    "/advanced",
    "/api/ranking",
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

  const subscription = await getUserSubscription(user.id);
  const admin = isAdminUser(user);
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
  const premium = subscriptionPremium || devPremium;
  const plan: EntitlementPlan = admin ? "admin" : premium ? "premium" : "free";

  return {
    authenticated: true,
    isAdmin: admin,
    isPremium: premium,
    plan,
    subscriptionStatus: subscription?.status ?? null,
    user,
  };
}

export function entitlementForUser(user: AuthUser | null): Entitlement {
  const admin = isAdminUser(user);
  const devPremium = Boolean(user) && devConfigPremiumEnabled(user?.email ?? "");
  const plan: EntitlementPlan = admin ? "admin" : devPremium ? "premium" : user ? "free" : "anonymous";

  return {
    authenticated: Boolean(user),
    isAdmin: admin,
    isPremium: devPremium,
    plan,
    subscriptionStatus: null,
    user,
  };
}

export function hasPremiumAccess(entitlement: Entitlement): boolean {
  return entitlement.isPremium || entitlement.isAdmin;
}

export function entitlementSummary(entitlement: Entitlement): Omit<Entitlement, "user"> {
  return {
    authenticated: entitlement.authenticated,
    isAdmin: entitlement.isAdmin,
    isPremium: entitlement.isPremium,
    plan: entitlement.plan,
    subscriptionStatus: entitlement.subscriptionStatus,
  };
}

export function premiumDeniedStatus(entitlement: Entitlement): 401 | 403 {
  return entitlement.authenticated ? 403 : 401;
}

export function premiumDeniedMessage(entitlement: Entitlement): string {
  return entitlement.authenticated ? "Premium plan required." : "Sign in to access premium features.";
}

export function premiumDeniedResponse(entitlement: Entitlement): NextResponse<{ ok: false; limited: true; message: string; entitlement: Omit<Entitlement, "user"> }> {
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
      console.warn("[entitlements] MARKET_ALPHA_MOCK_PREMIUM is ignored in production.");
    }
    console.warn("[entitlements] subscription lookup unavailable; defaulting to free access.");
    return null;
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
