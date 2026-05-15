# Phase 15.8 Real User Telemetry, Behavioral Intelligence

Date: 2026-05-15

## Executive Summary

Phase 15.8 adds a privacy-aware behavioral telemetry layer on top of TradeVeto's existing first-party analytics pipeline. The goal is to measure whether beta users understand, trust, and repeatedly use the product without collecting brokerage credentials, payment data, private financial data, raw Copilot prompts, or unnecessary personal data.

Final optimization maturity estimate: 88/100. The product now has the foundation required for real UX optimization, but the score should not move into the mid-90s until several weeks of beta cohort data are collected and acted on.

## Event Architecture

The canonical event allowlist now includes:

- `page_view`
- `first_useful_action`
- `modal_open`
- `modal_close`
- `modal_abandon`
- `card_click`
- `chart_expand`
- `timeframe_change`
- `watch_add`
- `alert_create`
- `feed_item_open`
- `replay_open`
- `strategy_open`
- `paper_trade_open`
- `onboarding_step`
- `onboarding_complete`
- `copilot_question`
- `rage_click`
- `duplicate_click`
- `nav_confusion`
- `scroll_abandon`
- `bottom_sheet_close`
- `back_navigation`
- `failed_action`
- `experiment_assigned`
- `experiment_exposed`

The implementation reuses the existing `analytics_events` table and sanitized `/api/analytics/events` ingestion route. Events are batched client-side, sent with `sendBeacon` when available, and capped per request to prevent network flooding.

## Privacy Boundaries

Telemetry tracks product behavior only.

Not collected:

- brokerage credentials
- payment card data
- Stripe secrets or tokens
- private financial account data
- raw Copilot prompts
- raw cookies, authorization headers, SMTP, API keys, or secrets

Copilot telemetry records only `questionLength`, mode, source, and history depth. Metadata sanitization continues to redact secret-like values and reject sensitive keys before storage.

Client telemetry can be disabled with:

- `NEXT_PUBLIC_TRADEVETO_DISABLE_TELEMETRY=1`
- local opt-out key: `tv_analytics_opt_out`

## Friction Detection

The client behavior detector now measures:

- repeated clicks on the same surface
- rage-click clusters
- long scroll sessions without useful interaction
- back-navigation behavior
- modal and bottom-sheet close behavior
- failed action reporting from instrumented workflows

Stored context is intentionally coarse:

- route
- viewport type
- component or surface label
- event cluster
- optional symbol context

## First Useful Action Analytics

The first-useful-action model now captures session elapsed time and page elapsed time for actions such as:

- first watchlist add
- first replay open
- first Copilot question
- first strategy review
- first paper-trade interaction when instrumented

Admin analytics aggregates:

- count of first useful actions
- average time to value
- top first useful action types

## Retention Analytics

The existing analytics summary continues to report:

- DAU
- WAU
- total sessions
- repeat sessions
- average session depth
- average session duration
- top pages
- top symbols
- entry/exit pages
- device/browser/geography mix

Phase 15.8 adds UX-focused retention inputs:

- feed item opens
- chart expansion
- timeframe changes
- Copilot question engagement
- modal abandonment
- failed action clusters

## Admin Dashboard

The internal `/admin/analytics` dashboard now includes UX optimization panels:

- UX friction signals
- activation quality
- first useful action breakdown
- friction hotspots by component and route
- flow abandonment
- experiment exposure
- telemetry boundary reminders

This remains admin-only and is intended for beta cohort learning, not public reporting.

## Experimentation Framework

Added a lightweight client experiment foundation in `frontend/src/lib/client/experiments.ts`.

Capabilities:

- deterministic local assignment
- variant persistence
- `experiment_assigned` telemetry
- `experiment_exposed` telemetry
- feature-flag friendly usage
- default-variant fallback when storage is unavailable

No active product experiment is forced by this phase. The framework is ready for safe tests such as nav ordering, card density, onboarding flow, chart layout, feed ranking, or CTA wording.

## Instrumented Surfaces

Updated instrumentation includes:

- route/page views through `AnalyticsProvider`
- global click/friction detector
- stable detail overlays for modal open/close/abandon
- chart expand and timeframe changes
- symbol chart expand and timeframe changes
- watchlist add alias event
- feed item open events
- onboarding step progression
- privacy-safe Copilot question telemetry

## Benchmark Notes

Compared to Robinhood-style fintech analytics, TradeVeto now has the necessary event model to detect early activation, repeated usage, and basic friction. Compared to Duolingo-style retention systems, the next gap is cohort-driven experimentation and user-level learning loops. Compared to mature fintech SaaS analytics, the remaining gap is not instrumentation primitives; it is longitudinal beta data and disciplined weekly review.

## Remaining Telemetry Debt

- Add opt-out UI in Account/Privacy if required by policy.
- Instrument every alert/watch/paper/strategy failed-action path consistently.
- Add server-side materialized UX summary if event volume grows.
- Add notification open-rate tracking once push/email events are wired end-to-end.
- Add cohort segmentation for invited beta wave, device class, and experience level.
- Add A/B experiment review workflow before activating tests.
- Add physical-device validation for mobile friction signals.

## Validation Results

Local validation on `/Users/hdtv/dev/market-alpha-scanner`:

- `cd frontend && npm run lint`: PASS
- `cd frontend && npm test -- --runInBand`: PASS, 400 tests
- `cd frontend && npm run build`: PASS
- `cd frontend && npm audit --omit=dev`: PASS, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: PASS
- `npx pyright . --pythonpath .venv/bin/python --warnings`: PASS, 0 errors / 0 warnings
- `git diff --check`: PASS

Production validation on `onsre-node-01` as `sre` from `/opt/apps/market-alpha-scanner/app`:

- Source-control parity before deploy: production worktree clean; production was behind `origin/main` by `4ec5dd7`.
- Code deploy commit after pull/rebuild: `4ec5dd7e4874846db514903ce906c23925645ab7`.
- Final production source/report sync: production was fast-forwarded to `origin/main` after report updates and left with a clean worktree.
- Migration status: no schema migration added; Phase 15.8 reuses the existing `analytics_events` table.
- Compose service discovery: `docker compose config --services` returned `market-alpha-postgres` and `market-alpha-frontend`.
- Rebuild command: `docker compose up -d --build market-alpha-frontend`.
- Container health: `market-alpha-frontend` healthy on port `3001/tcp`.
- `/api/health`: PASS, 200, `ok: true`.
- `/api/health/deep`: PASS, 200, database/scanner/backup statuses ok.
- Route smoke:
  - `/`: 200
  - `/terminal`: 200
  - `/opportunities`: 200
  - `/dashboard`: 200
  - `/api/admin/analytics`: 401 unauthenticated, expected fail-closed
  - `/api/analytics/events`: 405 on GET, expected method protection
  - `/api/health`: 200
  - `/api/health/deep`: 200
- Production worktree after deploy: clean.

Final status:

PHASE 15.8 REAL USER TELEMETRY BEHAVIORAL INTELLIGENCE COMPLETE
