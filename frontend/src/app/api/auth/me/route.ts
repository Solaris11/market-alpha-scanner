import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { entitlementForUser, entitlementSummary } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ authenticated: false, entitlement: entitlementSummary(entitlementForUser(null)) });
    return NextResponse.json({ authenticated: true, user, entitlement: entitlementSummary(entitlementForUser(user)) });
  } catch {
    return NextResponse.json({ authenticated: false, entitlement: entitlementSummary(entitlementForUser(null)) });
  }
}
