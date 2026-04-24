import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await runPythonCommand(["investment_scanner_mvp.py", "--alerts-only", "--send-alerts"]);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
