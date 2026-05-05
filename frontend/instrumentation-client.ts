import * as Sentry from "@sentry/nextjs";
import { sentryBeforeSend } from "./src/lib/observability/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    beforeSend: sentryBeforeSend,
    dsn,
    environment: process.env.NODE_ENV || "development",
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
