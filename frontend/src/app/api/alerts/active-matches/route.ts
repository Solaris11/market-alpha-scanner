import { NextResponse } from "next/server";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entitlement = await getEntitlement();
  const scanSafety = await getCurrentScanSafety();

  if (!hasPremiumAccess(entitlement)) {
    return NextResponse.json({
      data_status: scanSafety.status,
      generated_at: new Date().toISOString(),
      matches: [],
      scanSafety,
      limited: true,
      message: "Live alert matches are locked.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  const matches = await getActiveAlertMatches();
  return NextResponse.json({ ...matches, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) });
}
