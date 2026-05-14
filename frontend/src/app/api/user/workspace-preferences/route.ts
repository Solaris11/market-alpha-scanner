import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { readUserWorkspacePreferences, upsertUserWorkspacePreferences } from "@/lib/server/user-workspace-preferences";
import { DEFAULT_WORKSPACE_PREFERENCES, normalizeWorkspacePreferences } from "@/lib/trading/workspace-preferences";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, preferences: DEFAULT_WORKSPACE_PREFERENCES });
  }

  try {
    const preferences = await readUserWorkspacePreferences(user.id);
    return NextResponse.json({ authenticated: true, preferences });
  } catch {
    return NextResponse.json(
      { authenticated: true, error: "Failed to load workspace preferences.", preferences: DEFAULT_WORKSPACE_PREFERENCES },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const rateLimited = await rateLimitRequest(request, "workspace-preferences:write", { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: "Sign in to save workspace preferences.", preferences: DEFAULT_WORKSPACE_PREFERENCES },
      { status: 401 },
    );
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = await request.json().catch(() => null);
  const preferences = normalizeWorkspacePreferences(payload);

  try {
    const saved = await upsertUserWorkspacePreferences(user.id, preferences);
    return NextResponse.json({ authenticated: true, preferences: saved });
  } catch {
    return NextResponse.json(
      { authenticated: true, error: "Failed to save workspace preferences.", preferences },
      { status: 500 },
    );
  }
}
