import { BRAND_NAME, CANONICAL_URL } from "@/lib/brand";

export type SearchLandingPage = {
  assetType: "symbol" | "theme" | "macro" | "education" | "opportunity";
  description: string;
  headline: string;
  primaryKeywords: string[];
  primarySymbols: string[];
  relatedLinks: Array<{ href: string; label: string }>;
  sections: Array<{ body: string; heading: string }>;
  slug: string;
  title: string;
};

export type OrganicAcquisitionCounts = {
  organicPaidConversions: number;
  organicSearchVisits: number;
  organicSessions: number;
  organicSignups: number;
  searchLandingVisits: number;
};

export type OrganicAcquisitionMetrics = OrganicAcquisitionCounts & {
  organicPaidConversionRatePct: number | null;
  organicSignupRatePct: number | null;
};

const FORBIDDEN_SEO_CLAIMS = /\b(guaranteed|sure profit|must buy|must sell|buy now|sell now|will definitely|cannot lose|can't lose)\b/i;

export const SEO_SEARCH_LANDING_PAGES: SearchLandingPage[] = [
  {
    assetType: "symbol",
    description: "AMD forecast research from TradeVeto: public-safe symbol intelligence, scanner context, macro pressure, and risk framing without price guarantees.",
    headline: "AMD Forecast Research",
    primaryKeywords: ["AMD forecast", "AMD stock forecast", "AMD AI market intelligence"],
    primarySymbols: ["AMD", "NVDA", "AVGO"],
    relatedLinks: [
      { href: "/symbol/AMD", label: "AMD symbol intelligence" },
      { href: "/intelligence/why-wait/AMD", label: "Why WAIT on AMD" },
      { href: "/macro", label: "Macro intelligence" },
    ],
    sections: [
      {
        heading: "What TradeVeto Reviews",
        body: "TradeVeto frames AMD through trend quality, macro pressure, replay context, volatility, source freshness, and setup fragility. The page is designed for research and evidence review, not financial advice.",
      },
      {
        heading: "What Can Change",
        body: "A stronger or weaker AMD research state can come from changing semiconductor breadth, index pressure, event freshness, liquidity conditions, or a new scanner packet.",
      },
      {
        heading: "How To Use It",
        body: "Use the public page as a starting point, then inspect the full symbol card or chart workflow when authenticated access is available.",
      },
    ],
    slug: "amd-forecast",
    title: "AMD Forecast Research - TradeVeto",
  },
  {
    assetType: "symbol",
    description: "NVDA analysis from TradeVeto: AI market intelligence, macro context, event freshness, and risk-aware research framing.",
    headline: "NVDA Analysis",
    primaryKeywords: ["NVDA analysis", "Nvidia stock analysis", "NVDA AI stocks"],
    primarySymbols: ["NVDA", "AMD", "AVGO", "TSM"],
    relatedLinks: [
      { href: "/symbol/NVDA", label: "NVDA symbol intelligence" },
      { href: "/intelligence/why-wait/NVDA", label: "Why WAIT on NVDA" },
      { href: "/search/best-ai-stocks", label: "Best AI stocks research" },
    ],
    sections: [
      {
        heading: "Evidence Reviewed",
        body: "The NVDA research surface connects scanner quality, replay history, macro pressure, sector leadership, and source-backed event context when available.",
      },
      {
        heading: "No Prediction Claim",
        body: "TradeVeto does not publish fixed targets or certain outcomes. It shows what evidence is constructive, mixed, stale, or limited.",
      },
    ],
    slug: "nvda-analysis",
    title: "NVDA Analysis - TradeVeto",
  },
  {
    assetType: "theme",
    description: "Best AI stocks research with TradeVeto: source-aware AI market intelligence across semiconductor and infrastructure symbols.",
    headline: "Best AI Stocks Research",
    primaryKeywords: ["best AI stocks", "AI stocks research", "AI stock screener"],
    primarySymbols: ["NVDA", "AMD", "AVGO", "ASML", "TSM", "CRWD"],
    relatedLinks: [
      { href: "/symbol/NVDA", label: "NVDA intelligence" },
      { href: "/symbol/AMD", label: "AMD intelligence" },
      { href: "/discover", label: "Discovery scanner" },
    ],
    sections: [
      {
        heading: "Ranking Philosophy",
        body: "TradeVeto ranks AI-related symbols by evidence quality, risk pressure, sector context, replay support, and source freshness. It is a research workflow, not a direct recommendation list.",
      },
      {
        heading: "What Makes A Setup Cleaner",
        body: "Cleaner AI-stock research usually combines improving breadth, lower fragility, confirmed liquidity, and source-backed event context.",
      },
    ],
    slug: "best-ai-stocks",
    title: "Best AI Stocks Research - TradeVeto",
  },
  {
    assetType: "opportunity",
    description: "Market opportunities research from TradeVeto: scanner-led opportunity discovery, risk context, and macro-aware setup review.",
    headline: "Market Opportunities",
    primaryKeywords: ["market opportunities", "stock market opportunities", "AI market scanner"],
    primarySymbols: ["SPY", "QQQ", "AMD", "NVDA"],
    relatedLinks: [
      { href: "/discover", label: "Discovery" },
      { href: "/scanner", label: "Scanner" },
      { href: "/intelligence/shock-opportunities", label: "Shock opportunity research" },
    ],
    sections: [
      {
        heading: "Opportunity Discovery",
        body: "The public landing page explains how TradeVeto separates potential setups from noisy, fragile, stale, or overextended conditions.",
      },
      {
        heading: "Risk Comes First",
        body: "Opportunities are framed with risk, freshness, source evidence, and WAIT-first restraint before any research setup is treated as useful.",
      },
    ],
    slug: "market-opportunities",
    title: "Market Opportunities - TradeVeto",
  },
  {
    assetType: "education",
    description: "Earnings analysis research workflow from TradeVeto: event freshness, post-event context, replay evidence, and no-fabrication boundaries.",
    headline: "Earnings Analysis Workflow",
    primaryKeywords: ["earnings analysis", "earnings stock analysis", "post earnings reaction"],
    primarySymbols: ["AMD", "NVDA", "AVGO", "CRWD"],
    relatedLinks: [
      { href: "/feed", label: "Intelligence feed" },
      { href: "/market-memory", label: "Market memory" },
      { href: "/history", label: "History workflows" },
    ],
    sections: [
      {
        heading: "Source-Bound Event Context",
        body: "Earnings analysis is only useful when the event date, freshness, source context, and price reaction are verifiable. TradeVeto labels limited data instead of inventing an earnings story.",
      },
      {
        heading: "Replay And Memory",
        body: "When history exists, TradeVeto connects the current setup to comparable prior reactions and shows uncertainty rather than pretending the next move is known.",
      },
    ],
    slug: "earnings-analysis",
    title: "Earnings Analysis - TradeVeto",
  },
  {
    assetType: "macro",
    description: "Sector intelligence research from TradeVeto: breadth, macro pressure, volatility, liquidity, and symbol-level sector context.",
    headline: "Sector Intelligence",
    primaryKeywords: ["sector intelligence", "sector analysis", "market sector scanner"],
    primarySymbols: ["QQQ", "SPY", "XLK", "XLE"],
    relatedLinks: [
      { href: "/macro", label: "Macro intelligence" },
      { href: "/intelligence/macro-regime", label: "Macro regime" },
      { href: "/feed", label: "Intelligence feed" },
    ],
    sections: [
      {
        heading: "Sector-Level Context",
        body: "TradeVeto connects symbol research to sector pressure, macro alignment, volatility, liquidity, and breadth conditions.",
      },
      {
        heading: "What It Avoids",
        body: "Sector pages do not fabricate live headlines, hidden provider states, or certain predictions. Limited domains stay clearly labeled.",
      },
    ],
    slug: "sector-intelligence",
    title: "Sector Intelligence - TradeVeto",
  },
];

export function getSearchLandingPage(slug: string): SearchLandingPage | null {
  const normalized = normalizeSeoSlug(slug);
  return SEO_SEARCH_LANDING_PAGES.find((page) => page.slug === normalized) ?? null;
}

export function normalizeSeoSlug(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function searchLandingCanonical(page: SearchLandingPage): string {
  return `${CANONICAL_URL}/search/${page.slug}`;
}

export function searchLandingJsonLd(page: SearchLandingPage): Record<string, unknown>[] {
  const canonical = searchLandingCanonical(page);
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      about: page.primaryKeywords,
      author: { "@type": "Organization", name: BRAND_NAME, url: CANONICAL_URL },
      dateModified: new Date().toISOString(),
      description: page.description,
      headline: page.headline,
      isAccessibleForFree: true,
      mainEntityOfPage: canonical,
      publisher: { "@type": "Organization", name: BRAND_NAME, url: CANONICAL_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", item: CANONICAL_URL, name: "TradeVeto", position: 1 },
        { "@type": "ListItem", item: canonical, name: page.headline, position: 2 },
      ],
    },
  ];
}

export function calculateOrganicAcquisitionMetrics(counts: OrganicAcquisitionCounts): OrganicAcquisitionMetrics {
  return {
    ...counts,
    organicPaidConversionRatePct: pct(counts.organicPaidConversions, Math.max(counts.organicSessions, counts.organicSearchVisits)),
    organicSignupRatePct: pct(counts.organicSignups, Math.max(counts.organicSessions, counts.organicSearchVisits)),
  };
}

export function assertSearchLandingPageIsTrustSafe(page: SearchLandingPage): boolean {
  const text = [
    page.description,
    page.headline,
    page.title,
    ...page.primaryKeywords,
    ...page.sections.flatMap((section) => [section.heading, section.body]),
  ].join(" ");
  return !FORBIDDEN_SEO_CLAIMS.test(text);
}

function pct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}
