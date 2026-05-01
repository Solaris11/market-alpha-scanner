import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";
import { requireAdmin } from "@/lib/server/access-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const result = await runPythonCommand(["investment_scanner_mvp.py", "--save-history"], {
    failure: "Scanner refresh failed.",
    success: "Scanner refresh completed.",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
