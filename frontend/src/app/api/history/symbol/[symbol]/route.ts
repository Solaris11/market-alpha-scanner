import { NextResponse } from "next/server";
import { getSymbolHistoryLookup } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewSymbolHistoryRows } from "@/lib/server/premium-preview";
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
  const [entitlement, rawResult, scanSafety] = await Promise.all([getEntitlement(), getSymbolHistoryLookup(cleaned), getCurrentScanSafety()]);
  const result = { ...rawResult, rows: applyStaleDataSafetyToRows(rawResult.rows, scanSafety) };

  if (!hasPremiumAccess(entitlement)) {
    const previewRows = previewSymbolHistoryRows(result.rows);
    return NextResponse.json(
      {
        symbol: cleaned,
        ...result,
        rows: previewRows,
        matchingRows: previewRows.length,
        scanSafety,
        limited: true,
        message: "Limited history preview. Premium unlocks full signal history.",
        entitlement: entitlementSummary(entitlement),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { symbol: cleaned, ...result, scanSafety, limited: false, entitlement: entitlementSummary(entitlement) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
