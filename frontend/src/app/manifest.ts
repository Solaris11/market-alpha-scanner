import type { MetadataRoute } from "next";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#070a12",
    categories: ["finance", "productivity"],
    description: `${BRAND_DESCRIPTION} ${BRAND_TAGLINE}`,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    icons: [
      {
        sizes: "180x180",
        src: "/apple-touch-icon.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "192x192",
        src: "/icon-192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icon.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icon.png",
        type: "image/png",
      },
    ],
    id: "/mobile",
    lang: "en-US",
    launch_handler: {
      client_mode: "focus-existing",
    },
    name: BRAND_NAME,
    orientation: "portrait",
    prefer_related_applications: false,
    screenshots: [
      {
        form_factor: "narrow",
        label: "TradeVeto mobile terminal",
        sizes: "390x844",
        src: "/marketing/screenshots/terminal-mobile.png",
        type: "image/png",
      },
      {
        form_factor: "wide",
        label: "TradeVeto terminal dashboard",
        sizes: "1440x900",
        src: "/marketing/screenshots/terminal-desktop.png",
        type: "image/png",
      },
      {
        form_factor: "wide",
        label: "TradeVeto opportunities workspace",
        sizes: "1440x900",
        src: "/marketing/screenshots/opportunities-desktop.png",
        type: "image/png",
      },
    ],
    scope: "/",
    short_name: "TradeVeto",
    shortcuts: [
      {
        description: "Open the TradeVeto market decision terminal.",
        icons: [{ sizes: "192x192", src: "/icon-192.png", type: "image/png" }],
        name: "Terminal",
        short_name: "Terminal",
        url: "/terminal?source=pwa-shortcut",
      },
      {
        description: "Review current opportunities and filters.",
        icons: [{ sizes: "192x192", src: "/icon-192.png", type: "image/png" }],
        name: "Opportunities",
        short_name: "Opportunities",
        url: "/opportunities?source=pwa-shortcut",
      },
      {
        description: "Open mobile intelligence and push setup.",
        icons: [{ sizes: "192x192", src: "/icon-192.png", type: "image/png" }],
        name: "Mobile Intelligence",
        short_name: "Mobile",
        url: "/mobile?source=pwa-shortcut",
      },
    ],
    start_url: "/mobile?source=pwa",
    theme_color: "#0b1020",
  };
}
