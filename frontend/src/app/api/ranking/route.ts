import { NextResponse } from "next/server";
import { getFullRanking } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewRankingRows } from "@/lib/server/premium-preview";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [entitlement, rawRows, scanSafety] = await Promise.all([getEntitlement(), getFullRanking(), getCurrentScanSafety()]);
  const rows = applyStaleDataSafetyToRows(rawRows, scanSafety);

  if (!hasPremiumAccess(entitlement)) {
    return NextResponse.json({
      rows: previewRankingRows(rows),
      scanSafety,
      limited: true,
      message: "Limited scanner preview. Premium unlocks the full ranking.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  return NextResponse.json({ rows, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) });
}
