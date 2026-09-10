# `/terminal` information architecture — audit and plan

2026-09-10 · branch `work/terminal-ia-simplification` · no deploy until the
21:30 SNDK full-scan verification is complete.

## What the page is today

Route `frontend/src/app/terminal/page.tsx` has three branches; the long one is
`TerminalPremiumView.tsx` (690 lines, server, 13 awaited fetches, ~22
synchronous model builds).

**~24 top-level sections in the main column, ~45 distinct rendered surfaces**
once the accordion and the right rail are counted.

Two findings dominate everything else:

1. **There is exactly one collapse point on the entire page** — the "Advanced
   intelligence layers" `<details>` at `TerminalPremiumView.tsx:~340`. Sections
   1–17 are all permanently expanded.
2. **The decision hero is fifth.** `DailyActionCard` — the component that
   answers "is there an ENTER right now" — renders *below* the four heaviest
   non-chart panels on the page. A trader scrolls past ~3,500 lines of
   component output to reach the verdict.

And the four panels above it are largely not market data:
`DailyDriverRetentionPanel` (1063 lines) is retention/habit product narrative;
`EcosystemContinuityPanel` (431) is device continuity;
`LivingIntelligenceProofPanel` (230) is proof-of-value marketing.

## The five questions, and where their answers currently live

