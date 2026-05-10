# Phase 11.6 API + Webhook Platform Hardening

This pass moves the developer platform closer to controlled-public-beta quality without changing scanner or intelligence scoring.

## API Policy

- Current API version: `v1`.
- Versioning policy: breaking changes require a new `/api/vN` path.
- Authentication: `Authorization: Bearer tvk_live_...` or `x-tradeveto-api-key`.
- API keys are one-way hashed at rest.
- Revocation is immediate because API auth only selects keys where `revoked_at IS NULL`.
- Scope enforcement is per endpoint:
  - `GET /api/v1/opportunities` -> `read:opportunities`
  - `GET /api/v1/macro` -> `read:macro`
  - `GET /api/v1/shocks` -> `read:shocks`
  - `GET /api/v1/replay` -> `read:replay`
  - `POST /api/v1/portfolio/scenario` -> `read:portfolio`

## Quota Policy

- IP quota: 120 requests/minute.
- API key quota: 600 requests/minute.
- Quotas fail closed if the rate-limit backend is unavailable.
- Rate-limit bucket keys are hashed before persistence.

## Usage Analytics

Authenticated developer API traffic is aggregated into `developer_api_usage_hourly`.

Tracked fields:

- user id
- API key id
- endpoint
- method
- status bucket
- request count
- last status
- last used timestamp

The developer console shows a 7-day usage summary without exposing raw API keys.

## Webhook Reliability

Webhook endpoints require HTTPS public URLs and reject local/private hosts, including localhost, RFC1918 IPv4 ranges, link-local IPv4, `.local` names, IPv6 loopback, IPv6 link-local, and IPv6 unique-local ranges.

Outbound delivery:

- `User-Agent: TradeVeto-Webhooks/1.0`
- `X-TradeVeto-Event`
- `X-TradeVeto-Signature`
- timeout: 8000ms
- retry delays: 0ms, 750ms, 2000ms
- retries only transient failures: network errors, timeout/no status, 408, 409, 425, 429, or 5xx

Delivery records include:

- status
- HTTP status
- error
- attempt count
- duration
- delivered timestamp when successful

## Webhook Verification Example

Receiver pseudocode:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyTradeVetoWebhook(payload: string, header: string, secret: string): boolean {
  const parts = new Map(header.split(",").map((part) => {
    const [key, value = ""] = part.trim().split("=", 2);
    return [key, value] as const;
  }));
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1") ?? "";
  if (!Number.isFinite(timestamp) || !signature) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
```

## Operator Check

Run:

```bash
tools/ops/tradeveto-api-platform-check.sh
```

The check validates route availability and invalid-key rejection for all `/api/v1/*` endpoints. It allows `404` until the latest developer API routes are deployed to production.

## Remaining Risks

- Webhook retries are bounded inline for controlled beta. A durable async delivery queue is still needed before high-volume public integrations.
- Invalid/revoked-key traffic is controlled by rate-limit buckets but not yet shown in a dedicated abuse dashboard.
- Usage analytics are hourly aggregates, not per-request forensic logs.
- Production must run `db/migrations/20260510_061500_developer_platform_hardening.sql` before relying on usage summaries and webhook attempt metadata.

## Current Platform Score

Controlled-public-beta API platform score estimate: **90/100**.

To move above 95:

- Add durable webhook retry queue with dead-letter handling.
- Add admin/API operator dashboard for invalid keys, top consumers, endpoint latency, and failure spikes.
- Add staging tests with disposable valid/revoked API keys and real webhook receivers.
- Add public developer documentation pages with complete response schemas.
