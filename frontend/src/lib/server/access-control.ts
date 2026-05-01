import "server-only";

import { NextResponse } from "next/server";
import { isAdminUser } from "./admin";
import { getCurrentUser, type AuthUser } from "./auth";

type AccessGranted = {
  ok: true;
  user: AuthUser;
};

type AccessDenied = {
  ok: false;
  response: NextResponse<{ ok: false; message: string }>;
};

export type AccessResult = AccessGranted | AccessDenied;

export function accessDenied(message: string, status: 401 | 403 = 401): NextResponse<{ ok: false; message: string }> {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function requireUser(message = "Sign in to continue."): Promise<AccessResult> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return { ok: false, response: accessDenied(message, 401) };
  }
  return { ok: true, user };
}

export async function requireAdmin(): Promise<AccessResult> {
  const access = await requireUser("Admin access required.");
  if (!access.ok) return access;
  if (!isAdminUser(access.user)) {
    return { ok: false, response: accessDenied("Admin access required.", 403) };
  }
  return access;
}

export async function requirePremium(): Promise<AccessResult> {
  const access = await requireUser("Sign in to access premium features.");
  if (!access.ok) return access;

  // Placeholder for Phase 3 entitlements. Deny by default until Stripe-backed
  // premium state exists so paid gates cannot accidentally fail open.
  return { ok: false, response: accessDenied("Premium access required.", 403) };
}
