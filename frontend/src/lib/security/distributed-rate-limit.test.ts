import assert from "node:assert/strict";
import test from "node:test";
import { hashRateLimitKey, rateLimitPayload } from "./rate-limit-policy";
import { REQUEST_BODY_LIMITS, evaluateContentLength } from "./http-abuse-policy";

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

test("oversized request policy rejects only explicit large content lengths", () => {
  assert.deepEqual(evaluateContentLength(null, REQUEST_BODY_LIMITS.supportMessage), {
    maxBytes: REQUEST_BODY_LIMITS.supportMessage,
    ok: true,
  });
  assert.deepEqual(evaluateContentLength("128", REQUEST_BODY_LIMITS.supportMessage), {
    maxBytes: REQUEST_BODY_LIMITS.supportMessage,
    ok: true,
  });
  assert.deepEqual(evaluateContentLength(String(REQUEST_BODY_LIMITS.supportMessage + 1), REQUEST_BODY_LIMITS.supportMessage), {
    contentLength: REQUEST_BODY_LIMITS.supportMessage + 1,
    maxBytes: REQUEST_BODY_LIMITS.supportMessage,
    ok: false,
  });
  assert.deepEqual(evaluateContentLength("not-a-number", REQUEST_BODY_LIMITS.supportMessage), {
    maxBytes: REQUEST_BODY_LIMITS.supportMessage,
    ok: true,
  });
});
