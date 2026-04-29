import { NextResponse } from "next/server";
import { getPaperAnalytics } from "@/lib/paper-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = await getPaperAnalytics();
  return NextResponse.json({ configured: data.configured, summary: data.summary, error: data.error ?? null });
}
