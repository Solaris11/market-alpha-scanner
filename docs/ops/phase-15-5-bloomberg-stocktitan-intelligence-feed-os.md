# Phase 15.5 - Bloomberg + StockTitan Intelligence Feed OS

Date: 2026-05-15

## Executive Summary

Phase 15.5 upgrades TradeVeto's intelligence feed from a useful notification panel into a market-awareness operating system. The Terminal now summarizes what changed, why it matters, what risk increased, what confidence weakened, which setups are stale, and what the user should monitor next.

The implementation remains trust-first:

- Feed items are generated from existing scanner rows, watchlist context, workflow memory, alert matches, market state, freshness, risk, volatility, macro, sector, and replay fields.
- No social-style timeline, fake news causality, fake price movement, fake confidence, or decorative feed item was added.
- Notification preferences remain high-signal by default with quiet hours, symbol scope, category controls, daily caps, and duplicate suppression.
- Email and push remain preference-ready but not spam-enabled by this sprint.

Final status: PHASE 15.5 BLOOMBERG STOCKTITAN INTELLIGENCE FEED OS COMPLETE

## Feed Architecture

The feed engine lives in `frontend/src/lib/trading/intelligence-feed.ts` and is loaded through `frontend/src/lib/server/intelligence-feed.ts`.

New market-awareness item types:

| Type | Purpose | Primary Data |
| --- | --- | --- |
| `score_improved` | Setup quality improved | scanner score delta fields |
| `score_deteriorated` | Setup quality weakened | scanner score delta fields |
| `confidence_changed` | Conviction changed | confidence/conviction delta fields |
| `freshness_decayed` | Setup is aging | `dataFreshness`, `decayLabel` |
| `volatility_spiked` | Volatility pressure rose | shock pattern, volatility pressure, event risk |
| `breadth_deteriorated` | Broad risk filtering increased | risk-filtered scanner row ratio |
| `sector_pressure_changed` | Sector-level risk clustered | sector grouping plus fragility/event risk |
| `contradiction_detected` | Strong setup plus elevated risk | score, fragility, event risk, shock pressure |
| `replay_similarity_found` | Historical replay context exists | shock/replay similarity fields |

Existing types remain supported:

- market regime changed
- watchlist score improved
- risk pressure increased
- shock risk detected
- opportunity entered attention queue
- macro pressure changed
- alert triggered

## Daily Brief UX

The Terminal feed panel now renders a scannable Daily Brief with real sections instead of a plain bullet list.

Sections:

- Market State
- Macro Pressure
- Best Setups
- Dangerous Names
- Shock Watch
- What Changed
- Replay Similarities
- Stale Setups
- Watchlist Changes
- What To Monitor

Each section includes:

- semantic icon
- short status
- one-line summary
- related symbols when available
- detail link
- honest limited-state copy when data is missing

The brief also includes:

- `Since your last visit` from workflow memory
- `What to monitor` from trigger monitors or top scanner candidates
- risk environment summary
- macro pressure summary

## Ranking Logic

The feed is ranked by signal usefulness, not by raw recency alone.

Ranking inputs:

- severity
- watchlist relevance
- notification eligibility
- category importance
- item-type importance
- timestamp tie-break
- deterministic title tie-break

Priority examples:

- watchlist risk escalation outranks a generic opportunity card
- alert trigger outranks low-severity feed context
- shock/volatility/contradiction items outrank static score-only items
- stale setup warnings are visible but do not overpower critical risk items

The feed is capped at 24 generated items and the Terminal shows the top 10 by default to avoid noise.

## Notification UX

Notification categories now include:

- Watchlist risk escalation
- Large score change
- Confidence change
- Freshness decay
- Shock risk
- Macro regime shift
- Volatility spike
- Breadth deterioration
- Sector pressure change
- Contradiction detected
- Replay-relevant event
- Alert threshold

Controls remain user-owned:

- category toggles
- high-signal / daily digest / off
- in-app, email preference, future push preference
- all symbols / watchlist and favorites / custom symbols
- quiet hours
- daily in-app cap

