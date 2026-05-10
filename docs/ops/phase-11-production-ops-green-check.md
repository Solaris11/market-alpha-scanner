# Phase 11.1 Production Ops Green Check

This runbook defines the minimum operational proof required before expanding
TradeVeto beyond controlled public beta.

The goal is boring operations: repeatable checks, explicit failure states, and
no dependency on memory during an incident.

## Green Check Command

Run from the production host:

```bash
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh
```

Optional overrides:

```bash
sudo TRADEVETO_OPS_BASE_URL=https://tradeveto.com \
  TRADEVETO_APP_DIR=/opt/apps/market-alpha-scanner/app \
  TRADEVETO_LOG_DIR=/var/log/market-alpha \
  TRADEVETO_BACKUP_ROOT=/opt/backups/market-alpha \
  /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh
```

The script is read-only. It checks:

- public route availability
- `/api/health`
- `/api/health/deep`
- OpenGraph image content type
- TLS certificate expiry
- visible Docker container health
- Postgres `pg_isready`
- cron presence for backups, monitoring, and Stripe reconciliation
- stale `rclone` processes
- stale scanner processes
- latest local backup artifact integrity
- R2/offsite backup prefix listing when configured
- obvious secret patterns in recent ops logs

Expected launch result:

```text
RESULT: PRODUCTION OPS GREEN
```

Warnings can be acceptable during controlled beta only if an operator writes down
the reason and follow-up. Any failure blocks broad launch.

## Production Health Criteria

Required green states:

- `https://tradeveto.com/api/health` returns `200`.
- `https://tradeveto.com/api/health/deep` returns `200`.
- Docker containers show no `unhealthy` state.
- Postgres accepts `pg_isready`.
- Scanner freshness is `ok` or `warn` only outside expected market windows.
- Backup health is `ok`; `partial` is acceptable only during a documented
  offsite-provider incident.
- R2 backup prefixes are listable.
- Monitoring synthetic and system jobs have run successfully in the last
  expected interval.
- No stale scanner or backup processes are visible.
- Recent logs do not contain obvious secret material.

## Daily Operator Checklist

```bash
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh
curl -s https://tradeveto.com/api/health | jq .
curl -s https://tradeveto.com/api/health/deep | jq .
sudo docker ps --filter 'name=market-alpha'
sudo tail -80 /var/log/market-alpha/monitoring-synthetics.log
sudo tail -80 /var/log/market-alpha/monitoring-system.log
sudo tail -80 /var/log/market-alpha/backup.log
```

Do not paste raw `docker compose config` output. Use:

```bash
sudo /opt/ops/tradeveto-compose-config-redacted.sh
```

## Deploy Procedure

1. Announce deploy window if beta users are active.
2. Pull the intended release branch/tag.
3. Run migrations:

   ```bash
   cd /opt/apps/market-alpha-scanner/app
   tools/db/run-migrations.sh
   tools/db/run-migrations.sh
   ```

   The second run must apply zero migrations.

4. Build/recreate frontend containers with the approved deployment command.
5. Check containers:

   ```bash
   sudo docker compose ps
   sudo docker logs --tail=120 market-alpha-frontend
   ```

6. Run public health checks:

   ```bash
   curl -s https://tradeveto.com/api/health | jq .
   curl -s https://tradeveto.com/api/health/deep | jq .
   ```

7. Run synthetics and system monitoring:

   ```bash
   cd /opt/apps/market-alpha-scanner/app/frontend
   npm run monitoring:synthetics
   npm run monitoring:system
   ```

8. Run verified post-deploy backup:

   ```bash
   sudo /opt/ops/tradeveto-post-deploy-backup.sh
   ```

9. Run the green check:

   ```bash
   sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh
   ```

10. Record the result in the deployment notes.

## Rollback Procedure

Use rollback when the app is unavailable, deep health is red after deploy, login
or billing is broken, or data integrity is questionable.

1. Stop new deploy actions.
2. Preserve evidence:

   ```bash
   sudo docker compose ps
   sudo docker logs --tail=300 market-alpha-frontend
   curl -s https://tradeveto.com/api/health/deep | jq .
   ```

3. Revert to the last known-good image/tag or commit.
4. Recreate the frontend container.
5. Do not roll back database migrations unless a migration-specific rollback
   plan exists. Prefer forward fixes for additive migrations.
6. Run `/api/health`, `/api/health/deep`, monitoring synthetics, and the green
   check.
7. Record incident notes and user impact.

## Backup Verification

After deploys and schema changes:

```bash
sudo /opt/ops/tradeveto-post-deploy-backup.sh
sudo tail -80 /var/log/market-alpha/post-deploy-backup.log
curl -s https://tradeveto.com/api/health/deep | jq .backup
```

Local backup verification:

```bash
LATEST_PG="$(find /opt/backups/market-alpha/postgres -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
LATEST_SCANNER="$(find /opt/backups/market-alpha/scanner_output -maxdepth 1 -type f -name '*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
gzip -t "$LATEST_PG"
tar -tzf "$LATEST_SCANNER" >/dev/null
```

