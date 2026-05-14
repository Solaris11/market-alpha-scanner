import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { readUserNotificationPreferences, upsertUserNotificationPreferences } from "@/lib/server/intelligence-feed";
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from "@/lib/trading/intelligence-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, preferences: DEFAULT_NOTIFICATION_PREFERENCES });
  }

  try {
    const preferences = await readUserNotificationPreferences(user.id);
    return NextResponse.json({ authenticated: true, preferences });
  } catch {
    return NextResponse.json(
      { authenticated: true, error: "Failed to load notification preferences.", preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const rateLimited = await rateLimitRequest(request, "notification-preferences:write", { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: "Sign in to save notification preferences.", preferences: DEFAULT_NOTIFICATION_PREFERENCES },
      { status: 401 },
    );
  }

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = await request.json().catch(() => null);
  const preferences = normalizeNotificationPreferences(payload);

  try {
    const saved = await upsertUserNotificationPreferences(user.id, preferences);
    return NextResponse.json({ authenticated: true, preferences: saved });
  } catch {
    return NextResponse.json(
      { authenticated: true, error: "Failed to save notification preferences.", preferences },
      { status: 500 },
    );
  }
}
