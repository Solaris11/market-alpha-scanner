# Phase 28.5 - Large-Universe Scanner Proof

Date: 2026-05-28
Target: https://tradeveto.com
Status: Pending production proof.

## Scope

Phase 28.5 validates scanner browser workflow behavior with a 500+ row universe:

- 500+ browser-visible scanner rows.
- Bounded virtualized render window.
- Browser timing proof for filter, sort, search, compare, row expansion, fullscreen scanner, saved scan restore, and keyboard navigation.
- Browser heap and DOM growth proof.
- No fake data presented as live trading intelligence.

## Real Universe Baseline

The current production scanner universe is smaller than the required proof size. Production SQL checks before implementation showed:

- Latest successful scanner runs expose `111` unique real symbols.
- Recent successful runs contain `2220` signal rows across `20` runs.
- No current live scanner packet proves a real 500+ symbol market universe.

Because of that, this phase implements an isolated proof path instead of inflating the user-facing scanner.

## Implemented Proof Boundary

The large-universe mode is intentionally isolated:

- Route/API flag: `?proof=large-universe`.
- Access is restricted to admin users and authenticated probe users with `@tradeveto-probe.local` email addresses.
- Normal production users continue to receive the real scanner universe.
- Rows beyond the supported real symbols use `TVP####` proof symbols and are marked `TEST-ONLY`.
- Proof rows are explicitly non-trading rows, not live market signals, not recommendations, and not financial advice.
- The proof mode is used only for browser virtualization, timing, memory, and workflow certification.

This does not claim that TradeVeto currently has a real 500-symbol live scanner universe.

## Changed Files

- `frontend/src/lib/trading/intelligence-discovery.ts`
- `frontend/src/lib/trading/intelligence-discovery.test.ts`
- `frontend/src/app/api/discovery/route.ts`
- `frontend/src/app/discover/page.tsx`
- `frontend/src/components/discovery/IntelligenceDiscoveryWorkspace.tsx`
- `frontend/scripts/phase28-large-universe-scanner-proof.mjs`
- `frontend/package.json`

## Implementation Summary

- Added `buildLargeUniverseDiscoveryProofSystem()` to create a deterministic 520-row scanner proof universe.
- Added authenticated proof-mode support to `/api/discovery`.
- Added SSR proof-mode support to `/discover`.
- Added scanner DOM proof attributes:
  - `data-scanner-total-rows`
  - `data-scanner-rendered-rows`
  - `data-scanner-virtualized`
  - `data-scanner-scroll-container`
  - `data-discovery-proof-mode`
- Added `npm --prefix frontend run probe:phase28:large-universe-scanner`.
- Added a production browser probe that creates a temporary premium probe identity, creates a saved scan fixture, opens `/discover?proof=large-universe`, captures timing/memory/DOM proof, screenshots, and a JSON report.

## Browser Probe Coverage

The Phase 28.5 browser probe validates:

- Ultra-dense scanner mode.
- 500+ total rows.
- Virtualized render window.
- Bounded rendered rows before and after scroll.
- Filter.
- Search.
- Sort.
- Compare open.
- Saved scan restore.
- Row expansion.
- Fullscreen scanner.
- Keyboard navigation.
- Horizontal overflow.
- Browser heap delta.
- DOM node delta.

## Targets

| Target | Requirement |
| --- | ---: |
| Production browser rows | `500+` |
| Rendered rows | Bounded, virtualized |
| Scanner filter | `<100 ms` |
| Sort/search | `<100 ms` |
| Compare open | `<150 ms` |
| Row expansion | `<100 ms` |
| Fullscreen scanner | `<100 ms` |
| Horizontal overflow | `0 px` |
| Scanner crash | `0` |
| Fake data presented as real | `0` |

## Artifact Location

Production proof artifacts are stored under:

`docs/ops/artifacts/phase-28-5-large-universe-scanner-proof/`

Expected files:

- `large-universe-scanner-proof.json`
- `production-smoke.txt`
- `screenshots/large-universe-ultra-dense.png`
- `screenshots/large-universe-compare.png`
- `screenshots/large-universe-fullscreen.png`

## Local Validation

Completed before production deployment:

| Command | Result |
| --- | --- |
| `node --check frontend/scripts/phase28-large-universe-scanner-proof.mjs` | Pass |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- intelligence-discovery.test.ts chart-scanner-power-workflow-proof.test.ts --runInBand` | Pass, 536 tests |
| `npm --prefix frontend test -- --runInBand` | Pass, 536 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |
| `git diff --check` | Pass |

## Production Deployment

Pending.

## Production Smoke

Pending.

## Production Browser Proof

Pending.

## No-Fabrication Proof

- The proof route is not available to normal production users.
- Generated rows include `TEST-ONLY` in company names, reasons, headline, and summary.
- Proof rows use `/discover?proof=large-universe` instead of a fake symbol route.
- The probe report records unsupported claims that must not be made.
- The artifact distinguishes isolated browser workflow proof from real scanner universe proof.

## Current Verdict

Pending production browser proof.
