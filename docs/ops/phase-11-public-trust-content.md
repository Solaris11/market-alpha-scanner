# Phase 11.12 Launch Content + Public Trust Hardening

Date: 2026-05-10

## Scope

Audited public launch surfaces:

- Homepage
- Pricing
- Features
- FAQ
- How It Works
- Intelligence index
- Macro regime page
- Shock opportunities page
- Public strategy performance page
- Public symbol intelligence and why-wait pages
- Risk disclosure, terms, and privacy pages
- Sitemap, robots, canonical metadata, OpenGraph/Twitter metadata

## Findings Before Hardening

- Homepage messaging was clear but still leaned scanner-centric rather than proof, replay, event context, and evidence maturity.
- Pricing described premium access but did not strongly explain research-only limitations, replay/evidence value, or simulation boundaries.
- Features and FAQ under-explained shock intelligence, evidence maturity, replay, verified event context, and LLM boundaries.
- Public intelligence pages were structurally strong but needed more visible trust-boundary language on public-safe pages.
- Legal pages covered basic risk language but did not explicitly mention AI explanations, replay studies, strategy simulations, or evidence labels.
- No user-facing stale Market Alpha branding was found in public app copy. Remaining `market-alpha` strings are legacy migration, operational path, or backward-compatible storage/header references.

## Improvements Applied

- Updated brand and SEO defaults to emphasize WAIT-first, evidence-aware market research.
- Strengthened homepage value proposition around evidence maturity, verified event context, shock research, replay, and limitations.
- Added a homepage proof model section covering evidence maturity, replay, simulated strategies, and LLM boundaries.
- Expanded pricing copy with replay/evidence context and a transparent limits panel.
- Expanded features and FAQ coverage for shock intelligence, evidence maturity, verified events, public strategy proof, and deterministic-vs-LLM boundaries.
- Updated How It Works to explain Market -> Evidence -> Decision -> Explanation -> Replay/Simulation.
- Added public trust boundaries to symbol intelligence, macro, and shock publishing pages.
- Improved risk/legal pages to mention AI explanations, strategy simulations, replay studies, evidence labels, and user-memory controls.
- Improved metadata with stronger default description, canonical URLs, OpenGraph/Twitter consistency, large-image crawler hints, and proof-oriented keywords.

## SEO + Social Preview Notes

- `marketingMetadata()` now emits canonical URL, OpenGraph URL, absolute PNG social image, Twitter large image, index/follow robots directives, and large image preview hints.
- Sitemap already includes the main public launch routes plus published symbol and why-wait pages.
- Robots rules allow public marketing/intelligence pages and social preview crawlers while keeping private app routes disallowed.

## Validation Results

- `npm run lint`: passed.
- `npm test -- --runInBand`: passed, 354 tests.
- `npm run build`: passed.
- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- Local route checks passed with HTTP 200 for `/`, `/pricing`, `/features`, `/how-it-works`, `/faq`, `/intelligence`, `/intelligence/shock-opportunities`, `/intelligence/macro-regime`, `/intelligence/strategy-performance`, `/symbol/AMD`, `/intelligence/why-wait/AMD`, `/risk-disclosure`, `/terms`, `/privacy`, `/robots.txt`, `/sitemap.xml`, and `/og-image.png`.
- Canonical, OpenGraph image, and Twitter image metadata were validated locally for the homepage, pricing, features, how-it-works, FAQ, intelligence, shock, macro, strategy-performance, AMD symbol, and AMD why-wait pages.
- `/api/health` passed locally. `/api/health/deep` returned 503 in the local dev environment because database, scanner, and backup state were unavailable; this is an environment limitation rather than a content regression.

## Remaining Content Gaps

- Public symbol pages depend on latest scanner-derived publishing data; if data is missing, some pages can still be sparse.
- OG image is consistent and valid, but not yet route-specific for proof, shock, or macro pages.
- Public pages do not yet show source citations inline for every event-derived claim.
- Testimonials remain intentionally absent until real beta feedback exists.
- Native social preview validation against Facebook/LinkedIn/Twitter debuggers still requires production-domain testing.

## Visual QA Artifacts

- Homepage desktop: `/tmp/tradeveto-public-content-audit/home-desktop.png`
- Homepage mobile: `/tmp/tradeveto-public-content-audit/home-mobile.png`
- Pricing desktop: `/tmp/tradeveto-public-content-audit/pricing-desktop.png`
- Intelligence library desktop: `/tmp/tradeveto-public-content-audit/intelligence-desktop.png`
