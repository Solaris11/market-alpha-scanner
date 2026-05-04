import { NextResponse } from "next/server";
import { getFullRanking } from "@/lib/scanner-data";
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

    const rows = await getFullRanking();

    if (!rows.length) {
      return NextResponse.json({ ok: false, message: "No snapshots available." }, { status: 404 });
    }

    const body = toCsv(rows);
    const filename = `scanner_signals_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).sort();
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
