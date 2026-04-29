import { NextResponse } from "next/server";
import { getPaperData } from "@/lib/paper-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = await getPaperData();
  return NextResponse.json({ configured: data.configured, rows: data.events, error: data.error ?? null });
}