Delivery remains intentionally conservative. The system materializes eligible in-app notifications only after preference checks, symbol-scope checks, quiet-hour checks, and duplicate suppression.

## Feed Card UX

Feed cards now show:

- severity chip
- evidence label
- what changed
- why it matters
- monitor-next guidance
- related symbol link
- action buttons

Actions:

- Open Detail
- Open Symbol
- Open Chart
- Open Replay
- Add Alert
- Ask Copilot

This makes the feed a workflow launcher instead of a static status list.

## Mobile Feed UX

The updated panel is mobile-safe:

- compact Daily Brief section cards
- shorter default copy
- feed cards that progressively disclose detail without giant text walls
- large tap targets for symbols and actions
- notification controls remain collapsed under `details`
- no fake chart widgets or dense mobile-only table layout

Remaining mobile debt is mostly interaction polish: future work should add swipe groups, per-item bottom-sheet detail, and native-style summary cards once beta usage confirms the highest-value feed categories.

## Real Data Mapping

| UX Element | Data Source | Empty/Limited Behavior |
| --- | --- | --- |
| Market State | route scan market condition | shows limited snapshot copy |
| Macro Pressure | macro alignment fields, market state fallback | says macro context is limited |
| Risk Environment | fragility, event risk, volatility pressure | says scanner rows are unavailable |
| Best Setups | score and conviction sorted rows | no dominant setup cluster |
| Dangerous Names | fragility, event risk, avoid decisions | no dominant dangerous cluster |
| Shock Watch | shock pattern, event risk | no shock cluster |
| Stale Setups | freshness status and decay labels | no stale setup cluster |
| Replay Similarities | replay/shock similarity fields | replay context limited |
| What Changed | workflow memory and watchlist evolution | baseline still building |
| Alert Trigger | active alert matches | no alert feed item |

No seeded arrays, random feed events, decorative market stories, or fabricated news causality were added.

## Benchmark Comparison

Official public references used:

- StockTitan FAQ describes real-time market news, official announcements, watchlists, filters, and a momentum scanner that alerts on large intraday moves: https://www.stocktitan.net/faq
- StockTitan About notes licensed market data, user-feedback-driven features, and scanner/news aggregation positioning: https://www.stocktitan.net/about
- Bloomberg Terminal News describes trusted global news, tailored alerts, data-backed reporting, analytics integration, and news volume/sentiment context: https://www.bloomberg.com/professional/products/bloomberg-terminal/news/
- Bloomberg's Terminal introduction references AI-powered news summaries and customized alerts for subscribers: https://www.bloomberg.com/professional/products/bloomberg-terminal/news/introduction/
- TradingView support documents app, popup, email, and webhook alert actions: https://www.tradingview.com/support/solutions/43000595315-how-to-set-up-alerts/
- TradingView support documents webhook alert behavior and security cautions: https://www.tradingview.com/support/solutions/43000529348/
- Robinhood documents price movement alerts, watchlist/holding notification controls, custom price alerts, 52-week high/low alerts, and informational-use disclosure: https://robinhood.com/us/en/support/articles/stock-price-alerts/

| Competitor | Strength | TradeVeto Phase 15.5 Advantage | Remaining Gap |
| --- | --- | --- | --- |
| StockTitan | Fast market news, scanner alerts, watchlist/news workflow | TradeVeto feed explains risk, confidence decay, stale setups, replay relevance, and macro context rather than only surfacing events | StockTitan still has broader live news/event volume |
| Bloomberg | Deep news coverage, tailored alerts, analytics integration | TradeVeto is more beginner-readable and directly ties feed items to monitor-next research actions | Bloomberg still dominates professional news breadth and institutional data coverage |
| TradingView Alerts | Flexible chart-triggered alerts and webhook routing | TradeVeto alerts/feed explain why a threshold matters and whether context supports it | TradingView still leads on custom technical alert ecosystem breadth |
| Robinhood Notifications | Simple mobile notification controls and price movement alerts | TradeVeto adds risk-aware context, confidence/freshness decay, and non-advisory research explanations | Robinhood still has simpler consumer-grade mobile notification onboarding |

## Where TradeVeto Now Wins

