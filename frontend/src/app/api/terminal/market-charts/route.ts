import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { rateLimitRequest } from "@/lib/server/request-security";
import { getMarketChartHubData } from "@/lib/server/validated-price-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// P2.6 hardening: the terminal's cross-asset chart hub (8 symbols x 260 points)
// is ~1.5-2MB and sits well below the WHAT/WHERE/WHICH first screen. Serving it
// here lets the terminal render the hub lazily (on scroll) instead of inlining
// the raw points into the initial RSC document. Premium-gated + rate-limited,
// same as the other terminal data routes.
export async function GET(request: Request) {
  const access = await requirePremium();
  if (!access.ok) return access.response;

  const limited = await rateLimitRequest(request, "terminal-market-charts", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const charts = await getMarketChartHubData(260);
    return NextResponse.json({ charts }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ charts: [] }, { status: 200 });
  }
}
