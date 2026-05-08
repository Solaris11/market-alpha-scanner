const SOCIAL_CRAWLER_USER_AGENT =
  /\b(facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|linkedinbot|slackbot|discordbot)\b/i;

const PUBLIC_SOCIAL_PREVIEW_PATHS = new Set(["/", "/pricing", "/features", "/how-it-works", "/faq", "/og-image.png", "/og-image.svg"]);

export function isSocialCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  return SOCIAL_CRAWLER_USER_AGENT.test(userAgent ?? "");
}

export function isPublicSocialPreviewPath(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname);
  return PUBLIC_SOCIAL_PREVIEW_PATHS.has(normalized);
}

export function isSafeSocialCrawlerMethod(method: string | null | undefined): boolean {
  const normalized = (method ?? "").toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

export function shouldAllowSocialCrawlerRequest(input: { method: string | null | undefined; pathname: string | null | undefined; userAgent: string | null | undefined }): boolean {
  return isSafeSocialCrawlerMethod(input.method) && isPublicSocialPreviewPath(input.pathname) && isSocialCrawlerUserAgent(input.userAgent);
}

function normalizePathname(pathname: string | null | undefined): string {
  const rawPath = pathname?.trim() || "/";
  const withoutQuery = rawPath.split("?")[0]?.split("#")[0] || "/";
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (withSlash === "/") return withSlash;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}
