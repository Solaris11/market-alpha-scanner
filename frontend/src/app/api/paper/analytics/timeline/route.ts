import { NextResponse } from "next/server";
import { emptyPaperAnalytics, getPaperAnalytics } from "@/lib/paper-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entitlement = await getEntitlement();
  const premium = hasPremiumAccess(entitlement);
  const data = premium ? await getPaperAnalytics({ userId: entitlement.user?.id ?? null }) : emptyPaperAnalytics(true);
  return NextResponse.json({
    ok: !data.error,
    configured: data.configured,
    rows: premium ? data.timeline : data.timeline.slice(-10),
    error: data.error ?? null,
    limited: !premium,
    message: premium ? undefined : "Limited paper analytics preview. Premium unlocks full timeline data.",
    entitlement: entitlementSummary(entitlement),
  });
}
