import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEVELOPER_API_ENDPOINTS,
  DEVELOPER_API_KEY_QUOTA_PER_MINUTE,
  DEVELOPER_API_VERSION,
  DEVELOPER_WEBHOOK_RETRY_DELAYS_MS,
  apiKeyPrefix,
  buildWebhookSignatureHeader,
  developerApiStatusBucket,
  extractDeveloperApiKey,
  generateDeveloperApiKey,
  generateWebhookSigningSecret,
  hashDeveloperApiKey,
  normalizeDeveloperApiScopes,
  normalizeWebhookEventTypes,
  shouldRetryWebhookDelivery,
  validateWebhookUrl,
  verifyWebhookSignature,
  webhookRetryDelayMs,
} from "./developer-platform";

describe("developer platform security helpers", () => {
  it("generates TradeVeto API keys with a stable prefix and one-way hash", () => {
    const material = generateDeveloperApiKey();

    assert.match(material.key, /^tvk_live_/);
    assert.equal(material.hash, hashDeveloperApiKey(material.key));
    assert.notEqual(material.hash, material.key);
    assert.equal(material.prefix, apiKeyPrefix(material.key));
    assert.equal(material.prefix.includes("..."), true);
  });

  it("extracts API keys from bearer and explicit API key headers", () => {
    assert.equal(extractDeveloperApiKey(new Request("https://tradeveto.com/api/v1/macro", { headers: { Authorization: "Bearer tvk_live_test" } })), "tvk_live_test");
    assert.equal(extractDeveloperApiKey(new Request("https://tradeveto.com/api/v1/macro", { headers: { "x-tradeveto-api-key": "tvk_live_header" } })), "tvk_live_header");
    assert.equal(extractDeveloperApiKey(new Request("https://tradeveto.com/api/v1/macro")), null);
  });

  it("normalizes scopes and webhook events to trusted allowlists", () => {
    assert.deepEqual(normalizeDeveloperApiScopes(["read:macro", "unknown", "read:macro", "read:shocks"]), ["read:macro", "read:shocks"]);
    assert.deepEqual(normalizeDeveloperApiScopes([], ["read:opportunities"]), ["read:opportunities"]);
    assert.deepEqual(normalizeWebhookEventTypes("shock.detected replay.ready unknown"), ["shock.detected", "replay.ready"]);
  });

  it("accepts only HTTPS webhook URLs outside local/private hosts", () => {
    assert.deepEqual(validateWebhookUrl("https://hooks.slack.com/services/T000/B000/XXX"), { ok: true, url: "https://hooks.slack.com/services/T000/B000/XXX" });
    assert.equal(validateWebhookUrl("http://example.com/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://localhost/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://127.0.0.1/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://10.0.0.4/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://192.168.1.10/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://172.20.0.10/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://169.254.10.10/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://internal.local/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://[::1]/webhook").ok, false);
    assert.equal(validateWebhookUrl("https://[fd00::1]/webhook").ok, false);
  });

  it("signs webhook payloads and rejects tampered or stale signatures", () => {
    const payload = JSON.stringify({ event_type: "shock.detected", id: "evt_test" });
    const secret = generateWebhookSigningSecret();
    const now = Math.floor(Date.now() / 1000);
    const header = buildWebhookSignatureHeader({ payload, secret, timestamp: now });

    assert.equal(verifyWebhookSignature({ header, payload, secret, toleranceSeconds: 300 }), true);
    assert.equal(verifyWebhookSignature({ header, payload: JSON.stringify({ event_type: "shock.detected", id: "tampered" }), secret, toleranceSeconds: 300 }), false);
    assert.equal(verifyWebhookSignature({ header: buildWebhookSignatureHeader({ payload, secret, timestamp: now - 10_000 }), payload, secret, toleranceSeconds: 300 }), false);
  });

  it("publishes a stable v1 endpoint catalog with bounded quota policy", () => {
    assert.equal(DEVELOPER_API_VERSION, "v1");
    assert.ok(DEVELOPER_API_KEY_QUOTA_PER_MINUTE > 0);
    assert.deepEqual(
      DEVELOPER_API_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path} ${endpoint.requiredScope}`),
      [
        "GET /api/v1/opportunities read:opportunities",
        "GET /api/v1/macro read:macro",
        "GET /api/v1/shocks read:shocks",
        "GET /api/v1/replay read:replay",
        "POST /api/v1/portfolio/scenario read:portfolio",
      ],
    );
  });

  it("normalizes developer API statuses for usage analytics", () => {
    assert.equal(developerApiStatusBucket(200), "2xx");
    assert.equal(developerApiStatusBucket(302), "3xx");
    assert.equal(developerApiStatusBucket(403), "4xx");
    assert.equal(developerApiStatusBucket(500), "5xx");
    assert.equal(developerApiStatusBucket(102), "unknown");
    assert.equal(developerApiStatusBucket(null), "unknown");
  });

  it("retries webhook deliveries only for transient failures", () => {
    assert.deepEqual(DEVELOPER_WEBHOOK_RETRY_DELAYS_MS, [0, 750, 2000]);
    assert.equal(shouldRetryWebhookDelivery(500, null), true);
    assert.equal(shouldRetryWebhookDelivery(429, null), true);
    assert.equal(shouldRetryWebhookDelivery(null, "timeout"), true);
    assert.equal(shouldRetryWebhookDelivery(404, null), false);
    assert.equal(shouldRetryWebhookDelivery(200, null), false);
    assert.equal(webhookRetryDelayMs(-1), 0);
    assert.equal(webhookRetryDelayMs(99), 2000);
  });
});
