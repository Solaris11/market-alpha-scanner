# Phase 12.2 Product Simplification Audit

Date: 2026-05-10

Final status: PRODUCT SIMPLIFICATION AUDIT COMPLETE

## Scope

This audit reviewed the product surfaces most likely to overwhelm new and returning TradeVeto users:

- Terminal
- Dashboard
- Opportunities
- Symbol detail
- Strategy Labs
- Replay / History
- Portfolio / Scenario
- Account / Settings
- Onboarding
- Mobile workflows

The audit combined code-level route inspection with local desktop/mobile screenshot capture. Screenshots were captured in local unauthenticated/public-preview mode, so some premium and live-data states appear locked or degraded. The route/component audit covers the authenticated/premium composition where the largest complexity risk exists.

Screenshot directory:

`artifacts/phase-12-2-product-simplification/screenshots`

## Executive Verdict

TradeVeto has strong depth, but the primary UX now exposes too many intelligence systems at once. The product risks feeling like many smart panels stacked together instead of one simple decision workspace.

The biggest simplification opportunity is not deleting intelligence. It is changing the hierarchy:

1. Show one clear answer first: what matters now.
2. Show one clear next action: what to inspect or watch.
3. Hide deep evidence behind progressive disclosure.
4. Move operator/research-grade panels out of primary user workflows.

The product should keep its institutional depth, but the default experience should become much simpler.

## Primary Complexity Drivers

### 1. Too Many Top-Level Intelligence Panels

The Terminal and Opportunities pages both mount many of the same systems:

- Meta Intelligence / Unified Console
- Intraday Regime Drift
- Adaptive Learning
- Strategy Intelligence
- Scenario Intelligence
- Execution Intelligence
- Workflow Evolution
- Institutional Intelligence
- Risk-Tolerant Radar
- Shock Move Radar

This creates repetition and makes each page feel like a dashboard index rather than a guided workflow.

### 2. Duplicated "What Matters" Logic

The Terminal, Dashboard, Opportunities, and some symbol pages all compete to summarize market state, opportunity priority, risk, regime drift, and institutional context.

Recommendation: the Terminal should own the daily "What Matters Most Now" experience. Other pages should show compact context only when it directly supports the page task.

### 3. Advanced Evidence Appears Before Core Task Completion

Opportunities currently front-load many context panels before the user reaches the core job: browse, filter, and compare symbols.

Recommendation: Opportunities should open with ranking controls, risk/reward mode, and the opportunity table/cards. Advanced proof panels should be secondary tabs or expandable context.

### 4. Symbol Detail Is Too Exhaustive By Default

Symbol detail exposes most Phase 7-11 intelligence systems in a long vertical stack. This is powerful but makes it hard to answer:

- Why does this symbol matter?
- Is this early or late?
- What should I watch?
- What could break the setup?

Recommendation: symbol detail should use a three-layer structure: Overview, Timing, Evidence.

### 5. Navigation Exposes Too Much Product Surface

Desktop navigation includes both primary routes and low-frequency utility/advanced routes. This increases "where do I click first?" confusion.

Recommendation: primary navigation should be limited to the daily workflow. Labs, dashboard maps, developer routes, team/community, and advanced proof tools should move under More / Advanced.

## Route-by-Route Findings

## Terminal

Current role:
Daily command center and market operating console.

Observed complexity:

- Terminal combines daily action, unified console, live intelligence, research agents, market tape, monitoring, regime drift, adaptive learning, strategy, scenario, execution, workflow, institutional context, best trade, shock radar, risk-tolerant radar, heatmaps, watchlist, paper performance, and AI assistant.
- The local first-run screenshot shows the risk acknowledgement modal blocking the first read of the product.
- Many panels repeat the same high-level idea: market state, risks, opportunities, and changes.

Simplification recommendation:

- Keep Terminal as the only default "What Matters Most Now" page.
- Above the fold should contain only:
  - Daily action / core market state
  - Top 3 opportunities
  - Top 3 risks
  - Biggest changes
  - Watchlist changes
  - One clear CTA to Opportunities or Symbol Detail
- Move advanced systems into an "Advanced Intelligence" drawer or tabs:
  - Regime Drift
  - Adaptive Learning
  - Strategy Intelligence
  - Scenario Intelligence
  - Institutional Intelligence
  - Automated Research Agents

Merge candidates:

- Live Intelligence + Intraday Regime Drift + Regime Shift Intelligence -> Market State Changes
- Adaptive Learning + Strategy Intelligence + Evidence/Calibration -> Proof & Calibration
- Best Trade Now + Risk-Tolerant Radar + Shock Move Radar -> Opportunity Radar
- Workflow Evolution + Watchlist + Alerts -> Your Watchlist Changes

