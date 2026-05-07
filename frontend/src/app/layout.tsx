import type { Metadata } from "next";
import { AccountOnboardingGate } from "@/components/account/AccountOnboardingGate";
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
  icons: {
    apple: [{ url: "/logo-icon.svg?v=1", sizes: "256x256", type: "image/svg+xml" }],
    icon: [
      { url: "/favicon.svg?v=1", type: "image/svg+xml" },
      { url: "/logo-icon.svg?v=1", sizes: "256x256", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg?v=1",
  },
  appleWebApp: {
    title: BRAND_NAME,
  },
  other: {
    "apple-mobile-web-app-title": BRAND_NAME,
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
          {children}
          <AccountOnboardingGate />
        </CurrentUserProvider>
      </body>
    </html>
  );
}
