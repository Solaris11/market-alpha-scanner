import { NextResponse } from "next/server";
import { requirePremium } from "@/lib/server/access-control";
import { loadMobileIntelligenceCenter } from "@/lib/server/mobile-push-intelligence";
import { rateLimitRequest } from "@/lib/server/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requirePremium();
  if (!access.ok) return access.response;

  const limited = await rateLimitRequest(request, "mobile-intelligence", { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const center = await loadMobileIntelligenceCenter(access.user.id);
    return NextResponse.json({ center, ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Mobile intelligence is temporarily unavailable." }, { status: 503 });
  }
}
