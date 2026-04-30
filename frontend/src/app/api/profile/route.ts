import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { PUT as updateUserProfile } from "../user/profile/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json({ authenticated: Boolean(user), profile: user ?? null });
}

export async function PUT(request: Request) {
  return updateUserProfile(request);
}
