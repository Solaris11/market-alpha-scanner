# Phase 17.1 - Data Depth Completion System

Final status: TRADEVETO DATA DEPTH COMPLETION ACCOMPLISHED

## Objective

Phase 17.1 targeted the remaining world-class blocker after the cinematic UX phases: production evidence depth. The issue was not that production lacked data. The issue was that several surfaces were reading only the latest scan run, which often has no completed forward-return outcomes yet.

This pass reconnects Performance, Strategy Labs, and Paper to historical completed evidence while preserving limited-evidence language where user-specific paper history is genuinely sparse.

## Production Evidence Baseline

Production database snapshot after deployment:

| Evidence store | Count |
| --- | ---: |
| `scan_runs` | 2,810 |
| `scanner_signals` | 310,819 |
| `market_memory_snapshots` | 310,819 |
| `forward_returns` | 99,678 |
| completed `forward_returns` | 85,876 |
| `performance_summary` | 4,577 |
| `paper_accounts` | 2 |
| `paper_positions` | 3 |

Historical scan coverage:

- Earliest successful run: `2026-04-24 07:53:58+00`
- Latest successful run: `2026-05-20 17:09:38.975326+00`
- Unique scan days: `27`

Latest performance-summary evidence batch:

- `scan_run_id`: `8799317e-c922-4788-930a-59fc3d4af755`
- Summary rows: `369`
- Latest batch timestamp: `2026-05-20 00:12:12.65558+00`

## Implemented Changes

### Historical Forward-Return Consumption

Updated [scanner-data.ts](/Users/hdtv/dev/market-alpha-scanner/frontend/src/lib/scanner-data.ts) so `getDbPerformanceData()` no longer limits Performance and Strategy Labs to the latest scan run.

The new behavior:

- Reads the latest available `performance_summary` batch by `created_at`.
- Reads completed `forward_returns` across historical production evidence.
- Preserves the true completed-observation count even when only a tail slice is loaded for rendering.
- Builds CSV-compatible rows from structured Postgres metrics plus core columns such as symbol, horizon, signal date, and return.

This directly fixes the shallow-data failure where latest scans had no completed outcomes yet, despite production having 85,876 completed observations.

### Calibration Insights Fallback

Added a DB-derived calibration fallback when `scanner_output/analysis/calibration_insights.json` is unavailable.

The fallback:

- Finds strongest and weakest completed-evidence groups from `performance_summary`.
- Labels low-sample cohorts explicitly.
- Produces `best_group`, `worst_group`, warning, and evidence-source fields for the Performance UI.
- Keeps the source traceable as `postgres:performance_summary`.

### Paper Evidence Bridge

Updated [paper/page.tsx](/Users/hdtv/dev/market-alpha-scanner/frontend/src/app/paper/page.tsx) with a separate completed-evidence portfolio bridge.

This section is intentionally labeled as research simulation, not as the user's own paper account:

- "Completed Evidence Portfolio"
- 85,876 completed samples
- 220 balanced-mode simulated closed trades
- simulated equity curve
- max drawdown, volatility, cash, quality
- recent evidence trades with outcome lessons

This avoids fake paper account data while preventing the Paper page from feeling empty when the QA/user account has little personal trade history.

## Page Impact

| Page | Before | After |
| --- | --- | --- |
| Performance | Could show shallow or unavailable outcome evidence when latest scan had no completed returns. | Shows 369 summary rows, 85,876 signal rows, saved-run depth, strongest/weakest evidence groups, and populated evidence clusters. |
| Strategy Labs | Could appear empty or low-evidence if latest scan did not have completed returns. | Builds model portfolios from completed historical forward returns; production shows closed simulated trade evidence and strategy simulation systems. |
| Paper | User-specific QA paper account was sparse and looked immature. | User paper history remains honest, but a separate completed-evidence simulation bridge gives populated validated research context. |
| History / Symbol Detail | Already had production history depth; included in smoke/screenshots to confirm no regression. | Remained healthy on authenticated production route smoke. |
| Market Memory | Already backed by 310k+ market memory rows. | No code change required in this pass. |

## Production Screenshots

Desktop:

