import { NextResponse } from "next/server";
import { getSymbolHistoryLookup } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { getPublicMarketSummary } from "@/lib/server/public-signal-data";
import { getCurrentScanSafety } from "@/lib/server/stale-data-safety";
import { applyStaleDataSafetyToRows } from "@/lib/stale-data-safety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { symbol } = await context.params;
  const cleaned = symbol.trim().toUpperCase();
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);

  if (!hasPremiumAccess(entitlement)) {
    const publicPreview = await getPublicMarketSummary();
    return NextResponse.json(
      {
        rows: [],
        matchingRows: 0,
        scanSafety: publicPreview.scanSafety,
        summary: publicPreview.summary,
        limited: true,
        message: "Live symbol history is locked.",
        entitlement: entitlementSummary(entitlement),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const [rawResult, scanSafety] = await Promise.all([getSymbolHistoryLookup(cleaned), getCurrentScanSafety()]);
  const result = { ...rawResult, rows: applyStaleDataSafetyToRows(rawResult.rows, scanSafety) };
  return NextResponse.json(
    { symbol: cleaned, ...result, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
