# TradeVeto Backup And Restore Runbook

Production host paths:

- App: `/opt/apps/market-alpha-scanner/app`
- Backups: `/opt/backups/market-alpha`
- Ops scripts: `/opt/ops`
- Logs: `/var/log/market-alpha`

## Scheduled Backups

Cron runs the normal backup every 6 hours:

```bash
sudo cat /etc/cron.d/market-alpha-backup
```

The normal backup script is:

```bash
sudo /opt/ops/market-alpha-backup.sh
```

It creates:

- `/opt/backups/market-alpha/postgres/YYYY-MM-DD_HH-MM.sql.gz`
- `/opt/backups/market-alpha/scanner_output/YYYY-MM-DD_HH-MM.tar.gz`

The script treats local backup creation as its first safety boundary. It verifies
the local Postgres gzip and scanner tar before attempting off-host sync.

Cloudflare R2 is the primary offsite target. Google Drive is optional secondary
redundancy only and should not be treated as the source of operational truth.
Off-host rclone sync is bounded with connection, operation, retry, and total
timeout controls so a stuck provider connection cannot leave orphaned rclone
processes indefinitely. Result classifications written to `monitoring_events`
include:

- `local_backup_ok`
- `offsite_sync_ok`
- `backup_r2_started`
- `backup_r2_success`
- `backup_r2_failure`
- `backup_partial` when local backups are valid but offsite sync failed

Relevant knobs in `/etc/market-alpha-backup.env`:

```bash
MARKET_ALPHA_BACKUP_R2_REMOTE=r2:market-alpha-backups
MARKET_ALPHA_BACKUP_PRIMARY_REMOTE=r2:market-alpha-backups
MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER=r2
MARKET_ALPHA_BACKUP_REQUIRE_OFFSITE=1
MARKET_ALPHA_BACKUP_SECONDARY_ENABLED=0
MARKET_ALPHA_BACKUP_GDRIVE_REMOTE=GDRIVE:market-alpha-backup
MARKET_ALPHA_BACKUP_RCLONE_COPY_TIMEOUT_SECONDS=900
MARKET_ALPHA_BACKUP_RCLONE_LSF_TIMEOUT_SECONDS=90
MARKET_ALPHA_BACKUP_RCLONE_OP_TIMEOUT=60s
MARKET_ALPHA_BACKUP_RCLONE_CONNECT_TIMEOUT=20s
MARKET_ALPHA_BACKUP_RCLONE_RETRIES=2
MARKET_ALPHA_BACKUP_RCLONE_LOW_LEVEL_RETRIES=3
```

## Post-Deploy Backup

Run an immediate verified backup after:

- DB migrations
- billing schema changes
- monitoring schema changes
- alert schema changes
- major production deploys

Command:

```bash
sudo /opt/ops/market-alpha-post-deploy-backup.sh
```

The post-deploy wrapper runs the normal backup, verifies the latest Postgres gzip, verifies the latest scanner tarball, checks the off-host rclone target when configured, and records a `monitoring_events` row when the monitoring table is available. If offsite sync fails, it still verifies the local backup artifacts and then exits with a clear partial-backup failure.

Check logs:

```bash
sudo tail -80 /var/log/market-alpha/post-deploy-backup.log
```

## Verify Latest Backup

```bash
LATEST_PG="$(find /opt/backups/market-alpha/postgres -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
LATEST_SCANNER="$(find /opt/backups/market-alpha/scanner_output -maxdepth 1 -type f -name '*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"

gzip -t "$LATEST_PG"
tar -tzf "$LATEST_SCANNER" >/dev/null
ls -lh "$LATEST_PG" "$LATEST_SCANNER"
```

If off-host backups are configured:

```bash
sudo grep -E '^MARKET_ALPHA_BACKUP_(R2_REMOTE|PRIMARY_REMOTE|PRIMARY_PROVIDER)=' /etc/market-alpha-backup.env
rclone lsf r2:market-alpha-backups/postgres/ | tail
rclone lsf r2:market-alpha-backups/scanner_output/ | tail
```

