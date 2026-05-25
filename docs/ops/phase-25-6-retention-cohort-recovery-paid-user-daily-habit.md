# Phase 25.6 - Retention Cohort Recovery + Paid User Daily Habit

## Scope

Phase 25.6 adds a hard proof boundary for daily-driver retention. The implementation separates paid early-access retention from historical/noisy aggregate traffic and prevents same-day product instrumentation from being certified as retention success.

## Implemented

- Added paid-user cohort segmentation to admin analytics:
  - founding members
  - free research preview
  - legacy users
  - anonymous users
  - bot/noise filtered users
- Added elapsed-cohort gates for:
  - D2 retention greater than 8%
  - D7 retention greater than 4%
  - 2+ active-day retention greater than 10%
  - alert-return conversion greater than 12%
  - notification useful ratio greater than 55%
- Added first useful action counts by cohort:
  - first watchlist
  - first scanner
  - first alert
  - first chart save
  - first replay
  - first morning briefing completion
- Added admin dashboard cohort panel with paid/founding sample size, noise filtering, target gates, blockers, and segment-level pass/fail evidence.
- Added production proof probe:
  - `npm --prefix frontend run probe:phase25:retention-cohort`
  - output: `docs/ops/artifacts/phase-25-6-retention-cohort-recovery-paid-user-daily-habit/retention-cohort-proof.json`

## Evidence Boundary

The retention proof uses production `analytics_events` only. The proof probe creates a temporary admin session only to read `/api/admin/analytics`; it does not create cohort events, seed retention activity, or manufacture D2/D7 outcomes.

Certification can only be `ACCOMPLISHED` when elapsed founding-member cohorts meet all targets. If instrumentation ships but founding-member cohorts have not aged or do not meet targets, the correct result is `STRONG PARTIAL ACCOMPLISHED`.

## Validation

Local validation passed on 2026-05-25:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Production deployment passed on 2026-05-25:

- `git pull --ff-only origin main` fast-forwarded production to `bb31a309`.
- `docker compose --env-file .env up -d --build market-alpha-frontend` rebuilt and restarted `market-alpha-frontend`.
- `https://tradeveto.com/api/health` returned `ok`.
- `https://tradeveto.com/api/health/deep` returned `ok` for database, scanner, and backups.
- Route smoke returned `200` for `/terminal`, `/discover`, `/scanner`, `/paper`, and `/performance`.
- `/admin/analytics` is not publicly reachable without an authenticated admin session, as expected.

Production retention proof:

- Host-side probe could not reach the Docker-only Postgres DNS name from outside the Compose network.
- The same probe was rerun inside `market-alpha-frontend`, where deployed runtime environment variables and `market-alpha-postgres` DNS are available.
- `/api/admin/analytics?range=90d` returned `200` in `378ms`.
- The probe did not create cohort events or seed retention data.

## Production Evidence

| Evidence | Result |
| --- | --- |
| Production deploy | Passed |
| Production smoke | Passed |
| Admin analytics retention probe | Passed |
| Total actors segmented | 909 |
| Bot/noise filtered actors | 2 |
| Founding-member sample size | 1 actor |
| Founding-member D2 retention | 0%: 0 / 1 |
| Founding-member D7 retention | 0%: 0 / 1 |
| Founding-member 2+ active-day retention | 0%: 0 / 1 |
| Founding-member alert-return conversion | No eligible alert-trigger population |
| Founding-member notification useful ratio | No notification usefulness sample |
| Free research preview sample | 1 actor |
| Anonymous sample | 905 actors |

## Remaining Blockers

- Founding-member D2 retention is 0%, below the 8% target.
- Founding-member D7 retention is 0%, below the 4% target.
- Founding-member 2+ active-day retention is 0%, below the 10% target.
- No founding-member alert-trigger population exists for alert-return conversion proof.
- No founding-member notification usefulness sample exists.
- Same-day or synthetic data is not valid retention certification evidence.

## Verdict

TRADEVETO RETENTION COHORT RECOVERY + PAID USER DAILY HABIT STRONG PARTIAL ACCOMPLISHED