Offsite verification:

```bash
sudo grep -E '^MARKET_ALPHA_BACKUP_(R2_REMOTE|PRIMARY_REMOTE|PRIMARY_PROVIDER)=' /etc/market-alpha-backup.env
rclone lsf r2:market-alpha-backups/postgres/ | tail
rclone lsf r2:market-alpha-backups/scanner_output/ | tail
```

Never print full backup env files in chat or tickets.

## Restore Drill

Run restore drills into a temporary database only. Never restore over production
during a drill.

```bash
RESTORE_DB="market_alpha_restore_$(date +%s)"
LATEST_PG="$(find /opt/backups/market-alpha/postgres -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"

sudo docker exec -e RESTORE_DB="$RESTORE_DB" market-alpha-scanner-market-alpha-postgres-1 \
  sh -lc 'createdb -U "$POSTGRES_USER" "$RESTORE_DB"'

sudo /opt/ops/market-alpha-restore.sh --target-db "$RESTORE_DB" --yes "$LATEST_PG"

sudo docker exec -e RESTORE_DB="$RESTORE_DB" market-alpha-scanner-market-alpha-postgres-1 \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -tAc "select count(*) from information_schema.tables where table_schema = '\''public'\'';"'

sudo docker exec -e RESTORE_DB="$RESTORE_DB" market-alpha-scanner-market-alpha-postgres-1 \
  sh -lc 'dropdb -U "$POSTGRES_USER" "$RESTORE_DB"'
```

Expected result: restore completes without SQL errors and table count is greater
than zero.

## Scanner Recovery

Symptoms:

- `/api/health/deep` scanner status is `fail`.
- scanner freshness is stale during active market hours.
- scanner writeback is missing or schema mismatched.

Procedure:

1. Check latest scanner logs.
2. Confirm no stale scanner process:

   ```bash
   ps -eo pid,etimes,args | grep -E 'investment_scanner_mvp|scanner-job|run-scanner' | grep -v grep
   ```

3. Check DB writeback tables and latest `scan_runs`.
4. Run only the approved bounded scanner refresh command for the current ops
   playbook. Do not run unnecessary full scanner jobs during incident triage.
5. Recheck `/api/health/deep`.
6. Record root cause and whether user-facing freshness copy remained calm and
   accurate.

## Stripe Outage Response

Symptoms:

- checkout or portal fails
- webhooks delayed
- reconciliation mismatch

Procedure:

1. Check Stripe dashboard status.
2. Check webhook signature failures and recent billing logs.
3. Run dry-run reconciliation inside Docker network:

   ```bash
   sudo /opt/ops/tradeveto-stripe-reconcile.sh --dry-run
   ```

4. If Stripe is degraded, pause billing-related deploys and keep existing
   entitlements unchanged unless verified by Stripe.
5. After recovery, run:

   ```bash
   sudo /opt/ops/tradeveto-stripe-reconcile.sh
   ```

## Cloudflare Or Edge Outage Response

Symptoms:

- external uptime fails but local container health is green
- social crawlers or users receive edge errors
- TLS/redirect behavior changes unexpectedly

Procedure:

1. Check Cloudflare status and zone events.
2. Compare direct host/container health against public URL.
3. Confirm DNS, SSL mode, WAF rules, redirect rules, and cache rules.
4. For social crawler issues, use `docs/ops/social-crawler-access.md`.
5. Do not disable broad security controls globally. Use narrow public-route
   allow rules only.

## OpenAI Outage Response

TradeVeto must degrade safely when OpenAI is unavailable.

Procedure:

1. Confirm deterministic fallback is active.
2. Check logs for timeout/error rate spikes.
3. If needed, disable LLM use without disabling deterministic intelligence:

   ```bash
   TRADEVETO_EVENT_LLM_ENABLED=false
   TRADEVETO_RESEARCH_COPILOT_LLM_ENABLED=false
   TRADEVETO_OPPORTUNITY_LLM_ENABLED=false
   ```

4. Rebuild/restart frontend if env changes require it.
5. Confirm copilot and narrative surfaces show fallback explanations.

## Monitoring Escalation

Escalate immediately when:

- `/api/health` fails.
- `/api/health/deep` fails for DB or backup.
- scanner is stale during active market hours.
- Stripe webhook signature failures spike.
- backup health becomes `failed`.
- R2 listing fails after local backup succeeds.
- logs contain secret-like material.
- CPU/disk/memory pressure threatens the host.

Escalation note format:

```text
Time:
User impact:
Current health:
Suspected cause:
Actions taken:
Rollback needed:
Next check time:
Owner:
```

## Launch Gate

For broad launch, all must be true:

- green check returns `PRODUCTION OPS GREEN`
- production `/api/health/deep` returns `200`
- monitoring scripts complete successfully
- post-deploy backup completes with R2 success
- restore drill completed within the last 30 days with:
  `sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-restore-drill.sh`
- no unresolved P0/P1 operational incidents
- Stripe live-mode checkout, portal, webhook, and reconciliation are tested
- operator can complete deploy and rollback procedures without improvising
