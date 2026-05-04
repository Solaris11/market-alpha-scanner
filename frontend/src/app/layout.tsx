import type { Metadata } from "next";
import { CurrentUserProvider } from "@/hooks/useCurrentUser";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Alpha",
  description: "AI-powered trading research platform",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/favicon.ico",
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
        <CurrentUserProvider>{children}</CurrentUserProvider>
      </body>
    </html>
  );
}
