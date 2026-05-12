import { NextRequest } from "next/server";
import { symbolLogoUrl } from "@/lib/visual-identity";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const symbol = String(request.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) {
    return Response.json({ error: "symbol_required" }, { status: 400 });
  }

  const upstreamUrl = symbolLogoUrl(symbol);
  if (!upstreamUrl) {
    return Response.json({ error: "symbol_logo_unavailable" }, { status: 404 });
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { accept: "image/avif,image/webp,image/png,image/*;q=0.8" },
      next: { revalidate: 86_400 },
    });
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      return Response.json({ error: "symbol_logo_fetch_failed" }, { status: 502 });
    }

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch {
    return Response.json({ error: "symbol_logo_fetch_failed" }, { status: 502 });
  }
}
