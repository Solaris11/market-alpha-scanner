# Sprint 30.1 - Retention Emergency Recovery

## Verdict Boundary

Implementation target: first-session activation recovery and retention instrumentation.

Outcome target: real elapsed D1/D2/D7, 2+ active-day, alert-return, and notification usefulness improvement.

This sprint can deploy activation recovery mechanics immediately, but it cannot honestly certify retention recovery until aged production cohorts prove the metrics. No fake cohort events, probe sessions, or same-day activity are counted as D2/D7 retention.

## Baseline

Current production retention entering the sprint:

| Metric | Current |
| --- | ---: |
| D1 retention | `0.739%` |
| D2 retention | `0.328%` |
| D7 retention | `0.123%` |
| 2+ active days | `0.929%` |

## Implementation Summary

- Added a shared activation score model for durable first-session anchors:
  - scanner usage
  - watchlist creation
  - symbol investigation
  - alert creation
  - chart save
  - morning briefing completion
  - compare usage
  - history usage
  - replay usage
- Added client route telemetry for the required journey steps:
  - landing
  - signup
  - discover
  - scanner
  - watchlist
  - symbol
  - alert
  - chart
  - history
  - replay
  - morning briefing
  - account
- Added activation score and journey events:
  - `activation_journey_step`
  - `activation_score_update`
  - `activation_nudge_view`
  - `activation_nudge_click`
  - `activation_nudge_dismiss`
- Added a global targeted activation nudge for low-score users:
  - "Track your first symbol"
  - "Run your first scanner"
  - "Investigate one symbol"
  - "Create your first alert"
  - "Save this chart setup"
  - "Complete your morning briefing"
- Added route-entry first-useful-action events for scanner, symbol, history, and replay so first useful action failure is visible instead of hidden.
- Expanded the admin analytics dashboard with:
  - activation funnel report
  - dropoff analysis
  - activation heatmap
  - activation score distribution
  - nudge view/click scoreboard

## Activation Funnel Report

The admin dashboard now measures user-level adoption for:

| Step | Evidence |
| --- | --- |
| Landing | `landing_open` and root page views |
| Signup | `signup_open`, early-access, founding checkout events |
| Discover | `discover_open`, `opportunities_open` |
| Scanner | `scanner_open`, `scanner_usage`, `scanner_run`, first scanner action |
| Watchlist | `watch_add`, `watchlist_add`, `watchlist_usage`, watchlist first action |
| Symbol investigation | `symbol_open`, symbol-card action, symbol research start |
| Alert creation | `alert_create`, alert first action |
| Chart save | chart expand/template save/return, chart first action |
| Compare | compare first action and compare return |
| History/replay | history/replay/market-memory opens and usage |
| Morning briefing | morning workflow completion and briefing first action |
| Account | account visits |

## Dropoff Analysis

The dashboard now estimates abandonment across these key transitions:

| Transition | Purpose |
| --- | --- |
| landing to signup | top-of-funnel friction |
| signup to scanner | first product action failure |
| discover to scanner | discovery-to-operational scanner conversion |
| scanner to watchlist | repeat-use anchor creation |
| scanner to symbol | scanner-to-investigation workflow |
| symbol to alert | return-loop creation |
| symbol to chart save | persistent workflow creation |
| scanner to compare | power workflow activation |
| history to replay memory | continuity workflow depth |
| terminal to morning complete | daily habit loop completion |

## Heatmap Analysis

The admin heatmap now groups activation and friction by surface:

- visits
- unique actors
- activation events
- activation rate
- workflow dropoffs
- dropoff rate
- nudge views
- nudge clicks
- friction events

This makes first-session exits and workflow exits visible by page instead of requiring raw event inspection.

## Activation Score

The client builds a local activation score from completed durable actions. Low-scoring users receive targeted prompts. The score intentionally weights actions that create return behavior:

| Action | Weight |
| --- | ---: |
| Scanner usage | `16` |
| Watchlist creation | `16` |
| Symbol investigation | `14` |
| Alert creation | `13` |
| Chart save | `12` |
| Morning briefing completion | `11` |
| Compare usage | `7` |
| History usage | `6` |
| Replay usage | `5` |

Score levels:

- `at_risk`: below `35`
- `partial`: `35` to `71`
- `activated`: `72+`

## Success Metrics

The sprint is designed to move:

- watchlist adoption: `+50%`
- alert adoption: `+50%`
- chart save adoption: `+50%`
- morning briefing completion: `+100%`
- return session rate: significant improvement

These are post-deploy cohort targets and require elapsed production data before certification.

## Validation Plan

Required local validation:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Required production validation:

- production pull on `sre@100.68.155.121`
- rebuild affected runtime containers
- production smoke
- admin analytics dashboard check
- cohort export after enough elapsed time

## Remaining Certification Blocker

Retention recovery is not certified by implementation alone. Final recovery requires aged production cohorts showing materially improved D1/D2/D7, 2+ active-day, alert-return conversion, and notification usefulness metrics.
