# External Monitoring Runbook

Market Alpha uses in-app synthetic monitoring plus external checks. External checks are required because host-local cron cannot detect a complete host or network outage.

## UptimeRobot

Provision the four required monitors with the official UptimeRobot API:

```bash
export UPTIMEROBOT_API_KEY="..."
export UPTIMEROBOT_INTERVAL_SECONDS=60
# Optional: comma-separated UptimeRobot alert contact IDs.
export UPTIMEROBOT_ALERT_CONTACTS="..."
tools/ops/market-alpha-uptimerobot-setup.sh
```

Required URLs:

- `https://marketalpha.co`
- `https://marketalpha.co/features`
- `https://app.marketalpha.co/api/health`
- `https://app.marketalpha.co/api/health/deep`

Alert on downtime, timeout, and non-200 responses. Use email to `support@marketalpha.co` or a Telegram/Slack alert contact.

## App-Side Alert Channels

The app-side synthetic checks send critical/degraded alerts through the first configured channels below:

- `SLACK_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` or `MARKET_ALPHA_ALERT_TELEGRAM_CHAT_ID`
- SMTP email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and optional `MARKET_ALPHA_ALERT_EMAIL_TO`

If no destination is set, SMTP alerts default to `support@marketalpha.co`.

## Sentry

Set these values in the production app `.env` and rebuild the frontend:

```bash
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_TRACES_SAMPLE_RATE=0
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
```

The Sentry integration disables default PII and scrubs cookies, authorization headers, session tokens, CSRF tokens, Stripe signatures, Stripe keys, webhook secrets, and long bearer-style values before sending events.
