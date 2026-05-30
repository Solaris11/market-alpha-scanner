import { NextResponse } from "next/server";
import { buildCompetitiveLeadershipCertification } from "@/lib/trading/competitive-leadership";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const model = buildCompetitiveLeadershipCertification();
  return NextResponse.json({ ok: true, model });
}
