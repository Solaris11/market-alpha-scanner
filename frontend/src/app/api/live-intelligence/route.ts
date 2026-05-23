import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { recordLiveIntelligenceApiTiming, type LiveIntelligenceCacheStatus, type LiveIntelligencePerformanceSnapshot } from "@/lib/live-intelligence-performance";
import { loadLiveIntelligenceSystemWithMeta } from "@/lib/server/live-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/live-intelligence", async () => {
    const startedAt = Date.now();
    const access = await requirePremium();
    if (!access.ok) return withLivePerformanceHeaders(access.response, startedAt, "degraded-fallback");

    const refreshIntervalMs = refreshIntervalFromRequest(request);
    const { cacheStatus, system } = await loadLiveIntelligenceSystemWithMeta({ refreshIntervalMs, streamMode: "snapshot" });
    const latencyMs = Date.now() - startedAt;
    const performance = recordLiveIntelligenceApiTiming({ cacheStatus, latencyMs, statusCode: 200 });
    const response = NextResponse.json({ ok: true, performance, system });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-TradeVeto-Live-Build-Ms", String(latencyMs));
    return applyLivePerformanceHeaders(response, latencyMs, cacheStatus, performance);
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
