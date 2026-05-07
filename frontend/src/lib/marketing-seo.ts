import type { Metadata } from "next";
import { BRAND_DESCRIPTION, BRAND_NAME, CANONICAL_URL } from "@/lib/brand";

export const marketingBaseUrl = CANONICAL_URL;
export const appBaseUrl = CANONICAL_URL;

const title = `${BRAND_NAME} — AI Market Intelligence`;
const description =
  "AI-powered market intelligence that helps traders filter weak setups, analyze risk, and make clearer research decisions. Not financial advice.";

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
    keywords: [
      "AI market intelligence",
      "trade filtering",
      "trading research platform",
      "trading decision support",
      "reduce overtrading",
      "stock analysis AI",
      "risk-aware trading research",
      "explainable market research",
    ],
    openGraph: {
      title: String(pageTitle),
      description: String(pageDescription),
      type: "website",
      url: canonical,
      siteName: BRAND_NAME,
      images: [
        {
          url: `${marketingBaseUrl}/og-image.svg`,
          width: 1200,
          height: 630,
          alt: `${BRAND_NAME} social preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: String(pageTitle),
      description: String(pageDescription),
      images: [`${marketingBaseUrl}/og-image.svg`],
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
