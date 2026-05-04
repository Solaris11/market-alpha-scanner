import { NextResponse } from "next/server";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";
import { entitlementSummary, getEntitlement, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);
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

  const matches = await getActiveAlertMatches(entitlement.user?.id ?? null);
  return NextResponse.json({ ...matches, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) });
}
