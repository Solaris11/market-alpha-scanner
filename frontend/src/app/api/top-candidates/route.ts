import { NextResponse } from "next/server";
import { getTopCandidates } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewRankingRows } from "@/lib/server/premium-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [entitlement, rows] = await Promise.all([getEntitlement(), getTopCandidates()]);

  if (!hasPremiumAccess(entitlement)) {
    return NextResponse.json({
      rows: previewRankingRows(rows),
      limited: true,
      message: "Limited scanner preview. Premium unlocks all top candidates.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  return NextResponse.json({ rows, limited: false, entitlement: entitlementSummary(entitlement) });
}