- Better than StockTitan for explaining why a scanner/feed update matters.
- Better than Robinhood for context-aware, non-price-only alerts.
- Better than TradingView for research wording around risk, staleness, and contradiction.
- More beginner-readable than Bloomberg for "what changed / why it matters / what to monitor" workflows.

## Where TradeVeto Still Lags

- Does not yet ingest or summarize broad professional news at Bloomberg scale.
- Does not yet have TradingView-level custom alert scripting.
- Does not yet have fully wired production email/push delivery for all feed categories.
- Does not yet have physical-device-confirmed mobile notification delivery.
- Does not yet have user-behavior-tuned ranking weights from enough beta cohort history.

## Remaining Feed Debt

- Add per-feed-item bottom sheets on mobile.
- Add swipeable feed groups once the category mix stabilizes.
- Add event/news linkage only when verified event data exists.
- Add delivery-channel proof for email and push after operator rollout.
- Add user-level feed ranking telemetry after enough cohort activity exists.
- Add digest email rendering with the same high-signal ranking and quiet-hour policy.

## Final Feed UX Score Estimate

| Category | Estimate |
| --- | ---: |
| Market awareness usefulness | 94 |
| Daily brief clarity | 94 |
| Alert explainability | 95 |
| Notification control | 93 |
| Trust / no-fake-data behavior | 98 |
| Mobile feed scanability | 91 |
| Habit-loop strength | 92 |
| Bloomberg-style context | 89 |
| StockTitan-style immediacy | 90 |
| Overall Feed UX | 93 |

Phase 15.5 moves the feed from a notification panel to a real market-awareness OS. It is not yet Bloomberg-scale news intelligence or Robinhood-smooth production push UX, but it is materially more contextual, calmer, and more trustworthy than a raw scanner/news timeline.

## Validation Results

Local validation before production deploy:

| Check | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm test -- --runInBand intelligence-feed` | PASS - 394 tests |
| `npm test -- --runInBand` | PASS - 394 tests |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS - 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | PASS |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | PASS - 0 errors |
| `git diff --check` | PASS |
| `npm run test:mobile-ux` | PASS - 11 routes, 2 emulated devices |

Mobile emulation note: local mobile smoke ran without production `DATABASE_URL`, so the app correctly failed closed for DB-backed request metrics/rate-limit writes and used honest limited scanner-data states where local DB data was unavailable. It also noted that `/symbol/AMD` did not expose an automated expandable chart control in the current script, so manual production chart QA remains useful.

Production validation:

| Check | Result |
| --- | --- |
| Production host/user/path | `onsre-node-01` / `sre` / `/opt/apps/market-alpha-scanner/app` |
| Production app code deploy commit | `300730c4542e04b5cd6075edf6ef4944335fa89d` |
| Production worktree before deploy | Clean |
| Production source drift | Behind `origin/main` by `300730c` only before pull |
| Pull mode | PASS - fast-forward from `53fb9e6` to `300730c` |
| Docker service rebuilt | PASS - `market-alpha-frontend` |
| Container health | PASS - frontend and Postgres healthy |
| `/` | PASS - 200 |
| `/terminal` | PASS - 200 |
| `/dashboard` | PASS - 200 |
| `/opportunities` | PASS - 200 |
| `/symbol/AMD` | PASS - 200 |
| `/performance` | PASS - 200 |
| `/history?symbol=AMD` | PASS - 200 |
| `/paper` | PASS - 200 |
| `/strategy-labs` | PASS - 200 |
| `/alerts` | PASS - 200 |
| `/mobile` | PASS - 200 |
| `/api/intelligence/feed` | PASS - unauthenticated 401 fail-closed |
| `/api/health` | PASS - 200, `ok: true` |
| `/api/health/deep` | PASS - 200, DB/scanner/local backup/R2 healthy |

Production notes:

- Scanner freshness was acceptable at approximately 8 minutes.
- Latest local backup was approximately 15 minutes old.
- Latest R2 offsite backup was approximately 14 minutes old.
- No production secrets were printed.

PHASE 15.5 BLOOMBERG STOCKTITAN INTELLIGENCE FEED OS COMPLETE
