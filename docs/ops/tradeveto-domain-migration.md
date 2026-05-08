# TradeVeto Domain Migration Runbook

TradeVeto uses `tradeveto.com` as the canonical product and marketing domain. Legacy Market Alpha domains are no longer required for normal production operation; keep them only as temporary redirects or manual rollback references until third-party decommission is complete.

## Current Cutover Gate

Legacy redirects are gated by:

```bash
TRADEVETO_REDIRECT_ENABLED=true
```

Keep this flag enabled during the final redirect window. Setting it to `false` is a rollback-only action.

## Cloudflare DNS

Expected records:

- `tradeveto.com` proxied through Cloudflare Tunnel.
- `www.tradeveto.com` proxied through Cloudflare Tunnel or redirected at Cloudflare to `https://tradeveto.com`.
- Legacy `marketalpha.co`, `www.marketalpha.co`, and `app.marketalpha.co` should be removed from required production routing after redirect validation and third-party cleanup are complete.

Avoid public A records to the origin if Tunnel is the intended ingress.

## Cloudflared Ingress

Add these hostnames before DNS cutover:

```yaml
- hostname: tradeveto.com
  service: http://127.0.0.1:80
- hostname: www.tradeveto.com
  service: http://127.0.0.1:80
```

Keep legacy hostnames only while validating redirects or rollback.

## Caddy

Caddy should serve the frontend for:

- `tradeveto.com`
- `www.tradeveto.com`
- legacy Market Alpha hostnames only during redirect/rollback validation

The app-level redirect layer handles:

- `www.tradeveto.com` -> `https://tradeveto.com`
- legacy domains -> `https://tradeveto.com` only when `TRADEVETO_REDIRECT_ENABLED=true`

## App Environment

After DNS and Tunnel are verified, update production app env:

```bash
TRADEVETO_APP_URL=https://tradeveto.com
TRADEVETO_PUBLIC_APP_URL=https://tradeveto.com
TRADEVETO_APP_BASE_URL=https://tradeveto.com
TRADEVETO_REDIRECT_ENABLED=true
EMAIL_FROM="TradeVeto <noreply@tradeveto.com>"
SUPPORT_EMAIL=support@tradeveto.com
BILLING_EMAIL=billing@tradeveto.com
TRADEVETO_ALERT_EMAIL_TO=support@tradeveto.com
TRADEVETO_MONITORING_TOKEN=...
```

Do not print SMTP, Stripe, Sentry, monitoring, or database secrets during updates.

## Email DNS

Before sending production mail as TradeVeto, verify:

- SPF authorizes Google Workspace for `tradeveto.com`.
- DKIM is enabled and passing for TradeVeto aliases.
- DMARC exists, starting with `p=none` until delivery is proven.
- Gmail "Send mail as" aliases are verified for `support@tradeveto.com`, `billing@tradeveto.com`, and `noreply@tradeveto.com`.
- Legacy Market Alpha sender addresses should remain aliases/forwards only for old replies and support history. TradeVeto sender addresses are primary.

## Stripe And Auth URLs

Update provider dashboards after the new domain is live:

- Stripe Checkout success/cancel URLs use `https://tradeveto.com/account?...`.
- Stripe customer portal return URL uses `https://tradeveto.com/account?...`.
- Stripe webhook endpoint if domain-bound.
- OAuth callback URLs.
- Email verification and reset password base URL.
- External uptime monitors target `tradeveto.com` only; old-domain redirect monitors are optional.

## Validation

Run:

```bash
curl -I https://tradeveto.com
curl -I https://www.tradeveto.com
curl -s https://tradeveto.com/api/health | jq .
curl -s https://tradeveto.com/api/health/deep | jq .
curl -I "https://marketalpha.co/history?symbol=TSM" # optional redirect validation
curl -I "https://app.marketalpha.co/history?symbol=TSM" # optional redirect validation
```

Expected after redirect cutover:

- `tradeveto.com` returns 200.
- `www.tradeveto.com` redirects to `tradeveto.com`.
- Legacy Market Alpha domains return 301 to the same path and query on `tradeveto.com`.
- No redirect loops.
- Auth, support, billing, monitoring, and premium-gated routes remain protected.

## Rollback

Rollback is intentionally simple:

1. Set `TRADEVETO_REDIRECT_ENABLED=false`.
2. Restore `TRADEVETO_APP_URL`, `TRADEVETO_PUBLIC_APP_URL`, and `TRADEVETO_APP_BASE_URL` to the previous known-good URL if needed.
3. Keep Caddy/cloudflared routes for both domains while investigating.
4. Do not delete legacy DNS until the final audit has passed.
