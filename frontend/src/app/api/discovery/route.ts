import { NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE_NAME } from "@/lib/server/auth";
import { entitlementSummary, getEntitlementForUser, hasPremiumAccess, legalNotAcceptedResponse, requiresLegalAcceptance, type Entitlement } from "@/lib/server/entitlements";
import { loadIntelligenceDiscoverySystemWithMeta, type DiscoveryPacketMode } from "@/lib/server/discovery-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { readUserSavedScans } from "@/lib/server/user-saved-scans";
import { buildLargeUniverseDiscoveryProofSystem, buildLimitedIntelligenceDiscoverySystem } from "@/lib/trading/intelligence-discovery";
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

type DiscoveryResponseCacheEntry = {
  baseCacheStatus: "base-hit" | "base-miss" | "skipped";
  bodyBuffer: ArrayBuffer;
  bodyLength: number;
  buildMs: number;
  expiresAt: number;
  packetMode: DiscoveryPacketMode;
  systemCacheStatus: "system-hit" | "system-miss";
};

const discoveryBodyCache = new Map<string, DiscoveryBodyCacheEntry>();
const discoveryResponseCache = new Map<string, DiscoveryResponseCacheEntry>();
const DISCOVERY_BODY_CACHE_MAX_ENTRIES = 200;
const DISCOVERY_RESPONSE_CACHE_MAX_ENTRIES = 500;
const DISCOVERY_RESPONSE_CACHE_TTL_MS = boundedDiscoveryResponseCacheTtlMs(process.env.TRADEVETO_DISCOVERY_RESPONSE_CACHE_TTL_MS);
const discoveryBodyEncoder = new TextEncoder();

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/discovery", async () => {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const outageSimulation = providerOutageSimulationFromRequest(request);
    const entitlement = await getDiscoveryEntitlementForRequest(request);
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

    if (largeUniverseProofRequested(url) && largeUniverseProofAllowed(entitlement)) {
      const savedScans = entitlement.user?.id ? await readUserSavedScans(entitlement.user.id).catch(() => []) : [];
      const system = buildLargeUniverseDiscoveryProofSystem({ savedScans });
      const performance = getDiscoveryPerformanceSnapshot();
      const response = NextResponse.json({
        entitlement: entitlementSummary(entitlement),
        limited: false,
        ok: true,
        performance,
        proofMode: "large-universe",
        system,
      }, { headers: { "Cache-Control": "no-store" } });
      response.headers.set("X-TradeVeto-Discovery-Packet", "large-universe-proof");
      response.headers.set("X-TradeVeto-Discovery-Proof-Mode", "large-universe");
      return applyDiscoveryPerformanceHeaders(response, Date.now() - startedAt, "system-hit", performance);
    }

    const packetMode = discoveryPacketModeFromUrl(url);
    const entitlementKey = discoveryEntitlementKey(entitlement);
    const responseCacheKey = discoveryResponseCacheKey(entitlementKey, packetMode);
    if (!outageSimulation.enabled && packetMode === "initial") {
      const cachedResponse = readDiscoveryResponseCache(responseCacheKey);
      if (cachedResponse) return cachedDiscoveryJsonResponse(cachedResponse, startedAt);
    }

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
      : (() => {
        const bodyCacheEntry = readDiscoveryBodyCache({
          cacheKey: `${entitlement.user?.id ?? "anonymous"}:${packetMode}`,
          entitlementJson: () => JSON.stringify(entitlementSummary(entitlement)),
          entitlementKey,
          performanceJson: () => JSON.stringify(performance),
          serializedSystem,
        });
        if (packetMode === "initial") {
          writeDiscoveryResponseCache(responseCacheKey, {
            baseCacheStatus: meta.baseCacheStatus,
            bodyBuffer: bodyCacheEntry.bodyBuffer,
            bodyLength: bodyCacheEntry.bodyLength,
            buildMs: meta.durationMs,
            expiresAt: Date.now() + DISCOVERY_RESPONSE_CACHE_TTL_MS,
            packetMode,
            systemCacheStatus: meta.systemCacheStatus,
          });
        }
        const builtResponse = discoveryJsonResponseFromBodyCache(bodyCacheEntry);
        builtResponse.headers.set("X-TradeVeto-Discovery-Response-Cache", "miss");
        return builtResponse;
      })();
    response.headers.set("X-TradeVeto-Discovery-Build-Ms", String(meta.durationMs));
    response.headers.set("X-TradeVeto-Discovery-Base-Cache", meta.baseCacheStatus);
    response.headers.set("X-TradeVeto-Discovery-Packet", packetMode);
    return applyProviderOutageSimulationHeaders(applyDiscoveryPerformanceHeaders(response, latencyMs, meta.cacheStatus, performance), outageSimulation);
  });
}

