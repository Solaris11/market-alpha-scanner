import { NextResponse } from "next/server";
import { readProcessHealth } from "@/lib/server/event-loop-monitor";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/health", async () =>
    NextResponse.json(
      {
        ok: true,
        // Cumulative since process start. A jump between two consecutive polls
        // localises a stall in time without mutating state on a GET.
        process: readProcessHealth(),
        service: "tradeveto-frontend",
        status: "ok",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    ),
  );
}
