# Phase 23.4 Retention + Daily-Driver Recovery

Date: 2026-05-23

Production target: https://tradeveto.com

Production host: `sre@100.68.155.121`

Production path: `/opt/apps/market-alpha-scanner/app`

Final deployed runtime commit: `pending`

Final verdict: **pending**

## Scope

Phase 23.4 targets the current retention blocker directly. It improves the product loops that can create repeat behavior, but it does not claim the retention targets are met before elapsed production cohorts prove them.

Required targets:

| Metric | Target | Current Certification State |
| --- | ---: | --- |
| D2 retention | > 8% | Requires elapsed post-release cohort proof |
| D7 retention | > 4% | Requires elapsed post-release cohort proof |
| 2+ active-day retention | > 10% | Requires elapsed post-release cohort proof |
| Notification useful ratio | > 55% | Requires real user feedback volume |

## Implemented Recovery Loops

### Morning Workflow

Added an explicit morning recovery workflow to the Terminal daily-driver panel:

- overnight market summary
- watchlist movement
- scanner changes
- risk changes
- macro updates

Each check is now a tappable workflow item with first-party telemetry:

- `morning_workflow_start`
- `watchlist_return`
- `scanner_return`
- `personalized_intelligence_return`
- `workflow_continuity`

### Return Loops

Strengthened route and action telemetry for:

- scanner return
- alert return
- replay return
- watchlist return
- strategy return
- personalized intelligence return

Added the explicit `strategy_return` analytics event so strategy repeat behavior is measured separately from generic personalized intelligence.

### Notification Usefulness

Notification feedback now records richer quality/fatigue metadata:

- useful/not useful
- notification type
- fatigue signal
- category quality
- action URL presence
- return attribution

This preserves existing durable notification feedback while making category-level fatigue and usefulness easier to audit.

### Continue Where You Left Off

The Terminal ecosystem continuity bridge now exposes clickable restore rows for:

- last route
- scanner state
- compare set
- chart layouts

Restore clicks emit `workflow_continuity` and `first_useful_action` context so scanner, chart, compare, and route restoration become measurable return-session behavior.

### Personalization

The existing adaptive priority, workspace preferences, watchlist, and favorite-module systems remain the personalization layer. Phase 23.4 makes the daily recovery panel a clearer entry point into that adaptive state rather than adding unsupported user-model claims.

## Dashboard Coverage

Admin analytics and monitoring now expose:

- D1/D2/D7 retention
- 2+ and 7+ active-day behavior
- return sessions
- morning workflows
- scanner returns
- replay returns
- alert returns
- watchlist returns
- strategy returns
- personalized returns
- notification useful/not useful/fatigue metrics

## Local Validation

Passed before production deploy:

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | passed |
| `npm --prefix frontend test -- --runInBand` | passed: 491 tests |
| `npm --prefix frontend run build` | passed |
| `npm --prefix frontend audit --omit=dev` | passed: 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | passed |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | passed: 0 errors, 0 warnings |
| `git diff --check` | passed |

## Production Deploy Proof

Pending production pull, rebuild, and smoke.

## Production Smoke

Pending.

## Retention Proof Boundary

The implementation creates stronger habit loops and telemetry. It does not prove:

- D2 retention > 8%
- D7 retention > 4%
- 2+ active-day retention > 10%
- notification useful ratio > 55%

Those remain cohort metrics that require eligible post-release users and elapsed time after deployment.

## Remaining Blockers

- No elapsed Phase 23.4 D2/D7 cohort exists on release day.
- Real notification usefulness needs real users to rate delivered notifications.
- Daily-driver certification requires a follow-up retention read after eligible cohorts age past 2 and 7 days.

## Verdict Criteria

Strong partial requires:

- runtime changes deployed to production
- local validation passing
- production health and core route smoke passing
- retention loops implemented and instrumented
- no claim that retention targets are met before cohort evidence exists

Accomplished requires all strong partial criteria plus elapsed production cohorts meeting the requested retention and notification usefulness targets.

## Verdict

Pending.
