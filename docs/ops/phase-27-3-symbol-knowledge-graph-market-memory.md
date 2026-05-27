# Phase 27.3 - Symbol Knowledge Graph + Market Memory

## Verdict

Status: Strong partial accomplished.

TradeVeto now has a reusable, evidence-bounded symbol knowledge graph layer. It connects symbol detail and Market Memory to source-backed memory traits, relationship links, historical analogs, event memory, and an interactive timeline without fabricating relationships or event history.

## Implementation Summary

- Added deterministic model: `frontend/src/lib/trading/symbol-knowledge-graph.ts`.
- Added unit tests: `frontend/src/lib/trading/symbol-knowledge-graph.test.ts`.
- Added reusable UI panel: `frontend/src/components/symbol/SymbolKnowledgeGraphPanel.tsx`.
- Wired the panel into premium symbol detail through `SymbolTerminalWorkspace`.
- Wired graph samples into `/market-memory` using the sampled Market Memory rows.

## Implemented Capabilities

- Symbol memory traits:
  - prior setups
  - prior failures
  - breakout behavior
  - macro conditions
  - earnings reactions
  - volatility personality
  - liquidity behavior
  - trend personality
- Relationship engine:
  - sector leaders from same-sector scanner rows
  - same-sector co-movement candidates, explicitly not statistical correlation
  - sympathy plays from shared setup/decision context
  - macro-linked symbols from macro/event regime signatures
  - event-linked symbols from verified event signatures
  - inverse links only when explicit inverse/hedge fields exist
- Historical analog memory:
  - similarity score
  - success/failure rate from attached forward outcomes only
  - replay link
  - macro/regime similarity disclosure
- Event memory:
  - FOMC/rates
  - CPI/inflation
  - earnings
  - geopolitical
  - crypto
  - macro event memory
- Interactive timeline:
  - scanner signal history
  - replay/analog events
  - macro markers
  - verified event markers
  - volatility markers
  - alert category remains empty unless source-backed alert memory exists

## No-Fabrication Boundaries

- Correlation labels are co-movement candidates from shared sector/setup/macro/event evidence unless explicit price-correlation evidence exists.
- Historical analog rates use only source-backed forward outcome rows.
- Event memory appears only from scanner rows or market-memory analog event signatures.
- Inverse relationships remain hidden unless an explicit hedge or inverse symbol is present.
- Missing event domains are shown as limited instead of simulated.

## Validation

Completed locally:

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend run test -- symbol-knowledge-graph.test.ts` - passed.
- `npm --prefix frontend test -- --runInBand` - passed.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors.
- `git diff --check` - passed.

Production:

- Pending at the time of this artifact update. Runtime deploy and smoke are required before broader platform certification.

## Remaining Blockers

- True statistical correlation needs multi-symbol price-series correlation proof, not just scanner co-occurrence.
- Alert timeline memory is limited until alert trigger history is attached to the symbol memory packet.
- Event memory breadth depends on verified event signatures and provider coverage already present in scanner rows.
- Production screenshot proof was not captured in this phase.
