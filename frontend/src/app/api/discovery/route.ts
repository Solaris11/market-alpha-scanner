import { NextResponse } from "next/server";
import { entitlementSummary, getEntitlement, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { loadIntelligenceDiscoverySystem } from "@/lib/server/discovery-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { buildLimitedIntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/discovery", async () => {
    const entitlement = await getEntitlement();
    if (requiresLegalAcceptance(entitlement)) return legalNotAcceptedResponse(entitlement);

    if (!hasPremiumAccess(entitlement)) {
      return NextResponse.json({
        entitlement: entitlementSummary(entitlement),
        limited: true,
        message: entitlement.authenticated ? "Premium plan required for full-universe discovery." : "Sign in to explore the full scanner universe.",
        ok: false,
        system: buildLimitedIntelligenceDiscoverySystem("Full-universe discovery is locked until premium scanner access is available."),
      }, { headers: { "Cache-Control": "no-store" }, status: entitlement.authenticated ? 403 : 401 });
    }

    const system = await loadIntelligenceDiscoverySystem(entitlement.user?.id ?? null);
    return NextResponse.json({ entitlement: entitlementSummary(entitlement), limited: false, ok: true, system }, { headers: { "Cache-Control": "no-store" } });
  });
}
