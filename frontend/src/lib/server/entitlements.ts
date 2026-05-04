import "server-only";

import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { devConfigPremiumEnabled, productionMockPremiumEnabled, subscriptionGrantsPremium } from "@/lib/security/entitlement-policy";
import { isAdminUser } from "./admin";
import { getCurrentUser, type AuthUser } from "./auth";
import { dbQuery } from "./db";
import { emptyLegalStatus, getLegalStatus, type LegalStatus } from "./legal";

export type RouteAccess = "public" | "free" | "premium" | "admin";

export type EntitlementPlan = "anonymous" | "free" | "premium" | "admin";

export type Entitlement = {
  authenticated: boolean;
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

export const ROUTE_CLASSIFICATION: Record<RouteAccess, string[]> = {
  public: [
    "/",
    "/terminal",
    "/support",
    "/support/*",
    "/opportunities",
    "/symbol/[symbol]",
    "/api/health",
    "/api/auth/*",
    "/api/legal/status",
    "/api/stripe/webhook",
  ],
  free: [
    "/account",
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

  const [subscription, legalStatus] = await Promise.all([getUserSubscription(user.id), getLegalStatusForEntitlement(user.id)]);
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
    legalStatus,
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
    legalStatus: emptyLegalStatus(),
    plan,
    subscriptionStatus: null,
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
      console.warn("[entitlements] MARKET_ALPHA_MOCK_PREMIUM is ignored in production.");
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
