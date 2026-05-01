import { NextResponse } from "next/server";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewAlertMatches } from "@/lib/server/premium-preview";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entitlement = await getEntitlement();
  const scanSafety = await getCurrentScanSafety();

  if (!hasPremiumAccess(entitlement)) {
    const matches = await getActiveAlertMatches();
    return NextResponse.json({
      ...previewAlertMatches(matches),
      scanSafety,
      limited: true,
      message: "Limited alert preview. Premium unlocks full alert coverage.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  const matches = await getActiveAlertMatches();
  return NextResponse.json({ ...matches, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) });
}
