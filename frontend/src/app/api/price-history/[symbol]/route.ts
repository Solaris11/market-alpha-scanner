import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/server/access-control";
import { rateLimitRequest } from "@/lib/server/request-security";

type PriceHistoryPayload = {
  ok: boolean;
  symbol: string;
  period: string;
  requested_period?: string;
  yf_period?: string;
  yf_interval?: string;
  point_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  interval?: string;
  rows: Record<string, unknown>[];
  error?: string;
};

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set(["1d", "1wk", "1mo", "6mo", "ytd", "1y", "5y", "max"]);

function projectRoot() {
  return process.env.SCANNER_ROOT ?? path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..");
}

function pythonBin() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const localVenv = path.join(projectRoot(), ".venv", "bin", "python");
  if (fsSync.existsSync(localVenv)) return localVenv;
  const deploymentVenv = "/opt/apps/market-alpha-scanner/venv/bin/python";
  if (fsSync.existsSync(deploymentVenv)) return deploymentVenv;
  return "python3";
}

function fetchPriceHistory(symbol: string, period: string) {
  const root = projectRoot();
  const script = path.join(root, "tools", "get_price_history.py");

  return new Promise<PriceHistoryPayload>((resolve) => {
    execFile(
      pythonBin(),
      [script, symbol, "--period", period],
      {
        cwd: root,
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        try {
          const parsed = JSON.parse(stdout || "{}") as PriceHistoryPayload;
          if (error && !parsed.error) {
            parsed.ok = false;
            parsed.error = "Price history is unavailable.";
          }
          resolve(parsed);
        } catch {
          resolve({
            ok: false,
            symbol: symbol.toUpperCase(),
            period,
            rows: [],
            error: "Price history is unavailable.",
          });
        }
      },
    );
  });
}

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const rateLimited = await rateLimitRequest(request, "admin:price-history", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const access = await requireAdmin();
  if (!access.ok) return access.response;

  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "1y").toLowerCase();
  if (!VALID_PERIODS.has(period)) {
    return NextResponse.json({ ok: false, symbol: symbol.toUpperCase(), period, rows: [], error: `Unsupported period: ${period}` }, { status: 400 });
  }

  const payload = await fetchPriceHistory(symbol, period);
  return NextResponse.json(payload, { status: payload.ok ? 200 : 502 });
}
