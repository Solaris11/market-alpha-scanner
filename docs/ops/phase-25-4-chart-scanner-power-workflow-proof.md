# Phase 25.4 - Chart + Scanner Power Workflow Proof

## Scope

Phase 25.4 targets hard operational proof for chart and scanner workflows without claiming unsupported TradingView parity.

## Implemented Runtime Changes

- Added bounded virtual-window rendering to the ultra/dense scanner table so 500+ symbol result sets do not render every row at once.
- Exposed scanner table proof attributes:
  - `data-scanner-virtualized`
  - `data-scanner-total-rows`
  - `data-scanner-rendered-rows`
- Added deterministic chart/scanner power workflow proof utilities covering:
  - 500+ symbol synthetic scanner universe
  - 500-symbol watchlist filtering
  - scanner filtering and sorting
  - rapid compare matrix creation
  - chart toolbar state mutation
  - fullscreen chart state mutation
  - multi-symbol chart workspace restore
  - rapid symbol switching with bounded workspace persistence
- Added production container probe:
  - `npm --prefix frontend run probe:phase25:chart-scanner-power`

## Targets

| Workflow | Target |
| --- | ---: |
| Scanner interaction | p95 < 100 ms |
| Chart interaction | p95 < 60 ms |
| Compare open | p95 < 150 ms |
| Fullscreen chart open | p95 < 150 ms |
| Large-watchlist filter | p95 < 150 ms |
| Workspace restore | p95 < 250 ms |

## Local Validation

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend test -- --runInBand` - passed, 509 tests.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors and 0 warnings.
- `node --check frontend/scripts/phase25-chart-scanner-power-workflow-probe.mjs` - passed.
- `npm --prefix frontend run probe:phase25:chart-scanner-power` - passed locally with `overallStatus=ready`.
- `git diff --check` - passed.

## Production Deployment

Pending deployment.

## Production Smoke

Pending smoke.

## Production Power Workflow Probe

Expected artifact:

- `docs/ops/artifacts/phase-25-4/chart-scanner-power-workflow-production.json`

Pending production probe.

## Certification Notes

This phase proves bounded scanner rendering and deterministic production-container workflow timings. It does not prove full browser DOM frame timing, physical-device gesture latency, or TradingView parity.

## Remaining Blockers

- Browser/DOM interaction latency proof still requires Playwright or manual production timing evidence.
- Physical-device chart gesture proof is outside this phase.
