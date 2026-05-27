# Phase 27.4 - Primary Workflow Dominance + User Dependence

Date: 2026-05-27

## Verdict

Status: Strong partial accomplished.

Full accomplishment is not claimed from same-day implementation. The requested retention gates require elapsed production cohorts:

- D2 retention greater than 10%.
- D7 retention greater than 6%.
- 2+ active-day retention greater than 15%.

## Implementation Summary

Phase 27.4 strengthens the existing Terminal daily-driver system into a first-screen morning command center.

Runtime changes:

- Expanded the morning command center from seven checks to nine checks:
  - overnight market summary
  - overnight event summary
  - important events today
  - watchlist movement
  - scanner changes
  - risk changes
  - portfolio pressure
  - macro updates
  - AI intelligence digest
- Added a dedicated daily briefing engine:
  - what changed overnight
  - what matters now
  - what deteriorated
  - what improved
  - what risk changed
  - next useful action
- Added explicit user-dependence loops:
  - first open dependence
  - return-session dependence
  - repeat scanner usage
  - repeat chart usage
  - repeat watchlist usage
  - replay dependence
  - compare dependence
- Added an alert quality engine:
  - relevance scoring
  - fatigue score
  - adaptive importance
  - workflow-linked alerts
  - return attribution
- Raised product and admin retention proof gates to the Phase 27.4 thresholds:
  - D2 greater than 10%
  - D7 greater than 6%
  - 2+ active-day greater than 15%
  - alert-return conversion greater than 12%
  - notification useful ratio greater than 55%

## Changed Files

- `frontend/src/lib/trading/daily-driver-retention.ts`
- `frontend/src/components/terminal/DailyDriverRetentionPanel.tsx`
- `frontend/src/lib/trading/daily-driver-retention.test.ts`
- `frontend/src/lib/retention-cohort-certification.ts`
- `frontend/src/lib/retention-cohort-certification.test.ts`
- `frontend/scripts/phase26-paid-retention-daily-habit-probe.mjs`
- `docs/ops/phase-27-4-primary-workflow-user-dependence.md`

## Validation

Local focused validation:

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend run test -- daily-driver-retention retention-cohort-certification --runInBand` - passed, 531 tests.

Full validation:

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend test -- --runInBand` - passed, 531 tests.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors.
- `git diff --check` - passed.

## Production Workflow

Production deployment:

- Local commit: `9bc75b1f` - `Add primary workflow user dependence loops`.
- Pushed to `origin/main`.
- Production pull fast-forwarded to `9bc75b1`.
- Rebuilt and restarted:
  - `market-alpha-frontend`
  - `market-alpha-frontend-hot-api`
- Both containers reported healthy after deploy.

Production smoke:

- `/api/health` - 200.
- `/api/health/deep` - 200.
- `/terminal` - 200.
- `/discover` - 200.
- `/scanner` - 200.
- `/paper` - 200.
- `/strategy-labs` - 200.
- `/market-memory` - 200.
- `/symbol/AMD` - 200.
- `/alerts` - 200.
- `/feed` - 200.
- `/macro` - 200.

Retention proof:

- Production retention proof probe ran from inside `market-alpha-frontend`.
- Artifact: `docs/ops/artifacts/phase-27-4-primary-workflow-user-dependence/retention-proof.json`.
- `/api/admin/analytics?range=90d` returned 200 in 460ms.
- Probe did not create cohort events, seed retention activity, backfill outcomes, or fabricate D2/D7 success.
- Overall status: `strong_partial`.

## Refreshed Production Cohort Evidence

Founding-member cohort:

| Metric | Evidence | Target | Result |
| --- | ---: | ---: | --- |
| Founding actors | 4 | n/a | sample exists |
| Founding D2 retention | 0 / 1 = 0% | > 10% | failed |
| Founding D7 retention | 0 / 1 = 0% | > 6% | failed |
| Founding 2+ active-day retention | 0 / 4 = 0% | > 15% | failed |
| Alert-return conversion | no alert-trigger population | > 12% | failed |
| Notification useful ratio | no usefulness sample | > 55% | failed |

Aggregate 90-day evidence:

| Metric | Evidence |
| --- | ---: |
| Total active-day users | 935 |
| D1 retention | 7 / 914 = 0.77% |
| D2 retention | 3 / 911 = 0.33% |
| D7 retention | 1 / 679 = 0.15% |
| 2+ active-day retention | 9 / 935 = 0.96% |

Workflow-return counts from the production read:

| Metric | Count |
| --- | ---: |
| Morning workflow starts | 22 |
| Morning workflow completions | 0 |
| Return sessions | 6 |
| Personalized returns | 8 |
| Watchlist returns | 6 |
| Chart returns | 1 |
| Scanner returns | 0 |
| Alert returns | 0 |
| Workflow dropoffs | 2 |

## Retention Evidence Boundary

No retention success is fabricated. This phase can improve first-screen workflow design and telemetry, but it cannot prove D2/D7 outcomes until real users age into those cohort windows after deployment.

Prior production evidence remains below target:

- Founding D2 retention: 0%.
- Founding D7 retention: 0%.
- Founding 2+ active-day retention: 0%.
- Aggregate D2/D7 retention remains below 1%.

## Remaining Blockers

- Elapsed production cohorts have not met D2 greater than 10%.
- Elapsed production cohorts have not met D7 greater than 6%.
- Elapsed production cohorts have not met 2+ active-day greater than 15%.
- Alert-return conversion and notification usefulness still need meaningful real-user samples.

## Final Certification Rule

Strong partial is the maximum defensible status after implementation and deployment unless refreshed production cohorts already meet every target.

Final certification status:

`TRADEVETO PRIMARY WORKFLOW + USER DEPENDENCE STRONG PARTIAL ACCOMPLISHED`
