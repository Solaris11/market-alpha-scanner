import assert from "node:assert/strict";
import test from "node:test";
import { hashRateLimitKey, rateLimitPayload } from "./rate-limit-policy";

test("rate limit response uses stable public shape", () => {
  const payload = rateLimitPayload(17);
  assert.deepEqual(payload, {
    error: "rate_limited",
    retryAfter: 17,
  });
});

test("rate limit keys are hashed before persistence", () => {
  const raw = "auth:login:ip=203.0.113.10:user=anonymous";
  const hashed = hashRateLimitKey(raw);

  assert.equal(hashed.length, 64);
  assert.match(hashed, /^[a-f0-9]+$/);
  assert.notEqual(hashed, raw);
});