## Dashboard

Current role:
Institutional market dashboard and heatmap workspace.

Observed complexity:

- Dashboard duplicates Terminal's unified intelligence summary, then adds heatmaps, clusters, opportunity maps, shock maps, and briefing panels.
- It competes with Terminal for "main command center" status.

Simplification recommendation:

- Reposition Dashboard as Advanced Market Map.
- Remove or compress the unified console on Dashboard to a one-line market brief.
- Keep Dashboard focused on:
  - heatmaps
  - opportunity clusters
  - market pressure maps
  - shock clusters
  - institutional maps
- Link back to Terminal for the final daily priority answer.

## Opportunities

Current role:
Browse and rank current opportunities.

Observed complexity:

- Many intelligence panels appear before the filter/table workflow.
- Full-universe ranking is less visually dominant than context modules.
- Shock/risk-tolerant/strategy/institutional sections overlap in meaning for most users.

Simplification recommendation:

- First screen should prioritize:
  - risk/reward mode
  - setup tab
  - search/filter
  - Top 5 results
  - why each result appears
- Move advanced context into tabs:
  - Context
  - Shock Evidence
  - Strategy Proof
  - Institutional View
- Keep one compact "why this list changed" summary.

Recommended default layout:

1. Risk/Reward controls
2. Opportunity tabs: Core, Risk-Tolerant, Pullback, Shock, Momentum
3. Top results
4. Filters
5. Advanced context collapsed

## Symbol Detail

Current role:
Full research workspace for a symbol.

Observed complexity:

- Symbol detail stacks nearly every intelligence subsystem.
- The page is comprehensive but not simple enough for first-pass decision clarity.
- Several panels answer overlapping questions about macro, event, shock, execution, and institutional quality.

Simplification recommendation:

Use three primary tabs:

1. Overview
   - Current decision
   - Why it matters
   - Key risk
   - What to watch next
   - Evidence maturity
2. Timing
   - Entry quality
   - Pullback / confirmation state
   - Invalidation area
   - Chase risk
   - Historical exit zone
3. Evidence
   - Shock memory
   - Market memory
   - Macro/event context
   - Replay / historical proof
   - Advanced institutional/strategy/scenario panels

The first screen should answer the user's practical questions before showing deep research detail.

## Strategy Labs

Current role:
Proof and simulated strategy research.

Observed complexity:

- Strategy Labs is more focused than the main intelligence pages, but still dense.
- It should remain a proof/research surface, not a primary onboarding destination.

Simplification recommendation:

- Keep as an advanced route.
- Above the fold should show:
  - active simulated strategies
  - performance vs benchmark
  - max drawdown
  - "why the model acted" summary
- Move detailed trade logs and metrics into expandable sections.

## Replay / History

Current role:
Historical playback and proof.

Observed complexity:

- "History" reads like a generic historical table, while the actual product value is "Replay what TradeVeto knew."
- The user can land in an empty or abstract state without a clear case study.

Simplification recommendation:

- Rename or label as Replay / Proof.
- Default state should offer example replay studies:
  - AMD before a large move
  - MU shock setup
  - QQQ regime deterioration
- Table view should be secondary.
- Core CTA: "Replay a date or symbol."

## Portfolio / Scenario

Current role:
Portfolio exposure and stress-test analysis.

Observed complexity:

- Exposure, correlation, concentration, scenario, heatmap, and trust-boundary content can appear in one dense workspace.

Simplification recommendation:

Use three layers:

1. Portfolio Summary
   - quality score
   - biggest concentration
   - biggest fragility
   - strongest hedge/offset
2. Stress Tests
   - QQQ selloff
   - VIX spike
   - rates surge
   - oil shock
3. Advanced Math
   - rolling correlation
   - covariance clusters
   - exposure tables
   - methodology

## Account / Settings

Current role:
Account, subscription, onboarding gate, profile, security, risk preferences, memory/privacy, watchlist, alerts, and decision memory.

Observed complexity:

- Too many unrelated account concepts share one page.
- Privacy and memory controls are important enough to be discoverable, but not mixed into billing/security noise.

Simplification recommendation:

Split into tabs or grouped sections:

- Account
- Billing
- Preferences
- Memory & Privacy
- Notifications
- Security

Memory controls should clearly answer:

- What is remembered?
- Why is it used?
- How do I delete/export/disable it?

## Onboarding

Current role:
First-run education and setup.

Observed complexity:

