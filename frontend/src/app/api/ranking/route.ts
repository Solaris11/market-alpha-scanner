import { NextResponse } from "next/server";
import { getFullRanking } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewRankingRows } from "@/lib/server/premium-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [entitlement, rows] = await Promise.all([getEntitlement(), getFullRanking()]);

  if (!hasPremiumAccess(entitlement)) {
    return NextResponse.json({
      rows: previewRankingRows(rows),
      limited: true,
      message: "Limited scanner preview. Premium unlocks the full ranking.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  return NextResponse.json({ rows, limited: false, entitlement: entitlementSummary(entitlement) });
}
