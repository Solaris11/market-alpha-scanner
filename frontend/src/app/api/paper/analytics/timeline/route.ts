import { NextResponse } from "next/server";
import { getPaperAnalytics } from "@/lib/paper-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [entitlement, data] = await Promise.all([getEntitlement(), getPaperAnalytics()]);
  const premium = hasPremiumAccess(entitlement);
  return NextResponse.json({
    configured: data.configured,
    rows: premium ? data.timeline : data.timeline.slice(-10),
    error: data.error ?? null,
    limited: !premium,
    message: premium ? undefined : "Limited paper analytics preview. Premium unlocks full timeline data.",
    entitlement: entitlementSummary(entitlement),
  });
}
