# Phase 7.3b - Verified Event + Macro Intelligence

TradeVeto now has a first-generation verified event layer that enriches scanner rows with trusted macro, regulatory, commodity, and company event context. The layer is intentionally bounded: it adds explainable pressure, conviction, fragility, and shock context without turning event feeds into deterministic predictions.

## Default Trusted Sources

The scanner fetches official RSS/XML feeds with a short timeout and cached fallback:

- Federal Reserve press releases: `https://www.federalreserve.gov/feeds/press_all.xml`
- Bureau of Labor Statistics latest releases: `https://www.bls.gov/feed/bls_latest.rss`
- SEC press releases: `https://www.sec.gov/news/pressreleases.rss`
- SEC EDGAR 8-K current filings: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&start=0&count=40&output=atom`
- CFTC general press releases: `https://www.cftc.gov/RSS/RSSGP/rssgp.xml`
- BEA news releases: `https://apps.bea.gov/rss/rss.xml`
- Census economic indicators: `https://www.census.gov/economic-indicators/indicator.xml`
- EIA Today in Energy: `https://www.eia.gov/rss/todayinenergy.xml`
- EIA press releases: `https://www.eia.gov/rss/press_rss.xml`
- PR Newswire releases: `https://www.prnewswire.com/rss/news-releases-list.rss`
- MarketWatch top stories: `https://feeds.content.dowjones.io/public/rss/mw_topstories`

Symbol-level news already collected through the scanner is accepted only when it has a source, URL, timestamp, and an allowlisted provider such as Reuters, Bloomberg, CNBC, MarketWatch, Yahoo Finance, SEC, Business Wire, GlobeNewswire, PR Newswire, MT Newswires, AP, or WSJ.

Phase 8.4 adds source weighting, duplicate suppression, source URL allowlisting, stale-event suppression, and event decay. Official `.gov` feeds carry the highest weight; reputable market/newswire feeds are accepted at lower bounded weights. Non-HTTPS feeds, untrusted hosts, duplicate URLs, and stale low-decay events are ignored.

Upcoming symbol earnings dates from the scanner fundamentals cache are converted into lower-weight `Yahoo Finance Earnings Calendar` events when they are near enough to matter. These are treated as event-risk context, not as confirmed earnings outcome claims.

## Optional Feed Expansion

Operators can add up to 8 additional trusted HTTPS feeds without code changes:

```json
[
  {
    "key": "bea_economic_releases",
    "name": "Bureau of Economic Analysis",
    "url": "https://apps.bea.gov/rss/rss.xml",
    "category_hint": "macro"
  },
  {
    "key": "census_economic_indicators",
    "name": "U.S. Census Economic Indicators",
    "url": "https://www.census.gov/economic-indicators/indicator.xml",
    "category_hint": "macro"
  },
  {
    "key": "eia_today_in_energy",
    "name": "U.S. Energy Information Administration",
    "url": "https://www.eia.gov/rss/todayinenergy.xml",
    "category_hint": "commodity"
  },
  {
    "key": "prnewswire_company_releases",
    "name": "PR Newswire",
    "url": "https://www.prnewswire.com/rss/news-releases-list.rss",
    "category_hint": "company"
  },
  {
    "key": "marketwatch_top_stories",
    "name": "MarketWatch",
    "url": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    "category_hint": "market"
  }
]
```

Set it as `TRADEVETO_EVENT_FEEDS_JSON`. Invalid JSON, non-HTTPS URLs, missing names, and duplicate URLs are ignored. This keeps broad event coverage possible without silently accepting random or unverifiable feeds.

## Optional LLM Interpretation Layer

The event layer can optionally use an LLM as an evidence-gated adjudicator. It is off by default.

Required when enabling it:

```bash
TRADEVETO_EVENT_LLM_ENABLED=true
TRADEVETO_EVENT_LLM_MODEL=<openai-model-id>
OPENAI_API_KEY=<secret>
```

Optional:

```bash
TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS=8
```

The OpenAI request intentionally does not send a `temperature` override so models such as `gpt-5.5` can run with their default sampling behavior.