- [Terminal](artifacts/phase-17-1-prod/desktop/terminal.png)
- [Performance](artifacts/phase-17-1-prod/desktop/performance.png)
- [Paper](artifacts/phase-17-1-prod/desktop/paper.png)
- [Strategy Labs](artifacts/phase-17-1-prod/desktop/strategy-labs.png)
- [History AMD](artifacts/phase-17-1-prod/desktop/history-amd.png)
- [Symbol AMD](artifacts/phase-17-1-prod/desktop/symbol-amd.png)
- [Dashboard](artifacts/phase-17-1-prod/desktop/dashboard.png)

Mobile:

- [Terminal](artifacts/phase-17-1-prod/mobile/terminal.png)
- [Performance](artifacts/phase-17-1-prod/mobile/performance.png)
- [Paper](artifacts/phase-17-1-prod/mobile/paper.png)
- [Strategy Labs](artifacts/phase-17-1-prod/mobile/strategy-labs.png)
- [History AMD](artifacts/phase-17-1-prod/mobile/history-amd.png)
- [Symbol AMD](artifacts/phase-17-1-prod/mobile/symbol-amd.png)
- [Dashboard](artifacts/phase-17-1-prod/mobile/dashboard.png)

Screenshot manifest:

- [screenshot-manifest.json](artifacts/phase-17-1-prod/screenshot-manifest.json)

Production DOM checks confirmed:

- Performance: `SUMMARY ROWS`, `SIGNAL ROWS`, `85,876`, `Scanner Evidence Command Center`
- Paper: `COMPLETED EVIDENCE PORTFOLIO`, `Practice portfolio from validated forward returns`, `85,876`, `CLOSED TRADES`
- Strategy Labs: `STRATEGY LABS`, `Closed simulated trades`, `Strategy Simulation Operating System`

## Production Validation

Commit deployed:

- `dd723ab` - `Increase production data depth for evidence surfaces`

Frontend:

- Production pull: fast-forwarded to `dd723ab`
- Frontend Docker image rebuilt successfully.
- `market-alpha-frontend`: healthy

Health checks:

| Check | Result |
| --- | --- |
| `/api/health` | 200, ok |
| `/api/health/deep` | 200, ok |
| DB health | ok |
| Scanner freshness | ok, updated within minutes |
| Backup health | ok, local + R2 offsite |

Route smoke:

| Route | Result |
| --- | --- |
| `/terminal` | 200 |
| `/performance` | 200 |
| `/paper` | 200 |
| `/strategy-labs` | 200 |
| `/history?symbol=AMD` | 200 |
| `/symbol/AMD` | 200 |
| `/dashboard` | 200 |

Authenticated QA:

- Created disposable premium QA user: `phase17-1-qa-20260520@tradeveto.invalid`
- Seeded legal acceptance, premium entitlement, watchlist, and paper account context.
- Captured authenticated desktop and mobile production screenshots.
- Cleaned up QA user and QA paper account after capture.
- Verified remaining QA users: `0`
- Verified remaining QA paper accounts: `0`

## Local Validation

Commands run from the repository root, using `npm --prefix frontend` because this repo has the app package under `frontend/`:

| Command | Result |
| --- | --- |
| `npm --prefix frontend run lint` | pass |
| `npm --prefix frontend test -- --runInBand` | pass, 414 tests |
| `npm --prefix frontend run build` | pass |
| `npm --prefix frontend audit --omit=dev` | pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | pass, 0 errors |
| `git diff --check` | pass |

## Remaining Gaps

The phase meets the data-depth completion target for the major shallow surfaces, but two gaps remain:

- Actual user-specific paper history is still sparse in production. The new completed-evidence bridge prevents an empty experience without inventing user paper trades.
- The historical coverage window is 27 scan days. This is now usable and visible, but institutional-grade multi-year replay memory still requires longer production accumulation or historical backfill.

Neither gap blocks Phase 17.1 because the application now consumes the evidence that already exists, and the remaining shallow areas are either honestly labeled or converted into data-backed simulation context.

## Verdict

TRADEVETO DATA DEPTH COMPLETION ACCOMPLISHED
