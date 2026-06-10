# Phase 35.0C.4 Final Performance Recertification

Generated: 2026-06-10

## Verdict

**NOT READY**

Phase 35.0C.4 cannot be certified as `FULLY CERTIFIED`, `OPTIMIZED`, or
`PARTIALLY OPTIMIZED` because hard prerequisite gates are still red:

- 24h stability observation is running but not elapsed.
- R2 offsite backup is still unhealthy.
- Current large-object R2 backup upload did not complete.
- Chart workflow certification remains not accomplished from the latest
  authenticated Chromium/Firefox/WebKit matrix.

The scanner persistence and full-scan analysis blockers are materially improved,
but final performance recertification requires no Critical or High blockers.
That bar is not met.

## Production State

Production host:

- `sre@100.68.155.121`
- `/opt/apps/market-alpha-scanner/app`

Production commit checked during this recertification:

- `6c95a54`

Container state:

| Service | State |
| --- | --- |
| `market-alpha-frontend` | healthy |
| `market-alpha-frontend-hot-api` | healthy |
| `market-alpha-postgres` | healthy |

Deep health:

| Component | Result |
| --- | --- |
| App health | OK |
| DB health | OK |
| Scanner health | OK |
| Local backup | OK |
| R2/offsite backup | Failed |
| Overall backup | Partial/warn |

Latest R2 health evidence:

- Latest local Postgres backup: `2026-06-10_02-00.sql.gz`
- Latest local scanner backup: `2026-06-10_02-04.tar.gz`
- R2 Postgres listing still stops at `2026-06-05_06-00.sql.gz`
- R2 scanner listing still stops at `2026-06-05_12-03.tar.gz`
- Latest successful offsite provider: none reported by deep health

## Route Smoke

Live curl smoke during this pass:

| Route | HTTP | TTFB | Total |
| --- | ---: | ---: | ---: |
| `/` | 200 | 0.686s | 1.970s |
| `/terminal` | 200 | 0.365s | 0.566s |
| `/discover` | 200 | 0.529s | 1.777s |
| `/scanner` | 200 | 0.404s | 0.928s |
| `/symbol/AMD` | 200 | 0.430s | 0.673s |
| `/history` | 200 | 0.255s | 0.458s |
| `/performance` | 200 | 0.807s | 0.935s |
| `/feed` | 200 | 0.680s | 1.028s |
| `/alerts` | 200 | 0.226s | 0.513s |
| `/account` | 200 | 0.240s | 0.829s |
| `/market-memory` | 200 | 2.481s | 3.459s |

Result:

- Primary route smoke passes.
- `/market-memory` remains slow enough to watch in the next performance pass.

## Scanner Certification

Phase 35.0C.1 scanner proof:

| Gate | Result |
| --- | --- |
| 500 selected/accounted | Pass |
| 500 unknown = 0 | Pass |
| 1000 selected/accounted | Pass |
| 1000 unknown = 0 | Pass |
| Full scan with analysis | Pass |
| Exit 137 recurrence | Not observed in latest proof |

Latest live production scan DB check:

| Metric | Result |
| --- | ---: |
| Selected | 500 |
| Accounted | 500 |
| Ranked | 362 |
| Unknown | 0 |
| Filtered liquidity | 115 |
| Filtered market cap | 7 |
| Provider partial | 16 |
| Latest persisted distinct symbols | 362 |
| Market-structure total symbols | 362 |

Full-scan service state:

- `market-alpha-full-scan.service` completed successfully on
  `2026-06-09 21:41:24 UTC`.
- Latest logged full-analysis runtime: `680.7s`.
- Analysis database rows written: `performance_summary=283`,
  `forward_returns=8066`.

Certification interpretation:

- Scanner accounting and full-analysis stability are certified.
- Current user-facing ranked universe is still 362 symbols, not 500 ranked rows.
  That is acceptable for accounting certification but not a 500-row user-facing
  scanner dominance claim.

## Chart And Workflow Certification

Latest Phase 35.0C.2 authenticated full-matrix proof remains the current valid
chart workflow evidence. No code landed after that proof that closes the failed
browser-specific gates.

| Browser | Overall | `/symbol/AMD` interactive | Chart restore | Symbol switch |
| --- | --- | ---: | ---: | ---: |
| Chromium | ready | 1780.4 ms | 30.3 ms | 7.6 ms |
| Firefox | not_ready | 4495 ms | 13 ms | 15 ms |
| WebKit | not_ready | 1463 ms | 87 ms | 149 ms |

Targets:

- Chart restore `<250 ms`
- Symbol switch `<100 ms`
- `/symbol/AMD` interactive `<2500 ms`

Result:

- Chart restore target passes.
- Firefox route interactive fails.
- WebKit symbol switch fails.
- Chart workflow certification remains `NOT ACCOMPLISHED`.

The full browser/auth workflow matrix was not rerun in this pass because hard
production prerequisites were already red: R2 offsite backup is unhealthy and
the 24h stability window has not elapsed. Running the expensive matrix would not
change the final verdict.

## Stability Certification

Phase 35.0C.3 observation status:

| Gate | Result |
| --- | --- |
| 1h observation | Not elapsed during this recertification |
| 6h observation | Not elapsed |
| 24h observation | Running, not elapsed |
| Observer start | `2026-06-10T03:40:40Z` |
| Sample file | `docs/ops/artifacts/phase-35-0c-3-stability/observation-24h/samples.jsonl` |
| Samples observed during this pass | 7 |

Result:

- Stability certification is not complete.
- A 24h memory/container leak claim cannot be made yet.

## Backup And Recovery Certification

Local backup/restore:

| Gate | Result |
| --- | --- |
| Latest local Postgres gzip | Pass |
| Latest local scanner tar | Pass |
| Local restore drill | Pass |
| Temporary DB public tables | 79 |
| Restored `scanner_signals` rows | 537728 |
| Scanner artifact files extracted | 10171 |
| RTO estimate | 244s |
| Post-restore route smoke | Pass |

R2/offsite backup:

| Gate | Result |
| --- | --- |
| Small disposable R2 boto3 write/read/delete | Pass |
| R2 list via rclone | Pass |
| Current large Postgres artifact upload | Fail |
| Current large scanner artifact upload | Not reached after Postgres timeout |
| R2 current backup visible | Fail |
| R2 restore drill | Not possible from current backup |
| Deep health backup state | warn/partial |

Current failure modes observed:

- rclone upload path fails with `NotImplemented` for writes while listing works.
- boto3 large-object upload first failed with `SSLEOFError` during multipart.
- hardened single-concurrency multipart upload then timed out after one hour
  before Postgres object verification.

Result:

- Local recovery is proven.
- R2/offsite recovery is not proven.
- Backup recovery certification fails.

## API, DB, And Memory State

Live container memory sample:

| Container | CPU | Memory |
| --- | ---: | ---: |
| `market-alpha-frontend` | 0.00% | 1.638 GiB |
| `market-alpha-frontend-hot-api` | 0.02% | 929 MiB |
| `market-alpha-postgres` | 0.02% | 2.782 GiB |

DB pressure:

- Deep health DB check passes.
- Full `pg_stat_statements` attribution remains unavailable from prior Phase
  35.0C evidence.
- Long-duration DB/memory stability cannot be certified until the 24h observer
  completes.

## Certification Matrix

| Gate | Target | Result | Status |
| --- | --- | --- | --- |
| Production deployment | Current main deployed | `6c95a54` | Pass |
| Production route smoke | All major routes 200 | Pass | Pass |
| 500-symbol scanner path | Selected/accounted, unknown 0 | Pass | Pass |
| 1000-symbol scanner path | Selected/accounted, unknown 0 | Phase 35.0C.1 pass | Pass |
| Full scan with analysis | Completes, no exit 137 | Pass | Pass |
| Chart restore | `<250 ms` | Pass in Phase 35.0C.2 | Pass |
| Symbol switch | `<100 ms` | WebKit `149 ms` final matrix | Fail |
| Browser route matrix | Chromium/Firefox/WebKit ready | Firefox/WebKit not ready | Fail |
| Authenticated workflow matrix | All critical workflows ready | Chart matrix not ready | Fail |
| API latency | No hot p95 regression | Not fully rerun due red preflight | Not certified |
| DB pressure | No lock/memory pressure | Short sample ok, 24h pending | Partial |
| Memory stability | 24h pass | Running, not elapsed | Fail |
| R2 backup health | Healthy | Failed/partial | Fail |
| R2 restore | Current offsite restore passes | Not possible | Fail |

## Blocker Register

| Severity | Blocker | Evidence | Required Fix |
| --- | --- | --- | --- |
| Critical | R2 current backup unhealthy | Deep health backup `warn`; R2 listing lacks June 10 backups | Fix large-object offsite sync or replace R2 transfer path |
| Critical | 24h stability not complete | Observer has only early samples | Let 24h window complete and analyze memory/container trends |
| High | R2 restore drill impossible | Current backup is not in R2 | Complete current R2 sync, download artifacts, restore drill from R2 |
| High | WebKit symbol switch misses target | Phase 35.0C.2 final matrix `149 ms` vs `<100 ms` | Reduce WebKit switch variance or loosen unsupported target with evidence |
| High | Firefox `/symbol/AMD` interactive unstable | Phase 35.0C.2 final matrix `4495 ms` vs `<2500 ms` | Fix authenticated shell scheduling/hydration variance |
| Medium | `/market-memory` route slow | Live total `3.459s` | Profile route-specific server/render cost |
| Medium | User-facing ranked universe below 500 | Latest ranked/persisted symbols `362` | Decide whether 500+ ranked rows are required, or keep accounting-only claim |

## Final Outcome

**NOT READY**

Reason:

Final performance recertification requires no Critical or High blockers. The
platform currently has Critical failures in R2/offsite backup health and elapsed
24h stability proof, plus High browser workflow failures carried forward from
the latest authenticated chart workflow matrix. Scanner persistence and local
restore are substantially improved, but the complete Phase 35.0C certification
cannot honestly pass yet.
