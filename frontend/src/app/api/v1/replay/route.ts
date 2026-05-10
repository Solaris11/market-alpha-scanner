import { NextResponse } from "next/server";
import { authenticateDeveloperApiRequest, DeveloperApiAuthError, recordDeveloperApiUsage } from "@/lib/server/developer-platform";
import { loadDeveloperReplay } from "@/lib/server/developer-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/v1/replay", async () => {
    try {
      const access = await authenticateDeveloperApiRequest(request, "read:replay");
      const url = new URL(request.url);
      const replay = await loadDeveloperReplay({
        symbol: cleanSymbol(url.searchParams.get("symbol")),
        timestamp: timestampParam(url.searchParams.get("timestamp")),
      });
      if (!replay) {
        const response = NextResponse.json({ message: "No replay snapshot available.", ok: false }, { status: 404 });
        void recordDeveloperApiUsage({ access, endpoint: "/api/v1/replay", method: "GET", status: response.status }).catch(() => undefined);
        return response;
      }
      const response = NextResponse.json({ ok: true, replay }, { headers: { "Cache-Control": "no-store" } });
      void recordDeveloperApiUsage({ access, endpoint: "/api/v1/replay", method: "GET", status: response.status }).catch(() => undefined);
      return response;
    } catch (error) {
      if (error instanceof DeveloperApiAuthError) return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      console.warn("[developer-api] replay failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to load replay.", ok: false }, { status: 500 });
    }
  });
}

function cleanSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return symbol || null;
}

function timestampParam(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
