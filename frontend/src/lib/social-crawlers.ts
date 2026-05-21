const SOCIAL_CRAWLER_USER_AGENT =
  /\b(facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|linkedinbot|slackbot|discordbot)\b/i;

const PUBLIC_SOCIAL_PREVIEW_PATHS = new Set([
  "/",
  "/pricing",
  "/features",
  "/how-it-works",
  "/faq",
  "/intelligence",
  "/intelligence/shock-opportunities",
  "/intelligence/macro-regime",
  "/feed",
  "/macro",
  "/market-memory",
  "/robots.txt",
  "/og-image.png",
  "/og-image.svg",
]);
const PUBLIC_SOCIAL_PREVIEW_PREFIXES = ["/symbol/", "/intelligence/why-wait/"] as const;
const STATIC_SOCIAL_PREVIEW_PATHS = new Set(["/", "/pricing", "/features", "/how-it-works", "/faq", "/intelligence", "/intelligence/shock-opportunities", "/intelligence/macro-regime", "/feed", "/macro", "/market-memory"]);

export function isSocialCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  return SOCIAL_CRAWLER_USER_AGENT.test(userAgent ?? "");
}

export function isPublicSocialPreviewPath(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname);
  return PUBLIC_SOCIAL_PREVIEW_PATHS.has(normalized) || PUBLIC_SOCIAL_PREVIEW_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isSafeSocialCrawlerMethod(method: string | null | undefined): boolean {
  const normalized = (method ?? "").toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

export function shouldAllowSocialCrawlerRequest(input: { method: string | null | undefined; pathname: string | null | undefined; userAgent: string | null | undefined }): boolean {
  return isSafeSocialCrawlerMethod(input.method) && isPublicSocialPreviewPath(input.pathname) && isSocialCrawlerUserAgent(input.userAgent);
}

export function shouldServeStaticSocialPreview(input: { method: string | null | undefined; pathname: string | null | undefined; userAgent: string | null | undefined }): boolean {
  const normalized = normalizePathname(input.pathname);
  return isSafeSocialCrawlerMethod(input.method) && STATIC_SOCIAL_PREVIEW_PATHS.has(normalized) && isSocialCrawlerUserAgent(input.userAgent);
}

export function buildStaticSocialPreviewHtml(input: { pathname: string | null | undefined }): string {
  const canonicalPath = normalizePathname(input.pathname);
  const canonicalUrl = canonicalPath === "/" ? "https://tradeveto.com/" : `https://tradeveto.com${canonicalPath}`;
  const title = "TradeVeto - AI Market Intelligence for Disciplined Traders";
  const description =
    "TradeVeto helps traders avoid low-quality setups with AI veto logic, readiness scoring, confidence, and regime-aware research. Research only. Not financial advice.";
  const imageUrl = "https://tradeveto.com/og-image.png";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:site_name" content="TradeVeto">
<meta property="og:type" content="website">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="TradeVeto social preview">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${imageUrl}">
</head>
<body>
<h1>TradeVeto</h1>
<p>${escapeHtml(description)}</p>
</body>
</html>`;
}

function normalizePathname(pathname: string | null | undefined): string {
  const rawPath = pathname?.trim() || "/";
  const withoutQuery = rawPath.split("?")[0]?.split("#")[0] || "/";
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (withSlash === "/") return withSlash;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