- Product concepts are powerful but numerous: WAIT-first, risk/reward, fragility, asymmetry, proof, replay, shock intelligence, portfolio, strategy labs.
- Advanced proof workflows should not be first-run tasks.

Simplification recommendation:

First-run should have only three jobs:

1. Read "What Matters Most Now."
2. Add or inspect one symbol.
3. Understand one recommendation: opportunity, wait, or avoid chase.

Advanced concepts should be introduced after the first useful action.

Recommended first-run paths:

- Beginner: "Show me what matters today."
- Active trader: "Find opportunities."
- Research-focused: "Replay proof."

## Mobile Workflows

Observed complexity:

- Mobile navigation is more focused than desktop.
- The main risk is dense cards and long stacked intelligence panels.

Simplification recommendation:

- Mobile should prioritize one-card-at-a-time decision flow.
- Use sticky mode controls only when necessary.
- Collapse advanced detail by default.
- Avoid placing multiple score chips or dense metric grids side by side.
- Use "Why / Watch / Risk" accordions on symbol pages.

## Duplicated Panel Map

| Intelligence function | Appears across | Simplification |
| --- | --- | --- |
| What matters now | Terminal, Dashboard, Opportunities | Terminal owns it; others show compact context |
| Market state/regime drift | Terminal, Dashboard, Symbol, Opportunities | Merge into Market State Changes |
| Shock/risk-tolerant opportunities | Terminal, Opportunities, Symbol | Merge into Opportunity Radar with page-specific detail |
| Adaptive/strategy/calibration proof | Terminal, Opportunities, Dashboard, Symbol | Merge into Proof & Calibration, advanced by default |
| Institutional/market pressure | Terminal, Dashboard, Opportunities, Symbol | Dashboard owns map; Symbol gets compact context |
| Scenario/execution intelligence | Terminal, Opportunities, Symbol, Portfolio | Keep execution on Symbol/Opportunities, scenario on Portfolio/Symbol advanced |
| Watchlist/workflow evolution | Terminal, Symbol, Account/Memory | Create Watchlist Changes surface |
| Copilot/reasoning | Terminal, Symbol, advanced routes | Keep as assistive drawer, not another dashboard section |

## Panel Priority Ranking

### P0: Must-See

These should be visible without digging:

- Core market state
- What Matters Most Now
- Top opportunities
- Top risks
- Biggest changes
- Watchlist changes
- Symbol decision summary
- Symbol action context
- Evidence maturity label

### P1: Primary Workflow

These support the user's immediate task:

- Opportunity table/cards
- Risk/reward controls
- Setup filters
- Search
- Entry quality
- Pullback/confirmation status
- Chase warning
- Invalidation area
- Replay summary

### P2: Secondary Evidence

These build trust but should not dominate first view:

- Shock pattern memory
- Market memory
- Macro/event context
- Calibration labels
- Strategy proof summary
- Portfolio exposure summary
- Scenario summary

### P3: Advanced Detail

These should be collapsed, tabbed, or moved under Advanced:

- Full adaptive learning detail
- Full institutional heatmaps
- Automated research agents
- Full rolling correlation matrix
- Raw replay tables
- Full strategy trade logs
- Developer/team/community routes
- Detailed methodology panels

## Simplified Information Architecture

Recommended primary IA:

1. Terminal
   - What Matters Most Now
   - Top opportunities
   - Top risks
   - Biggest changes
   - Watchlist changes
2. Opportunities
   - Rank and filter the universe
   - Risk/reward mode
   - Setup tabs
   - Compact evidence labels
3. Symbol
   - Overview
   - Timing
   - Evidence
   - Journal
4. Watchlist
   - Improving
   - Deteriorating
   - Alerts
   - Trigger proximity
5. Replay & Proof
   - Historical playback
   - Strategy performance proof
   - Calibration evidence
6. Portfolio Lab
   - Portfolio quality
   - Stress tests
   - Advanced correlation
7. Advanced
   - Institutional dashboard
   - Strategy Labs
   - Heatmaps
   - Adaptive learning
   - Developer/API
   - Team/Community
8. Account / Settings
   - Billing
   - Preferences
   - Memory & Privacy
   - Notifications
   - Security

## Recommended Merges / Removals

### Merge

- `LiveIntelligencePanel`, `IntradayRegimeDriftPanel`, and `RegimeShiftIntelligencePanel` into `MarketStateChanges`.
- `BestTradeNowOpportunityCard`, `RiskTolerantOpportunityRadar`, and `ShockMoveRadar` into `OpportunityRadar`.
- `AdaptiveLearningInsightPanel`, `StrategyIntelligencePanel`, and calibration/evidence labels into `ProofAndCalibration`.
- `WorkflowEvolutionPanel`, watchlist urgency, and alert drift into `WatchlistChanges`.
- Scenario and portfolio stress-test logic into `PortfolioLab`, with compact symbol-level excerpts.

