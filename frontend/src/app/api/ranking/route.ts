import { NextResponse } from "next/server";
import { getFullRanking } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);

  if (!hasPremiumAccess(entitlement)) {
    const publicPreview = await getPublicMarketSummary();
    return NextResponse.json({
      rows: [],
      scanSafety: publicPreview.scanSafety,
      summary: publicPreview.summary,
      limited: true,
      message: "Live scanner rankings are locked.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  const [rawRows, scanSafety] = await Promise.all([getFullRanking(), getCurrentScanSafety()]);
  const rows = applyStaleDataSafetyToRows(rawRows, scanSafety);
  return NextResponse.json({ rows, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) });
}
