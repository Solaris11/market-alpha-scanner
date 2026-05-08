import type { MetadataRoute } from "next";
import { CANONICAL_URL } from "@/lib/brand";

const PRIVATE_ROUTES = ["/api/", "/account", "/terminal", "/opportunities", "/paper", "/performance", "/history", "/alerts", "/advanced", "/symbol/"];

const SOCIAL_CRAWLER_USER_AGENTS = ["facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "Slackbot", "Discordbot"];

const SOCIAL_PREVIEW_PATHS = ["/", "/pricing", "/features", "/how-it-works", "/faq", "/og-image.png"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: SOCIAL_CRAWLER_USER_AGENTS,
        allow: SOCIAL_PREVIEW_PATHS,
        disallow: PRIVATE_ROUTES,
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_ROUTES,
      },
    ],
    sitemap: `${CANONICAL_URL}/sitemap.xml`,
  };
}
