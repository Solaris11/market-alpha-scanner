import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getHistorySummary, scannerOutputDir } from "@/lib/scanner-data";
import { getEntitlement, hasPremiumAccess, premiumDeniedResponse } from "@/lib/server/entitlements";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/history/latest", async () => {
    const entitlement = await getEntitlement();
    if (!hasPremiumAccess(entitlement)) {
      return premiumDeniedResponse(entitlement);
    }

    const history = await getHistorySummary();
    const latest = history.snapshots[0];

    if (!latest) {
      return NextResponse.json({ ok: false, message: "No snapshots available." }, { status: 404 });
    }

    const filePath = path.join(scannerOutputDir(), "history", latest.name);
    const body = await fs.readFile(filePath, "utf8");

    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${latest.name}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  });
}
