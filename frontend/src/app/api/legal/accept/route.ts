import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { acceptLatestLegalDocument, isLegalDocumentType } from "@/lib/server/legal";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LegalAcceptPayload = {
  type?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = await rateLimitRequest(request, "legal:accept", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to accept legal terms.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as LegalAcceptPayload | null;
  if (!isLegalDocumentType(payload?.type)) {
    return NextResponse.json({ ok: false, error: "invalid_legal_document" }, { status: 400 });
  }

  try {
    const status = await acceptLatestLegalDocument(access.user.id, payload.type);
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    console.warn("[legal] acceptance failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "legal_acceptance_unavailable" }, { status: 503 });
  }
}
