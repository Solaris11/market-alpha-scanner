import { NextResponse } from "next/server";
import { getSymbolDetail } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToSymbolDetail } from "@/lib/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const entitlement = await getEntitlement();

  if (!hasPremiumAccess(entitlement)) {
    const publicPreview = await getPublicMarketSummary();
    return NextResponse.json({
      history: [],
      row: null,
      scanSafety: publicPreview.scanSafety,
      summary: publicPreview.summary,
      limited: true,
      message: "Live symbol research is locked.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  const [rawDetail, scanSafety] = await Promise.all([getSymbolDetail(symbol), getCurrentScanSafety()]);
  const detail = applyStaleDataSafetyToSymbolDetail(rawDetail, scanSafety);
  return NextResponse.json({ ...detail, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) });
}
