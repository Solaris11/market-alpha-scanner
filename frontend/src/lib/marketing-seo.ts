import type { Metadata } from "next";

export const marketingBaseUrl = "https://marketalpha.co";
export const appBaseUrl = "https://app.marketalpha.co";

const title = "Market Alpha Scanner — AI Trading Research Platform";
const description =
  "AI-powered trading research platform that helps traders reduce overtrading, analyze market setups, and make clearer trading decisions. Not financial advice.";

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
      "AI trading scanner",
      "stock market scanner",
      "trading research platform",
      "trading decision support",
      "reduce overtrading",
      "stock analysis AI",
      "market scanner",
      "trading signals research",
    ],
    openGraph: {
      title: String(pageTitle),
      description: String(pageDescription),
      type: "website",
      url: canonical,
      siteName: "Market Alpha Scanner",
      images: [
        {
          url: `${marketingBaseUrl}/icon.png`,
          width: 512,
          height: 512,
          alt: "Market Alpha",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: String(pageTitle),
      description: String(pageDescription),
      images: [`${marketingBaseUrl}/icon.png`],
    },
    ...overrides,
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "FinanceApplication",
    name: "Market Alpha Scanner",
    operatingSystem: "Web",
    description,
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
