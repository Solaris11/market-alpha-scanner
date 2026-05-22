import { NextResponse } from "next/server";
import { entitlementSummary, getEntitlement, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance } from "@/lib/server/entitlements";
import { loadIntelligenceDiscoverySystemWithMeta } from "@/lib/server/discovery-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { buildLimitedIntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";
import { recordDiscoveryApiTiming, type DiscoveryCacheStatus, type DiscoveryPerformanceSnapshot } from "@/lib/discovery-performance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/discovery", async () => {
    const startedAt = Date.now();
    const entitlement = await getEntitlement();
    if (requiresLegalAcceptance(entitlement)) {
      const response = legalNotAcceptedResponse(entitlement);
      return withDiscoveryPerformanceHeaders(response, startedAt, "limited");
    }

    if (!hasPremiumAccess(entitlement)) {
      const status = entitlement.authenticated ? 403 : 401;
      const response = NextResponse.json({
        entitlement: entitlementSummary(entitlement),
        limited: true,
        message: entitlement.authenticated ? "Premium plan required for full-universe discovery." : "Sign in to explore the full scanner universe.",
        ok: false,
        system: buildLimitedIntelligenceDiscoverySystem("Full-universe discovery is locked until premium scanner access is available."),
      }, { headers: { "Cache-Control": "no-store" }, status });
      return withDiscoveryPerformanceHeaders(response, startedAt, "limited");
    }

    const { meta, system } = await loadIntelligenceDiscoverySystemWithMeta(entitlement.user?.id ?? null);
    const latencyMs = Date.now() - startedAt;
    const performance = recordDiscoveryApiTiming({ cacheStatus: meta.cacheStatus, latencyMs, statusCode: 200 });
    const response = NextResponse.json({
      entitlement: entitlementSummary(entitlement),
      limited: false,
      ok: true,
      performance,
      system,
    }, { headers: { "Cache-Control": "no-store" } });
    response.headers.set("X-TradeVeto-Discovery-Build-Ms", String(meta.durationMs));
    response.headers.set("X-TradeVeto-Discovery-Base-Cache", meta.baseCacheStatus);
    return applyDiscoveryPerformanceHeaders(response, latencyMs, meta.cacheStatus, performance);
  });
}

function withDiscoveryPerformanceHeaders(response: NextResponse, startedAt: number, cacheStatus: DiscoveryCacheStatus): NextResponse {
  const latencyMs = Date.now() - startedAt;
  const snapshot = recordDiscoveryApiTiming({ cacheStatus, latencyMs, statusCode: response.status });
  return applyDiscoveryPerformanceHeaders(response, latencyMs, cacheStatus, snapshot);
}

function applyDiscoveryPerformanceHeaders(response: NextResponse, latencyMs: number, cacheStatus: DiscoveryCacheStatus, snapshot: DiscoveryPerformanceSnapshot): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Server-Timing", `discovery;dur=${latencyMs};desc="${cacheStatus}"`);
  response.headers.set("X-TradeVeto-Discovery-Cache", cacheStatus);
  response.headers.set("X-TradeVeto-Discovery-P50", String(snapshot.p50LatencyMs));
  response.headers.set("X-TradeVeto-Discovery-P95", String(snapshot.p95LatencyMs));
  response.headers.set("X-TradeVeto-Discovery-Max", String(snapshot.maxLatencyMs));
  response.headers.set("X-TradeVeto-Discovery-Target", snapshot.targetMet ? "met" : "miss");
  return response;
}
