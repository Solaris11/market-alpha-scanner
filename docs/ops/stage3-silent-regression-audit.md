# Stage 3: every reader of the array it removes

Written 2026-09-04. Priority 2 asked that no visible metric or text regress
silently. Stage 3 (`857af454`) removes `shockEvents` — 4.7 MB, 28% of the
`/terminal` payload — so this is the audit of what still reads it.

It found one regression, which is now fixed. The method mattered more than the
result, so it is written down first.

## Why guards were not enough

Stage 3's own commit message says the compiler enumerated the remaining readers
and that guards were written rather than guessed. That is true, and it was not
sufficient. `?? []` at each site satisfies the compiler and prevents a crash;
it does not preserve the value. Being made to look at a reader is not the same
as fixing it.

So the test for each reader is not "does it still compile" but: **build one
pattern, strip it exactly the way Stage 3 does, run both through the same
function, and compare the outputs.** `evidence-maturity-strip.test.ts` is that
test.

## The regression it found

`evidence-maturity.ts` derives three values by walking the array, and three
client components on `/terminal` call it — `SymbolDecisionHero`,
`TerminalRightRail`, `EvidenceMaturityCard`. On a row with no explicit sample
or depth columns, so the shock pattern is what the model falls back on:

| Rendered field | With array | After strip |
|---|---:|---:|
| `evidenceSampleSize` | 26 | 13 |
| `historicalDepthDays` | 163 | 0 |
| `outcomeCoverage` | 100% | 0% |
| `score` | 79 | 29 |
| `tier` | `developing` | `limited` |
| `label` | Developing Evidence | **Limited Evidence** |

Same failure mode as the actionability regression — a client component
recomputing from a row that lost an input — one commit later in the same
branch, and worse in one respect: actionability degraded a sentence, this
degrades the headline evidence rating on every card.

Fixed in `af8ebf24` by following the precedent `shockEventCount` set. Two more
summaries are computed on the server, in both pattern constructors, from the
same array the count comes from: `shockCompletedEventCount` and
`shockEventSpanDays`. Required rather than optional, which is what made the
compiler enumerate the fourteen fixtures instead of letting them default to a
quiet zero.

## Every reader, and its verdict

| Reader | Runs on the client on `/terminal`? | Verdict |
|---|---|---|
| `evidence-maturity.ts` — sample size | yes, three components | **was wrong, fixed** — reads `shockEventCount` |
| `evidence-maturity.ts` — depth days | yes | **was wrong, fixed** — reads `shockEventSpanDays`, array only as fallback |
| `evidence-maturity.ts` — outcome coverage | yes | **was wrong, fixed** — reads the two counts |
| `execution-intelligence.ts` — `buildExecutionCalibration` | **no** | safe, see below |
| `institutional-trust.ts` | yes | already takes `shockEventCount`, with a comment saying why |
| `risk-tolerant-opportunities.ts` | yes | Stage 3 moved it to `shockEventCount` |
| both radars — actionability | yes | `98afc6c6` moved the computation to the server |
| `terminal-actionability.ts` | — | comment only, no read |

### Why `execution-intelligence` is safe, checked rather than assumed

`buildExecutionCalibration` reads the array and derives `validationSampleSize`,
`evidenceMaturity`, the best and weakest validated entry types, and a score
adjustment. Emptying it would change all of them. It is reached from
`ExecutionIntelligencePanel`, which is `"use client"`.

But that component computes `focusModel` client-side only when
`providedFocusModel` is undefined **and** both `focusSymbol` and `rows` are
passed. The three call sites:

```
TerminalPremiumView.tsx:348   <ExecutionIntelligencePanel compact system={executionTimingSystem} />
SymbolTerminalWorkspace.tsx:344  <ExecutionIntelligencePanel compact focusSymbol={symbol} rows={[institutionalOpportunity]} />
OpportunitiesWorkspace.tsx:517   <ExecutionIntelligencePanel rows={rows} />
```

`/terminal` passes a server-built `system` and neither `rows` nor
`focusSymbol`, so `focusModel` is null and the calibration never runs there.
`/symbol` and `/opportunities` pass rows, and both receive unstripped rows.

**This is a standing constraint, not a property of the code as written.** If
`/terminal` ever passes `rows` to this panel, the calibration starts running on
stripped rows and degrades silently. Worth a comment at the call site the next
time anyone touches it.

## What to check after Stage 3 deploys

Beyond the runbook's browser script:

1. Evidence cards on `/terminal` still read **Developing Evidence** (or better)
   where they do today — not a page of **Limited Evidence**.
2. `htmlBytes` drops by roughly 4.8 MB from the 13,837,994 B baseline. That
   figure is arithmetic from the payload inventory, not a measurement.
3. DOM interactive is expected **not** to improve. Payload came down by a
   quarter once before and it did not move. Treat any improvement as a bonus
   and any regression as a signal.
