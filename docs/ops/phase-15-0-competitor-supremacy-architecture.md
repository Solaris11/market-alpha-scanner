# Phase 15.0 Competitor Supremacy Architecture

Date: 2026-05-14

## Executive Summary

Phase 15.0 defines the canonical TradeVeto product architecture after the Phase 14 UX and trust hardening work. This is not a feature sprint. It is the operating model that future TradeVeto work should use to keep the product understandable, premium, evidence-aware, and faster to use than competing market tools.

The core architecture is:

- Terminal is the primary intelligence cockpit.
- Opportunities is setup discovery.
- Watchlist is tracked research.
- Alerts is condition monitoring.
- Symbol Detail is the deep analysis cockpit.
- Performance is scanner evidence review.
- History is what changed over time.
- Paper Trading is guided simulation.
- Strategy Labs is the research and simulation engine.
- Intelligence Feed is daily market awareness.
- Copilot is the explainable reasoning assistant.
- Dashboard is account, workspace, personalization, and productivity summary, not a duplicate Terminal.

The non-negotiable product rule for Phase 15 is simple: every screen must help users understand what changed, why it matters, what risk increased, what improved or weakened, what is stale, what requires confirmation, and where to go next.

## Source Control Baseline

Mandatory source-control parity check before this architecture document:

| Item | Result |
| --- | --- |
| Local branch | `main` |
| Local HEAD at start | `e99114f294a25a6950a1d99ded55df68b0a42a56` |
| Local worktree | Clean |
| Local commits ahead of `origin/main` | 0 |
| Local commits behind `origin/main` | 0 |
| Remote | `git@github.com:Solaris11/market-alpha-scanner.git` |

This document is the only Phase 15.0 source change.

## Canonical Product Mental Model

TradeVeto must be understandable in under 60 seconds. The product should be explained as a research-first market intelligence operating system with one primary cockpit and specialized workspaces around it.

| Surface | Canonical Role | User Question It Answers | Primary Next Action |
| --- | --- | --- | --- |
| Terminal | Intelligence cockpit | What matters now? | Open a zone, inspect a symbol, review daily brief |
| Opportunities | Setup discovery | What research candidates are worth reviewing? | Open opportunity detail or symbol detail |
| Watchlist | Tracked research | What changed in names I care about? | Review status change, create alert |
| Alerts | Condition monitoring | What conditions triggered or escalated? | Open alert detail, adjust rule |
| Symbol Detail | Deep analysis cockpit | Why does this symbol look this way? | Inspect chart, risk, replay, graph, or watch action |
| Performance | Scanner evidence review | How have recent signals behaved? | Review evidence quality and scanner behavior |
| History | Change timeline | What changed over time? | Open a change item and compare before/after |
| Paper Trading | Guided simulation | How would a researched idea behave if simulated? | Create or review a paper scenario |
| Strategy Labs | Research/simulation engine | Which strategy behavior is worth studying? | Run or compare simulations |
| Intelligence Feed | Daily awareness | What changed since the last session? | Open feed item, inspect related symbol |
| Copilot | Explainable reasoning assistant | Why did the system say this? | Ask grounded follow-up |
| Dashboard | Workspace/account summary | What is my workspace status? | Resume recent work, review preferences, continue onboarding |

## Terminal-First Architecture

Terminal is the canonical primary workspace. It should be the first place a beta user goes after onboarding, and it should remain the "home cockpit" for daily use.

Terminal responsibilities:

- Market overview
- Watchlist changes
- Best setups
- Clickable intelligence zones
- Daily brief
- Cognition timeline
- Alerts summary
- Quick symbol exploration
- Market risk context
- Intelligence feed
- Copilot entry

Dashboard responsibilities:

- Account/workspace summary
- Saved layouts
- Personalization summary
- Recent activity
- Onboarding progress
- Productivity overview
- Billing/account status shortcuts
- Support and setup completion status

Overlap rule:

- Dashboard must not recreate Terminal's "What Matters Now" cockpit.
- Dashboard may summarize the user's relationship with Terminal, but should link back to Terminal for intelligence work.
- If a Dashboard card starts answering "what matters in the market now," it belongs in Terminal.
- If a Terminal card starts answering "what is my account/workspace status," it belongs in Dashboard.

