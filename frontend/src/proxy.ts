import { NextResponse, type NextRequest } from "next/server";

const APP_HOST = "app.marketalpha.co";
const APEX_HOST = "marketalpha.co";
const WWW_HOST = "www.marketalpha.co";

const appPathPrefixes = [
  "/account",
  "/advanced",
  "/alerts",
  "/api",
  "/history",
  "/opportunities",
  "/paper",
  "/performance",
  "/symbol",
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

  if (hostname === WWW_HOST) {
    const url = request.nextUrl.clone();
    url.hostname = APEX_HOST;
    return NextResponse.redirect(url, 308);
  }

  if (hostname === APP_HOST && pathname === "/") {
    return NextResponse.redirect(new URL("/terminal", request.url), 307);
  }

  if (hostname === APEX_HOST && isAppPath(pathname)) {
    const url = request.nextUrl.clone();
    url.hostname = APP_HOST;
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon-ma.ico|icon.png|apple-touch-icon.png|logo.svg).*)"],
};
