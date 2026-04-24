import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Alpha Scanner",
  description: "Premium trading terminal frontend for Market Alpha Scanner outputs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
