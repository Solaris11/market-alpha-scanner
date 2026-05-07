# TradeVeto Domain Migration Runbook

TradeVeto uses `tradeveto.com` as the canonical product and marketing domain. Legacy Market Alpha domains must remain reachable until DNS, Cloudflare Tunnel, email authentication, Stripe URLs, and monitoring are validated.

## Current Cutover Gate

Legacy redirects are gated by:

```bash
TRADEVETO_REDIRECT_ENABLED=true
```

Do not enable this flag until `tradeveto.com` and `www.tradeveto.com` resolve publicly, HTTPS works, and the app serves health checks on the new domain. With the flag unset or false, legacy Market Alpha routing continues to work.

## Cloudflare DNS

Expected records:

- `tradeveto.com` proxied through Cloudflare Tunnel.
- `www.tradeveto.com` proxied through Cloudflare Tunnel or redirected at Cloudflare to `https://tradeveto.com`.
- Legacy `marketalpha.co`, `www.marketalpha.co`, and `app.marketalpha.co` remain proxied during transition.

Do not point `marketalpha.co` to `tradeveto.com` until `tradeveto.com` is reachable and verified. Avoid public A records to the origin if Tunnel is the intended ingress.

## Cloudflared Ingress

Add these hostnames before DNS cutover:

```yaml
- hostname: tradeveto.com
  service: http://127.0.0.1:80
- hostname: www.tradeveto.com
  service: http://127.0.0.1:80
```

Keep existing legacy hostnames until redirect validation is complete.

## Caddy

Caddy should serve the frontend for:

- `tradeveto.com`
- `www.tradeveto.com`
- legacy Market Alpha hostnames during the transition

The app-level redirect layer handles:

- `www.tradeveto.com` -> `https://tradeveto.com`
- legacy domains -> `https://tradeveto.com` only when `TRADEVETO_REDIRECT_ENABLED=true`

## App Environment

After DNS and Tunnel are verified, update production app env:

```bash
APP_URL=https://tradeveto.com
PUBLIC_APP_URL=https://tradeveto.com
APP_BASE_URL=https://tradeveto.com
TRADEVETO_REDIRECT_ENABLED=true
EMAIL_FROM="TradeVeto <noreply@tradeveto.com>"
SUPPORT_EMAIL=support@tradeveto.com
BILLING_EMAIL=billing@tradeveto.com
MARKET_ALPHA_ALERT_EMAIL_TO=support@tradeveto.com
```

Do not print SMTP, Stripe, Sentry, monitoring, or database secrets during updates.

## Email DNS

Before sending production mail as TradeVeto, verify:

- SPF authorizes Google Workspace for `tradeveto.com`.
- DKIM is enabled and passing for TradeVeto aliases.
- DMARC exists, starting with `p=none` until delivery is proven.
- Gmail "Send mail as" aliases are verified for `support@tradeveto.com`, `billing@tradeveto.com`, and `noreply@tradeveto.com`.
- Legacy Market Alpha sender addresses should remain aliases/forwards only during transition. TradeVeto sender addresses are primary once DNS, alias, and delivery tests pass.

## Stripe And Auth URLs

Update provider dashboards after the new domain is live:

- Stripe Checkout success/cancel URLs.
- Stripe customer portal return URL.
- Stripe webhook endpoint if domain-bound.
- OAuth callback URLs.
- Email verification and reset password base URL.
- External uptime monitors.

## Validation

Run:

```bash
curl -I https://tradeveto.com
curl -I https://www.tradeveto.com
curl -s https://tradeveto.com/api/health | jq .
curl -s https://tradeveto.com/api/health/deep | jq .
curl -I "https://marketalpha.co/history?symbol=TSM"
curl -I "https://app.marketalpha.co/history?symbol=TSM"
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
2. Restore `APP_URL`, `PUBLIC_APP_URL`, and `APP_BASE_URL` to the previous legacy app URL if needed.
3. Keep Caddy/cloudflared routes for both domains while investigating.
4. Do not delete legacy DNS until the final audit has passed.
