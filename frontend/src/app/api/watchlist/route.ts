import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { scannerOutputDir } from "@/lib/scanner-data";
import { getCurrentUser } from "@/lib/server/auth";
import { requireUser } from "@/lib/server/access-control";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { addUserWatchlistSymbols, readUserWatchlist } from "@/lib/server/user-watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]/g, "");
}

function watchlistPath() {
  return path.join(scannerOutputDir(), "watchlist.json");
}

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    const symbols = await readUserWatchlist(user.id).catch(() => []);
    return NextResponse.json({ authenticated: true, symbols });
  }

  const symbols = await readScannerWatchlist().catch(() => []);
  return NextResponse.json({ authenticated: false, symbols });
}

export async function POST(request: Request) {
  const rateLimited = rateLimitRequest(request, "watchlist:write", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const invalidOrigin = validateMutationRequest(request);
  if (invalidOrigin) return invalidOrigin;

  const access = await requireUser("Sign in to save this watchlist.");
  if (!access.ok) return access.response;

  const csrf = requireCsrf(request);
  if (csrf) return csrf;

  const payload = (await request.json().catch(() => null)) as { symbols?: unknown[] } | null;
  const symbols = Array.from(new Set((payload?.symbols ?? []).map(normalizeSymbol).filter(Boolean))).sort();
  try {
    const saved = await addUserWatchlistSymbols(access.user.id, symbols);
    return NextResponse.json({ ok: true, message: "Watchlist saved.", symbols: saved });
  } catch {
    return NextResponse.json({ ok: false, message: "Watchlist sync is unavailable.", symbols: [] }, { status: 500 });
  }
}

async function readScannerWatchlist(): Promise<string[]> {
  const text = await fs.readFile(watchlistPath(), "utf8");
  const parsed = JSON.parse(text) as unknown;
  return Array.from(new Set((Array.isArray(parsed) ? parsed : []).map(normalizeSymbol).filter(Boolean))).sort();
}
