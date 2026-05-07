"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { flushAnalyticsEvents, trackRouteAnalytics } from "@/lib/client/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    trackRouteAnalytics(pathname);
  }, [pathname]);

  useEffect(() => {
    function flush() {
      void flushAnalyticsEvents();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  return <>{children}</>;
}
