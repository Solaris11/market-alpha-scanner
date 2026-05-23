import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { recordLiveIntelligenceApiTiming, type LiveIntelligenceCacheStatus, type LiveIntelligencePerformanceSnapshot } from "@/lib/live-intelligence-performance";
import { loadLiveIntelligenceSystemWithMeta } from "@/lib/server/live-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderOutageSimulation = {
  degradedMode: boolean;
  enabled: boolean;
  fallbackVisible: boolean;
  recoveryVisible: boolean;
  requested: string[];
  staleStateVisible: boolean;
  simulatedStates: Array<{
    disclosure: string;
    provider: string;
    state: "outage";
  }>;
};

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/live-intelligence", async () => {
    const startedAt = Date.now();
    const access = await requirePremium();
    if (!access.ok) return withLivePerformanceHeaders(access.response, startedAt, "degraded-fallback");

    const refreshIntervalMs = refreshIntervalFromRequest(request);
    const outageSimulation = providerOutageSimulationFromRequest(request);
    const { cacheStatus, system } = await loadLiveIntelligenceSystemWithMeta({ refreshIntervalMs, streamMode: "snapshot" });
    const latencyMs = Date.now() - startedAt;
    const performance = recordLiveIntelligenceApiTiming({ cacheStatus, latencyMs, statusCode: 200 });
    const response = NextResponse.json({
      ok: true,
      performance,
      providerOutageSimulation: outageSimulation.enabled ? outageSimulation : undefined,
      system: outageSimulation.enabled ? {
        ...system,
        latencyLabel: "Provider outage simulation: stale-safe degraded fallback visible",
        limitations: [
          `Provider outage simulation active for ${outageSimulation.requested.join(", ")}; live intelligence is exposing stale-safe degraded fallback state instead of inventing unavailable provider data.`,
          ...system.limitations,
        ],
        status: "degraded" as const,
      } : system,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-TradeVeto-Live-Build-Ms", String(latencyMs));
    return applyProviderOutageSimulationHeaders(applyLivePerformanceHeaders(response, latencyMs, cacheStatus, performance), outageSimulation);
  });
}

function withLivePerformanceHeaders(response: NextResponse, startedAt: number, cacheStatus: LiveIntelligenceCacheStatus): NextResponse {
  const latencyMs = Date.now() - startedAt;
  const snapshot = recordLiveIntelligenceApiTiming({ cacheStatus, latencyMs, statusCode: response.status });
  return applyLivePerformanceHeaders(response, latencyMs, cacheStatus, snapshot);
}

function applyLivePerformanceHeaders(response: NextResponse, latencyMs: number, cacheStatus: LiveIntelligenceCacheStatus, snapshot: LiveIntelligencePerformanceSnapshot): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Server-Timing", `live-intelligence;dur=${latencyMs};desc="${cacheStatus}"`);
  response.headers.set("X-TradeVeto-Live-Cache", cacheStatus);
  response.headers.set("X-TradeVeto-Live-P50", String(snapshot.p50LatencyMs));
  response.headers.set("X-TradeVeto-Live-P95", String(snapshot.p95LatencyMs));
  response.headers.set("X-TradeVeto-Live-P99", String(snapshot.p99LatencyMs));
  response.headers.set("X-TradeVeto-Live-Max", String(snapshot.maxLatencyMs));
  response.headers.set("X-TradeVeto-Live-Target", snapshot.targetMet ? "met" : "miss");
  return response;
}

function refreshIntervalFromRequest(request: Request): number | undefined {
  const url = new URL(request.url);
  const raw = url.searchParams.get("intervalMs");
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(10_000, Math.min(120_000, Math.trunc(parsed)));
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
    staleStateVisible: requested.length > 0,
    simulatedStates: requested.map((provider) => ({
      disclosure: `${provider} provider outage simulated for resilience certification; no live events, headlines, or catalysts are inferred while this provider is unavailable.`,
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