## Navigation Architecture

The navigation model should stay stable across desktop and mobile. Users should not have to learn different product maps on different devices.

Canonical primary navigation:

| Priority | Destination | Purpose |
| --- | --- | --- |
| 1 | Terminal | Main intelligence cockpit |
| 2 | Opportunities | Setup discovery |
| 3 | Watchlist | Tracked research |
| 4 | Alerts | Condition monitoring |
| 5 | Dashboard | Workspace/account summary |

Canonical More menu grouping:

| Group | Destinations | Rule |
| --- | --- | --- |
| Research | Performance, History, Paper Trading, Strategy Labs | Secondary research workspaces |
| Intelligence | Intelligence, Intelligence Graph, Feed, Copilot when separate | Advanced explanation and context surfaces |
| Setup | Mobile App Setup, Settings, Account, Support | User setup and support |
| Public/community | Team, Community, Developers | Only if intentionally in beta scope |
| Admin | Admin, internal tools | Admin users only |

Navigation rules:

- No duplicate navigation rows.
- No mobile-specific nav pattern on desktop unless it is intentionally a responsive adaptation.
- No admin/developer/internal destinations for normal users.
- "Mobile" must be labeled as "Mobile App Setup" or "Install TradeVeto" when user-facing.
- Every nav item must have a consistent icon, label, route, and purpose.
- A route in public nav must not 404 in production.
- Routes intentionally hidden from beta must be removed from nav, sitemap, and launch-gate scope.

Current canonical code anchor:

- `frontend/src/lib/navigation.ts`

## Global Interaction Standard

Every detail interaction must use one shared overlay standard. Phase 14.10 introduced `StableDetailOverlay`; Phase 15 should treat this as the canonical implementation layer or wrap it with clearer names such as `DetailSurface`, `IntelligenceSheet`, or `MobileBottomSheet`.

No one-off side drawers or offscreen detail panels should be added.

Desktop behavior:

- Detail opens centered in the current viewport.
- No page jump.
- No scroll-to-bottom behavior.
- No offscreen right, left, or bottom placement.
- User does not need to scroll to see the detail surface.
- X closes.
- ESC closes.
- Backdrop click may close when safe.
- Closing restores the user's previous scroll position.

Mobile behavior:

- Detail opens as a bottom sheet or full-screen sheet.
- Close control is visible immediately.
- No hidden offscreen content without clear scroll affordance.
- Back button behavior must not break the page state.
- Closing restores the user's previous scroll position.
- Tap targets must be large enough for thumb use.

Interaction audit rule:

Every clickable card, zone, chart, graph node, feed item, alert, watchlist item, opportunity, history item, paper trade, strategy lab card, and cognition timeline item must use the shared detail standard.

## Canonical Information Hierarchy

Every page should visually prioritize the same hierarchy:

1. What changed
2. Why it matters
3. Risk state
4. Evidence quality
5. What to monitor
6. Optional deep detail

This replaces older patterns where users had to parse raw tables, long explanations, internal metrics, or dense cards before understanding the next useful action.

Page-level application:

| Page | First Layer | Second Layer | Deep Layer |
| --- | --- | --- | --- |
| Terminal | What changed and what matters now | Risk, opportunity, watchlist, shock, macro zones | Full zone detail and symbol detail |
| Opportunities | Best research candidates | Score/risk/evidence/price context | Full symbol or opportunity breakdown |
| Watchlist | Tracked symbols that changed | Setup evolution and alert state | Symbol detail and alert rule detail |
| Alerts | Active severity and recent triggers | Trigger reason and symbol context | Alert detail and rule edit |
| Symbol Detail | Decision state, chart, price, risk | Factor breakdown, replay, graph, what changed | Full chart, replay, event, cognition detail |
| Performance | Recent scanner behavior | Evidence quality and what worked/did not work | Tables and grouped evidence |
| History | Timeline of changes | Before/after state and reason | Full scan item detail |
| Paper Trading | Simulation cockpit state | Open/closed trades, PnL, risk exposure | Trade review and scenario detail |
| Strategy Labs | Simulation overview | Strategy behavior, drawdown, regime comparison | Deep test and assumptions |
| Dashboard | Workspace status | Recent activity, preferences, onboarding | Account/settings/support detail |

