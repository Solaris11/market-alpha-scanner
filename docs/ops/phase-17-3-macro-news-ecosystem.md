# Phase 17.3 - Macro + News Ecosystem

## Scope

Phase 17.3 restores macro/news awareness as a first-class intelligence system instead of a buried support feed. The implementation extends the existing Daily Market Command Center, Global Market Command surface, and Symbol Research cockpit with source-linked market developments, explicit impact interpretation, and richer event-calendar context.

## Implemented Systems

- Macro news feed: `MarketNewsItem` now carries source, timestamp, affected assets, affected sectors, why-it-matters copy, bullish implication, bearish implication, related macro context, related replay/memory context, event tracking label, and market-moving label.
- Geopolitical/rates/inflation/feed categories: Terminal daily developments now classify `Macro`, `Rates`, `Geopolitical`, `Energy`, `Crypto`, `Earnings`, and `Analyst` items.
- Analyst actions: direct source-linked row news can classify analyst upgrades, downgrades, price targets, and rating actions.
- Symbol-specific news: `buildSymbolResearchModel` continues to filter source-linked news to the active symbol, and the symbol overlay now shows implications plus macro/replay context.
- Watchlist impact engine: Terminal developments prioritize watchlist symbols first, then top opportunity/risk symbols, and explain why the item is being shown.
- Source-linked article policy: direct row news uses `verifiedNewsItemFromRow`; event packets require reputable source names and valid source URLs through `isVerifiedNewsSource`.
- Daily developments center: Terminal now includes a compact macro/news ecosystem summary near the top of the Daily Market Command Center.
- Market-moving event tracking: every displayed development includes event tracking and market-moving labels derived from the event type and relevance.

## Data Sources Used

- `verified_event_recent_events`
- `news_headline`, `news_source`, `news_url`, `news_timestamp`, `news_score`
- symbol, sector, macro alignment, event risk, event summaries, replay/memory summary fields
- earnings, dividend, analyst action, macro event, Fed/CPI/PPI/jobs/GDP date fields where present

No fabricated headlines are generated. If source-linked news is absent, Terminal keeps the existing premium limited-data state: `News source not configured yet`.

## User-Facing Changes

- Terminal daily developments now expose:
  - source and timestamp
  - affected symbols and sectors
  - urgency and impact
  - bullish and bearish implications
  - macro context
  - replay/memory context
  - watchlist impact reason
  - original source link
- Global Market Command macro/news overlays now show the same source-linked interpretation fields.
- Symbol Deep Research news overlays now show the same company-level context fields.
- The next-seven-days calendar now supports analyst and macro/rates/geopolitical event date fields in addition to earnings and dividends.

## Validation

Local validation started with the frontend unit suite:

- `npm --prefix frontend test -- market-research daily-market-command --runInBand` passed 415 tests.

Full validation and production deployment are recorded in the final response for this phase.

## Remaining Gaps

- Live provider depth still depends on production data feeds exposing source-linked fields.
- Geopolitical and macro event calendars are limited unless upstream scanner packets include explicit event dates.
- The current interpretation layer is deterministic and conservative; broader multi-source article clustering would require a dedicated ingestion service.

## Verdict

TRADEVETO MACRO + NEWS ECOSYSTEM ACCOMPLISHED
