import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { getCurrentUser } from "@/lib/server/auth";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { addUserWatchlistSymbols, normalizeWatchlistSymbols, readUserWatchlist } from "@/lib/server/user-watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WatchlistPayload = {
  symbol?: unknown;
  symbols?: unknown;
};

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, symbols: [] });
  }

  try {
    return NextResponse.json({ authenticated: true, symbols: await readUserWatchlist(user.id) });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to load watchlist.", symbols: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const rateLimited = rateLimitRequest(request, "user-watchlist:write", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to save this watchlist.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as WatchlistPayload | null;
  const symbols = normalizeWatchlistSymbols(Array.isArray(payload?.symbols) ? payload.symbols : [payload?.symbol]);

  try {
    return NextResponse.json({ authenticated: true, symbols: await addUserWatchlistSymbols(access.user.id, symbols) });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to save watchlist.", symbols: [] }, { status: 500 });
  }
}
