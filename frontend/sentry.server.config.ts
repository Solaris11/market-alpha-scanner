import * as Sentry from "@sentry/nextjs";
import { sentryBeforeSend } from "./src/lib/observability/sentry-scrub";

const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    beforeSend: sentryBeforeSend,
    dsn,
    environment: process.env.NODE_ENV || "development",
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}
