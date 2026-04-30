import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { removeUserWatchlistSymbol } from "@/lib/server/user-watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ authenticated: false, error: "Sign in to save this watchlist." }, { status: 401 });
  }

  const { symbol } = await context.params;
  try {
    return NextResponse.json({ authenticated: true, symbols: await removeUserWatchlistSymbol(user.id, symbol) });
  } catch {
    return NextResponse.json({ authenticated: true, error: "Failed to update watchlist.", symbols: [] }, { status: 500 });
  }
}
