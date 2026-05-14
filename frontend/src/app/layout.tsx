import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountOnboardingGate } from "@/components/account/AccountOnboardingGate";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { BetaFeedbackWidget } from "@/components/analytics/BetaFeedbackWidget";
import { PresentationModeController } from "@/components/presentation/PresentationModeController";
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
  other: {
    "apple-mobile-web-app-title": BRAND_NAME,
    "mobile-web-app-capable": "yes",
    "theme-color": "#0b1020",
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
            <AccountOnboardingGate />
            <Suspense fallback={null}>
              <PresentationModeController />
            </Suspense>
            <BetaFeedbackWidget />
          </AnalyticsProvider>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
