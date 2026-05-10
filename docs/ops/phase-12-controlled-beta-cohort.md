# Phase 12.8 Controlled 25-User Beta Cohort Setup

Date: 2026-05-10

Final status target:

```text
CONTROLLED 25-USER COHORT READY
```

## Cohort Policy

Initial beta cap: **25 invited users**.

Signup enforcement:

- Set `TRADEVETO_BETA_USER_CAP=25`.
- New email/password and Google OAuth account creation is blocked after 25 active users.
- Existing users can still sign in.
- Allowlisted operator/support emails in `TRADEVETO_BETA_ALLOWED_EMAILS` can still be created for launch operations.

Do not expand beyond 25 until:

- `/api/health` and `/api/health/deep` remain green.
- Monitoring synthetics and system checks are green.
- Backup verification is current.
- Stripe, email, support, and onboarding checks have no P0/P1 failures.
- LLM spend remains below 80% of daily budget at expected usage.
- Terminal, dashboard, opportunities, symbol detail, replay, and Strategy Labs routes stay inside performance budgets.
- Support queue is manageable and repeated confusion points have an owner.

Invite ramp:

1. Send first 10 invites.
2. Wait at least one market session.
3. Review onboarding, first useful action, support tickets, LLM spend, and route timings.
4. Send the remaining 15 only if the dashboard remains green.

## Invite Workflow

1. Set `TRADEVETO_BETA_SIGNUP_MODE=invite`.
2. Set a cohort-specific `TRADEVETO_BETA_INVITE_CODE`.
3. Set `TRADEVETO_BETA_USER_CAP=25`.
4. Add explicit early testers or operator/support accounts to `TRADEVETO_BETA_ALLOWED_EMAILS` when needed.
5. Send invite copy with research-only and not-financial-advice language.
6. Track signup, onboarding completion, first useful action, watchlist creation, replay usage, Strategy Labs engagement, support tickets, and daily revisits.
7. Pause invites immediately if rollback conditions trigger.

## Onboarding Process

The first session should lead users through:

- What Matters Now.
- One opportunity review.
- One watchlist save.
- Optional replay or Strategy Labs review.
- Beta feedback or support if the workflow is confusing.

First useful action is tracked when a user saves a watchlist symbol, opens a replay, or reaches Strategy Labs engagement. The metric is activation evidence, not a trading outcome.

## Beta Metrics Dashboard

Admin route:

```text
/admin/beta
```

The dashboard shows:

- 25-user cap status.
- Onboarding completion.
- First useful action.
- Watchlist creation.
- Replay usage.
- Strategy Labs engagement.
- Daily and weekly active users.
- Support tickets opened/open/urgent.
- Confusion points from feedback and support.
- Daily ops checklist.
- Support macros.
- Escalation and rollback rules.
- Links to `/admin/monitoring` for LLM cost and route performance tracking.

Supporting analytics route:

```text
/admin/analytics
```

## Support Workflow

Support tiers:

| Tier | Examples | Operator action |
| --- | --- | --- |
| P0 | app down, broken auth, incorrect premium entitlement, secret exposure | Pause invites, preserve evidence, rollback if deploy-related |
| P1 | deep health failure, Stripe webhook failure, email auth failure, LLM cost runaway | Pause paid growth and assign same-day owner |
| P2 | repeated onboarding confusion, mobile layout blocker, support backlog, route budget miss | Hold cap until fixed |
| P3 | copy polish, isolated UX issue, docs gap | Track during daily review |

Support macros are available in `/admin/beta`:

- First session guidance.
- WAIT / Risk Review confusion.
- Bug report request.
- Billing/account routing.
- Incident pause-invites note.
- Research-only boundary.

## Feedback And Bug Reporting

The floating beta feedback widget now supports:

- Helpful.
- Confusing Signal.
- Bug Report.
- Onboarding Confusion.
- Performance Issue.
- Feature Request.

Feedback remains privacy-conscious. Users should include page, symbol, browser/device, and approximate time when useful. They must not include passwords, payment details, API keys, session tokens, or private brokerage/account credentials.

Account-specific and reproducible workflow bugs should become support tickets.

## Retention Metrics Plan

Activation:

- Onboarding completion.
- First useful action.
- Watchlist creation.
- First symbol detail review.

Engagement:

- Replay usage.
- Strategy Labs visits.
- Opportunities visits.
- Support/help interactions.
- Watchlist revisits.

Retention:

- DAU.
- WAU.
- Repeat sessions.
- Average session depth.
- Daily revisit behavior.

Quality and trust:

- Confusing-signal feedback.
- Bug reports.
- Support ticket severity.
- Route performance misses.
- LLM spend and blocked calls.

## Daily Ops Review

Each beta day:

1. Check `/api/health` and `/api/health/deep`.
2. Check monitoring synthetics, system metrics, backup state, and route budgets.
3. Review `/admin/beta` for cap status, onboarding, first useful action, support tickets, and confusion points.
4. Review `/admin/monitoring` for LLM spend, cache hits, blocked calls, route latency, and errors.
5. Review `/admin/support` for open and urgent tickets.
6. Record GO / HOLD / PAUSE before sending more invites.

## Rollback Conditions

Pause invites or roll back if:

- `/api/health` fails for more than two minutes.
- `/api/health/deep` reports DB, backup, scanner, or critical dependency failure.
- Login, signup, onboarding, billing, cancellation, or premium entitlement breaks.
- Repeated support tickets report the same blocking workflow.
- LLM spend crosses 80% of daily budget before expected cohort usage.
- Core route p95 latency remains over budget.
- Production logs expose secret-like values.

## Files Changed

- `frontend/src/lib/beta-cohort.ts`
- `frontend/src/lib/beta-cohort.test.ts`
- `frontend/src/lib/analytics-policy.ts`
- `frontend/src/lib/analytics-policy.test.ts`
- `frontend/src/lib/client/analytics.ts`
- `frontend/src/lib/server/analytics.ts`
- `frontend/src/hooks/useLocalWatchlist.ts`
- `frontend/src/components/analytics/BetaFeedbackWidget.tsx`
- `frontend/src/components/history/DecisionReplayPanel.tsx`
- `frontend/src/components/strategy-labs/StrategyLabsWorkspace.tsx`
- `frontend/src/components/admin/BetaCohortDashboard.tsx`
- `frontend/src/app/admin/beta/page.tsx`
- `frontend/src/components/admin/AdminChrome.tsx`
- `docs/ops/beta-analytics.md`

## Remaining Risks

- Real cohort metrics are only meaningful after live users complete onboarding and use watchlist/replay/Strategy Labs.
- First useful action is an activation proxy, not proof of retention.
- Support tickets and feedback need daily operator discipline; dashboards do not replace review.
- The 25-user cap is enforced at signup against active users, but there is not yet a dedicated cohort membership table for invite waves, user status, or cohort notes.
