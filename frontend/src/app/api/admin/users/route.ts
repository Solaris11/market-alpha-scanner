import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/access-control";
import { listAdminUsers } from "@/lib/server/admin-data";
import { withRequestMetrics } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/admin/users", async () => {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const url = new URL(request.url);
    return NextResponse.json({
      ok: true,
      users: await listAdminUsers({
        role: url.searchParams.get("role"),
        search: url.searchParams.get("q"),
        subscriptionStatus: url.searchParams.get("status"),
      }),
    });
  });
}