async function getDiscoveryEntitlementForRequest(request: Request): Promise<Entitlement> {
  const sessionToken = cookieValueFromHeader(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  const user = sessionToken ? await getUserForSessionToken(sessionToken).catch(() => null) : null;
  return getEntitlementForUser(user);
}

function cookieValueFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    if (trimmed.slice(0, separator) === name) return trimmed.slice(separator + 1);
  }
  return null;
}

function largeUniverseProofRequested(url: URL): boolean {
  return /^(large-universe|scanner-large-universe|1|true)$/i.test(url.searchParams.get("proof") ?? "");
}

function largeUniverseProofAllowed(entitlement: Entitlement): boolean {
  const email = entitlement.user?.email.trim().toLowerCase() ?? "";
  return entitlement.isAdmin || email.endsWith("@tradeveto-probe.local");
}

function discoveryPacketModeFromUrl(url: URL): DiscoveryPacketMode {
  const raw = (url.searchParams.get("packet") ?? url.searchParams.get("scope") ?? "").trim().toLowerCase();
  return raw === "full" || raw === "full-universe" ? "full" : "initial";
}

function discoveryJsonResponseFromBodyCache(cacheEntry: Pick<DiscoveryBodyCacheEntry, "bodyBuffer" | "bodyLength">): NextResponse {
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

function cachedDiscoveryJsonResponse(entry: DiscoveryResponseCacheEntry, startedAt: number): NextResponse {
  const latencyMs = Date.now() - startedAt;
  const performance = shouldRecordDiscoveryApiTiming()
    ? recordDiscoveryApiTiming({ cacheStatus: "response-hit", latencyMs, statusCode: 200 })
    : getDiscoveryPerformanceSnapshot();
  const response = discoveryJsonResponseFromBodyCache(entry);
  response.headers.set("X-TradeVeto-Discovery-Build-Ms", String(entry.buildMs));
  response.headers.set("X-TradeVeto-Discovery-Base-Cache", entry.baseCacheStatus);
  response.headers.set("X-TradeVeto-Discovery-Packet", entry.packetMode);
  response.headers.set("X-TradeVeto-Discovery-Response-Cache", "hit");
  response.headers.set("X-TradeVeto-Discovery-System-Cache", entry.systemCacheStatus);
  return applyDiscoveryPerformanceHeaders(response, latencyMs, "response-hit", performance);
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

function discoveryResponseCacheKey(entitlementKey: string, packetMode: DiscoveryPacketMode): string {
  return `${entitlementKey}:${packetMode}`;
}

function readDiscoveryResponseCache(cacheKey: string): DiscoveryResponseCacheEntry | null {
  const entry = discoveryResponseCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    discoveryResponseCache.delete(cacheKey);
    return null;
  }
  return entry;
}

function writeDiscoveryResponseCache(cacheKey: string, entry: DiscoveryResponseCacheEntry): void {
  discoveryResponseCache.set(cacheKey, entry);
  trimDiscoveryResponseCache();
}

function trimDiscoveryResponseCache(): void {
  const now = Date.now();
  for (const [cacheKey, entry] of discoveryResponseCache) {
    if (entry.expiresAt <= now) discoveryResponseCache.delete(cacheKey);
  }
  while (discoveryResponseCache.size > DISCOVERY_RESPONSE_CACHE_MAX_ENTRIES) {
    const oldest = discoveryResponseCache.keys().next().value;
    if (!oldest) return;
    discoveryResponseCache.delete(oldest);
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

function boundedDiscoveryResponseCacheTtlMs(rawValue: string | undefined): number {
  const fallback = 1_500;
  if (!rawValue) return fallback;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(100, Math.min(5_000, Math.round(parsed)));
}
