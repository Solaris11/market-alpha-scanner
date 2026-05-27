# Phase 26.4 - Browser Power Workflow + Chart Dominance Closure

Date: 2026-05-27

## Verdict

Pending production browser probes.

## Critical Issue

Phase 25 chart/scanner deterministic probes were strong, but browser-level workflow proof still missed important targets:

- scanner ultra-dense interaction exceeded 100 ms
- scanner sort/search exceeded 100 ms
- compare open exceeded 150 ms
- chart fullscreen open and chart toolbar interactions exceeded target
- rapid symbol switching exceeded 100 ms
- production browser scanner exposed 111 rows, so 500+ browser-row proof was not established

## Implementation

- Added in-browser workflow timing instrumentation for scanner and chart interactions via `window.__tradevetoBrowserWorkflowMetrics`.
- Scanner instrumentation now records browser click/input-to-next-frame timing for:
  - ultra-dense mode
  - filtering
  - sorting
  - compare open
  - row expansion
  - fullscreen scanner toggle
- Chart instrumentation now records browser click-to-next-frame timing for:
  - fullscreen chart open
  - fullscreen toolbar mode/layout actions
  - drawing toolbar operations
  - drawing object commits
- Extended the existing chart/scanner browser probe with Phase 26.4 artifact paths and browser-performance timing source support.
- Added production browser screenshots for:
  - ultra-dense scanner
  - compare workflow
  - fullscreen scanner
  - symbol chart
  - fullscreen chart
  - symbol switch
- Added `npm --prefix frontend run probe:phase26:browser-power-workflow`.

## Targets

| Workflow | Target |
| --- | ---: |
| Scanner interaction | < 100 ms |
| Compare open | < 150 ms |
| Chart interaction | < 60 ms |
| Fullscreen chart open | < 150 ms |
| Workspace restore | < 250 ms |
| Rapid symbol switch | < 100 ms |

## Local Validation

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 516 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |
| `git diff --check` | Pass |
| `node --check frontend/scripts/phase25-chart-scanner-browser-timing-probe.mjs` | Pass |

## Production Deploy Proof

Pending.

## Production Browser Probe

Expected artifacts:

- `docs/ops/artifacts/phase-26-4-browser-workflows/chart-scanner-browser-timing.json`
- `docs/ops/artifacts/phase-26-4-browser-workflows/large-universe-proof.json`
- `docs/ops/artifacts/phase-26-4-browser-workflows/screenshots/`

## Remaining Blockers

Pending production proof. Full accomplishment is not defensible unless production browser timings meet targets and the production browser large-universe workflow proves 500+ real rows or clearly documents the remaining product-data limitation.
