# Phase 14.3 Progressive Disclosure UX

Date: 2026-05-13

## Executive Summary

Phase 14.3 reduced visible text density across the core research workflow without removing explanations. The default experience now favors overview-first scanning, with heavier proof panels moved behind explicit advanced/detail controls.

Final status: PROGRESSIVE DISCLOSURE UX COMPLETE

## What Changed

- Advanced panels now default closed through `ResponsiveAdvancedDetails`, including desktop, so detailed proof is available on demand instead of occupying the first scan.
- Opportunities first-run guidance was shortened to one candidate, one reason, one wait condition, and one break condition.
- Symbol detail now shows the chart before deep research proof, while trade plan, memory, historical edge, paper context, and conviction timeline sit behind a "Deep symbol proof" disclosure.
- Performance keeps calibration summary visible and moves forward-return tables, drift proof, and manual refresh controls behind deep validation.
- Paper shows headline trust cards and equity curve first, while portfolio proof, scenario lab, setup evidence, trade autopsy, and ghost portfolio move behind a paper-detail disclosure.
- Strategy Labs shortened visible risk policy, research boundary, summary copy, and open-position reasoning. Exit-plan detail is now expandable per position.

## Page Coverage

| Page | Progressive Disclosure Change |
| --- | --- |
| Opportunities | Shortened guide copy and checklist; visual cards remain primary. |
| Symbol Detail | Chart promoted above dense proof; deeper research moved into expandable detail. |
| Performance | Heavy validation, drift, and runner sections moved into deep validation. |
| Paper | Trust metrics and equity curve first; portfolio/scenario/trade proof moved into detail. |
| Strategy Labs | Hero, mode, boundary, and summary text reduced; position reasoning collapsed. |
| History | Existing timeline/simple view remains the default path. |
| Alerts | Existing alert overview remains primary; inherited advanced behavior stays collapsed where used. |

## Text Reduction Rule

Visible default paragraphs added or touched in this pass are line-clamped to two lines where they previously presented longer explanations. Explanations were moved into expandable controls rather than removed.

## Validation Results

Local validation completed from `/Users/hdtv/dev/market-alpha-scanner`:

| Check | Result |
| --- | --- |
| `git diff --check` | Pass |
| `cd frontend && npm run lint` | Pass |
| `cd frontend && npm test -- --runInBand` | Pass, 374 tests |
| `cd frontend && npm run build` | Pass |
| `cd frontend && npm audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors |

Production validation completed from `onsre-node-01` at `/opt/apps/market-alpha-scanner/app`:

| Check | Result |
| --- | --- |
| Git pull | Fast-forwarded to `c0d0c670db52f7a650bcdae197a977be53610787` |
| Docker rebuild | `market-alpha-frontend` rebuilt and restarted |
| `/api/health` | Pass, HTTP 200, `ok: true` |
| `/api/health/deep` | Pass, DB/scanner/local backup/R2 backup OK |

## Production Route Smoke

Desktop route checks from production host:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/` | 200 | 0.156s |
| `/terminal` | 200 | 0.131s |
| `/opportunities` | 200 | 0.138s |
| `/symbol/AMD` | 200 | 0.257s |
| `/performance` | 200 | 0.128s |
| `/history?symbol=AMD` | 200 | 0.100s |
| `/alerts` | 200 | 0.112s |
| `/paper` | 200 | 0.136s |
| `/dashboard` | 200 | 0.147s |
| `/strategy-labs` | 200 | 0.124s |
| `/mobile` | 200 | 0.157s |

Mobile user-agent checks from production host:

| Route | HTTP | Time |
| --- | ---: | ---: |
| `/terminal` | 200 | 0.122s |
| `/opportunities` | 200 | 0.132s |
| `/symbol/AMD` | 200 | 0.224s |
| `/performance` | 200 | 0.117s |
| `/alerts` | 200 | 0.138s |
| `/paper` | 200 | 0.140s |
| `/mobile` | 200 | 0.136s |

## Mobile QA

Mobile route rendering was validated with an iPhone Safari user agent from the production host. All checked routes returned HTTP 200 without route failures. The main functional mobile risk that remains is visual review under an authenticated beta session, because curl smoke validates route availability and server response, not the full interactive viewport.

## Remaining UX Debt

- Some pages still need authenticated screenshot review after the next beta user session to confirm perceived density under real data.
- History and Alerts are structurally ready for progressive disclosure, but the next pass should add more tap-to-expand interaction around individual timeline/alert items.
- Strategy Labs can still be made more visual in Phase 14.4 by replacing more summary copy with real simulation charts and compact drill-downs.

