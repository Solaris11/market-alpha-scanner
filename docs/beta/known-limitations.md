# Closed Beta Known Limitations

This document is internal. Do not hide these from operators.

## Product/Data

- Forward-return and calibration evidence is still early. Some groups have low sample size and should not be overinterpreted.
- Historical signal retention is limited because the production database only began accumulating recent scanner snapshots after the DB-source-of-truth migration.
- Alpaca is primary market data, but unsupported symbols and crypto-style symbols may use yfinance fallback.
- Scanner decisions are decision-support labels, not predictions and not instructions.

## Analytics

- Analytics are first-party and privacy-conscious, but early beta cohorts will have low sample sizes.
- Visitor geography depends on Cloudflare headers and may be unavailable for direct-origin or local tests.
- Analytics custom date ranges are not implemented yet; admin analytics currently uses preset ranges.
- Some declared analytics events are supported but only partially wired where workflows are not yet user-triggered.

## Billing

- Stripe trials and promotion codes are optional environment-driven features and should be validated with a disposable user before each cohort.
- Google OAuth signups in invite mode require email allowlisting because an invite code cannot be entered in the OAuth redirect flow.
- Billing portal messaging comes from Stripe; keep Stripe product, price, trial, and coupon configuration aligned with TradeVeto copy.

## UX

- Some protected pages show public previews rather than full content for anonymous/free users.
- Mobile charts are usable but remain dense on small-height screens.
- Browser QA should be repeated after each navigation/layout change.

## Operations

- R2 is the primary offsite backup. Google Drive is legacy/secondary only.
- Turbopack build currently reports a known NFT tracing warning related to the price-history route.
- Dependency audit currently reports moderate findings during container builds; review before public launch.
