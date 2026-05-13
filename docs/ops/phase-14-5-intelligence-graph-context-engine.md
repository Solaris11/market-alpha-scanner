# Phase 14.5 - Intelligence Graph + Context Relationships

## Summary

Phase 14.5 adds a data-backed intelligence graph layer that connects symbol and market-zone context instead of leaving intelligence as separate static cards.

The graph is intentionally lightweight: relationship cards plus a visual influence map. It does not use random, seeded, or decorative relationships.

## Data Sources

Visible relationships are derived from:

- Current scanner rows and sector labels
- Visible ETF/proxy rows when present in the scanner snapshot
- Macro exchange context
- Macro proxy coverage
- Verified event context fields
- Shock move pattern output
- Market memory analogs
- Unified console scored factors
- Unified console related symbols

Unavailable relationships are displayed honestly instead of being faked.

## Symbol Detail Graph

Added a symbol-level graph to the premium symbol workspace.

The graph can show:

- Sector pressure
- Related market or ETF proxies
- Macro regime influence
- Risk appetite
- Volatility and liquidity pressure
- Verified event pressure
- Shock/chase risk
- Replay and market memory analogs

Clickable symbol relationships link to `/symbol/[symbol]`.

## Market Zone Graph

Added relationship graphs inside clickable terminal intelligence-zone drawers.

The graph uses the zone's real scored factors and related symbols:

- Market State
- Best Setups
- Shock Watch
- Dangerous Now
- Watchlist Intelligence
- What Changed
- Risk Review
- Volatility Pressure
- Macro Pressure
- Replay Context

## Trust Rules

The implementation follows these rules:

- No fake relationships
- No random or seeded graph shapes implying data
- No proxy relationship unless the proxy row exists in current data
- No replay relationship unless market memory has a validated analog
- No shock relationship unless a shock pattern exists
- Missing relationships are listed as limited/unavailable

## UX Behavior

- Relationship cards include label, target, status, score when available, evidence, and data source.
- Visual graph nodes are clickable when they represent symbols.
- The graph can render compactly inside detail drawers and fully in symbol detail.
- Mobile uses the same centered detail modal/bottom-sheet flow already used by interactive zones.

## Validation

Added unit coverage for:

- Sector, macro, proxy, event, and replay relationship generation
- Missing proxy rows not creating fake relationships
- Zone graph generation from scored factors and related symbols only

## Remaining Debt

- Full market-level cross-asset graph can become richer when validated OHLC/correlation tables are consistently available for SPY, QQQ, DIA, BTC, GLD, USO, UUP, and TLT.
- Sector ETF coverage depends on whether proxy rows are present in the current scanner snapshot.
- Relationship strength is deliberately conservative when a relationship is valid but not directly scored.

Final status: INTELLIGENCE GRAPH CONTEXT ENGINE COMPLETE
