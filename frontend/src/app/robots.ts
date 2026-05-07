import type { MetadataRoute } from "next";
import { CANONICAL_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/terminal", "/opportunities", "/paper", "/performance", "/history", "/alerts", "/advanced", "/symbol/"],
    },
    sitemap: `${CANONICAL_URL}/sitemap.xml`,
  };
}
