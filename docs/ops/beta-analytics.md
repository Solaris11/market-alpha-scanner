# TradeVeto Beta Analytics

TradeVeto uses a lightweight first-party analytics ledger to learn from closed beta usage without adding ad-tech tracking or session replay.

## Event Sources

Events are written to `analytics_events` through `/api/analytics/events`. Beta feedback is written to `beta_feedback` through `/api/analytics/feedback`.

Tracked event groups:

- Navigation: `page_view`, `terminal_open`, `opportunities_open`, `performance_open`, `history_open`, `support_open`, `account_open`
- Symbol research: `symbol_open`, `chart_interaction`, `history_filter_used`, `detail_expand`, `readiness_expand`, `veto_explanation_open`
- Feature usage: `watchlist_add`, `watchlist_remove`, `alert_create`, `alert_delete`, `paper_trade_create`, `paper_trade_close`, `onboarding_complete`, `onboarding_skip`
- Scanner workflows: `scanner_run`, `analysis_run`, `calibration_open`, `signal_drilldown`
- Support AI: `support_prompt_click`, `support_message_submit`, `support_helpful_feedback`, `support_unhelpful_feedback`
- Feedback: `beta_feedback_submit`

## Privacy Boundaries

The analytics layer must not collect passwords, secrets, payment credentials, private portfolio/account data, raw support transcripts, raw IP addresses, or full user-agent strings.

Visitor/session identifiers are client-generated and stored as salted hashes server-side. Cloudflare geography is stored only at coarse country/region/city/timezone level when headers are available. User-agent data is reduced to browser family, OS family, and device class.

Metadata is allowlisted and sanitized. Secret-like keys and values are dropped before persistence.

## Admin Dashboard

The admin-only dashboard is available at `/admin/analytics`.

It reports:

- Visitor Insights: page views, unique visitors, signed-in users, anonymous visitors, repeat visitors, session duration, top pages, entry pages, exit pages
- Time trends: page views, visitors, sessions
- Geo/device/browser summaries
- Retention overview: DAU/WAU, repeat sessions, session depth, return frequency
- WAIT-first adoption: WAIT engagement, veto explanation opens, readiness/confidence expansion
- Feature engagement: watchlist, alerts, paper, history filters, chart interactions, calibration opens
- Support usage and beta feedback

## Operational Notes

- Analytics requests are rate limited and non-blocking on the client.
- Events batch in memory and flush with `sendBeacon` or `fetch(..., keepalive: true)`.
- The product must work if analytics ingestion is unavailable.
- Admin dashboards must remain admin-only; anonymous users must not receive analytics payloads.

## Current Gaps

- Some events are supported by policy but only partially wired where workflows are server-rendered or not yet user-triggered in closed beta.
- Visitor geography depends on Cloudflare headers and may be `unknown` in local or direct-origin tests.
- The dashboard supports preset ranges for `today`, `7d`, `30d`, and `90d`; custom analytics ranges can be added after beta traffic volume grows.
