import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { recordWorkflowVisit } from "@/lib/server/workflow-evolution";
import type { WorkflowSignalSnapshot, WorkflowSurface } from "@/lib/trading/workflow-evolution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WorkflowVisitPayload = {
  snapshots?: unknown;
  surface?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "workflow-visit:write", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requirePremium();
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as WorkflowVisitPayload | null;
  const surface = normalizeSurface(payload?.surface);
  const snapshots = normalizeSnapshots(payload?.snapshots);
  if (!surface || !snapshots.length) {
    return NextResponse.json({ ok: false, message: "Workflow visit payload is incomplete." }, { status: 400 });
  }

  await recordWorkflowVisit(access.user.id, { snapshots, surface });
  return NextResponse.json({ ok: true, recorded: snapshots.length });
}

function normalizeSurface(value: unknown): WorkflowSurface | null {
  const text = String(value ?? "").trim();
  return text === "terminal" || text === "opportunities" || text === "symbol" ? text : null;
}

function normalizeSnapshots(value: unknown): WorkflowSignalSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? item as Partial<WorkflowSignalSnapshot> : null))
    .filter((item): item is Partial<WorkflowSignalSnapshot> => Boolean(item?.symbol))
    .slice(0, 160)
    .map((item): WorkflowSignalSnapshot => ({
      capturedAt: null,
      convictionScore: nullableNumber(item.convictionScore),
      entryDistancePct: nullableNumber(item.entryDistancePct),
      eventPressureScore: nullableNumber(item.eventPressureScore),
      finalDecision: cleanNullableText(item.finalDecision),
      finalScore: nullableNumber(item.finalScore),
      fragilityScore: nullableNumber(item.fragilityScore),
      macroAlignmentScore: nullableNumber(item.macroAlignmentScore),
      maturityState: normalizeMaturity(item.maturityState),
      metadata: safeMetadata(item.metadata),
      return1d: nullableNumber(item.return1d),
      setupType: cleanNullableText(item.setupType),
      shockPressureScore: nullableNumber(item.shockPressureScore),
      symbol: cleanSymbol(item.symbol),
    }))
    .filter((item) => Boolean(item.symbol));
}

function normalizeMaturity(value: unknown): WorkflowSignalSnapshot["maturityState"] {
  const text = String(value ?? "").trim();
  if (
    text === "Early Formation" ||
    text === "Improving" ||
    text === "Trigger Approaching" ||
    text === "Breakout Confirmed" ||
    text === "Extended" ||
    text === "Decaying" ||
    text === "High Chase Risk"
  ) {
    return text;
  }
  return "Early Formation";
}

function safeMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key)) continue;
    if (rawValue === null || typeof rawValue === "boolean" || typeof rawValue === "number") {
      output[key] = rawValue;
    } else if (typeof rawValue === "string") {
      output[key] = rawValue.slice(0, 180);
    }
    if (Object.keys(output).length >= 20) break;
  }
  return output;
}

function cleanSymbol(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

function cleanNullableText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return null;
  return text.slice(0, 120);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
