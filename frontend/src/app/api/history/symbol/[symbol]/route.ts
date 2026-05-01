import { NextResponse } from "next/server";
import { getSymbolHistoryLookup } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewSymbolHistoryRows } from "@/lib/server/premium-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { symbol } = await context.params;
  const cleaned = symbol.trim().toUpperCase();
  const [entitlement, result] = await Promise.all([getEntitlement(), getSymbolHistoryLookup(cleaned)]);

  if (!hasPremiumAccess(entitlement)) {
    const previewRows = previewSymbolHistoryRows(result.rows);
    return NextResponse.json(
      {
        symbol: cleaned,
        ...result,
        rows: previewRows,
        matchingRows: previewRows.length,
        limited: true,
        message: "Limited history preview. Premium unlocks full signal history.",
        entitlement: entitlementSummary(entitlement),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { symbol: cleaned, ...result, limited: false, entitlement: entitlementSummary(entitlement) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
