# Phase 14.7 - Intelligence Feed + Notification OS

## Executive Summary

Phase 14.7 adds the daily habit loop for TradeVeto: a data-backed intelligence feed, a daily brief, and user-controlled high-signal notification preferences.

The implementation is trust-first:

- Feed items are generated only from existing scanner, watchlist, alert, workflow, shock, and market-state data.
- Notification delivery is high-signal by default and bounded by duplicate suppression, quiet hours, category controls, symbol scope, and a daily cap.
- Email and push are preference-ready, but the current production behavior materializes in-app notifications only until those channels are explicitly wired for delivery.

## What Changed

- Added persistent notification preferences in `user_notification_preferences`.
- Added persistent intelligence feed items in `user_intelligence_feed_items`.
- Added a `/api/intelligence/feed` endpoint for authenticated feed retrieval.
- Added a `/api/user/notification-preferences` endpoint for GET/PUT preference management.
- Added `IntelligenceFeedNotificationPanel` to the Terminal after the unified console.
- Added a reusable `useNotificationPreferences` hook with debounced saves after user edits only.
- Added domain logic and tests for daily brief generation, feed item generation, preference normalization, quiet hours, and symbol-scope gating.

## Feed Item Coverage

Supported feed item types:

- Market regime changed
- Watchlist score improved
- Risk pressure increased
- Shock risk detected
- Replay similarity found
- Opportunity entered attention queue
- Symbol moved to risk review
- Macro pressure changed
- Alert triggered

Each item includes:

- What changed
- Why it matters
- Data timestamp
- Related symbol when available
- Evidence label
- Monitor-next guidance
- Detail action link
- Notification eligibility flag

## Daily Brief

The Terminal now includes a daily brief summarizing:

- Current market state
- Top watch candidates
- Risk review names
- Shock watch names
- Watchlist changes
- What to monitor next

The copy remains research-only and avoids trading instructions.

## Notification Controls

Users can control:

- Categories: watchlist risk escalation, large score change, shock risk, macro regime shift, replay-relevant event, alert threshold
- Channels: in-app, email preference, future push preference
- Frequency: high signal only, daily digest, off
- Symbol scope: all symbols, watchlist/favorites, custom symbols
- Quiet hours
- Daily in-app notification cap
- Custom tracked symbols

## Duplicate Suppression + Rate Limiting

- Feed item persistence uses deterministic `source_key` values and a `(user_id, source_key)` unique constraint.
- In-app notification materialization skips already-notified feed items.
- Daily notification creation is capped by user preference.
- Preference writes are CSRF-protected, origin-checked, and rate limited.

## Real Data Mapping

Feed sources are:

- Terminal scanner snapshot
- Opportunity model rows
- Active alert matches
- User watchlist
- Workflow evolution memory
- Market regime label
- Current scan freshness timestamp

No random, seeded, or decorative feed items are generated.

## Validation

Local validation completed on the development workstation:

- `npm run lint` - passed
- `npm test -- --runInBand` - passed, 384 tests
- `npm run build` - passed
- `npm audit --omit=dev` - passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')` - passed
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors
- `git diff --check` - passed

Production validation will be appended after the pushed commit is pulled and rebuilt on the production host.

## Remaining Risks

- Email and push delivery are preference-ready but intentionally not auto-sent by this sprint.
- Feed quality depends on scanner freshness and workflow-memory coverage.
- Daily brief is high-signal but should be tuned with real beta-user behavior once the cohort uses it for several sessions.

## Final Status

INTELLIGENCE FEED NOTIFICATION OS COMPLETE
