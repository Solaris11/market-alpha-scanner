# Phase 7.2 Conviction + Fragility Engine

## Goal

Phase 7.2 adds a structural decision-quality layer on top of existing scanner output. It does not rewrite scanner scoring, issue financial advice, or claim predictive certainty. The engine evaluates whether the current setup is supported by enough evidence, how fragile that support is, and what could weaken or invalidate the setup.

## Methodology

The model derives a `ConvictionFragilityModel` from:

- latest `RankingRow` scanner data
- decision-intelligence factor scores
- veto and setup reason codes
- symbol signal history, when available
- Phase 7.1 Market Memory analog outcomes, when available

The engine produces:

- Conviction Score: how much evidence currently supports the setup.
- Fragility Score: how vulnerable the setup is to breakdown.
- Setup Decay: fresh, maturing, extended, decaying, or unknown.
- Confidence Drift: rising, stable, weakening, or unavailable.
- Invalidation Context: proximity to stop/support/invalidation data and structural integrity.
- Market Pressure Contributors: macro, sector, risk/reward, volatility, data quality, and market memory.
- Historical Fragility Context: probabilistic downside and follow-through context from comparable analogs.

## Conviction Score

Conviction is a weighted blend of:

- scanner confidence
- readiness
- setup strength
- trend, momentum, volume, risk, macro, and data-quality factors
- market pressure score
- Market Memory analog consistency
- confidence drift

Risk vetoes and avoid/exit decision states reduce conviction. The score answers: "How much evidence currently supports this setup?"

## Fragility Score

Fragility is a weighted blend of:

- weak risk/reward context
- volatility pressure
- macro pressure
- data-quality pressure
- invalidation proximity
- historical downside-tail context
- veto pressure
- weakening drift
- weak setup structure

The score answers: "How easily could this setup break down?"

## Setup Decay

Decay is intentionally conservative:

- Extended: entry context is stretched or overextension diagnostics are active.
- Decaying: confidence is weakening or fragility is high without cleaner decision alignment.
- Maturing: many visible observations exist.
- Fresh: some observations exist but the setup is still early in visible history.
- Unknown: no usable symbol history is available.

## Invalidation

Invalidation risk uses:

- distance from available stop/invalidation/support context
- risk factor quality
- macro factor quality
- stop-risk and risk/reward vetoes
- volatility and overextension codes

The UI explains conditions that would need to improve rather than presenting deterministic triggers.

## Market Memory Integration

Market Memory contributes only probabilistic context:

- comparable setup sample size
- evidence maturity tier
- selected forward-return horizon
- positive-rate
- median return
- downside-tail behavior

If memory is unavailable, the engine degrades to a neutral context score instead of blocking render.

## UI Surfaces

Added surfaces:

- Symbol detail: Conviction vs Fragility panel.
- Opportunities: structural label, fragility score, and decay state on setup cards.
- Terminal research queue: simplified structural labels and fragility.
- Scanner signal cards: compact structure and fragility labels.

## Safety Rules

Generated copy avoids deterministic language. Preferred language is historical, probabilistic, and risk-first. The model does not say a setup will move, does not recommend buys/sells, and does not replace legal/research-only gates.

## Performance

The engine is synchronous and bounded:

- no DB query inside the model
- no unbounded similarity scan
- Market Memory candidates are already limited server-side
- history usage is limited to visible symbol history arrays

The model is suitable for page render and client-side card rendering.

## Remaining Limitations

- Macro/exchange regime inputs are still whatever the scanner currently exposes.
- Confidence drift quality depends on repeated symbol observations.
- Historical fragility improves as Market Memory depth expands.
- No dedicated persistence table exists yet for conviction/fragility snapshots.

## Phase 7.3 Recommendation

Next phase should add Macro + Exchange Regime Engine inputs so fragility and conviction can understand exchange breadth, cross-asset pressure, VIX, DXY, yields, oil, gold, and sector rotation instead of relying only on scanner-provided macro fields.
