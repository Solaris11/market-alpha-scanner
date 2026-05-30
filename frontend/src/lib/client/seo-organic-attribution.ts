"use client";

import { normalizeSeoSlug } from "@/lib/seo/organic-acquisition";

export type SeoOrganicAttribution = {
  campaign: string | null;
  landingPath: string;
  medium: "organic";
  query: string | null;
  searchEngine: string | null;
  source: string;
};

const ORGANIC_ATTRIBUTION_KEY = "tv_seo_organic_attribution";
const ORGANIC_OPEN_KEY_PREFIX = "tv_seo_organic_open";

const SEARCH_ENGINE_HOSTS: Array<{ engine: string; pattern: RegExp }> = [
  { engine: "google", pattern: /(^|\.)google\./i },
  { engine: "bing", pattern: /(^|\.)bing\.com$/i },
  { engine: "duckduckgo", pattern: /(^|\.)duckduckgo\.com$/i },
  { engine: "yahoo", pattern: /(^|\.)search\.yahoo\.com$/i },
  { engine: "brave", pattern: /(^|\.)search\.brave\.com$/i },
  { engine: "ecosia", pattern: /(^|\.)ecosia\.org$/i },
  { engine: "perplexity", pattern: /(^|\.)perplexity\.ai$/i },
  { engine: "yandex", pattern: /(^|\.)yandex\./i },
  { engine: "baidu", pattern: /(^|\.)baidu\.com$/i },
];

export function captureSeoOrganicAttribution(location: Location, referrer: string): SeoOrganicAttribution | null {
  const params = new URLSearchParams(location.search);
  const utmMedium = compact(params.get("utm_medium"));
  const utmSource = compact(params.get("utm_source"));
  const utmCampaign = compact(params.get("utm_campaign"));
  const explicitOrganic = utmMedium === "organic" || utmMedium === "seo" || utmMedium === "search";
  const referrerAttribution = classifySearchReferrer(referrer);
  if (!explicitOrganic && !referrerAttribution) return readStoredSeoOrganicAttribution();

  const source = explicitOrganic ? (utmSource || referrerAttribution?.engine || "organic") : referrerAttribution?.engine ?? "organic";
  const attribution: SeoOrganicAttribution = {
    campaign: utmCampaign || null,
    landingPath: safeLandingPath(`${location.pathname}${location.search}`),
    medium: "organic",
    query: compact(params.get("q")) || referrerAttribution?.query || null,
    searchEngine: referrerAttribution?.engine ?? (isKnownSearchEngine(source) ? source : null),
    source,
  };
  try {
    window.sessionStorage.setItem(ORGANIC_ATTRIBUTION_KEY, JSON.stringify(attribution));
    window.localStorage.setItem(ORGANIC_ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Organic attribution is best-effort analytics only.
  }
  return attribution;
}

export function readStoredSeoOrganicAttribution(): SeoOrganicAttribution | null {
  if (typeof window === "undefined") return null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const parsed = parseOrganicAttribution(storage.getItem(ORGANIC_ATTRIBUTION_KEY));
      if (parsed) return parsed;
    } catch {
      // Try the next storage backend.
    }
  }
  return null;
}

export function seoOrganicAttributionMetadata(attribution: SeoOrganicAttribution | null): Record<string, string | null> {
  return {
    organicCampaign: attribution?.campaign ?? null,
    organicLandingPath: attribution?.landingPath ?? null,
    organicMedium: attribution?.medium ?? null,
    organicQuery: attribution?.query ?? null,
    organicSearchEngine: attribution?.searchEngine ?? null,
    organicSource: attribution?.source ?? null,
  };
}

export function seoOrganicOpenStorageKey(input: { pathname: string; source: string | null }): string {
  return `${ORGANIC_OPEN_KEY_PREFIX}:${safeLandingPath(input.pathname)}:${input.source ?? "unknown"}`;
}

export function hasEmittedSeoOrganicOpen(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function markSeoOrganicOpenEmitted(key: string): void {
  try {
    window.sessionStorage.setItem(key, "true");
  } catch {
    // Best-effort dedupe.
  }
}

export function isSearchLandingPath(pathname: string): boolean {
  return /^\/search\/[a-z0-9-]+$/i.test(pathname);
}

function classifySearchReferrer(referrer: string): { engine: string; query: string | null } | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    const match = SEARCH_ENGINE_HOSTS.find((item) => item.pattern.test(host));
    if (!match) return null;
    return {
      engine: match.engine,
      query: compact(url.searchParams.get("q") ?? url.searchParams.get("p")) || null,
    };
  } catch {
    return null;
  }
}

function isKnownSearchEngine(value: string): boolean {
  return SEARCH_ENGINE_HOSTS.some((item) => item.engine === value);
}

function parseOrganicAttribution(value: string | null): SeoOrganicAttribution | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SeoOrganicAttribution>;
    const source = compact(parsed.source);
    const landingPath = safeLandingPath(parsed.landingPath);
    if (!source || !landingPath) return null;
    return {
      campaign: compact(parsed.campaign) || null,
      landingPath,
      medium: "organic",
      query: compact(parsed.query) || null,
      searchEngine: compact(parsed.searchEngine) || null,
      source,
    };
  } catch {
    return null;
  }
}

function safeLandingPath(value: unknown): string {
  const text = String(value ?? "").trim();
  const [path] = text.split("?", 1);
  const normalizedPath = path.startsWith("/") ? path : "/";
  if (normalizedPath.startsWith("/search/")) {
    const slug = normalizeSeoSlug(normalizedPath.replace(/^\/search\//, ""));
    return slug ? `/search/${slug}` : "/search";
  }
  return normalizedPath.replace(/[^A-Za-z0-9/_\-.]/g, "").replace(/\/{2,}/g, "/").slice(0, 160) || "/";
}

function compact(value: unknown): string | null {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return text || null;
}
