import { NextResponse } from "next/server";
import { runPythonCommand } from "@/lib/run-command";
import { requireAdmin } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "admin:run-analysis", { limit: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const result = await runPythonCommand(["investment_scanner_mvp.py", "--run-analysis"], {
    failure: "Analysis refresh failed.",
    success: "Analysis refresh completed.",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
