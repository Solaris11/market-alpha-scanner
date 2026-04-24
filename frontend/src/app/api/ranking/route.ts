import { NextResponse } from "next/server";
import { getFullRanking } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rows: await getFullRanking() });
}
