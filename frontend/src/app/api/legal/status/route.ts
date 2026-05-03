import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { emptyLegalStatus, getLegalStatus } from "@/lib/server/legal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ ok: true, authenticated: false, ...emptyLegalStatus() });
  }

  try {
    const status = await getLegalStatus(user.id);
    return NextResponse.json({ ok: true, authenticated: true, ...status });
  } catch (error) {
    console.warn("[legal] status lookup failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "legal_status_unavailable", ...emptyLegalStatus() }, { status: 503 });
  }
}
