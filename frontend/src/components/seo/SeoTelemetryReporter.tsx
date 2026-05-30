"use client";

import { useReportWebVitals } from "next/web-vitals";
import { trackAnalyticsEvent } from "@/lib/client/analytics";

const CORE_WEB_VITAL_NAMES = new Set(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]);

export function SeoTelemetryReporter() {
  useReportWebVitals((metric) => {
    if (!CORE_WEB_VITAL_NAMES.has(metric.name)) return;
    trackAnalyticsEvent("seo_core_web_vital", {
      metricId: metric.id,
      metricName: metric.name,
      metricRating: metric.rating ?? null,
      metricValue: Number(metric.value.toFixed(2)),
      navigationType: metric.navigationType ?? null,
    }, { source: "web_vitals" });
  });
  return null;
}
