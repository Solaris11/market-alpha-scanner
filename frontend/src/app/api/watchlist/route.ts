import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { scannerOutputDir } from "@/lib/scanner-data";
import { getCurrentUser } from "@/lib/server/auth";
import { readUserWatchlist } from "@/lib/server/user-watchlist";

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

async function writeAtomic(filePath: string, payload: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
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
  const payload = (await request.json().catch(() => null)) as { symbols?: unknown[] } | null;
  const symbols = Array.from(new Set((payload?.symbols ?? []).map(normalizeSymbol).filter(Boolean))).sort();
  try {
    await writeAtomic(watchlistPath(), symbols);
    return NextResponse.json({ ok: true, symbols, path: watchlistPath() });
  } catch {
    return NextResponse.json({ ok: false, error: "Watchlist sync is unavailable.", symbols });
  }
}

async function readScannerWatchlist(): Promise<string[]> {
  const text = await fs.readFile(watchlistPath(), "utf8");
  const parsed = JSON.parse(text) as unknown;
  return Array.from(new Set((Array.isArray(parsed) ? parsed : []).map(normalizeSymbol).filter(Boolean))).sort();
}
