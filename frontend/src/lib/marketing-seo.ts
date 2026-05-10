import type { Metadata } from "next";
import { BRAND_DESCRIPTION, BRAND_NAME, CANONICAL_URL } from "@/lib/brand";

export const marketingBaseUrl = CANONICAL_URL;
export const appBaseUrl = CANONICAL_URL;
export const openGraphImageUrl = `${marketingBaseUrl}/og-image.png`;

const title = `${BRAND_NAME} — AI Market Intelligence`;
const description =
  "WAIT-first AI market intelligence for evidence-aware market research, risk filtering, replayable simulations, and clearer decisions. Not financial advice.";

export function marketingMetadata(path = "/", overrides: Partial<Metadata> = {}): Metadata {
  const canonical = new URL(path, marketingBaseUrl).toString();
  const pageTitle = typeof overrides.title === "string" ? overrides.title : title;
  const pageDescription = overrides.description ?? description;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical,
    },
    applicationName: BRAND_NAME,
    authors: [{ name: BRAND_NAME, url: marketingBaseUrl }],
    creator: BRAND_NAME,
    keywords: [
      "AI market intelligence",
      "WAIT-first trading research",
      "trade filtering",
      "trading research platform",
      "trading decision support",
      "reduce overtrading",
      "stock analysis AI",
      "risk-aware trading research",
      "explainable market research",
      "market replay analysis",
      "simulated strategy performance",
    ],
    openGraph: {
      title: String(pageTitle),
      description: String(pageDescription),
      locale: "en_US",
      type: "website",
      url: canonical,
      siteName: BRAND_NAME,
      images: [
        {
          url: openGraphImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: `${BRAND_NAME} social preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      creator: BRAND_NAME,
      title: String(pageTitle),
      description: String(pageDescription),
      images: [openGraphImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    ...overrides,
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "FinanceApplication",
    name: BRAND_NAME,
    operatingSystem: "Web",
    description: BRAND_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "20",
      priceCurrency: "USD",
      availability: "https://schema.org/PreOrder",
      description: "$20/month after beta. Free limited beta access is available.",
    },
    url: marketingBaseUrl,
  };
}
