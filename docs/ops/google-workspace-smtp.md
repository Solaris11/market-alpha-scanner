# Google Workspace SMTP Runbook

TradeVeto currently uses Google Workspace Gmail SMTP for low-volume transactional and support mail.

## Production Env

Use these app env names in `/opt/apps/market-alpha-scanner/app/.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=emrah@ondemandsre.com
SMTP_PASS=<Google app password or OAuth credential>
EMAIL_FROM="TradeVeto <no-reply@tradeveto.com>"
SUPPORT_EMAIL=support@tradeveto.com
BILLING_EMAIL=billing@tradeveto.com
```

Do not use `SMTP_PASSWORD` in the Next.js app. `SMTP_PASS` is the canonical secret name.

## Sender Policy

- Verification, password reset, alert, and system email `From`: `TradeVeto <no-reply@tradeveto.com>`
- Support email `From`: `TradeVeto Support <support@tradeveto.com>`
- Billing email `From`: `TradeVeto Billing <billing@tradeveto.com>`
- Verification/reset/support/alert `Reply-To`: `support@tradeveto.com`
- Billing lifecycle `Reply-To`: `billing@tradeveto.com`

Email content must not include trading recommendations, personalized buy/sell language, SMTP credentials, Stripe secrets, or session tokens.

Every email is tagged with one category: `verification`, `password_reset`, `support`, `billing`, `alert`, or `system`.

SMTP delivery is asynchronous from API responses. Sends retry up to 3 attempts with bounded backoff; final failures write `monitoring_events`.

External alert emails are throttled by alert fingerprint: the same alert is sent at most once every 15 minutes.

## Validation

After changing SMTP envs:

```bash
cd /opt/apps/market-alpha-scanner/app/frontend
set -a
source ../.env
set +a
npm run email:test -- --to support@tradeveto.com
npm run email:test -- --to support@tradeveto.com --category support
npm run email:test -- --to billing@tradeveto.com --category billing
```

The command prints only `{ "category": ..., "ok": true, "to": ... }` and never prints SMTP credentials.

## Google Workspace Limits

Google's current Workspace Gmail limits are rolling 24-hour limits and can change without notice. As of Google's 2026-05-01 documentation:

- Maximum messages per day per paid user account: 2,000
- Trial accounts: 500 messages/day
- SMTP POP/IMAP recipients per message: 100
- Total recipients per day: 10,000
- External recipients per day: 3,000

Source: https://support.google.com/a/answer/166852

Operational rule: use Gmail SMTP only for early low-volume transactional mail. Move to a dedicated transactional provider before high signup volume, bulk notifications, marketing campaigns, or any workflow that needs bounce/webhook analytics.

## Future Migration Path

Move to Postmark, Resend, or another dedicated transactional provider when any of these become true:

- sustained transactional volume exceeds a few hundred emails/day
- deliverability monitoring or bounce webhooks are required
- support/billing mail should be isolated from the Workspace user mailbox reputation
- product alerts become high-volume or fan-out to many users

Migration steps:

1. Add provider-specific server envs without removing Gmail SMTP.
2. Add a provider switch in the mail sender.
3. Send canary verification/reset/support/billing emails through the new provider.
4. Verify SPF, DKIM, DMARC, bounce handling, and suppression lists.
5. Move production traffic.
6. Keep Gmail SMTP as a temporary rollback path, then remove it.
