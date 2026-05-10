import { NextResponse } from "next/server";
import { authenticateDeveloperApiRequest, DeveloperApiAuthError, recordDeveloperApiUsage } from "@/lib/server/developer-platform";
import { loadDeveloperShockFeed } from "@/lib/server/developer-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/v1/shocks", async () => {
    try {
      const access = await authenticateDeveloperApiRequest(request, "read:shocks");
      const limit = new URL(request.url).searchParams.get("limit");
      const response = NextResponse.json({ ok: true, ...(await loadDeveloperShockFeed(Number(limit))) }, { headers: { "Cache-Control": "no-store" } });
      void recordDeveloperApiUsage({ access, endpoint: "/api/v1/shocks", method: "GET", status: response.status }).catch(() => undefined);
      return response;
    } catch (error) {
      if (error instanceof DeveloperApiAuthError) return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      console.warn("[developer-api] shocks failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to load shock feed.", ok: false }, { status: 500 });
    }
  });
}
