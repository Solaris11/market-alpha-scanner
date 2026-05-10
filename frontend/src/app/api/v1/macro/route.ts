import { NextResponse } from "next/server";
import { authenticateDeveloperApiRequest, DeveloperApiAuthError, recordDeveloperApiUsage } from "@/lib/server/developer-platform";
import { loadDeveloperMacroFeed } from "@/lib/server/developer-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/v1/macro", async () => {
    try {
      const access = await authenticateDeveloperApiRequest(request, "read:macro");
      const response = NextResponse.json({ ok: true, ...(await loadDeveloperMacroFeed()) }, { headers: { "Cache-Control": "no-store" } });
      void recordDeveloperApiUsage({ access, endpoint: "/api/v1/macro", method: "GET", status: response.status }).catch(() => undefined);
      return response;
    } catch (error) {
      if (error instanceof DeveloperApiAuthError) return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      console.warn("[developer-api] macro failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to load macro feed.", ok: false }, { status: 500 });
    }
  });
}
