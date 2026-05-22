# Phase 20.6 - Real User Retention + Daily Driver Dominance

Date: 2026-05-22

Production URL tested: `https://tradeveto.com/terminal#daily-driver-retention`

Final verdict: `TRADEVETO REAL USER RETENTION + DAILY DRIVER DOMINANCE NOT ACCOMPLISHED`

## Summary

Phase 20.6 added a production daily-driver retention layer to the Terminal, but it cannot honestly certify retention dominance yet. The prior audit showed 2+ day retention at 1.0%. This sprint improves the product mechanics that should reduce that risk, but real retention recovery requires live cohort proof over multiple days.

The new Terminal section is designed to move users from passive reading into repeatable workflows:

- morning intelligence check
- watchlist movement
- scanner reuse
- replay review
- strategy evolution
- alert-driven return
- macro update loop

It explicitly states that it does not claim retention victory until production cohorts show better 2-day and 7-day retention.

## Implementation

### Retention Funnel Model

Added `frontend/src/lib/trading/daily-driver-retention.ts`.

The model evaluates:

- activation readiness
- first useful action readiness
- watchlist anchor strength
- scanner reuse readiness
- replay reuse readiness
- strategy reuse readiness
- workflow continuity
- friction-control instrumentation

Inputs are grounded in existing production data structures:

- scanner opportunity rows
- user watchlist symbols
- persisted workspace preferences
- workflow evolution snapshots
- trigger monitors
- evidence maturity and replay/shock context where available

The model does not fabricate retention gains. It produces blockers when watchlists, saved workspace state, replay candidates, or returning workflow memory are missing.

### Daily Driver Terminal Surface

Added `frontend/src/components/terminal/DailyDriverRetentionPanel.tsx` and mounted it directly after the Daily Market Command Center on `/terminal`.

The panel provides:

- 6 primary daily-driver actions
- 7 habit loops
- funnel health visualization
- workflow continuity tiles
- personalization memory tiles
- explicit remaining retention proof gaps

The primary actions emit existing analytics events:

- `first_useful_action`
- `workflow_continuity`
- card-click behavior telemetry through existing detectors

### First Useful Action Optimization

The panel makes the following first useful actions visible without deep navigation:

- create or review watchlist
- save or reuse scanner preset
- review replay context
- run strategy evolution review
- create return alert
- run morning intelligence check

If a user has no watchlist, watchlist creation becomes the top-ranked action.

### Workflow Continuity

The model surfaces whether TradeVeto has:

- returning workflow memory
- saved workspace preferences
- tracked symbols
- trigger monitors

The QA user included saved workspace preferences, AMD/MU/NVDA watchlist context, and prior workflow snapshots to validate returning workflow behavior.

### Personalization

The panel exposes:

- workspace mode
- favorite modules
- focus cluster from watched/ranked symbols
- preferred timeframe habit

These are derived from saved preferences and scanner rows rather than inferred from fake usage.

## Production Evidence

Artifacts:

- Desktop authenticated screenshot: `docs/ops/artifacts/phase-20-6-prod/daily-driver-retention-auth-desktop.png`
- Mobile authenticated screenshot: `docs/ops/artifacts/phase-20-6-prod/daily-driver-retention-auth-mobile.png`
- CDP audit: `docs/ops/artifacts/phase-20-6-prod/daily-driver-retention-cdp-audit.json`

Production CDP proof after the final deploy:

| Check | Desktop | Mobile |
| --- | --- | --- |
| Daily driver panel exists | Pass | Pass |
| Title visible | Pass | Pass |
| Primary action tiles | 6 | 6 |
| Habit loop rows | 7 | 7 |
| Funnel health visible | Pass | Pass |
| Proof boundary visible | Pass | Pass |
| Watchlist loop visible | Pass | Pass |
| Scanner loop visible | Pass | Pass |
| Replay loop visible | Pass | Pass |
| Alert return loop visible | Pass | Pass |
| Legal/premium gate blocking QA | No | No |

The production QA used a disposable premium QA user:

- email: `phase20-6-qa-20260522@tradeveto.invalid`
- legal acceptances: latest terms/privacy/risk
- premium subscription: 7-day active QA entitlement
- watchlist: AMD, MU, NVDA
- workspace mode: watchlist-first
- workflow memory: terminal baseline from prior day

Cleanup completed and remaining QA user count returned to `0`.

## Validation

Local validation completed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`

Production validation completed:

- pushed `main`
- pulled latest `main` on `onsre-node-01`
- rebuilt `market-alpha-frontend`
- restarted frontend container
- confirmed container health: `healthy`
- `/api/health`: `200`
- `/api/health/deep`: `200`
- route smoke: `/terminal`, `/discover`, `/scanner`, `/strategy-labs`, `/alerts`, `/history`, `/performance`
- captured fresh authenticated desktop/mobile production screenshots
- captured CDP audit for daily-driver retention panel

Two production iterations were required:

1. First deploy exposed the panel but hid the alert return habit row from the audited view.
2. Second deploy exposed all 7 habit loops and passed CDP proof.

## Remaining Gaps

This sprint improves retention mechanics, but real daily-driver dominance is not proven.

Remaining blockers:

- 2+ day retention is still historically measured at 1.0% from the prior audit baseline.
- No new multi-day production cohort has elapsed after this release.
- 7-day retention cannot be certified during the same implementation session.
- Scanner reuse, replay reuse, strategy reuse, watchlist return, and alert-driven return need actual post-release event data.
- Notification usefulness and return behavior still need measured user cohorts, not only architecture.
- First useful action instrumentation exists, but the new panel needs real click-through and completion data.
- Habit loops are now visible, but repeat-session proof must be collected.

## Phase 20 Follow-Up

Next required work:

- Monitor 2-day and 7-day retention after deployment.
- Add an operator retention dashboard that compares pre/post Phase 20.6 cohorts.
- Track completion rates for each first useful action.
- Measure scanner preset save/reuse loops.
- Measure watchlist return rate by user cohort.
- Measure alert-created to return-session conversion.
- Measure whether daily-driver panel users have lower abandonment and higher workflow continuity than non-panel users.

## Verdict

The product now has a stronger daily-driver workflow layer and production-verified UI proof. It still does not have real-world retention proof. The sprint criteria that depend on real 2-day, 7-day, and repeat-session behavior remain unproven until production users generate post-release telemetry.

TRADEVETO REAL USER RETENTION + DAILY DRIVER DOMINANCE NOT ACCOMPLISHED
