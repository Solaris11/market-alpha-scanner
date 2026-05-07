import type { MetadataRoute } from "next";
import { CANONICAL_URL } from "@/lib/brand";

const routes = ["/", "/features", "/pricing", "/how-it-works", "/faq", "/risk-disclaimer", "/risk-disclosure", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${CANONICAL_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
