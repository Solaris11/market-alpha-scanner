import { NextResponse } from "next/server";
import { REQUEST_BODY_LIMITS } from "@/lib/security/http-abuse-policy";
import { authenticateDeveloperApiRequest, DeveloperApiAuthError, recordDeveloperApiUsage } from "@/lib/server/developer-platform";
import { runDeveloperPortfolioScenario } from "@/lib/server/developer-intelligence";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rejectOversizedRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PortfolioScenarioPayload = {
  accountValue?: unknown;
  positions?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/v1/portfolio/scenario", async () => {
    try {
      const access = await authenticateDeveloperApiRequest(request, "read:portfolio");
      const oversized = rejectOversizedRequest(request, REQUEST_BODY_LIMITS.developerMutation);
      if (oversized) {
        void recordDeveloperApiUsage({ access, endpoint: "/api/v1/portfolio/scenario", method: "POST", status: oversized.status }).catch(() => undefined);
        return oversized;
      }
      const payload = (await request.json().catch(() => null)) as PortfolioScenarioPayload | null;
      const system = await runDeveloperPortfolioScenario({
        accountValue: payload?.accountValue,
        positions: payload?.positions ?? [],
      });
      const response = NextResponse.json({ ok: true, ...system }, { headers: { "Cache-Control": "no-store" } });
      void recordDeveloperApiUsage({ access, endpoint: "/api/v1/portfolio/scenario", method: "POST", status: response.status }).catch(() => undefined);
      return response;
    } catch (error) {
      if (error instanceof DeveloperApiAuthError) return NextResponse.json({ message: error.message, ok: false }, { status: error.status });
      console.warn("[developer-api] portfolio scenario failed", error instanceof Error ? error.message : error);
      return NextResponse.json({ message: "Failed to run portfolio scenario.", ok: false }, { status: 500 });
    }
  });
}