## Universal Card System

All major cards should share a predictable contract while retaining visual identity by section type.

Required card fields where applicable:

- Title
- Symbol or context
- Company/asset identity when symbol-based
- Score, risk, and confidence chips
- Price context
- Entry zone when available
- Stop loss or invalidation area when available
- Target or profit-taking area when available
- Freshness label
- One-line "why this matters"
- Evidence quality label
- Primary action
- Open detail affordance

Price data rules:

- Do not fake live prices.
- Use "Last close," "Latest available," "Delayed," or "Data unavailable."
- Entry, stop, and target must be calculated from real fields or shown as unavailable.
- A price card without reliable price data must not imply precision.

Card hierarchy:

| Card Type | Visual Identity | Primary Meaning |
| --- | --- | --- |
| Opportunity | Cyan/green confidence with risk chips | Research candidate worth reviewing |
| Risk | Orange/red pressure | Caution, danger, invalidation, fragility |
| Replay | Purple/cyan memory | Historical or before/after context |
| Macro | Blue/orange regime | Market environment and pressure drivers |
| Alert | Severity color by trigger | Condition changed or threshold hit |
| Watchlist | Personal symbol state | Tracked setup evolution |
| Cognition | Cyan/purple timeline | Reasoning changed over time |
| Feed | Compact semantic status | Daily market awareness |
| Strategy | Purple/blue simulation | Research and scenario behavior |
| Paper Trading | Green/yellow simulation state | Guided simulated trade tracking |

Card behavior:

- Cards are scannable first, explainable second.
- Long explanation belongs behind "Why?", "Details," or expansion.
- Default visible paragraphs should not exceed 2-3 short lines.
- Every clickable card must use the shared detail surface.

## Universal Empty State System

Every empty state must answer:

1. What this page or module does
2. Why it is empty
3. What the user should do next
4. What data will eventually appear
5. Whether the empty state is due to limited evidence, user setup, market state, or permissions

Approved empty state language:

- "No validated history yet."
- "Evidence is still maturing."
- "No replay context available for this symbol yet."
- "No tracked symbols yet. Add a symbol to start monitoring changes."
- "Data unavailable for this timeframe."
- "This view will fill in after enough scans complete."
- "Research context unavailable."

Forbidden empty states:

- Blank panels
- Raw dashes without explanation
- Developer/debug language
- Dead-end "No data" screens with no next action

## Universal User Language System

Allowed user-facing language:

| Preferred Term | Meaning |
| --- | --- |
| Research signal | Non-advisory signal context |
| Evidence quality | Strength and maturity of supporting data |
| Confidence | Internal certainty/context quality, not guaranteed outcome |
| Risk pressure | Current downside/fragility environment |
| Monitor | Watch for confirmation or deterioration |
| Requires confirmation | Not ready for action without more evidence |
| Stale | Signal age or freshness has weakened |
| Recent scanner behavior | How recent signals have behaved |
| Latest available data | Honest non-live data label |
| Limited data | Insufficient sample or timeframe |
| What changed | Difference since last scan/session |
| Why this matters | User-facing explanation |
| What to monitor | Next research focus |

Forbidden in normal user UI:

| Forbidden Term | Replacement |
| --- | --- |
| lifecycle proof | billing/status check or remove from user UI |
| deterministic packet | grounded data context |
| forward-return observations | recent signal history |
| VAPID | browser push setup, or hide from user UI |
| wrapper/signing workflow | mobile app setup, or hide from user UI |
| pyright | hide from user UI |
| health/deep | system status, admin only |
| calibration review | scanner behavior review |
| auto-tune | automatic adjustment, or remove |
| production validation | system check, admin only |
| scanner internals | scanner behavior, if user-facing |

Legal and trust language:

- Use "research only."
- Use "not financial advice."
- Use "not a recommendation to buy or sell."
- Use "manage your own risk."
- Never imply guaranteed outcomes, certainty, or hidden alpha.

## Universal Self-Explaining UX

