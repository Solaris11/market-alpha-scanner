# Runbook — deploying the scanner-job image

**Why this document exists:** SNDK was absent from every production scan for 35
days because nothing in any deploy path rebuilds this image. `git pull` updates
the checkout; the frontend gets rebuilt; the scanner-job image is left behind
indefinitely. See `docs/ops/rca-sndk-missing-from-scanner-20260910.md`.

**The rule: any change under `scanner/`, `investment_scanner_mvp.py`,
`database.py`, `requirements.txt`, or `Dockerfile` is not deployed until this
image is rebuilt.** Pulling is not deploying, for this service.

## Why a pull is not enough

`Dockerfile` bakes the code *and the universe data* into the image:

```dockerfile
COPY . /app
```

`compose.yaml` mounts only outputs:

```yaml
volumes:
  - /opt/apps/market-alpha-scanner/runtime/scanner_output:/app/scanner_output
  - /opt/apps/market-alpha-scanner/runtime/logs:/app/logs
```

And the systemd units invoke `docker compose run --rm market-alpha-scanner-job`,
which resolves whatever `:latest` exists on the host and **never builds**.

## Procedure

### 1. Check whether a rebuild is needed

```bash
cd /opt/apps/market-alpha-scanner/app
./tools/ops/scanner-image-freshness.sh --warn-days 7 --fail-days 30
```

Exit 0 and `status ok` means the image is not behind. Anything else, continue.

### 2. Take the rollback tag BEFORE building

```bash
docker tag market-alpha-scanner-market-alpha-scanner-job:latest \
          market-alpha-scanner-market-alpha-scanner-job:rollback-$(date -u +%Y%m%d)a
```

Never skip this. The rebuilt image is the only copy of `:latest` afterwards.

### 3. Build, stamped with the commit it came from

```bash
SCANNER_BUILD_COMMIT="$(git rev-parse --short HEAD)" \
SCANNER_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
docker compose --env-file .env -f compose.yaml \
  --profile scanner-job build market-alpha-scanner-job
```

The two variables are what let the freshness check compare commit to commit
instead of guessing from timestamps. A bare `docker compose build` still works
and stamps `unknown`, which the check reports rather than treating as a pass.

### 4. Verify the built image before letting it run scheduled

```bash
docker compose --env-file .env -f compose.yaml --profile scanner-job run \
  --rm --no-deps --entrypoint cat market-alpha-scanner-job /app/.build-stamp

./tools/ops/scanner-image-freshness.sh
```

Expect `commit=` to match `git rev-parse --short HEAD`, and `status ok`.

### 5. Dry run into an isolated directory, with the database disabled

```bash
docker compose --env-file .env -f compose.yaml --profile scanner-job run \
  --rm --no-deps -e DATABASE_URL= market-alpha-scanner-job \
  python investment_scanner_mvp.py --fast --timing --skip-news \
  --no-save-history --outdir /app/scanner_output/dryrun-$(date -u +%Y%m%d)a
```

`-e DATABASE_URL=` is the scanner's own switch for skipping every database
write; it prints `Skipping database write: DATABASE_URL not configured`. The
outdir must be a `dryrun-*` subdirectory so the real output is untouched.

Check, in the dry-run output:

- `[universe] selected N symbols`
- **no** `[universe] WARNING required symbols missing from this scan:` line
- `accounting: selected=N accounted=N ranked=M unknown=0`
- ranked count and decision spread in the normal range (recent baseline: ~350
  ranked of 500, `unknown=0`)

The scan holds `scanner_output/run.lock` across the whole tree, so a dry run
will refuse to start while a scheduled scan is running (`[scanner] another run
in progress, skipping`). Stop the *timer*, not the service, and let any
in-flight run finish:

```bash
sudo systemctl stop market-alpha-fast-scan.timer
sudo systemctl is-active market-alpha-fast-scan.service   # wait for "inactive"
# ... run the dry run ...
sudo systemctl start market-alpha-fast-scan.timer
```

**Restarting the timer is part of the procedure, not an afterthought.** A fast
scan every 15 minutes is a user-visible freshness guarantee.

### 6. Let the schedule pick it up

No unit change and no restart is needed: `docker compose run` resolves `:latest`
at invocation, so the next scheduled scan uses the new image automatically.
Confirm with the database rather than the logs:

```sql
SELECT symbol, final_decision, final_score, created_at
FROM scanner_signals
WHERE created_at > now() - interval '30 minutes'
ORDER BY created_at DESC LIMIT 5;
```

### 7. Rollback

```bash
docker tag market-alpha-scanner-market-alpha-scanner-job:rollback-YYYYMMDDa \
          market-alpha-scanner-market-alpha-scanner-job:latest
```

The next scheduled run picks up the restored image. The image is stateless; its
only outputs are CSVs and database rows, so nothing needs unwinding.

## Monitoring this should have had, and still needs

| Control | State |
|---|---|
| `warn_missing_required_symbols()` names any promised symbol absent from a scan | **live** (in the image, runs every scan) |
| `tools/ops/scanner-image-freshness.sh` compares image to checkout from outside the image | **committed**, not yet wired to anything automatic |
| `ExecStartPre=-…/scanner-image-freshness.sh --warn-days 7` on both scan units | **open** — needs a systemd drop-in on prod |
| Daily timer running the check with `--fail-days 30` so staleness shows in `systemctl --failed` | **open** |
| Alert on the `[universe] WARNING` line in scan logs | **open** |

The two guards are deliberately different in kind. The in-image guard knows
what the scan actually contains; the out-of-image check knows what the scan
*should* have contained. Only the second can detect that the first is not
running, which is precisely the failure that hid SNDK for 35 days.
