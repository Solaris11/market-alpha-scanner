import { NextResponse } from "next/server";
import { entitlementSummary, getEntitlement, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance, type Entitlement } from "@/lib/server/entitlements";
import { loadIntelligenceDiscoverySystemWithMeta, type DiscoveryPacketMode } from "@/lib/server/discovery-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { buildLimitedIntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";
import { getDiscoveryPerformanceSnapshot, recordDiscoveryApiTiming, shouldRecordDiscoveryApiTiming, type DiscoveryCacheStatus, type DiscoveryPerformanceSnapshot } from "@/lib/discovery-performance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderOutageSimulation = {
  degradedMode: boolean;
  enabled: boolean;
  fallbackVisible: boolean;
  recoveryVisible: boolean;
  requested: string[];
  scannerStaleStateVisible: boolean;
  simulatedStates: Array<{
    disclosure: string;
    provider: string;
    state: "outage";
  }>;
};

type DiscoveryBodyCacheEntry = {
  bodyBuffer: ArrayBuffer;
  bodyLength: number;
  entitlementKey: string;
  serializedSystem: string;
};

const discoveryBodyCache = new Map<string, DiscoveryBodyCacheEntry>();
const DISCOVERY_BODY_CACHE_MAX_ENTRIES = 200;
const discoveryBodyEncoder = new TextEncoder();

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/discovery", async () => {
    const startedAt = Date.now();
    const outageSimulation = providerOutageSimulationFromRequest(request);
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

    const packetMode = discoveryPacketModeFromRequest(request);
    const { meta, serializedSystem } = await loadIntelligenceDiscoverySystemWithMeta(entitlement.user?.id ?? null, { packetMode });
    const latencyMs = Date.now() - startedAt;
    const performance = shouldRecordDiscoveryApiTiming()
      ? recordDiscoveryApiTiming({ cacheStatus: meta.cacheStatus, latencyMs, statusCode: 200 })
      : getDiscoveryPerformanceSnapshot();
    const response = outageSimulation.enabled
      ? NextResponse.json({
        entitlement: entitlementSummary(entitlement),
        limited: false,
        ok: true,
        performance,
        providerOutageSimulation: outageSimulation,
        system: JSON.parse(serializedSystem) as unknown,
      }, { headers: { "Cache-Control": "no-store" } })
      : discoveryJsonResponse({
        cacheKey: `${entitlement.user?.id ?? "anonymous"}:${packetMode}`,
        entitlementJson: () => JSON.stringify(entitlementSummary(entitlement)),
        entitlementKey: discoveryEntitlementKey(entitlement),
        performanceJson: () => JSON.stringify(performance),
        serializedSystem,
      });
    response.headers.set("X-TradeVeto-Discovery-Build-Ms", String(meta.durationMs));
    response.headers.set("X-TradeVeto-Discovery-Base-Cache", meta.baseCacheStatus);
    response.headers.set("X-TradeVeto-Discovery-Packet", packetMode);
    return applyProviderOutageSimulationHeaders(applyDiscoveryPerformanceHeaders(response, latencyMs, meta.cacheStatus, performance), outageSimulation);
  });
}

function discoveryPacketModeFromRequest(request: Request): DiscoveryPacketMode {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("packet") ?? url.searchParams.get("scope") ?? "").trim().toLowerCase();
  return raw === "full" || raw === "full-universe" ? "full" : "initial";
}

function discoveryJsonResponse(input: {
  cacheKey: string;
  entitlementJson: () => string;
  entitlementKey: string;
  performanceJson: () => string;
  serializedSystem: string;
}): NextResponse {
  const cacheEntry = readDiscoveryBodyCache(input);
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  headers.set("Content-Length", String(cacheEntry.bodyLength));
  return new NextResponse(cacheEntry.bodyBuffer, {
    headers,
    status: 200,
  });
}

function readDiscoveryBodyCache(input: {
  cacheKey: string;
  entitlementJson: () => string;
  entitlementKey: string;
  performanceJson: () => string;
  serializedSystem: string;
}): DiscoveryBodyCacheEntry {
  const current = discoveryBodyCache.get(input.cacheKey);
  if (current && current.entitlementKey === input.entitlementKey && current.serializedSystem === input.serializedSystem) {
    return current;
  }

  const body = `{"entitlement":${input.entitlementJson()},"limited":false,"ok":true,"performance":${input.performanceJson()},"system":${input.serializedSystem}}`;
  const bodyBytes = discoveryBodyEncoder.encode(body);
  const entry: DiscoveryBodyCacheEntry = {
    bodyBuffer: bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
    bodyLength: bodyBytes.byteLength,
    entitlementKey: input.entitlementKey,
    serializedSystem: input.serializedSystem,
  };
  discoveryBodyCache.set(input.cacheKey, entry);
  trimDiscoveryBodyCache();
  return entry;
}

function discoveryEntitlementKey(entitlement: Entitlement): string {
  const legal = entitlement.legalStatus;
  return [
    entitlement.user?.id ?? "anonymous",
    entitlement.authenticated ? "auth" : "anon",
    entitlement.plan,
    entitlement.isAdmin ? "admin" : "user",
    entitlement.isPremium ? "premium" : "limited",
    entitlement.betaAccess ? entitlement.betaAccessLabel ?? "beta" : "no-beta",
    entitlement.subscriptionStatus ?? "no-subscription",
    legal.termsAccepted ? "terms" : "no-terms",
    legal.privacyAccepted ? "privacy" : "no-privacy",
    legal.riskAccepted ? "risk" : "no-risk",
    legal.allAccepted ? "accepted" : "pending",
  ].join(":");
}

function trimDiscoveryBodyCache(): void {
  while (discoveryBodyCache.size > DISCOVERY_BODY_CACHE_MAX_ENTRIES) {
    const oldest = discoveryBodyCache.keys().next().value;
    if (!oldest) return;
    discoveryBodyCache.delete(oldest);
  }
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
  response.headers.set("X-TradeVeto-Discovery-P99", String(snapshot.p99LatencyMs));
  response.headers.set("X-TradeVeto-Discovery-Max", String(snapshot.maxLatencyMs));
  response.headers.set("X-TradeVeto-Discovery-Target", snapshot.targetMet ? "met" : "miss");
  return response;
}

function providerOutageSimulationFromRequest(request: Request): ProviderOutageSimulation {
  const requested = (request.headers.get("x-tradeveto-provider-outage-simulation") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return {
    degradedMode: requested.length > 0,
    enabled: requested.length > 0,
    fallbackVisible: requested.length > 0,
    recoveryVisible: requested.length > 0,
    requested,
    scannerStaleStateVisible: requested.length > 0,
    simulatedStates: requested.map((provider) => ({
      disclosure: `${provider} provider outage simulated for resilience certification; scanner discovery keeps stale-safe fallback context visible and does not infer unavailable provider events.`,
      provider,
      state: "outage" as const,
    })),
  };
}

function applyProviderOutageSimulationHeaders(response: NextResponse, simulation: ProviderOutageSimulation): NextResponse {
  if (!simulation.enabled) return response;
  response.headers.set("X-TradeVeto-Provider-Outage-Simulation", "active");
  response.headers.set("X-TradeVeto-Provider-State", "degraded-fallback");
  return response;
}
