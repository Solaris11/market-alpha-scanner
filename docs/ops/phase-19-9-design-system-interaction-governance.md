# Phase 19.9 - Design System + Interaction Governance

Date: 2026-05-21

Final status: TRADEVETO DESIGN SYSTEM + INTERACTION GOVERNANCE ACCOMPLISHED

## Scope

Phase 19.9 created a durable governance layer for TradeVeto's cinematic intelligence UI so motion, overlays, charts, scanner interactions, spacing, focus behavior, and mobile sheets do not drift as the product grows.

## Implemented Systems

### Global Design Tokens

Expanded root CSS tokens in `frontend/src/app/globals.css` for:

- spacing
- radius
- border opacity
- glass hierarchy
- shadow depth
- z-index hierarchy
- motion timing
- easing curves
- focus ring and outline

These tokens now define the canonical base for premium panels, overlays, controls, charts, and mobile sheets.

### Motion Governance

Added canonical motion tiers:

- instant: 90ms
- fast: 150ms
- standard: 260ms
- slow: 520ms

The governance layer keeps tap, hover, overlay, chart, and page transitions within a bounded calm-motion system.

### Overlay Governance

Added canonical overlay classes:

- `tv-overlay-root`
- `tv-governed-backdrop`
- `tv-governed-overlay-surface`
- `tv-governed-overlay-header`
- `tv-governed-bottom-sheet`
- `tv-governed-discovery-surface`

Applied these to:

- `StableDetailOverlay`
- `GlobalIntelligenceDiscovery`

The existing scroll-lock, escape close, mobile viewport, drag-to-close, reduced-motion, and stable scroll restoration behavior remains intact.

### Interaction Governance

Added canonical classes for:

- `tv-governed-action`
- `tv-governed-icon-button`
- `tv-governed-scanner-row`

These enforce:

- 44px minimum touch targets
- consistent tap feedback
- consistent hover behavior
- consistent focus-visible behavior
- non-layout-shifting hover states

### Accessibility Governance

Added a global focus-visible standard for:

- links
- buttons
- form controls
- role button surfaces
- focusable custom controls

The system now has a unified cyan focus outline and ring, plus reduced-motion protections for governed controls.

### Chart + Panel Governance

Applied canonical surface classes to:

- `PremiumEChart` through `tv-governed-chart`
- terminal `GlassPanel` through `tv-governed-panel`

This standardizes chart and panel radius, border, background, and depth without forcing every chart to duplicate local styling.

### TypeScript Governance Contract

Added `frontend/src/lib/ui/design-governance.ts` with:

- token catalog
- z-index catalog
- motion catalog
- component governance contracts
- governance checklist
- semantic governance tone classes

This gives future implementation work a typed source of truth instead of relying only on CSS convention.

## Regression Coverage

Added `frontend/src/lib/ui/design-governance.test.ts`.

The tests verify:

- motion tiers are ordered correctly
- overlay z-index is above feedback/navigation layers
- component contracts exist for panel, chart, overlay, button, scanner row, and bottom sheet
- governance checklist covers overlay, chart, scanner, reduced motion, scroll position, and focus
- semantic tone class names stay stable and non-advisory

## Remaining Governance Debt

The core primitives are now governed, but TradeVeto still has many legacy inline class compositions across older pages.

Future cleanup should migrate more local button/card/table classes to:

- `tv-governed-action`
- `tv-governed-scanner-row`
- `tv-governed-panel`
- `tv-governed-chart`

This is migration debt, not a blocker to having the governance system in place.

## Validation

Completed locally on 2026-05-21:

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend test -- --runInBand` - passed, 444 tests.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors.
- `git diff --check` - passed.

Production validation is tracked in the sprint handoff after deployment because the production host must pull the committed revision.

## Final Verdict

TRADEVETO DESIGN SYSTEM + INTERACTION GOVERNANCE ACCOMPLISHED
