# Phase 11.11 Public Beta Onboarding + First-Run Experience

Date: 2026-05-10

## Scope

This sprint focused on first-run clarity rather than adding another intelligence layer. The audited path was homepage/sign-in, account setup, terminal first run, opportunities, watchlist empty state, and decision-memory empty state.

## Changes

- Account setup now asks users to choose a starting path: Beginner, Intermediate, or Advanced.
- Successful account setup routes users to `/terminal?firstRun=1` so the first useful action is the decision console, not a dead-end account page.
- Terminal surfaces a dismissible Start Here card until the walkthrough is completed or hidden.
- The Start Here card offers Beginner and Advanced starter paths, a walkthrough trigger, and direct links to Terminal and Opportunities.
- Terminal onboarding copy now explains WAIT-first behavior, risk/reward controls, and symbol-detail research in plain language.
- The unified console is marked as the primary onboarding target for "What Matters Most Now."
- Empty watchlist and decision-memory states now explain the next action and include direct CTAs.
- Mobile risk acknowledgement now wraps correctly and stays inside the viewport before the walkthrough appears.

## Beginner Flow

1. Complete profile setup.
2. Land on `/terminal?firstRun=1`.
3. Read What Matters Most Now.
4. Open one opportunity or symbol detail page.
5. Add 3-5 familiar symbols to the watchlist.
6. Use alerts/journal entries after the user has one symbol context.

## Advanced Flow

1. Complete profile setup.
2. Land on `/terminal?firstRun=1`.
3. Review priority queue and market state.
4. Open Full Universe opportunities with risk/reward filters.
5. Check Strategy Labs and symbol detail evidence before trusting a setup.

## UX Clarity Notes

- WAIT is explained as a decision state, not a negative failure state.
- Risk/reward filters are framed as research controls, not trade commands.
- Symbol detail is positioned as the next step after the console.
- Watchlist setup is framed as the way TradeVeto learns what changed for the user.

## Remaining Pain Points

- First-run still depends on browser local storage rather than a persisted server-side onboarding state for starter-card dismissal.
- The account setup modal does not yet include a visual preview of the terminal console.
- Free users still see a limited first-run flow because premium trade-plan details remain gated.
- A native mobile onboarding flow will need a separate pass before iOS/Android launch.

## Visual QA Artifacts

- Desktop first-run tour: `/tmp/tradeveto-onboarding-audit/terminal-onboarding-tour-desktop.png`
- Mobile first-run tour: `/tmp/tradeveto-onboarding-audit/terminal-onboarding-tour-mobile.png`
- Mobile risk acknowledgement: `/tmp/tradeveto-onboarding-audit/risk-ack-mobile.png`
