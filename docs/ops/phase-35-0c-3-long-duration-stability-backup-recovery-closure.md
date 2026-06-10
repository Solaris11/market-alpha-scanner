# Phase 35.0C.3 Long-Duration Stability + Backup Recovery Closure

Generated: 2026-06-10

## Current Verdict

**NOT ACCOMPLISHED**

The R2 write root cause is now isolated and a safer current-artifact R2 sync path
has been implemented, but the phase cannot be certified yet because the required
1h/6h/24h production observations and full local/R2 restore drill have not all
elapsed and passed.

## Root Cause Summary

Production deep health was up, but backup health was partial:

- Local backup: `ok`
- Offsite backup: `failed`
- Latest failed event: `backup_partial`
- Provider: `r2`
- Exit code: `124`
- Retry count: `3`
- Duration: `3066` seconds
- Latest local artifacts:
  - Postgres: `2026-06-10_00-00.sql.gz`
  - Scanner: `2026-06-10_00-03.tar.gz`

Backup logs showed repeated `rclone copy /opt/backups/market-alpha
r2:market-alpha-backups` timeouts. The same logs also showed R2 multipart upload
failures after trying an unreachable IPv6 Cloudflare address. Direct production
checks proved:

- `rclone lsf r2:market-alpha-backups/postgres/` succeeds.
- `rclone copy` to a disposable R2 object fails with `NotImplemented`.
- Direct boto3 `put_object`, `get_object`, and `delete_object` against the same
R2 endpoint and credentials succeeds.
- The new root-run helper uploaded a disposable object, rclone listed it, and the
object was deleted successfully.

Conclusion: the current outage is not bad R2 credentials. It is the rclone write
path plus full-backlog sync behavior. The backup should upload only the current
Postgres and scanner artifacts on the hot scheduled path.

## Implemented Changes

- Added `tools/ops/tradeveto-r2-current-backup-sync.py`.
  - Uses the existing root rclone config for R2 credentials.
  - Uploads explicitly supplied local artifacts to explicit R2 object keys.
  - Verifies object size with `head_object`.
  - Prints JSON summaries without secret values.
- Updated `tools/ops/market-alpha-backup.sh`.
  - R2 provider now uses the boto3 current-artifact helper.
  - R2 helper uploads use a separate one-hour bound because current compressed
    Postgres plus scanner artifacts are roughly 1 GB.
  - Non-R2 providers still use the existing bounded rclone copy path.
  - Existing monitoring event classifications remain unchanged.
- Added `tools/ops/tradeveto-stability-observe.sh`.
  - Captures docker stats, container status, open connections, route timings,
    scanner/rclone process state, failed systemd units, and scanner/backup timers.
  - Writes JSONL samples plus a summary file.
  - Intended to run once for 24h and derive the 1h/6h/24h reports from the same
    sample stream.
- Updated `docs/ops/backup-restore.md` with the current R2 sync model and manual
  validation command.

## Evidence Captured So Far

Production checks:

| Check | Result |
| --- | --- |
| Current deployed commit before this phase | `9ca1c4f` |
| `docker compose ps` | frontend, hot-api, Postgres healthy |
| `/api/health/deep` | HTTP 200, app/db/scanner ok, backup warn |
| Root `rclone lsf` to R2 | Pass |
| Root disposable helper upload/list/delete | Pass |
| First full post-deploy R2 run | Failed on the prior 900s bound before completion |

Validation:

| Command | Result |
| --- | --- |
| `bash -n tools/ops/market-alpha-backup.sh tools/ops/tradeveto-stability-observe.sh tools/ops/market-alpha-post-deploy-backup.sh tools/ops/tradeveto-restore-drill.sh` | Pass |
| `python3 -m py_compile tools/ops/tradeveto-r2-current-backup-sync.py` | Pass |

## Required Observation Plan

Artifact root:

`docs/ops/artifacts/phase-35-0c-3-stability/`

Production command:

```bash
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-stability-observe.sh \
  --duration-seconds 86400 \
  --interval-seconds 60 \
  --output-dir /opt/apps/market-alpha-scanner/app/docs/ops/artifacts/phase-35-0c-3-stability/observation-24h
```

Expected derived reports:

- `observation-1h/`
- `observation-6h/`
- `observation-24h/`

Certification requires:

- no frontend, hot-api, Postgres, or scanner memory leak over 24h
- no container restarts
- no orphan scanner jobs
- no stale rclone processes
- request latency stable during the observation
- scanner and backup timers behaving as expected

## Backup Recovery Plan

Required proof still pending after deployment:

1. Run current-artifact backup with R2 helper.
2. Verify local Postgres gzip and scanner tar.
3. Verify current Postgres and scanner objects exist in R2.
4. Run local restore drill into temporary DB.
5. Download the current R2 Postgres and scanner artifacts into a temporary
   restore directory.
6. Run restore drill against the R2-downloaded artifacts.
7. Run production smoke after restore tests.

## Recovery Test Plan

Required proof still pending:

- frontend restart
- hot-api restart
- scanner-job failure/recovery
- Postgres temporary restore drill
- degraded provider mode smoke
- production smoke after recovery tests

## Remaining Blockers

| Severity | Blocker | Status |
| --- | --- | --- |
| Critical | 24h memory/container observation | Not elapsed |
| High | 6h observation report | Not elapsed |
| High | R2 current backup run with large artifacts | Pending rerun with one-hour R2 bound |
| High | Restore from local latest backup | Pending |
| High | Restore from R2-downloaded backup | Pending |
| High | Container restart/recovery proof | Pending |

## Final Stability Certification

Not certified yet. The implementation and root-cause isolation are materially
improved, but the requested certification target requires elapsed observation and
restore evidence that cannot be honestly claimed at this point.

Final verdict for this pass:

**PRODUCTION STABILITY AND RECOVERY NOT ACCOMPLISHED**
