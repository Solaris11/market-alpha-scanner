# Phase 11.5 Security + Abuse Hardening

This pass focuses on launch-scale abuse surfaces without changing market scoring logic.

## Hardened Controls

- Production response headers are managed in `frontend/next.config.ts`: CSP, HSTS, frame denial, content-type sniffing protection, referrer policy, permissions policy, COOP, and origin agent clustering.
- Mutating product routes use production host/origin validation through `validateMutationRequest`.
- Session-bound mutations use signed double-submit CSRF through `requireCsrf`.
- Auth, support, analytics, push, developer, and admin mutations use route-level rate limits backed by hashed rate-limit buckets.
- Developer API feed authentication now applies two quotas before feed work:
  - IP quota for bad-key brute-force control.
  - API-key-hash quota for valid-key usage control.
- High-risk JSON endpoints now reject explicit oversized `Content-Length` values before parsing:
  - analytics events
  - research copilot
  - support contact/chat/ticket/reply
  - developer key/webhook creation
- Stripe webhooks reject missing or invalid signatures before processing and use idempotent event claiming.
- Developer webhooks require HTTPS public destinations, HMAC signatures, timeout-bounded delivery, and no local/private host targets.
- Social crawler access is scoped to public preview-safe paths and safe `GET`/`HEAD` methods.
- LLM explanation output is validated against forbidden language, deterministic override language, invented prices/probabilities/news, unsupported macro certainty, and stale-data disclosure.

## Operator Check

Run:

```bash
tools/ops/tradeveto-security-abuse-check.sh
```

The check verifies:

- security headers
- health route
- unauthenticated premium/admin/developer route denial
- unsigned Stripe webhook rejection
- cross-origin mutation rejection
- social crawler access boundaries
- absence of obvious secret patterns in checked responses

Use `TRADEVETO_SECURITY_QA_BASE_URL` to point the check at staging or production.

## Remaining Attack Surface

- Production `/api/v1/*` route behavior depends on the deployed build. The check allows `404` until developer API routes are deployed, but local code now contains API-key quotas.
- Oversized request handling uses `Content-Length`; chunked bodies still rely on framework/proxy body limits.
- Real brute-force and replay testing should be run in staging with synthetic users and disposable API keys before broad public launch.
- Social crawler 403s can still originate from Cloudflare rules before traffic reaches the app; use Cloudflare Security Events and `docs/ops/social-crawler-access.md`.

## Launch Security Score

Current launch security score estimate: **91/100**.

To move above 95:

- Add edge-level request body limits in Cloudflare/Caddy.
- Add staging attack replay tests with disposable sessions/API keys.
- Add operator dashboards for rate-limit spikes, invalid API-key spikes, CSRF failures, and origin failures.
- Deploy and verify `/api/v1/*` route denial behavior in production.
