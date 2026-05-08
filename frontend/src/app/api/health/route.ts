import { NextResponse } from "next/server";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/health", async () =>
    NextResponse.json(
      {
        ok: true,
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