Every advanced page must include a beginner-safe "How to use this page" pattern.

Required pattern:

- Short headline
- 2-3 sentence explanation
- Up to 3 visual steps
- One example action
- Collapsible after the user understands it

Required pages:

- Opportunities
- Performance
- History
- Strategy Labs
- Paper Trading
- Intelligence Graph
- Alerts
- Watchlist
- Copilot
- Feed

Example:

"Use this page to review how past signals behaved. It helps you understand scanner quality, not guaranteed future performance."

## Mobile-First Architecture

Mobile is not compressed desktop. It is the fastest path to understanding what changed and what needs attention.

Mobile hierarchy:

1. Terminal overview
2. Opportunities
3. Watchlist
4. Alerts
5. Dashboard/account
6. More for low-frequency research surfaces

Mobile requirements:

- One primary nav system.
- Sticky bottom nav for primary workflows.
- More menu grouped by user intent.
- Detail opens as bottom sheet or full-screen sheet.
- Close button always visible.
- No horizontal overflow.
- No tiny chart labels.
- No long text walls by default.
- Swipeable cards need visible affordance or page dots.
- Charts need full-screen mode or large detail mode.
- "Back to overview" must be obvious after deep drill-down.
- Same scroll position after modal close.

Mobile information rule:

One card should communicate one idea, one status, one visual, and one next action.

## Visual System Standardization

TradeVeto should use a consistent, licensed-safe visual system.

Icon standards:

- Lucide React is the primary icon system.
- Use secondary icon systems only when Lucide lacks a needed symbol.
- Do not mix unrelated icon packs on the same surface.
- Standard sizes: 16px, 20px, 24px, 32px.
- Use consistent stroke widths.
- Icons must clarify meaning; decorative-only icons should be avoided.

Semantic colors:

| Color Family | Meaning | Advisory Risk |
| --- | --- | --- |
| Green | Constructive, improving, supportive | Must not imply "buy" |
| Yellow | Caution, monitor, incomplete | Must not imply "hold" |
| Orange | Elevated risk, pressure rising | Must not imply "sell" |
| Red | Dangerous, invalidation, severe risk | Must remain research framing |
| Purple/Cyan | Replay, intelligence, cognition, AI context | Must stay explainable |
| Blue | Neutral, system, navigation | Safe default |

Visual component standards:

- Chips communicate state, not decoration.
- Badges must have plain-language meaning.
- Freshness indicators must map to real timestamps.
- Alert indicators must map to real trigger types.
- Sparklines must be real data-backed or absent.
- Factor bars must map to real factor values.
- Gauges must explain scale and data source.
- Chart markers must have tooltips or detail explanations.
- Hover/tap states must be subtle and consistent.

Section differentiation:

| Section | Visual Signature |
| --- | --- |
| Opportunities | Cyan/green confidence, sector/logo identity, compact price context |
| Risk | Yellow/orange/red pressure, invalidation, caution language |
| Replay | Purple/cyan memory, before/after, historical context |
| Macro | Blue/orange regime, cross-asset and breadth context |
| Alerts | Severity chips, trigger icon, timestamp |
| Watchlist | Personal tracking state, setup evolution |
| Cognition | Timeline, stale/improved/weakened states |
| Feed | Compact event cards, timestamps, related symbols |
| Strategy | Purple/blue simulation, risk/drawdown visuals |
| Paper Trading | Guided simulation, PnL/risk exposure, non-live labels |

## Modular Intelligence Panel System

TradeVeto should be built from modular intelligence panels. Panels must stand alone, connect contextually, expand progressively, and communicate purpose instantly.

Panel contract:

- Panel type
- Purpose
- Primary data source
- Last updated timestamp
- One-line summary
- Risk state
- Evidence quality
- Freshness state
- Related symbols or routes
- Primary action
- Detail action
- Empty state
- Research-only caveat where relevant

Canonical panel examples:

