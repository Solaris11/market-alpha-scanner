import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountOnboardingGate } from "@/components/account/AccountOnboardingGate";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { BetaFeedbackWidget } from "@/components/analytics/BetaFeedbackWidget";
import { PresentationModeController } from "@/components/presentation/PresentationModeController";
import { SeoTelemetryReporter } from "@/components/seo/SeoTelemetryReporter";
import { SymbolIntelligenceOverlay } from "@/components/symbol/SymbolIntelligenceOverlay";
import { CurrentUserProvider } from "@/hooks/useCurrentUser";
import { BRAND_DESCRIPTION, BRAND_NAME, CANONICAL_URL } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_URL),
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: CANONICAL_URL,
  },
  icons: {
    apple: [{ url: "/logo-icon.svg?v=1", sizes: "256x256", type: "image/svg+xml" }],
    icon: [
      { url: "/favicon.svg?v=1", type: "image/svg+xml" },
      { url: "/logo-icon.svg?v=1", sizes: "256x256", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg?v=1",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND_NAME,
  },
  openGraph: {
    description: BRAND_DESCRIPTION,
    locale: "en_US",
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    type: "website",
    url: CANONICAL_URL,
  },
  other: {
    "apple-mobile-web-app-title": BRAND_NAME,
    "mobile-web-app-capable": "yes",
    "theme-color": "#0b1020",
  },
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
    index: true,
  },
  twitter: {
    card: "summary_large_image",
    description: BRAND_DESCRIPTION,
    title: BRAND_NAME,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CurrentUserProvider>
          <AnalyticsProvider>
            {children}
            <SymbolIntelligenceOverlay />
            <AccountOnboardingGate />
            <Suspense fallback={null}>
              <PresentationModeController />
            </Suspense>
            <SeoTelemetryReporter />
            <BetaFeedbackWidget />
          </AnalyticsProvider>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
