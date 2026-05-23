# Phase 23.6 - Provider Depth + Real-Time Event Dominance

Date: 2026-05-23

Final status: **NOT ACCOMPLISHED**

Phase 23.6 strengthened provider depth, source trust, and freshness disclosure without fabricating events, headlines, analyst actions, or live data. It does not honestly reach Bloomberg/Yahoo/StockTitan-level real-time event dominance because production still needs complete source-linked provider coverage across all required domains and measured freshness SLAs must pass in production.

## Implementation

- Added explicit provider freshness SLA fields to each provider matrix domain:
  - `freshnessSlaMinutes`
  - `freshnessSlaStatus`
  - `freshnessSlaDisclosure`
- Exposed SLA status in the Terminal provider coverage matrix.
- Extended `/api/intelligence/provider-source-trust` to return freshness SLA proof per required domain.
- Tightened the production provider-source-trust probe to fail certification when:
  - required provider domains are limited
  - source-trust completeness falls below 95%
  - freshness SLA status is missing
  - active domains breach freshness SLA
  - outage/fallback/recovery visibility is missing
- Added CoinDesk as a trusted source-linked crypto event provider:
  - scanner feed: `https://www.coindesk.com/arc/outboundfeeds/rss/`
  - frontend source policy allowlist
  - provider source weighting
- Fixed a classifier bug where the substring `ppi` inside words such as `shipping` could misclassify geopolitical shipping headlines as inflation/rates.
- Added regression coverage for source-linked inflation, analyst action, geopolitical, and crypto provider domains.

## Provider Domains

The required Phase 23.6 provider matrix remains:

| Domain | Implementation state |
| --- | --- |
| Macro | Source-linked when verified macro rows exist; limited otherwise |
| Rates | Source-linked when verified rates rows exist; limited otherwise |
| Inflation | Source-linked when CPI/PPI/inflation rows exist; limited otherwise |
| Earnings | Source-linked or calendar-only depending on available rows |
| Analyst actions | Source-linked when verified analyst rows exist; limited otherwise |
| Dividends | Source-linked or calendar-only depending on available rows |
| Geopolitical events | Source-linked when verified geopolitical rows exist; limited otherwise |
| Company events | Source-linked when verified symbol/company rows exist; limited otherwise |
| Sector events | Source-linked when verified sector rows exist; limited otherwise |
| Crypto events | Source-linked when verified crypto rows exist; limited otherwise |

## Source Trust Rules

Displayed event cards continue to require:

- source URL
- provider/source attribution
- timestamp
- freshness
- affected symbols or explicit market-level context
- watchlist impact reason
- uncertainty label

The implementation preserves the no-fabrication rule:

- no fake headlines
- no fake analyst actions
- no fake geopolitical events
- no fake crypto events
- no fake live labels
- no inferred missing provider events

## Local Validation

| Check | Result |
| --- | --- |
| `npm --prefix frontend run lint` | Pass |
| `npm --prefix frontend test -- --runInBand` | Pass, 496 tests |
| `npm --prefix frontend run build` | Pass |
| `npm --prefix frontend audit --omit=dev` | Pass, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Pass |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Pass, 0 errors / 0 warnings |
| `node --check frontend/scripts/phase22-provider-source-trust-probe.mjs` | Pass |
| `git diff --check` | Pass |

## Production Deploy Proof

Pending until commit, push, production pull, and runtime rebuild.

## Production Probe Proof

Pending until production deploy.

Required production probe:

```bash
npm --prefix frontend run probe:phase23:provider-depth
```

## Remaining Blockers

- Production provider breadth has not yet proven all required domains as active/source-linked.
- Real-time freshness SLAs have not yet passed on production provider data.
- Analyst-action depth still depends on configured source-linked rows, not a dedicated paid analyst-action provider.
- Dividend/event history is still not equivalent to a full dividend-history provider.
- Geopolitical coverage is not equivalent to a dedicated real-time geopolitical feed.
- Crypto depth improved with CoinDesk support, but production freshness and coverage still require proof.
- No Bloomberg/Yahoo/StockTitan parity claim is supported.

## Verdict

Phase 23.6 improves source-linked provider trust and event-domain governance, but real-time event dominance is not accomplished without complete production provider coverage and passing freshness SLA proof.

Final verdict:

`TRADEVETO PROVIDER DEPTH + REAL-TIME EVENT DOMINANCE NOT ACCOMPLISHED`