The LLM receives only trusted source title/summary/URL metadata. It must return strict JSON with event type, direction, affected sectors, reason codes, bounded pressure/conviction/fragility values, and evidence phrases copied from the source text. The validator rejects output when:

- the source text does not contain the claimed evidence phrase
- confidence is below threshold
- reason codes are outside the allowlist
- the schema is invalid
- the LLM times out or no API key/model is configured

If rejected, TradeVeto falls back to deterministic classification and the scan continues.

## Classification Scope

The classifier is deterministic and keyword-based. It currently recognizes:

- Inflation, employment, Fed/rates, liquidity tightening/easing, recession pressure
- Volatility expansion, defensive rotation, AI/semiconductor momentum
- Oil supply shocks, gold/safe-haven context, crypto context
- War/geopolitical escalation and peace/de-escalation
- Earnings sensitivity, earnings beat/miss, profit/loss pressure
- M&A, investments/capex, product launches
- Regulatory, enforcement, sanctions, and rulemaking risk

Directional parsing is also applied so wording such as "peace talks failed", "hotter than expected inflation", "higher than expected rates", "cuts guidance", "misses estimates", "preorders exceed expectations", "launch delayed", or "margin compression" can change the event direction before bounded scoring.

## Scanner Outputs

Each scanner row can now include:

- `event_context_label`
- `event_context_reason_codes`
- `event_context_summary`
- `event_confidence`
- `event_conviction_adjustment`
- `event_decay`
- `event_fragility_adjustment`
- `event_macro_pressure_adjustment`
- `event_risk_score`
- `event_shock_pressure_score`
- `event_source_weight`
- `verified_event_pressure_score`
- `verified_event_signature`
- `macro_event_regime_signature`
- `verified_event_recent_events`
- `verified_event_sources_used`

## Guardrails

- Event conviction adjustment is bounded to `-4.0..+3.0`.
- Event fragility adjustment is bounded to `0.0..6.0`.
- Event macro pressure adjustment is bounded to `-3.0..+2.0`.
- Recommendation quality receives only a secondary bounded event adjustment of `-8..+5`.
- Missing feeds degrade to neutral context or cached fallback.
- Output language stays probabilistic and non-advisory.

## Product Surfaces

- Symbol detail now shows an "Event + Macro Intelligence" card.
- Opportunities now expose compact event pressure states.
- Decision intelligence and conviction/fragility now use event reason codes.
- Market Memory signatures now include event and macro-event regime context for future analog matching.

## Phase 7.4 Shock Move Contract

LLM analysis can also help future peak/shock detection, but it should not replace the statistical engine. The intended contract is:

- Mathematical engine computes abnormal moves: 1D/2D/5D returns, z-score, ATR-normalized move, gap size, volume spike, realized volatility expansion, sector-relative return, reversal/drawdown, and percentile rank.
- Historical engine compares similar setup, macro/event regime, symbol memory, and forward-return distributions.
- Event engine provides verified macro/company/geopolitical context.
- LLM adjudicator labels whether the event context plausibly explains the peak/shock, using only supplied evidence and computed metrics.

The LLM must not invent z-scores, probabilities, or historical counts. It can only classify and explain the already-computed statistical packet.

Planned structured output:

- `shock_direction`: upside, downside, two_sided, none
- `shock_type`: earnings_gap, macro_surprise, geopolitical_volatility, commodity_shock, product_catalyst, regulatory_shock, technical_squeeze, unknown
- `event_link_confidence`: low, moderate, high
- `evidence_phrases`: copied from verified source text
- `statistical_evidence`: references to computed fields, not invented values
- `risk_note`: probabilistic, non-advisory explanation

## Limitations

This is not a real-time news terminal, geopolitical prediction engine, or full macro econometric model. Event extraction is first-generation and deterministic with an optional evidence-gated LLM adjudicator. The next step is Phase 7.4 Shock Move Intelligence, which should consume event pressure, shock pressure, event similarity, historical analog outcomes, and mathematically detected abnormal move packets.
