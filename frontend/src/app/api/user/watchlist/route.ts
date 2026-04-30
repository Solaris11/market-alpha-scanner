import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
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
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, error: "Sign in to save this watchlist." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as WatchlistPayload | null;
  const symbols = normalizeWatchlistSymbols(Array.isArray(payload?.symbols) ? payload.symbols : [payload?.symbol]);

  try {
    return NextResponse.json({ authenticated: true, symbols: await addUserWatchlistSymbols(user.id, symbols) });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to save watchlist.", symbols: [] }, { status: 500 });
  }
}
