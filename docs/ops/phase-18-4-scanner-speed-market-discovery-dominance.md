# Phase 18.4 - Scanner Speed + Market Discovery Dominance

## Objective

Phase 18.4 targeted the remaining Finviz / Trade Ideas scanner usability gap:

- faster market exploration
- denser scanner layouts
- rapid compare mode
- one-click scan workflows
- saved scanner presets
- advanced filtering
- top movers
- crash-risk candidates
- expansion candidates
- money-flow discovery
- replay-supported discovery
- macro-supported discovery

The goal was to preserve TradeVeto's cinematic intelligence feel while making discovery materially faster and more scanner-native.

## Implementation Summary

### Money-Flow Discovery Model

Updated:

- `frontend/src/lib/trading/intelligence-discovery.ts`

Added a money-flow ranking path that combines:

- short-term performance pulse
- macro alignment
- trend context
- confidence / conviction
- volume context when available
- sector availability

New scanner affordances:

- `money_flow` quick filter
- `money_flow` sort
- Money-flow scanner preset
- Money-flow compare preset
- Money-flow orbit node
- Money-flow discovery story

This gives the scanner a direct route for "where is leadership/attention moving?" without relying only on generic performance sorting.

### Advanced Filtering

The discovery filter state now supports:

- asset type
- market cap band
- risk band
- evidence maturity band
- watchlist-only mode

The scanner can now constrain the universe more like an institutional scanner:

- Mega cap / Large cap / Mid cap / Small cap / Unknown
- Low / Elevated / High risk
- Strong / Developing / Limited evidence
- Equity or other available asset types
- Watchlist-only scan

### One-Click Market Exploration

Updated:

- `frontend/src/components/discovery/IntelligenceDiscoveryWorkspace.tsx`

Added a dedicated speed deck near the top of the discovery workspace:

- Top movers
- Downside movers
- Expansion candidates
- Crash risk
- Money flow
- Macro support

Each lane shows a leader, count, and top symbols, then loads the matching scanner preset in one click.

### Dense Speed Table

The results section now defaults to a compact scanner table instead of only a card grid.

The speed table shows:

- rank
- symbol
- company / context
- selected timeframe performance
- confidence
- risk
- macro
- replay
- compare action
- open detail action

Users can still switch back to the richer cinematic card grid when they want deeper visual scanning.

### Rapid Compare Mode

Compare mode remains available from every row/card. This phase improves the path by making compare actions visible inside the dense table and adding money-flow compare presets.

### Overlay Prefetch

Updated:

- `frontend/src/components/discovery/GlobalIntelligenceDiscovery.tsx`

The global discovery overlay now warms the discovery universe shortly after mount instead of waiting for the first open. Opening search/discovery should feel faster for premium users because the scanner universe is often already loaded.

The fetch remains `no-store` and entitlement-aware. If the user does not have premium access, the system still returns the limited discovery state honestly.

## Regression Coverage

Updated:

- `frontend/src/lib/trading/intelligence-discovery.test.ts`

Coverage added for:

- money-flow quick filter counts
- money-flow scanner preset counts
- advanced filters by asset type, market cap, evidence, risk, and watchlist state
- deterministic scanner ordering with new filter fields

## Validation

Local validation completed:

- `npm --prefix frontend run lint`: passed
- `npm --prefix frontend test -- --runInBand --test-name-pattern "intelligence discovery system"`: passed, full runner executed 427 tests
- `npm --prefix frontend run build`: passed
- `npm --prefix frontend audit --omit=dev`: passed, 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed, 0 errors
- `git diff --check`: passed after this report was added

## Remaining Scanner Debt

This phase materially improves scanner speed and discovery ergonomics, but it does not honestly prove Finviz / Trade Ideas dominance yet.

Remaining gaps:

- User-defined saved scanner presets are not persisted yet; current presets are product-defined.
- No backend query/index optimization was added for very large universes; current improvements are primarily model and UI level.
- No true server-side pagination or virtualization has been added beyond limiting visible rows for fast rendering.
- No authenticated production QA has yet proven premium `/discover` against a large real premium scanner universe in this phase.
- Compare mode is still a side panel, not a full interactive matrix with bulk sector/group comparison.
- Scanner alerts are not yet creatable directly from an arbitrary filter state.
- No performance timing budget was captured for authenticated discovery open-to-first-action.

## Verdict

TradeVeto discovery is faster, denser, and more scanner-native after this phase. The product now has one-click market exploration, a compact speed table, advanced filters, money-flow discovery, and a warmer global discovery overlay.

However, scanner dominance over Finviz and Trade Ideas requires persistent custom presets, authenticated production speed proof, deeper compare workflows, and backend-scale scanner optimization. The correct status is:

TRADEVETO SCANNER DOMINANCE NOT ACCOMPLISHED