### Collapse By Default

- Institutional detail on Terminal and Opportunities.
- Full strategy metrics outside Strategy Labs.
- Adaptive learning detail outside admin/proof surfaces.
- Raw replay/history tables.
- Developer/team/community links for non-advanced users.

### Remove From Primary First-Run

- Strategy Labs as a first-run CTA.
- Advanced Dashboard as a primary beginner path.
- Dense methodology language on user-facing opportunity cards.

## Language Simplification Targets

TradeVeto should reduce repeated abstract phrases and make the practical meaning clear.

Examples:

| Current style | Preferred style |
| --- | --- |
| Shock-pattern support visible | Historically similar setups produced strong upside moves |
| Elevated fragility environment | The setup can still work, but the downside is easier to trigger |
| Macro conflict remains material | The broader market is not fully supporting this move |
| Risk-tolerant opportunity candidate | Interesting only if you accept higher risk |
| Evidence maturity developing | There is useful history, but not enough for high confidence |

## Must-See vs Advanced Detail Hierarchy

Default user view:

- One sentence: what matters now.
- One list: best opportunities.
- One list: biggest risks.
- One action: inspect, watch, or wait.

Advanced detail:

- Why the ranking exists.
- What historical evidence supports it.
- What changed recently.
- What would invalidate it.
- What the system is still uncertain about.

## Screenshot Inventory

Captured screenshots:

- `terminal-desktop.png`
- `terminal-mobile.png`
- `opportunities-desktop.png`
- `opportunities-mobile.png`
- `dashboard-desktop.png`
- `symbol-amd-desktop.png`
- `strategy-labs-desktop.png`
- `history-desktop.png`
- `paper-desktop.png`
- `account-desktop.png`
- `mobile-page-mobile.png`

Important screenshot findings:

- Terminal first-read can be blocked by risk acknowledgement.
- Public/local preview mode shows multiple locked/advanced surfaces, reinforcing the need for clearer progressive disclosure.
- Mobile route focus is better than desktop, but dense metric/card layouts remain the main risk.

## Recommended Implementation Sequence

### Step 1: Simplify Navigation

- Primary: Terminal, Opportunities, Watchlist, Alerts, Account.
- More / Advanced: Dashboard, Replay, Portfolio Lab, Strategy Labs, Developers, Team, Community.
- Hide unavailable or unfinished routes from public navigation.

### Step 2: Create Shared Progressive Disclosure Pattern

Add consistent section groups:

- Summary
- What to watch
- Evidence
- Advanced

Use this on Terminal cards, Opportunity cards, Symbol detail, Portfolio, and Replay.

### Step 3: Rebuild Terminal Above the Fold

Terminal should show:

- What matters now
- Top 3 opportunities
- Top 3 risks
- Biggest changes
- Watchlist changes

Everything else moves behind Advanced Intelligence.

### Step 4: Rebuild Opportunities First Screen

Opportunities should start with:

- Risk/reward controls
- Setup tabs
- Filter/search
- Top results
- Why each result appears

Advanced panels become secondary context.

### Step 5: Rebuild Symbol Detail Into Tabs

Tabs:

- Overview
- Timing
- Evidence
- Journal

### Step 6: Rename History To Replay / Proof

The route can stay the same, but UI copy should frame the value as replay and evidence.

### Step 7: Split Account Settings

Separate billing, preferences, memory/privacy, notifications, and security.

## Remaining Risks

- The product has enough advanced systems that removing visible panels may feel like hiding value unless the summary layer becomes excellent.
- Premium-gated and public preview states need special care so locked pages do not feel like dead ends.
- Symbol detail simplification requires careful information architecture, not just accordion wrapping.
- Some route names and nav labels still reflect internal architecture more than user jobs.
- The first-run risk acknowledgement needs a lighter interaction model without weakening required risk disclosure.

## Success Criteria For Simplification Work

TradeVeto should pass these checks:

- A new user can identify the primary action within 10 seconds on Terminal.
- Opportunities page shows actual ranked symbols before advanced context.
- Symbol detail answers "Why, what to watch, what risk, what evidence" above the fold.
- Mobile pages avoid dense side-by-side metric grids.
- Advanced systems remain discoverable without dominating the default workflow.
- The same market-state summary is not repeated in more than one major panel on the same page.
