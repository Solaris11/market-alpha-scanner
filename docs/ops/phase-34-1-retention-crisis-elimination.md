# Phase 34.1 - Retention Crisis Elimination

## Verdict Boundary

Phase 34.1 targets real retention recovery, not instrumentation alone.

The implementation can be shipped immediately, but `ACCOMPLISHED` is not valid until elapsed production cohorts prove:

| Metric | Target |
| --- | ---: |
| D1 retention | `> 20%` |
| D7 retention | `> 10%` |
| D30 retention | `> 5%` |
| 2+ active-day rate | `> 15%` |

Same-day activity, probe users, admin test users, synthetic sessions, and generated events do not count.

## Baseline

Phase 33 identified retention as the largest V1 blocker:

| Metric | Baseline |
| --- | ---: |
| D1 retention | `0.712%` |
| D2 retention | `0.306%` |
| D7 retention | `0.111%` |
| 2+ active-day rate | `0.904%` |

## Implementation

Added a Phase 34.1 retention crisis forensics model and production probe.

New model:

- `frontend/src/lib/retention-crisis-forensics.ts`
- `frontend/src/lib/retention-crisis-forensics.test.ts`

New production probe:

- `frontend/scripts/phase34-1-retention-crisis-forensics-probe.mjs`

New npm commands:

- `npm --prefix frontend run probe:phase34:retention-crisis`
- `npm --prefix frontend run probe:phase34:retention-crisis:docker`

The probe is read-only. It queries production analytics and does not create users, create events, seed retention, or backfill cohorts.

## Forensics Coverage

The Phase 34.1 probe measures:

- D1/D2/D7/D30 elapsed retention.
- 2+ active-day rate.
- signup-date cohorts.
- activation-score cohorts.
- workflow cohorts for watchlist, alert, chart, scanner, copilot, symbol, replay, and morning briefing.
- exit-surface forensics.
- first-useful-action failure.
- low-activation users.
- return-trigger readiness.
- experiment definitions for onboarding, daily setup, watchlist nudges, alert nudges, morning briefing, and copilot prompts.

## Return Triggers

Configured trigger categories:

| Trigger | Evidence source |
| --- | --- |
| Watchlist changes | watchlist usage and watchlist return events |
| New opportunities | scanner/discovery/opportunity events |
| AI confidence changes | copilot events |
| Macro changes | morning briefing events |
| Portfolio risk changes | chart and symbol investigation events |
| Alert opportunities | alert creation, notification engagement, and alert return events |

## Retention Experiments

Configured experiment definitions:

| Experiment | Primary metric |
| --- | --- |
| `phase34_onboarding_first_action` | first useful action |
| `phase34_daily_setup_card` | D7 |
| `phase34_watchlist_nudge` | D7 |
| `phase34_alert_nudge` | alert return |
| `phase34_morning_briefing` | D1 |
| `phase34_copilot_prompt` | D7 |

## Local Validation

Passed locally on 2026-06-02:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Local probe dry run:

- `npm --prefix frontend run probe:phase34:retention-crisis`
- Result: `not_ready` because the local execution environment did not expose `DATABASE_URL`.
- No synthetic cohort data was created.
- Production proof must run on the production host using the production `.env`.

## Production Deployment

Pending.

## Production Proof

Pending.

Expected artifact:

- `docs/ops/artifacts/phase-34-1-retention-crisis/retention-crisis-forensics-proof.json`

## Final Retention Proof

Pending elapsed production cohort proof.

## Current Verdict

Local implementation is validated. Production proof is pending.
