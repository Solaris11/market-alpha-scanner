import assert from "node:assert/strict";
import test from "node:test";
import type { Event } from "@sentry/nextjs";
import { scrubSentryEvent } from "./sentry-scrub";

test("Sentry scrubber removes sensitive headers and token-like values", () => {
  const event = {
    extra: {
      nested: {
        message: "failed with Bearer abcdefghijklmnopqrstuvwxyz0123456789",
        stripe: "whsec_1234567890abcdef",
      },
    },
    request: {
      cookies: "session=sess_1234567890abcdef",
      headers: {
        Authorization: "Bearer secret-token",
        "Stripe-Signature": "t=123,v1=secret",
        "X-Market-Alpha-Monitoring-Token": "monitoring-secret",
      },
      url: "https://app.marketalpha.co/api/health?token=secret",
    },
  } as unknown as Event;

  const scrubbed = scrubSentryEvent(event);
  const serialized = JSON.stringify(scrubbed);

  assert.doesNotMatch(serialized, /monitoring-secret|secret-token|whsec_1234567890abcdef|sess_1234567890abcdef/);
  assert.match(serialized, /\[redacted\]/);
});