| Panel | Purpose | Must Show |
| --- | --- | --- |
| Replay panel | Explain historical context | Before/after, similarity, evidence maturity |
| Risk panel | Explain pressure and invalidation | Risk category, drivers, what would improve |
| Macro panel | Explain market environment | Regime, breadth, volatility, liquidity, cross-asset context |
| Feed panel | Show daily changes | What changed, timestamp, related symbol, action |
| Watchlist panel | Track personal research | Status change, confidence change, alert state |
| Cognition panel | Show reasoning evolution | Previous state, current state, contradiction, stale signals |
| Scanner panel | Show discovery logic | Score, factor breakdown, evidence, freshness |
| Confidence panel | Show certainty context | Confidence value, trend, data limitations |

Panel rule:

If a panel cannot explain what powers it, why it is visible, and what the user should monitor next, it should not ship.

## Competitor Supremacy Architecture Targets

These are product architecture targets, not claims that TradeVeto currently beats every product in every dimension.

| Competitor Strength | TradeVeto Architecture Response |
| --- | --- |
| TradingView chart workflow | Add chart-linked intelligence, replay markers, source labels, timeframe-aware detail, and symbol context |
| Robinhood mobile simplicity | Keep mobile nav narrow, one action per card, bottom sheets, clear defaults, no dense admin screens |
| Bloomberg trust and information layering | Preserve evidence labels, freshness, risk language, and institutional information hierarchy |
| TrendSpider setup visualization | Make setup quality visual, chart-linked, explainable, and tied to invalidation/context |
| Trade Ideas scanner workflow | Keep Opportunities fast, ranked, filterable, and explain why a symbol appeared |
| Composer strategy simplicity | Make Strategy Labs beginner-safe with simulation caveats and visual walkthroughs |
| Danelfin AI score clarity | Explain confidence, contradiction, and score drivers without "AI magic" |
| Finviz scanability | Keep high-density lists visual, fast, logo-supported, and filterable |
| StockTitan habit loop | Use feed, alerts, watchlist changes, and daily brief to create a non-spam return loop |

## Validation Checklist

Every future Phase 15 change should be validated against this checklist:

- Product mental model remains clear in under 60 seconds.
- Terminal remains the primary cockpit.
- Dashboard does not duplicate Terminal.
- Primary navigation remains stable.
- No duplicate navigation systems.
- No normal-user internal/admin language.
- No dead-end empty states.
- No fake charts, fake overlays, fake scores, fake relationships, or fake live prices.
- All detail surfaces open centered or as mobile sheets.
- No scroll jump.
- X close works.
- ESC close works on desktop.
- Mobile close control is visible.
- Symbol names are clickable when used as navigation context.
- Cards include price/freshness/evidence when data exists.
- Missing data is labeled honestly.
- Every important score and visual has an explanation path.
- Mobile has no hidden horizontal overflow.
- Normal users never see admin-only tools.
- Non-advisory framing remains intact.

## Remaining Architectural Debt

Phase 15.0 defines the architecture, but the following debt remains to be enforced or deepened in later sprints:

- The shared detail primitive exists as `StableDetailOverlay`; a clearer product-level wrapper such as `DetailSurface` or `IntelligenceSheet` should be added only if it reduces future one-off implementations.
- The universal card contract is documented but not yet enforced by a typed component across every page.
- Visual tokens are partially implemented through local CSS/Tailwind conventions; they should become explicit design tokens if drift appears.
- Dashboard still needs real beta behavior data to confirm it feels like workspace summary rather than a secondary Terminal.
- Chart interaction still needs deeper TradingView-style overlays, zoom/pan, marker explanations, and comparison workflows in future phases.
- Intelligence Feed and Notifications need real cohort tuning to prevent spam and prove retention value.
- Mobile PWA still needs repeated real-device Safari, Android Chrome, and social in-app browser validation.
- Some advanced pages still need continued pressure toward "overview first, detail on demand."

## Future Phase 15 Merge Gate

A Phase 15 change should not merge if it introduces any of the following:

- Static dashboard blocks that look clickable but are not.
- One-off modals or side drawers.
- Fake or decorative market-looking charts.
- Internal engineering language in normal user UI.
- Duplicate navigation.
- Offscreen mobile detail views.
- Empty panels without explanation and next action.
- Advisory wording.
- Performance regression from visual richness.

## Final Status

PHASE 15.0 COMPETITOR SUPREMACY ARCHITECTURE COMPLETE
