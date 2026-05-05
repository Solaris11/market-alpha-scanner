import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";
import { requireAdmin } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "admin:alerts-test-send", { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

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
  return NextResponse.json(result, { status: result.status === "already_running" ? 202 : result.status === "unavailable" ? 503 : result.ok ? 200 : 500 });
}
