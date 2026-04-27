import { NextResponse } from "next/server";
import { getPerformanceData } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const performance = await getPerformanceData();
  return NextResponse.json({
    rows: performance.forwardReturns.rows,
    state: performance.forwardReturns.state,
    lineCount: performance.forwardReturns.lineCount,
  });
}
