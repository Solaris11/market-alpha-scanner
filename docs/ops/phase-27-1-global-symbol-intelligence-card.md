# Phase 27.1 - Global Symbol Intelligence Card

Date: 2026-05-27

## Verdict

Accomplished.

## Issue Summary

Symbol and company interactions were inconsistent. Some clicks navigated away or moved focus into lower page areas, which broke the expected market-research workflow. Phase 27.1 adds a global symbol card overlay so symbol interactions open a focused, top-layer intelligence card without route churn or scroll loss.

## Implemented Behavior

- Added a global symbol overlay store with `openSymbolCard`, `replaceSymbolCard`, and `closeSymbolCard`.
- Mounted the overlay once at the app layout level.
- Intercepts same-origin `/symbol/:symbol` links globally unless a link explicitly opts into page navigation.
- Preserves the current path and scroll position while opening and closing the card.
- Browser back closes the card before navigating away.
- Escape, backdrop click, and visible close button dismiss the card.
- Focus moves to the card close button on open and returns to the trigger on close.
- Desktop opens a top-centered dialog with bounded internal scrolling.
- Mobile uses viewport and safe-area governed sizing with internal scrolling and visible close control.

## Changed Files

- `frontend/src/lib/symbol/symbol-overlay-store.ts`
- `frontend/src/lib/symbol/symbol-intelligence-card.ts`
- `frontend/src/lib/symbol/symbol-intelligence-card.test.ts`
- `frontend/src/components/symbol/SymbolIntelligenceOverlay.tsx`
- `frontend/src/components/symbol/SymbolIntelligenceCard.tsx`
- `frontend/src/components/symbol/SymbolCardTrigger.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/ranking-table.tsx`
- `frontend/src/components/discovery/IntelligenceDiscoveryWorkspace.tsx`
- `frontend/src/components/symbol/SymbolCommandSearch.tsx`
- `frontend/src/components/terminal/MyWatchlistWidget.tsx`
- `frontend/tests/phase27/global-symbol-card.spec.ts`
- `frontend/playwright.phase27.config.ts`
- `frontend/package.json`

## Wired Surfaces

- Global `/symbol/:symbol` links through capture-phase interception.
- Terminal watchlist rows.
- Terminal ranking rows and symbol cells.
- Discover scanner cards, dense rows, shortlist rows, and keyboard open actions.
- Scanner/discovery explicit symbol interactions routed through `openSymbolCard`.
- Symbol command search result selection and keyboard Enter flow.
- Existing explicit full-page navigation remains available through links marked `data-symbol-navigation="page"`.

## Card Content

The card shows immediate research context:

- Ticker, company identity, sector/asset class, price, freshness, action state, conviction, risk, and confidence.
- Research-only/no-financial-advice disclosure.
- Support, resistance, entry, pullback, invalidation, profit-taking, avoid/exit conditions, and decision-change explanation where evidence exists.
- Compact chart preview from validated price history; otherwise an honest limited state.
- Scanner, macro, watchlist, replay/history, market-memory, risk, and source-linked event context when available.
- Actions for watchlist, alerts, full chart, full symbol page, history, performance, and compare workflows.

## Limited Data and No-Fabrication Proof

The card model requires source-backed evidence before showing high-trust profile fields:

- Company description requires a provider/source/timestamp.
- Headquarters and CEO require source-backed profile data.
- Earnings surprise history requires verified earnings surprise provider data.
- Post-earnings reaction requires real earnings dates and available price history.
- Dividend payout history requires verified dividend rows.
- News/events require provider, source URL, and timestamp.

When data is absent, the card displays `LIMITED` with the exact missing-provider reason instead of inferring or fabricating company facts, analyst actions, news, earnings, or dividends.

## Local Validation

Passed:

- `npm --prefix frontend run lint`
- `npm --prefix frontend test -- --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit --omit=dev`
- `python3 -m py_compile $(git ls-files '*.py')`
- `npx pyright . --pythonpath .venv/bin/python --warnings`
- `git diff --check`
- `npm --prefix frontend run test:phase27:symbol-card`

Focused Playwright result:

- 9 passed
- 1 skipped intentionally because the mobile geometry test only runs in the mobile project.

Artifact:

- `docs/ops/artifacts/phase-27-1-symbol-card/playwright-report.json`

Dev-mode notes:

- Local Playwright smoke used injected symbol links against `/terminal`, `/alerts`, and `/symbol/AMD` to validate global interception without depending on authenticated production data.
- Local dev server emitted expected DB-unconfigured warnings for rate-limit and monitoring writes; these are not overlay failures.

## Production Deployment Proof

Production host:

- `sre@100.68.155.121`
- `/opt/apps/market-alpha-scanner/app`

Deployment:

- Pulled `main` with fast-forward from `a39be43` to `d54f4de9`.
- Rebuilt and restarted `market-alpha-frontend` and `market-alpha-frontend-hot-api`:
  - `docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api`
- Both containers reported healthy after startup warmup.
- Production git revision after deploy: `d54f4de9ad87870532c4ef577ae1db32d2da4070`

Note:

- The first immediate health request returned `502` while the rebuilt containers were still starting. A warmup retry succeeded after both containers reported healthy.

## Production Smoke

Passed:

- `/api/health`: `ok=true`, service `tradeveto-frontend`, status `ok`
- `/api/health/deep`: `ok=true`; database `ok`; scanner fresh; backup `ok`
- `/terminal`: 200
- `/discover`: 200
- `/scanner`: 200
- `/symbol/EOG`: 200
- `/symbol/AMD`: 200
- `/history`: 200
- `/performance`: 200
- `/alerts`: 200
- `/feed`: 200
- `/macro`: 200
- `/market-memory`: 200

Production browser proof:

- Command: `TRADEVETO_PHASE27_BASE_URL=https://tradeveto.com npx playwright test --config=playwright.phase27.config.ts --workers=1`
- Result: 9 passed, 1 skipped intentionally because the mobile geometry test only runs in the mobile project.
- Routes covered by the production focused browser proof: `/terminal`, `/alerts`, `/symbol/AMD`
- Assertions covered: open without route change, close button, Escape close, backdrop close, browser-back closes card first, scroll restoration, intentional full-symbol-page navigation, mobile close visibility, mobile horizontal overflow guard, and mobile viewport geometry.

## Remaining Blockers

- Real authenticated production symbol rows should be spot-checked after deployment.
- The card remains honest-limited for provider-backed profile fields when production source data is unavailable.
