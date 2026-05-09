import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/access-control";
import { exportUserMemory } from "@/lib/server/user-memory-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const access = await requireUser("Sign in to export memory.");
  if (!access.ok) return access.response;
  const payload = await exportUserMemory(access.user.id);
  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="tradeveto-memory-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
