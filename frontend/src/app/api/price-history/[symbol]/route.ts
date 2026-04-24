import { NextResponse } from "next/server";
import { getSymbolPriceHistory } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "1y";
  return NextResponse.json({ symbol: symbol.toUpperCase(), period, rows: await getSymbolPriceHistory(symbol, period) });
}
