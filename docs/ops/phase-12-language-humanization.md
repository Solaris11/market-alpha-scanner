# Phase 12.5 Language Humanization

## Goal

TradeVeto should sound like a clear market analyst, not a research paper or an internal scoring system. The product can remain careful and non-advisory while using language that users understand quickly.

## Style Guide

Use this hierarchy when writing UI copy:

1. Say what matters.
2. Say why it matters.
3. Say what could go wrong.
4. Say what to watch next.

Preferred voice:

- Clear, calm, and concise.
- Evidence-aware without sounding academic.
- Risk-aware without sounding alarmist.
- Human-readable before technically precise.
- Research-only and non-advisory where needed.

Avoid:

- Internal engine language: `deterministic packet`, `source of truth`, `bounded adjustment`.
- Abstract labels without context: `shock-pattern support`, `asymmetry`, `macro regime`.
- Hype language: `buy now`, `guaranteed`, `sure profit`.
- Repeated disclaimers that crowd out the useful point.
- Long paragraphs that bury the next action.

Preferred replacements:

| Avoid | Prefer |
| --- | --- |
| shock-pattern support visible | Similar setups historically produced strong upside moves |
| shock memory | large-move history |
| upside shock | large upside move |
| downside shock | large downside move |
| chase risk | late-entry risk |
| invalidation context | what would break the setup |
| do-not-chase zone | too-extended area |
| research entry zone | research entry area |
| historical exit zone | historical exit area |
| macro alignment | market support |
| macro pressure | market pressure |
| deterministic packet | latest TradeVeto data |
| deterministic fallback | score-based fallback |
| source confidence | source strength |
| event decay | event freshness |
| false positive | false alarm |
| asymmetry | upside/downside balance |
| risk-tolerant | higher-risk |
| probabilistic | uncertain / historically mixed / context only |

## Rewritten Surfaces

- Shared UI language helper now rewrites more engine terms through `humanizeInsightText`.
- Shock radar now uses `Large-Move Watch`, `Upside History`, `False Alarm Risk`, and `Volume Quality`.
- Shock memory now explains what appeared before big moves, what made setups fail, and where late-entry risk appears.
- Conviction/fragility now frames the card as setup strength and “what could break it.”
- Macro cards now read as market/listing context instead of macro regime jargon.
- Verified event cards now show source strength, event freshness, and plain-language event impact.
- Risk-tolerant radar now says higher-risk, late-entry risk, and score-based fallback.
- Narrative cards now use `What Supports It`, `What Could Hurt It`, `Why It Matters`, and `What To Watch`.
- Replay copy now says “Replay what TradeVeto knew” and explains before/after evidence plainly.
- Portfolio/scenario copy now uses market support, stress vulnerability, and large-move exposure.
- Onboarding now explains large-move history and break conditions without exposing internal terms.
- Copilot fallback responses now use market context, late-entry risk, and plain scenario language.

## Before / After Examples

| Before | After |
| --- | --- |
| Shock-pattern support visible with macro pressure. | Similar setups historically produced strong upside moves while market pressure remained visible. |
| Entry context: research entry zone. Exit context: historical exit zone. | Research entry area and historical exit area are shown as context, not instructions. |
| Event decay and source confidence adjusted macro pressure. | Event freshness and source strength changed market pressure. |
| Deterministic fallback. | Score-based fallback. |
| Asymmetry is favorable relative to downside context. | Upside/downside balance looks favorable, but downside risk still matters. |
| Invalidation conditions. | What could break it. |
| Shock-memory chase risk is elevated. | Large-move history shows elevated late-entry risk. |

## Remaining Confusing Terms

These terms still appear because they are core product concepts, but they now need consistent nearby explanation:

- `Fragility`: keep the term, but pair it with “how easily the setup can break.”
- `Conviction`: keep for score identity, but explain it as evidence strength.
- `Asymmetry`: replace in most UI with `upside/downside balance`; keep only in advanced/institutional contexts.
- `Macro`: prefer `market` in user-facing UI; keep `macro` in admin, API, and technical docs.
- `Regime`: prefer `market state`; keep `regime` in advanced research and operator docs.
- `Deterministic`: avoid in user UI; keep in internal safety/eval code.
- `Alpha`: prefer `historical edge` or `strategy edge` outside Strategy Lab branding.

## Guardrails

- Never let the LLM invent prices, probabilities, events, or source claims.
- Keep research-only boundaries, but avoid repeating them inside every small card.
- Use “may,” “historically,” “similar setups,” and “what to watch” instead of certainty.
- Preserve direct financial advice avoidance.

## Status

The language rewrite is implemented across the main user-facing intelligence surfaces. Remaining work is mostly consistency testing and future UX review, not a blocker for Phase 12.5.
