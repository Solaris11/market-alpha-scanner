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

- Production host pulled `origin/main` from `f81991b` to `708b66e`.
- Rebuilt and redeployed `market-alpha-frontend` with `docker compose --env-file .env up -d --build market-alpha-frontend`.
- Container health reached `healthy`.

## Production Smoke

All production smoke checks returned HTTP 200:

- `https://tradeveto.com/api/health`
- `https://tradeveto.com/api/health/deep`
- `https://tradeveto.com/discover`
- `https://tradeveto.com/scanner`
- `https://tradeveto.com/symbol/AMD`
- `https://tradeveto.com/terminal`
- `https://tradeveto.com/market-memory`

## Production Power Workflow Probe

Artifact:

- `docs/ops/artifacts/phase-25-4/chart-scanner-power-workflow-production.json`

Production probe status: `ready`.

| Workflow | p95 | p99 | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| Scanner interaction | 0.389 ms | 2.174 ms | 100 ms | Pass |
| Large-watchlist filter | 0.186 ms | 0.232 ms | 150 ms | Pass |
| Compare open | 0.021 ms | 0.153 ms | 150 ms | Pass |
| Chart interaction | 0.010 ms | 0.088 ms | 60 ms | Pass |
| Fullscreen chart open | 0.003 ms | 0.017 ms | 150 ms | Pass |
| Chart workspace restore | 0.049 ms | 0.154 ms | 250 ms | Pass |
| Rapid symbol switch | 0.163 ms | 4.700 ms | 100 ms | Pass |

Large-universe proof:

- Synthetic scanner universe: 520 symbols.
- Large watchlist: 500 symbols.
- Scanner virtual window: 74 rendered rows out of 520 total rows.
- Probe memory delta: 14.117 MB RSS.
- Blockers reported by probe: none.

## Certification Notes

This phase proves bounded scanner rendering and deterministic production-container workflow timings. It does not prove full browser DOM frame timing, physical-device gesture latency, or TradingView parity.

## Remaining Blockers

- Browser/DOM interaction latency proof still requires Playwright or manual production timing evidence.
- Physical-device chart gesture proof is outside this phase.
