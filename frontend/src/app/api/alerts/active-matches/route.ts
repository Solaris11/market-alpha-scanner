import { NextResponse } from "next/server";
import { getActiveAlertMatches } from "@/lib/active-alert-matches";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getActiveAlertMatches());
}