Do not print backup secrets from `/etc/market-alpha-backup.env`.

## R2 Operational Validation

Use a disposable object path. Never test by deleting production backup prefixes.

```bash
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SRC_DIR="/tmp/market-alpha-r2-src-$TS"
DST_DIR="/tmp/market-alpha-r2-dst-$TS"
FILE="market-alpha-r2-validation-$TS.txt"
REMOTE="r2:market-alpha-backups/ops-validation/$TS"
mkdir -p "$SRC_DIR" "$DST_DIR"
printf 'market-alpha-r2-validation %s\n' "$TS" > "$SRC_DIR/$FILE"

rclone copy "$SRC_DIR/$FILE" "$REMOTE" --contimeout 10s --timeout 30s --retries 2 --low-level-retries 2 --stats-one-line
rclone ls "$REMOTE" --contimeout 10s --timeout 30s --retries 2 --low-level-retries 2
rclone copy "$REMOTE/$FILE" "$DST_DIR" --contimeout 10s --timeout 30s --retries 2 --low-level-retries 2 --stats-one-line
cmp "$SRC_DIR/$FILE" "$DST_DIR/$FILE"
rclone deletefile "$REMOTE/$FILE" --contimeout 10s --timeout 30s --retries 2 --low-level-retries 2
rclone rmdir "$REMOTE" --contimeout 10s --timeout 30s --retries 2 --low-level-retries 2 || true
rm -rf "$SRC_DIR" "$DST_DIR"
```

Expected result: upload, list, download, compare, and cleanup all complete
without `AccessDenied` or hanging rclone processes.

## Restore Drill Into A Temporary DB

Never restore over production during a drill.

To restore from R2 first copy the chosen backup locally:

```bash
rclone copy r2:market-alpha-backups/postgres/YYYY-MM-DD_HH-MM.sql.gz /tmp/market-alpha-restore/
```

```bash
RESTORE_DB="market_alpha_restore_$(date +%s)"
LATEST_PG="$(find /tmp/market-alpha-restore /opt/backups/market-alpha/postgres -maxdepth 1 -type f -name '*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"

docker exec -e RESTORE_DB="$RESTORE_DB" market-alpha-scanner-market-alpha-postgres-1 \
  sh -lc 'createdb -U "$POSTGRES_USER" "$RESTORE_DB"'

sudo /opt/ops/market-alpha-restore.sh --target-db "$RESTORE_DB" --yes "$LATEST_PG"

docker exec -e RESTORE_DB="$RESTORE_DB" market-alpha-scanner-market-alpha-postgres-1 \
  sh -lc 'psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -tAc "select count(*) from information_schema.tables where table_schema = '\''public'\'';"'

docker exec -e RESTORE_DB="$RESTORE_DB" market-alpha-scanner-market-alpha-postgres-1 \
  sh -lc 'dropdb -U "$POSTGRES_USER" "$RESTORE_DB"'
```

Expected result: restore completes without SQL errors and the table count is greater than zero.

## Scanner Artifact Restore

Only restore scanner artifacts when intentionally rolling back runtime scanner files.

```bash
LATEST_SCANNER="$(find /opt/backups/market-alpha/scanner_output -maxdepth 1 -type f -name '*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
tar -tzf "$LATEST_SCANNER" | head
sudo /opt/ops/market-alpha-restore.sh "$LATEST_SCANNER"
```

The script requires confirmation before overwriting `/opt/apps/market-alpha-scanner/runtime/scanner_output`.

## Health After Backup

```bash
cd /opt/apps/market-alpha-scanner/app
docker compose ps
curl -s https://tradeveto.com/api/health | jq .
curl -s https://tradeveto.com/api/health/deep | jq .
```