| Question | Answered in | Problem |
|---|---|---|
| Is there an ENTER right now? | `DailyActionCard` (#5), Decision Mix tiles | Fifth on the page |
| Best 3–5 opportunities? | `DailyMarketCommandCenter` Top 5, `UnifiedIntelligenceConsole` Best Opportunities, `BestTradeNowCard`, Research Queue `SignalCard`s | **Four separate answers** |
| Why WAIT / WATCH? | `DailyActionCard` whyReasons, `ExecutionIntelligencePanel` | The detailed answer is inside the collapsed accordion (#18.10) |
| Market risk state? | `GlobalMarketCommandCenter` (#8), `MarketRegimeRadar` (accordion), `DailyMarketCommandCenter` HeroBrief | Three places, one buried |
| Watchlist / alert urgencies? | Right rail Tracked Signals + Active Alerts, `MyWatchlistWidget` (#23), `UnifiedIntelligenceConsole` Watchlist Changes | Three places |

Every one of the five is answerable — none is missing. They are just scattered,
and none of them is reliably above the fold.

## Duplication inventory (summary)

Measured across the render tree. The decision label alone appears in **12**
components; regime label in **11**; scan freshness in **7**; the decision
distribution is computed **four separate times** from the same source; paper
PnL is rendered twice from the same `snapshot.paperSummary`.

Full table in the audit notes; the redesign does not delete any of these — it
makes one of them canonical and demotes the rest into their tab.

## Classification

**Critical — above the fold**
`DailyActionCard` (#5) · decision distribution · scan freshness
(`DataHealthBanner`) · market regime · top opportunities · right-rail alerts

**Secondary — one interaction away**
`GlobalMarketCommandCenter` · `UnifiedIntelligenceConsole` ·
`MarketChartHub` · `MyWatchlistWidget` · `SignalHeatmap` ·
`ExecutionIntelligencePanel` · `PredictiveIntelligencePanel` ·
`BestTradeNowCard` · Research Queue

**Research / detail — collapsed by default**
The 15 panels already inside "Advanced intelligence layers" ·
`AICognitionLayerPanel` · `IntelligenceEcosystemPanel` ·
`InstitutionalSuperplatformPanel` · `AutomatedResearchAgentsPanel` ·
`AdaptiveLearningInsightPanel` · `StrategyIntelligencePanel` ·
`ScenarioIntelligencePanel`

**Product narrative / retention — own tab, not the trading surface**
`DailyDriverRetentionPanel` · `LivingIntelligenceProofPanel` ·
`EcosystemContinuityPanel` · `PlatformMoatPanel` ·
`WorkspacePersonalizationPanel` · `ShareIntelligenceAsset` ·
`GrowthReferralPanel` · `IntelligenceFeedNotificationPanel`

**Duplicate / redundant**
Paper PnL (twice) · decision distribution (four computations) ·
`MarketTapeStrip` vs `MarketChartHub` comparison strip ·
`MyWatchlistWidget` vs right-rail Tracked Signals ·
Since Last Visit and What Changed each rendered twice inside
`UnifiedIntelligenceConsole` · two onboarding surfaces
(`FirstRunStarterCard` + `MarketOnboarding`)

## Target architecture

```
┌─ TerminalCommandBar  (sticky, ~56px)                                   ─┐
│  regime · scan freshness · ENTER count · alert count · refresh · icons  │
└────────────────────────────────────────────────────────────────────────┘
┌─ ActionableBoard  (first screen, no scroll)                            ─┐
│  DailyActionCard verdict + why                                          │
│  ENTER NOW  │  WATCH  │  WAIT FOR PULLBACK      (AVOID collapsed)       │
└────────────────────────────────────────────────────────────────────────┘
┌─ Tabs ─────────────────────────────────────────────────────────────────┐
│ Opportunities │ Watchlist │ Evidence │ Market │ Workflow                │
└────────────────────────────────────────────────────────────────────────┘
   right rail unchanged in content, sticky, unchanged data
```

Tab contents — every existing section keeps a home, nothing is deleted:

- **Opportunities** — `BestTradeNowCard`, Research Queue, `SignalHeatmap`,
  `DailyMarketCommandCenter`, `RiskTolerantOpportunityRadar`, `ShockMoveRadar`
- **Watchlist** — `MyWatchlistWidget`, watchlist changes, alerts detail
- **Evidence** — `UnifiedIntelligenceConsole`, `AICognitionLayerPanel`,
  `ExecutionIntelligencePanel`, `AdaptiveLearningInsightPanel`,
  `StrategyIntelligencePanel`, `ScenarioIntelligencePanel`,
  `PredictiveIntelligencePanel`, all grounding-boundary `<details>`
- **Market** — `GlobalMarketCommandCenter`, `MarketChartHub`,
  `MarketRegimeRadar`, `MarketTapeStrip`, `IntradayRegimeDriftPanel`,
  `RegimeShiftIntelligencePanel`
- **Workflow** — the retention/narrative/personalization group above

## Constraints held

- **No information deleted.** Every section listed above appears in exactly one
  tab. The redesign moves and layers; it does not remove.
- **No legal or risk copy touched.** 30 distinct disclaimer locations are
  inventoried (`CompactLegalNotice`, `LegalFooter`, `RiskAcknowledgement`,
  `DataHealthBanner`, the four `buildTodayActionReasons` stale-data branches,
  every `meta="research only"`, all four "Grounding boundary" `<details>`, the
  synthetic-data disclosure in `MarketChartHub`, `ShockMoveRadar`'s
  "Speculative · Research only"). Each keeps its component, so each moves with
  it.
- **No metric values change.** The board reads the same models
  (`buildDecisionDistribution`, `snapshot`, `clientRows`) that already feed the
  existing components. No new computation, no re-derivation, no new fetch.
- **No business logic, scanner decision, pricing, auth, entitlement or DB query
  behaviour changes.** The three route branches and every entitlement check stay
  exactly as they are.
- **No new dependency.** Tabs, drawers and collapses are `<details>`, CSS and
  existing React state. Animations are 150–250ms CSS transitions behind
  `prefers-reduced-motion`.
- **No synthetic data.** Empty states say what is missing.

## Sequencing (risk order, lowest first)

1. **Extract the inline sections.** `MarketTapeStrip`, `TerminalMonitoringBrief`,
   the Command Center panel, Research Queue and Paper Performance are defined
   inline inside `TerminalPremiumView.tsx`. They must become named components
   before anything can be reordered. Pure refactor, output byte-identical.
2. **Add `TerminalCommandBar`** — new component, reads existing props.
3. **Add `ActionableBoard`** — new component, reads existing models.
4. **Introduce the tab shell** and move sections into tabs, one group at a time,
   verifying after each.
5. **Chart, empty-state and motion polish.**

Stage 1 is verifiable by diffing rendered output. Stages 2–3 are additive.
Stage 4 is the only one that reorders, and it is done group by group so a
regression is attributable.

## Verification gates

typecheck · full test suite · `next build` · desktop and mobile browser check ·
console clean · no 4xx/5xx · no performance regression · every pre-existing
surface still reachable.

**Deploy gate: nothing from this branch reaches production until the 21:30 UTC
SNDK full-scan verification is complete and green.**
