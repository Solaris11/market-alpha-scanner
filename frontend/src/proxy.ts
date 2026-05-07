import { NextResponse, type NextRequest } from "next/server";
import { CANONICAL_DOMAIN, CANONICAL_WWW_DOMAIN, LEGACY_APEX_DOMAIN, LEGACY_APP_DOMAIN, LEGACY_WWW_DOMAIN } from "@/lib/brand";

const LEGACY_REDIRECT_ENABLED = process.env.TRADEVETO_REDIRECT_ENABLED === "true";

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

export function proxy(request: NextRequest): NextResponse {
  const hostname = getHostname(request);
  const { pathname } = request.nextUrl;
  const pathWithSearch = `${pathname}${request.nextUrl.search}`;

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
