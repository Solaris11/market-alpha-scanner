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

- Production host: `sre@100.68.155.121`
- Production path: `/opt/apps/market-alpha-scanner/app`
- Deployed commit: `c3260988ca8451de85efc942aab3592f4da82a83`
- Production pull: `git pull --ff-only origin main`
- Rebuild: `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Container health: `market-alpha-frontend` and `market-alpha-frontend-hot-api` reported `healthy`.

## Production Proof

Artifacts:

- `docs/ops/artifacts/phase-34-1-retention-crisis/production-smoke.txt`
- `docs/ops/artifacts/phase-34-1-retention-crisis/retention-crisis-forensics-proof.json`
- `docs/ops/artifacts/phase-34-1-retention-crisis/probe-exit.txt`

Production smoke returned HTTP `200` for:

- `/api/health`
- `/api/health/deep`
- `/terminal`
- `/discover`
- `/scanner`
- `/alerts`
- `/feed`
- `/history`
- `/performance`
- `/symbol/AMD`
- `/market-memory`
- `/macro`
- `/account`
- `/status`

Production retention probe:

- Status: `strong_partial`
- Query latency: `10004 ms`
- Total actors observed: `999`
- Real actors after probe/admin filtering: `982`
- Filtered actors: `17`
- Segment counts:
  - anonymous users: `784`
  - founding/paid: `197`
  - free authenticated: `1`
  - probe filtered: `16`
  - admin/internal filtered: `1`

Retention proof:

| Metric | Production result | Target | Status |
| --- | ---: | ---: | --- |
| D1 retention | `0.815%` (`8 / 982`) | `> 20%` | Fail |
| D2 retention | `0.408%` (`4 / 981`) | diagnostic | Fail context |
| D7 retention | `0%` (`0 / 913`) | `> 10%` | Fail |
| D30 retention | `N/A` (`0` eligible) | `> 5%` | Not yet aged |
| 2+ active-day rate | `0.815%` (`8 / 982`) | `> 15%` | Fail |

Behavioral findings:

- `982` real actors are in activation score tiers below `25`; first-session durable actions are not consistently happening.
- Top exit surface is `landing`; `100%` of those actors have no first useful action.
- `scanner` is the largest measured workflow missing D7 return behavior.
- AI confidence-change return triggers have no usable sample yet.

Return trigger readiness:

| Trigger | Evidence events | Readiness |
| --- | ---: | --- |
| Watchlist changes | `10` | ready to test |
| New scanner opportunities | `276` | ready to test |
| AI confidence changes | `0` | blocked by no sample |
| Macro changes | `19` | ready to test |
| Portfolio risk changes | `215` | ready to test |
| Alert opportunities | `7` | ready to test |

## Final Retention Proof

Retention crisis elimination is not proven. The implementation now provides production retention forensics, cohort segmentation, blocker attribution, and A/B experiment definitions, but elapsed production cohorts still miss every hard success target.

## Current Verdict

TRADEVETO RETENTION CRISIS ELIMINATION STRONG PARTIAL ACCOMPLISHED

This is strong partial because Phase 34.1 forensics, cohorts, return triggers, and experiment definitions are implemented, locally validated, deployed, and production-probed. It is not accomplished because D1, D7, D30, and 2+ active-day targets are not met.
