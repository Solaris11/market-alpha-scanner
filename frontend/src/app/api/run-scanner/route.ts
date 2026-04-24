import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await runPythonCommand(["investment_scanner_mvp.py", "--save-history"]);
  if (result.ok) {
    return NextResponse.json({ ok: true, stdout: result.stdout, stderr: result.stderr, command: result.command, message: result.message });
  }
  return NextResponse.json({ ok: false, error: result.message, stdout: result.stdout, stderr: result.stderr, command: result.command, code: result.code }, { status: 500 });
}
