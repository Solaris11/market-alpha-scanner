import { NextResponse } from "next/server";
import { getDecisionReplayReport } from "@/lib/server/decision-replay";
import { requirePremium } from "@/lib/server/access-control";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { rateLimitRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/history/replay", async () => {
    const rateLimited = await rateLimitRequest(request, "history:replay", { limit: 60, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const url = new URL(request.url);
    const symbol = cleanSymbol(url.searchParams.get("symbol"));
    const timestamp = timestampParam(url.searchParams.get("timestamp"));
    const replay = await getDecisionReplayReport({ symbol, timestamp });

    if (!replay) {
      return NextResponse.json({ ok: false, message: "No replay snapshot available." }, { headers: { "Cache-Control": "no-store" }, status: 404 });
    }

    return NextResponse.json({ ok: true, replay }, { headers: { "Cache-Control": "no-store" } });
  });
}

function cleanSymbol(value: unknown): string | null {
  const text = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return text || null;
}

function timestampParam(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
