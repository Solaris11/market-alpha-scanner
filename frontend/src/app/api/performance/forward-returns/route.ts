import { NextResponse } from "next/server";
import { getPerformanceData } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const entitlement = await getEntitlement();
  if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);
  const premium = hasPremiumAccess(entitlement);
  if (!premium) {
    return NextResponse.json({
      rows: [],
      state: "locked",
      lineCount: 0,
      limited: true,
      message: "Limited performance preview. Premium unlocks full validation data.",
      entitlement: entitlementSummary(entitlement),
    });
  }

  const performance = await getPerformanceData();

  return NextResponse.json({
    rows: performance.forwardReturns.rows,
    state: performance.forwardReturns.state,
    lineCount: performance.forwardReturns.lineCount,
    limited: false,
    entitlement: entitlementSummary(entitlement),
  });
}
