import { NextResponse } from "next/server";
import { requirePremium, requireUser } from "@/lib/server/access-control";
import { getCurrentUser } from "@/lib/server/auth";
import { buildDecisionMemorySummary } from "@/lib/trading/decision-journal";
import { clearDecisionJournal, createDecisionJournalEntry, listDecisionJournalEntries, type DecisionJournalInput } from "@/lib/server/decision-journal";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { clearUserMemoryData } from "@/lib/server/user-memory-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JournalPayload = DecisionJournalInput & {
  action?: unknown;
};

type ClearPayload = {
  confirm?: unknown;
};

export async function GET(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      entries: [],
      memory: buildDecisionMemorySummary([]),
    });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");

  try {
    const entries = await listDecisionJournalEntries(user.id, { limit: 120, symbol });
    return NextResponse.json({
      authenticated: true,
      entries,
      memory: buildDecisionMemorySummary(entries, { symbol }),
    });
  } catch {
    return NextResponse.json({ authenticated: true, entries: [], error: "Decision journal is not available.", memory: buildDecisionMemorySummary([], { symbol }) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "decision-journal:write", { limit: 45, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requirePremium();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as JournalPayload | null;
  if (!payload) {
    return NextResponse.json({ ok: false, message: "Invalid journal payload." }, { status: 400 });
  }

  try {
    const entry = await createDecisionJournalEntry(access.user.id, {
      ...payload,
      userAction: payload.userAction ?? payload.action,
    });
    const entries = await listDecisionJournalEntries(access.user.id, { limit: 120 });
    return NextResponse.json({
      authenticated: true,
      entry,
      entries,
      memory: buildDecisionMemorySummary(entries, { symbol: entry.symbol }),
      ok: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save decision journal entry.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const rateLimited = await rateLimitRequest(request, "decision-journal:clear", { limit: 6, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to clear decision memory.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as ClearPayload | null;
  if (payload?.confirm !== "CLEAR DECISION MEMORY") {
    return NextResponse.json({ ok: false, message: "Confirmation is required before clearing decision memory." }, { status: 400 });
  }

  await clearUserMemoryData(access.user.id).catch(() => clearDecisionJournal(access.user.id));
  return NextResponse.json({
    authenticated: true,
    entries: [],
    memory: buildDecisionMemorySummary([]),
    ok: true,
  });
}
