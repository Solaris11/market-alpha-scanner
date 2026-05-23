import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { readUserChartWorkflowWorkspace, upsertUserChartWorkflowWorkspace } from "@/lib/server/user-workspace-preferences";
import { normalizeChartWorkflowSymbol, sanitizeChartWorkflowWorkspace } from "@/components/terminal/chart-workflow-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser().catch(() => null);
  const { symbol: rawSymbol } = await context.params;
  const symbol = normalizeChartWorkflowSymbol(rawSymbol);
  if (!user) {
    return NextResponse.json({ authenticated: false, symbol, workspace: null });
  }

  try {
    const workspace = await readUserChartWorkflowWorkspace(user.id, symbol);
    return NextResponse.json({ authenticated: true, symbol, workspace });
  } catch {
    return NextResponse.json(
      { authenticated: true, error: "Failed to load chart workspace.", symbol, workspace: null },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const rateLimited = await rateLimitRequest(request, "chart-workspaces:write", { limit: 180, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const user = await getCurrentUser().catch(() => null);
  const { symbol: rawSymbol } = await context.params;
  const symbol = normalizeChartWorkflowSymbol(rawSymbol);
  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: "Sign in to sync chart workspaces.", symbol, workspace: null },
      { status: 401 },
    );
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = await request.json().catch(() => null);
  const workspace = sanitizeChartWorkflowWorkspace(payload?.workspace ?? payload);

  try {
    const saved = await upsertUserChartWorkflowWorkspace(user.id, symbol, workspace);
    return NextResponse.json({ authenticated: true, symbol, workspace: saved });
  } catch {
    return NextResponse.json(
      { authenticated: true, error: "Failed to save chart workspace.", symbol, workspace },
      { status: 500 },
    );
  }
}
