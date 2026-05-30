import { NextResponse } from "next/server";
import { enterpriseSsoConnectionsFromEnv } from "@/lib/server/enterprise";
import { googleOAuthConfigured } from "@/lib/server/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const enterprise = enterpriseSsoConnectionsFromEnv().map((connection) => ({
    configured: connection.configured,
    label: connection.label,
    provider: connection.provider,
    status: connection.status,
  }));
  return NextResponse.json({
    enterprise,
    google: {
      enabled: googleOAuthConfigured(),
    },
  });
}
