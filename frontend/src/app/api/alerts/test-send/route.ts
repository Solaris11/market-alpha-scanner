import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: { ruleId?: string; send?: boolean } = {};
  try {
    payload = (await request.json()) as { ruleId?: string; send?: boolean };
  } catch {
    payload = {};
  }

  const args = ["investment_scanner_mvp.py", "--alerts-only"];
  if (payload.send !== false) args.push("--send-alerts");
  if (payload.ruleId) args.push("--alert-rule-id", payload.ruleId);
  const result = await runPythonCommand(args);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
