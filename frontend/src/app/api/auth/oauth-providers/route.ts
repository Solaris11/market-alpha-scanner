import { NextResponse } from "next/server";
import { googleOAuthConfigured } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    google: {
      enabled: googleOAuthConfigured(),
    },
  });
}
