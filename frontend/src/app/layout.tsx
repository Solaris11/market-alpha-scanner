import type { Metadata } from "next";
import { AccountOnboardingGate } from "@/components/account/AccountOnboardingGate";
import { CurrentUserProvider } from "@/hooks/useCurrentUser";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://marketalpha.co"),
  title: {
    default: "Market Alpha",
    template: "%s | Market Alpha",
  },
  description: "AI-powered trading research platform",
  icons: {
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/favicon-ma.ico?v=2", sizes: "64x64", type: "image/x-icon" },
      { url: "/icon.png?v=2", sizes: "64x64", type: "image/png" },
    ],
    shortcut: "/favicon-ma.ico?v=2",
  },
  appleWebApp: {
    title: "Market Alpha",
  },
  other: {
    "apple-mobile-web-app-title": "Market Alpha",
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
