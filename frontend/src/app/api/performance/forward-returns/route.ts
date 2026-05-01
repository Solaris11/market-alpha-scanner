import { NextResponse } from "next/server";
import { getPerformanceData } from "@/lib/scanner-data";
import { entitlementSummary, getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { previewCsvRows } from "@/lib/server/premium-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [entitlement, performance] = await Promise.all([getEntitlement(), getPerformanceData()]);
  const premium = hasPremiumAccess(entitlement);
  const rows = premium ? performance.forwardReturns.rows : previewCsvRows(performance.forwardReturns.rows);

  return NextResponse.json({
    rows,
    state: performance.forwardReturns.state,
    lineCount: performance.forwardReturns.lineCount,
    limited: !premium,
    message: premium ? undefined : "Limited performance preview. Premium unlocks full validation data.",
    entitlement: entitlementSummary(entitlement),
  });
}
