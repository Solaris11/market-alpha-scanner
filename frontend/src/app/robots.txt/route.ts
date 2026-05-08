import { CANONICAL_URL } from "@/lib/brand";

const PRIVATE_ROUTES = ["/api/", "/account", "/terminal", "/opportunities", "/paper", "/performance", "/history", "/alerts", "/advanced", "/symbol/"];

const SOCIAL_CRAWLER_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "meta-externalagent",
  "meta-externalfetcher",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
];

const SOCIAL_PREVIEW_PATHS = ["/", "/pricing", "/features", "/how-it-works", "/faq", "/robots.txt", "/og-image.png"];

export const dynamic = "force-dynamic";

function ruleBlock(userAgents: string[], allows: string[], disallows: string[]): string {
  return [
    ...userAgents.map((userAgent) => `User-Agent: ${userAgent}`),
    ...allows.map((path) => `Allow: ${path}`),
    ...disallows.map((path) => `Disallow: ${path}`),
  ].join("\n");
}

export function buildRobotsTxt(): string {
  return [
    ruleBlock(SOCIAL_CRAWLER_USER_AGENTS, SOCIAL_PREVIEW_PATHS, PRIVATE_ROUTES),
    ruleBlock(["*"], ["/"], PRIVATE_ROUTES),
    `Sitemap: ${CANONICAL_URL}/sitemap.xml`,
    "",
  ].join("\n\n");
}

function robotsResponse(body: string | null): Response {
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=60, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export function GET(): Response {
  return robotsResponse(buildRobotsTxt());
}

export function HEAD(): Response {
  return robotsResponse(null);
}
