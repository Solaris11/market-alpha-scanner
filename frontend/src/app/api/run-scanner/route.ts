import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";
import { requireAdmin } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { fastScanSymbolArg } from "@/lib/security/scanner-command-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "admin:run-scanner", { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const result = await runPythonCommand(["investment_scanner_mvp.py", "--fast", "--timing", "--save-history", "--top", "13", "--symbols", fastScanSymbolArg()], {
    failure: "Scanner refresh failed.",
    success: "Scanner refresh completed.",
  });
  return NextResponse.json(result, { status: result.status === "already_running" ? 202 : result.ok ? 200 : 500 });
}
