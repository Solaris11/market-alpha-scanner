import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { scannerOutputDir } from "@/lib/scanner-data";

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

export async function POST(request: Request) {
  const payload = (await request.json()) as { symbols?: unknown[] };
  const symbols = Array.from(new Set((payload.symbols ?? []).map(normalizeSymbol).filter(Boolean))).sort();
  await writeAtomic(watchlistPath(), symbols);
  return NextResponse.json({ ok: true, symbols, path: watchlistPath() });
}
