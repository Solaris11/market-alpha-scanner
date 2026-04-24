import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getHistorySummary, scannerOutputDir } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const history = await getHistorySummary();
  const latest = history.snapshots[0];

  if (!latest) {
    return NextResponse.json({ error: "No snapshots available." }, { status: 404 });
  }

  const filePath = path.join(scannerOutputDir(), "history", latest.name);
  const body = await fs.readFile(filePath, "utf8");

  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${latest.name}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
