import "server-only";

import { NextResponse } from "next/server";
import { isAdminUser } from "./admin";
import { getCurrentUser, type AuthUser } from "./auth";

export type RouteAccess = "public" | "free" | "premium" | "admin";

export type EntitlementPlan = "anonymous" | "free" | "premium" | "admin";

export type Entitlement = {
  authenticated: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  plan: EntitlementPlan;
  user: AuthUser | null;
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
  return entitlementForUser(user);
}

export function entitlementForUser(user: AuthUser | null): Entitlement {
  const admin = isAdminUser(user);
  const premium = Boolean(user) && (admin || mockPremiumEnabled() || isPremiumEmail(user?.email ?? ""));
  const plan: EntitlementPlan = admin ? "admin" : premium ? "premium" : user ? "free" : "anonymous";

  return {
    authenticated: Boolean(user),
    isAdmin: admin,
    isPremium: premium,
    plan,
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

function mockPremiumEnabled(): boolean {
  return process.env.MARKET_ALPHA_MOCK_PREMIUM === "true";
}

function isPremiumEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return premiumEmailSet().has(normalized);
}

function premiumEmailSet(): Set<string> {
  return new Set(
    `${process.env.MARKET_ALPHA_PREMIUM_EMAILS ?? ""},${process.env.MARKET_ALPHA_MOCK_PREMIUM_EMAILS ?? ""}`
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
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
