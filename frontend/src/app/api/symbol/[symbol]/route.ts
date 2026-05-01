import { NextResponse } from "next/server";
import { getSymbolDetail } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewSymbolDetail } from "@/lib/server/premium-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const [entitlement, detail] = await Promise.all([getEntitlement(), getSymbolDetail(symbol)]);

  if (!hasPremiumAccess(entitlement)) {
    return NextResponse.json({
      ...previewSymbolDetail(detail),
      limited: true,
      message: "Limited symbol preview. Premium unlocks full trade plan details.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  return NextResponse.json({ ...detail, limited: false, entitlement: entitlementSummary(entitlement) });
}
