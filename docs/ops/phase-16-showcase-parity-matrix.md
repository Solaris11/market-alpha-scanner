# Phase 16 Showcase Parity Matrix

Date: 2026-05-15

This matrix treats the TradeVeto showcase posters as production acceptance references. Production UI must use real stored TradeVeto data, validated chart packets, scanner rows, watchlist state, alert rules, and user workflow state. If data is unavailable, the product must show a premium limited-data state rather than drawing fake intelligence.

## Component Mapping

| Showcase module | Production location | Real data source | Interaction | Empty or limited state |
|---|---|---|---|---|
| Circular intelligence hub / system map | Terminal `What Matters Now` | `buildUnifiedIntelligenceConsole`, scanner rows, workflow evolution, watchlist deltas | Click node opens centered intelligence detail with factors, symbols, graph, monitor-next list | Node detail says limited evidence or no validated context |
| Category orbit nodes | Terminal intelligence orbit | Zone objects from current console model | Node opens same stable overlay on desktop and mobile | Hidden if zone is unavailable |
| Dangerous / Watch / Neutral / Favorable cards | Terminal attention matrix | Top risk queue, shock/watchlist changes, top opportunities, attention queue | Scannable status summary; detail via adjacent zone orbit | Count can be zero with explanatory copy |
| Attention score / driver bars | Terminal attention matrix | Console metrics: attention, opportunity, decision, risk, fragility | Factor strip exposes driver values and details | Score strip shows insufficient scored evidence |
| Market regime gauge | Market Chart Hub | Validated cross-asset chart move summary | Read-only summary, charts clickable below | Gauge shows N/A if proxy data is not validated |
| Macro pressure drivers | Market Chart Hub | SPY/QQQ/DIA/BTC/GLD/USO/UUP/TLT chart packets | Driver rows summarize one-month validated move | Limited label when chart has fewer than two points |
| Cross-asset chart cards | Market Chart Hub | Stored validated price history | Click chart opens full detail with timeframe controls, source, updated timestamp | Interactive chart limited-data frame |
| Daily opportunity radar cards | Opportunities | Highest-scored `OpportunityViewModel` rows | Card opens symbol detail; symbol logo opens same detail | Waiting-for-validated-setups panel |
| Opportunity factor score grid | Opportunities radar and cards | Score, conviction, fragility, evidence, macro adjustment | Factor strip tooltips and card click-through | Insufficient scored evidence state |
| Price / entry / stop / target chips | Opportunities and opportunity cards | `price`, `suggested_entry`, `stop_loss`, `target`, data freshness | Compact scan context on card | Price context unavailable copy |
| Watchlist overview with logos | Existing watchlist and terminal widgets | Local/server watchlist and watchlist change summaries | Symbols link to symbol detail | Empty watchlist guidance |
| What changed panel | Terminal zones and briefing cards | Workflow evolution, biggest changes, watchlist changes | Click through to history/full detail | No material change state |
| Risk review dashboard | Terminal risk zones and opportunity cards | Top risk queue, fragility, event risk, risk pressure | Detail overlay and symbol links | No dominant risk item state |
| Market memory analog cards | Market Memory / symbol detail existing modules | Stored market memory and historical context | Existing details; future expansion should reuse stable overlays | Limited-memory state when analogs are not validated |
| Why Wait / risk-first cards | Daily Action, Terminal, Symbol Detail existing WAIT/RISK REVIEW UI | Daily action, market regime, scan safety, setup factors | Existing detail cards and symbol drilldowns | Research-only wait state |
| Strategy Labs simulation cards | Strategy Labs existing workspace | Strategy intelligence, forward-return evidence, simulations | Existing panels; future parity needs deeper chart treatment | Simulation evidence limited state |
| Copilot grounding panels | Copilot and Terminal copilot panel | Deterministic TradeVeto packets and allowed context | User asks grounded questions | Grounding boundary and no-answer state |
| QR / beta CTA modules | Landing and marketing assets | Production QR assets and `/register` route | Link/scan to invite-only register | No fake QR assets |

## Implementation Ownership

- `frontend/src/components/visual/InteractiveVisualIntelligence.tsx`: shared clickable showcase orbit and stable detail behavior.
- `frontend/src/components/terminal/UnifiedIntelligenceConsole.tsx`: Terminal attention matrix and intelligence orbit.
- `frontend/src/components/terminal/MarketChartHub.tsx`: macro environment overview and validated chart cards.
- `frontend/src/components/opportunities/OpportunitiesWorkspace.tsx`: opportunity radar showcase cards.
- `frontend/src/app/settings/page.tsx`: user-facing settings route parity via account redirect.

## Trust Rules

- No seeded sparklines or random patterns.
- No synthetic market action.
- No inferred live prices.
- No fake historical analogs.
- No hidden advisory language.
- Missing data must be called out as limited, unavailable, or waiting for more scans.

## Remaining Matrix Gaps

- Market Memory needs a dedicated showcase-grade page if stored analog coverage is rich enough.
- Strategy Labs still needs deeper simulation playback parity.
- Performance, History, and Paper Trading are improved from earlier phases but still need full poster-grade hero modules and chart-storytelling density.
- Physical-device mobile QA is still required beyond browser emulation.
