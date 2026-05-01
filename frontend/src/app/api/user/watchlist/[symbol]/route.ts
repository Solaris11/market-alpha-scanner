import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { removeUserWatchlistSymbol } from "@/lib/server/user-watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const rateLimited = rateLimitRequest(request, "user-watchlist:delete", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to save this watchlist.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const { symbol } = await context.params;
  try {
    return NextResponse.json({ authenticated: true, symbols: await removeUserWatchlistSymbol(access.user.id, symbol) });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to update watchlist.", symbols: [] }, { status: 500 });
  }
}
