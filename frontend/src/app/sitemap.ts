import type { MetadataRoute } from "next";
import { CANONICAL_URL } from "@/lib/brand";
import { PUBLISHED_SYMBOLS } from "@/lib/trading/intelligence-publishing";

const staticRoutes = ["/", "/features", "/pricing", "/how-it-works", "/faq", "/feed", "/macro", "/market-memory", "/intelligence", "/intelligence/shock-opportunities", "/intelligence/macro-regime", "/risk-disclaimer", "/risk-disclosure", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const symbolRoutes = PUBLISHED_SYMBOLS.flatMap((symbol) => [`/symbol/${symbol}`, `/intelligence/why-wait/${symbol}`]);
  return [...staticRoutes, ...symbolRoutes].map((route) => ({
    url: `${CANONICAL_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "/" || route.startsWith("/symbol/") || route.startsWith("/intelligence") ? "daily" : "monthly",
    priority: priorityForRoute(route),
  }));
}

function priorityForRoute(route: string): number {
  if (route === "/") return 1;
  if (route === "/feed") return 0.95;
  if (route === "/macro" || route === "/market-memory") return 0.9;
  if (route === "/intelligence") return 0.92;
  if (route.startsWith("/symbol/")) return 0.86;
  if (route.startsWith("/intelligence/")) return 0.82;
  return 0.7;
}
