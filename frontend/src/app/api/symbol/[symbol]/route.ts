import { NextResponse } from "next/server";
import { getSymbolDetail } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  return NextResponse.json(await getSymbolDetail(symbol));
}
