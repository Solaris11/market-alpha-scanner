import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { entitlementForUser, entitlementSummary } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json({ authenticated: Boolean(user), user: user ?? null, entitlement: entitlementSummary(entitlementForUser(user)) });
}
