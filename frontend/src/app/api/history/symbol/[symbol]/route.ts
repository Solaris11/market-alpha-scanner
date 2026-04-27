import { NextResponse } from "next/server";
import { getSymbolHistoryForSymbol } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { symbol } = await context.params;
  const cleaned = symbol.trim().toUpperCase();
  const rows = await getSymbolHistoryForSymbol(cleaned);
  return NextResponse.json({ symbol: cleaned, rows });
}
