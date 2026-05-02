import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getEntitlementForUser, entitlementSummary } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ authenticated: false, entitlement: entitlementSummary(await getEntitlementForUser(null)) });
    return NextResponse.json({ authenticated: true, user, entitlement: entitlementSummary(await getEntitlementForUser(user)) });
  } catch {
    return NextResponse.json({ authenticated: false, entitlement: entitlementSummary(await getEntitlementForUser(null)) });
  }
}
