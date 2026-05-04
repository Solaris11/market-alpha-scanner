import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getEntitlementForUser, entitlementSummary } from "@/lib/server/entitlements";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/session", async () => {
    const user = await getCurrentUser().catch(() => null);
    return NextResponse.json({ authenticated: Boolean(user), user: user ?? null, entitlement: entitlementSummary(await getEntitlementForUser(user)) });
  });
}
