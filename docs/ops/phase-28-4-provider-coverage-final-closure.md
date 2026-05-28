# Phase 28.4 - Provider Coverage Final Closure

## Scope

Phase 28.4 targets the remaining provider-source-trust blockers without fabricating provider data. The known limited domains were `analyst-actions` and `geopolitical-events`, with source completeness, fake-live labeling, hidden stale-state disclosure, and outage simulation already strong.

## Implementation

- Added a supplemental provider coverage helper for source-linked public provider rows:
  - MarketBeat analyst pages for upgrades, downgrades, initiations, and price-target/rating changes.
  - StockTitan RSS, filtered only to analyst-action headlines.
  - Nasdaq stocks RSS, filtered only to geopolitical and commodity/inflation-proxy event rows.
- Merged supplemental rows into the authenticated `/api/intelligence/provider-source-trust` proof path.
- Added provider-domain-diverse supplemental selection so analyst-action rows cannot crowd out geopolitical or inflation proof when those verified rows are available.
- Allowed MarketBeat in the existing verified news source policy.
- Updated source-trust completeness to accept source-backed affected sectors when a market/geopolitical event has no specific affected ticker.
- Extended the production probe card-field audit to require either affected symbols or affected sectors.
- Preserved the no-fabrication boundary:
  - No inferred geopolitical headlines.
  - No fake analyst actions.
  - No fake live labels.
  - No hidden stale state.
  - No watchlist impact unless symbols or sectors are source-backed.

## Local Validation

Completed before deployment:

- `npm --prefix frontend run lint` - pass.
- `npm --prefix frontend test -- --runInBand` - pass, 535 tests.
- `npm --prefix frontend run build` - pass.
- `npm --prefix frontend audit --omit=dev` - pass, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - pass.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - pass, 0 errors.
- `git diff --check` - pass.

Focused provider validation also passed:

- `provider-coverage-supplement.test.ts`
- `provider-source-certification.test.ts`
- `daily-market-command.test.ts`
- `market-research.test.ts`

Live local supplemental fetch returned all targeted supplemental domains from verified sources in one packet:

- `MarketBeat` analyst-action row.
- `Nasdaq` geopolitical row.
- `Nasdaq` commodity/inflation-proxy row.

## Production Deployment

Pending production deployment proof at initial commit time.

Expected workflow:

1. Pull latest `main` in `/opt/apps/market-alpha-scanner/app`.
2. Rebuild/redeploy `market-alpha-frontend` and `market-alpha-frontend-hot-api`.
3. Run production health and route smoke.
4. Run authenticated provider-source-trust probe from inside the production frontend container.
5. Capture provider matrix, freshness certification, source trust summary, and outage simulation artifacts.

## Production Evidence

Artifact directory:

`docs/ops/artifacts/phase-28-4-provider-coverage-final-closure/`

Expected artifacts:

- `production-smoke.txt`
- `provider-source-trust-probe.log`
- `provider-source-trust-probe.json`
- `provider-matrix.json`
- `source-trust-summary.json`
- `freshness-certification.json`
- `outage-certification.json`

## Certification Criteria

Phase 28.4 can only be accomplished when production proof shows:

- `provider-source-trust` `overallStatus = ready`.
- `analyst-actions` active or explicitly out-of-scope.
- `geopolitical-events` active or explicitly out-of-scope.
- Source completeness at or above 99%.
- Fake live labels = 0.
- Hidden stale states = 0.
- Provider outage fallback/recovery visible.

If production proof closes one but not both remaining domains while source completeness, fake-live, hidden-stale, and outage proof pass, the honest verdict is strong partial.

## Final Verdict

Pending production provider-source-trust probe.
