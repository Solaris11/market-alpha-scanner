import { NextResponse } from "next/server";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewAlertMatches } from "@/lib/server/premium-preview";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [entitlement, matches, scanSafety] = await Promise.all([getEntitlement(), getActiveAlertMatches(), getCurrentScanSafety()]);

  if (!hasPremiumAccess(entitlement)) {
    return NextResponse.json({
      ...previewAlertMatches(matches),
      scanSafety,
      limited: true,
      message: "Limited alert preview. Premium unlocks full alert coverage.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  return NextResponse.json({ ...matches, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) });
}
