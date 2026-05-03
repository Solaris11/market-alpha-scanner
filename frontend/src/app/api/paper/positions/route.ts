import { NextResponse } from "next/server";
import { getPaperData } from "@/lib/paper-data";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  const data = await getPaperData({ userId: user?.id ?? null });
  return NextResponse.json({
    ok: !data.error,
    authenticated: Boolean(user),
    configured: data.configured,
    rows: data.positions,
    error: data.error ?? null,
  });
}
