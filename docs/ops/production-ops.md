# Market Alpha Production Ops Runbook

Production host paths:

- App: `/opt/apps/market-alpha-scanner/app`
- Ops scripts: `/opt/ops`
- Logs: `/var/log/market-alpha`

## Database Migrations

Run the migration ledger runner before production deploys that include DB changes:

```bash
cd /opt/apps/market-alpha-scanner/app
tools/db/run-migrations.sh
tools/db/run-migrations.sh # idempotency check; should apply 0
```

The runner records migration filenames in `schema_migrations` and applies each pending migration exactly once.

See `docs/ops/migration-ledger.md` for the Phase 5.4 filename normalization mapping and bootstrap behavior.

## Stripe Reconciliation

Stripe reconciliation must run inside the Docker network because production Postgres is private and addressed by Docker service name.

Use:

```bash
sudo /opt/ops/market-alpha-stripe-reconcile.sh --dry-run
sudo /opt/ops/market-alpha-stripe-reconcile.sh
```

Do not use raw host `npm run stripe:reconcile` on production. It cannot resolve the private Postgres hostname and will fail outside the Docker network.

Cron:

```bash
sudo cat /etc/cron.d/market-alpha-stripe-reconcile
sudo tail -80 /var/log/market-alpha/stripe-reconcile.log
```

## Scanner Data Source

Postgres is the production SaaS source of truth for scanner reads.

CSV artifacts remain backup/export/debug output only. Runtime CSV fallback is disabled by default:

```bash
SCANNER_CSV_FALLBACK=false
```

Only enable CSV fallback for an explicit rollback/debug window:

```bash
SCANNER_CSV_FALLBACK=true
```

If fallback is used, the frontend logs a warning. Treat any fallback warning in production as an incident until the DB read path is repaired or the rollback window ends.

## Legacy Alert JSON

SaaS alert rules live in Postgres. Legacy MVP alert JSON files must not remain in the active runtime path.

If old files are found in `runtime/scanner_output/alerts`, archive then remove:

```bash
TS="$(date -u +%Y%m%d_%H%M%S)"
sudo install -d -o root -g sre -m 750 "/opt/backups/market-alpha/legacy-alert-json/$TS"
sudo find /opt/apps/market-alpha-scanner/runtime/scanner_output/alerts \
  -maxdepth 1 -type f -name '*.json' \
  -exec sudo mv {} "/opt/backups/market-alpha/legacy-alert-json/$TS/" \;
sudo chown -R root:sre "/opt/backups/market-alpha/legacy-alert-json/$TS"
sudo find "/opt/backups/market-alpha/legacy-alert-json/$TS" -type f -exec chmod 640 {} \;
```

Production scanner systemd jobs should run only the Docker scanner job and should not invoke legacy JSON alert CLI paths.

## Secrets Handling

Do not run or paste raw `docker compose config` for production. It expands env values and can expose secrets.

Use:

```bash
sudo /opt/ops/market-alpha-compose-config-redacted.sh
```

See `docs/ops/secrets-hardening.md` for env archive handling, Docker secrets migration order, and provider-side rotation steps.
