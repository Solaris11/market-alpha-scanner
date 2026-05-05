# Google Workspace SMTP Runbook

Market Alpha currently uses Google Workspace Gmail SMTP for low-volume transactional and support mail.

## Production Env

Use these app env names in `/opt/apps/market-alpha-scanner/app/.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=emrah@ondemandsre.com
SMTP_PASS=<Google app password or OAuth credential>
EMAIL_FROM="Market Alpha Scanner <noreply@marketalpha.co>"
SUPPORT_EMAIL=support@marketalpha.co
BILLING_EMAIL=billing@marketalpha.co
```

Do not use `SMTP_PASSWORD` in the Next.js app. `SMTP_PASS` is the canonical secret name.

## Sender Policy

- System email `From`: `Market Alpha Scanner <noreply@marketalpha.co>`
- Verification/reset/support `Reply-To`: `support@marketalpha.co`
- Billing lifecycle `Reply-To`: `billing@marketalpha.co`
- Operational alert email `Reply-To`: `support@marketalpha.co`

Email content must not include trading recommendations, personalized buy/sell language, SMTP credentials, Stripe secrets, or session tokens.

## Validation

After changing SMTP envs:

```bash
cd /opt/apps/market-alpha-scanner/app/frontend
set -a
source ../.env
set +a
npm run email:test -- --to support@marketalpha.co
```

The command prints only `{ "ok": true, "to": ... }` and never prints SMTP credentials.

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
