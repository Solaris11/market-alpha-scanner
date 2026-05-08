import { NextResponse, type NextRequest } from "next/server";
import { CANONICAL_DOMAIN, CANONICAL_WWW_DOMAIN, LEGACY_APEX_DOMAIN, LEGACY_APP_DOMAIN, LEGACY_WWW_DOMAIN } from "@/lib/brand";

const LEGACY_REDIRECT_ENABLED = process.env.TRADEVETO_REDIRECT_ENABLED === "true";
const PUBLIC_HOSTS = new Set([CANONICAL_DOMAIN, CANONICAL_WWW_DOMAIN, LEGACY_APEX_DOMAIN, LEGACY_WWW_DOMAIN, LEGACY_APP_DOMAIN]);

const appPathPrefixes = [
  "/account",
  "/advanced",
  "/admin",
  "/alerts",
  "/api",
  "/history",
  "/opportunities",
  "/paper",
  "/performance",
  "/symbol",
  "/support",
  "/terminal",
];

function getHostname(request: NextRequest): string {
  return (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
}

function isAppPath(pathname: string): boolean {
  return appPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function requestScheme(request: NextRequest): "http" | "https" | "unknown" {
  const cfVisitor = request.headers.get("cf-visitor");
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: unknown };
      if (parsed.scheme === "http" || parsed.scheme === "https") return parsed.scheme;
    } catch {
      // Ignore malformed Cloudflare visitor metadata and fall back to the URL protocol.
    }
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto === "http" || forwardedProto === "https") return forwardedProto;

  if (request.nextUrl.protocol === "http:" || request.nextUrl.protocol === "https:") {
    return request.nextUrl.protocol.slice(0, -1) as "http" | "https";
  }

  return "unknown";
}

function httpsRedirectHost(hostname: string): string {
  if (LEGACY_REDIRECT_ENABLED && (hostname === LEGACY_APEX_DOMAIN || hostname === LEGACY_WWW_DOMAIN || hostname === LEGACY_APP_DOMAIN)) return CANONICAL_DOMAIN;
  if (hostname === CANONICAL_WWW_DOMAIN) return CANONICAL_DOMAIN;
  return hostname;
}

export function proxy(request: NextRequest): NextResponse {
  const hostname = getHostname(request);
  const { pathname } = request.nextUrl;
  const pathWithSearch = `${pathname}${request.nextUrl.search}`;

  if (PUBLIC_HOSTS.has(hostname) && requestScheme(request) === "http") {
    return NextResponse.redirect(new URL(pathWithSearch, `https://${httpsRedirectHost(hostname)}`), hostname === CANONICAL_DOMAIN ? 308 : 301);
  }

  if (hostname === CANONICAL_WWW_DOMAIN) {
    return NextResponse.redirect(new URL(pathWithSearch, `https://${CANONICAL_DOMAIN}`), 308);
  }

  if (LEGACY_REDIRECT_ENABLED && (hostname === LEGACY_APEX_DOMAIN || hostname === LEGACY_WWW_DOMAIN || hostname === LEGACY_APP_DOMAIN)) {
    return NextResponse.redirect(new URL(pathWithSearch, `https://${CANONICAL_DOMAIN}`), 301);
  }

  if (hostname === LEGACY_WWW_DOMAIN) {
    return NextResponse.redirect(new URL(pathWithSearch, `https://${LEGACY_APEX_DOMAIN}`), 308);
  }

  if (hostname === LEGACY_APP_DOMAIN && pathname === "/") {
    return NextResponse.redirect(new URL("/terminal", request.url), 307);
  }

  if (hostname === LEGACY_APEX_DOMAIN && isAppPath(pathname)) {
    return NextResponse.redirect(new URL(pathWithSearch, `https://${LEGACY_APP_DOMAIN}`), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon-ma.ico|favicon.svg|icon.png|apple-touch-icon.png|logo.svg|logo-icon.svg|og-image.svg).*)"],
};
