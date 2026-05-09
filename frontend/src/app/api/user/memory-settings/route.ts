import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { readUserMemorySettings, upsertUserMemorySettings } from "@/lib/server/user-memory-settings";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import type { UserMemorySettings } from "@/lib/trading/user-memory-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MemorySettingsPayload = {
  behavioralLearningEnabled?: unknown;
  journalCoachingEnabled?: unknown;
};

export async function GET() {
  const access = await requireUser("Sign in to view memory settings.");
  if (!access.ok) return access.response;
  const settings = await readUserMemorySettings(access.user.id).catch((): UserMemorySettings => ({
    behavioralLearningEnabled: true,
    journalCoachingEnabled: true,
    updatedAt: null,
  }));
  return NextResponse.json({ authenticated: true, settings });
}

export async function PUT(request: Request) {
  const rateLimited = await rateLimitRequest(request, "memory-settings:write", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to update memory settings.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as MemorySettingsPayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ authenticated: true, message: "Invalid memory settings payload.", ok: false }, { status: 400 });
  }

  const settings = await upsertUserMemorySettings(access.user.id, {
    behavioralLearningEnabled: typeof payload.behavioralLearningEnabled === "boolean" ? payload.behavioralLearningEnabled : undefined,
    journalCoachingEnabled: typeof payload.journalCoachingEnabled === "boolean" ? payload.journalCoachingEnabled : undefined,
  });
  return NextResponse.json({ authenticated: true, ok: true, settings });
}
