# Secrets Hardening Runbook

Production secrets currently live in the root-readable app env file:

- `/opt/apps/market-alpha-scanner/app/.env`

The file must remain `600` and must not be copied into tickets, chat, terminals, screenshots, or logs.

## Safe Compose Config

Do not paste raw `docker compose config` output. Compose expands env values and can print secrets.

Use the redacted wrapper:

```bash
sudo /opt/ops/market-alpha-compose-config-redacted.sh
```

The wrapper redacts:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SMTP_PASS`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `MARKET_ALPHA_SESSION_SECRET`
- `MARKET_ALPHA_MONITORING_TOKEN`
- any `*_SECRET`, `*_TOKEN`, `*_KEY`, or `*_PASSWORD`

## Env Archives

Old env files are cold archives only. They must be stored under root-owned directories with `700` directory permissions and `600` file permissions.

Current cold archive path:

- `/opt/ops/secure-env-archive/market-alpha`

Do not keep env archives under `/opt/backups/market-alpha`; that tree is mounted into the app for backup freshness checks. If `/opt/backups/market-alpha/obsolete-env` appears, move it under `/opt/ops/secure-env-archive/market-alpha` and make it root-only.

Do not delete active env files. Obsolete archive deletion is only safe after provider-side rotation and a verified post-deploy backup.

## Docker Secrets Migration Plan

Do not migrate all secrets to Docker secrets in one step. The current Compose stack and Next.js app read env vars directly, so a rushed migration would risk outage.

Recommended order:

1. Add a small config helper that supports `FOO_FILE` for server-only secrets.
2. Move `MARKET_ALPHA_MONITORING_TOKEN` first because it is internal and easy to rotate.
3. Move `MARKET_ALPHA_SESSION_SECRET` next during a planned session logout window.
4. Move SMTP and Stripe server secrets after code supports file reads and rollback has been tested.
5. Keep public values such as publishable Stripe keys and public Sentry DSNs in env.

Rollback:

1. Put the secret value back in `.env`.
2. Rebuild `market-alpha-frontend`.
3. Verify `/api/health`, `/api/health/deep`, login, Stripe portal, and monitoring synthetics.

## Provider-Side Rotation Checklist

Manual provider rotation requires new values from each provider. Do not rotate blindly.

- Stripe secret key: create replacement key, update `.env`, rebuild, test checkout and portal, then revoke old key.
- Stripe webhook secret: add a second webhook endpoint or rotate in Stripe dashboard, update `.env`, rebuild, test signed webhook, then remove old secret.
- SMTP/Brevo: create replacement SMTP/API credential, update `.env`, test verification email, then revoke old credential.
- Sentry DSN: create or replace client key if needed, update `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, rebuild, trigger controlled Sentry test, then disable old key.
- Telegram: create replacement bot token, update env, run monitoring alert test, revoke old bot token.
- UptimeRobot: create replacement API key, rerun monitor setup, revoke old key.
