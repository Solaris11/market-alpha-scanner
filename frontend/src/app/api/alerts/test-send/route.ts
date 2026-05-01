import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";
import { requireAdmin } from "@/lib/server/access-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  let payload: { ruleId?: string; send?: boolean } = {};
  try {
    payload = (await request.json()) as { ruleId?: string; send?: boolean };
  } catch {
    payload = {};
  }

  const args = ["investment_scanner_mvp.py", "--alerts-only"];
  if (payload.send !== false) args.push("--send-alerts");
  if (payload.ruleId) args.push("--alert-rule-id", payload.ruleId);
  const result = await runPythonCommand(args, {
    failure: "Alert evaluation failed.",
    success: "Alert evaluation completed.",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
