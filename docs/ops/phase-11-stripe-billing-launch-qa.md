# Phase 11.3 Stripe + Billing Lifecycle Launch QA

This runbook verifies that TradeVeto billing is safe enough for controlled paid growth.

The automated checks are intentionally non-destructive by default. They validate route behavior,
premium gating, invalid webhook handling, and secret redaction without creating Stripe objects.
Paid lifecycle proof still requires a Stripe test-mode checkout session and webhook replay from a
test customer.

## Safe Route QA

Run from any operator machine:

```bash
tools/ops/tradeveto-billing-lifecycle-check.sh
```

Optional target override:

```bash
TRADEVETO_BILLING_QA_BASE_URL=https://tradeveto.com tools/ops/tradeveto-billing-lifecycle-check.sh
```

The script checks:

- `/pricing` loads
- `/account` loads
- `/api/health` and `/api/health/deep` are healthy
- anonymous checkout and portal mutation attempts fail closed
- invalid Stripe webhook signatures return `400`
- checked responses do not expose Stripe secret patterns

Expected success line:

```text
RESULT: BILLING ROUTE QA PASSED
```

## Test-Mode Lifecycle Drill

Use only Stripe test-mode credentials.

1. Create or select a test user.
2. Confirm the account has accepted current legal documents.
3. Confirm email verification is complete.
4. Click **Upgrade to Premium** from `/account`.
5. Complete Stripe Checkout with a test card.
6. Confirm `/account` shows Premium active and the renewal/trial date.
7. Confirm premium routes unlock for that user.
8. Open the Billing Portal from `/account`.
9. Cancel at period end.
10. Confirm `/account` says Premium remains active until the period end and does not say it renews.
11. Reactivate/renew from the Billing Portal.
12. Confirm `/account` shows renewal restored.
13. Replay the same Stripe event and confirm duplicate replay is idempotent.
14. Send a stale older subscription event and confirm it does not overwrite newer local state.
15. Send an invalid webhook signature and confirm it returns `400`.

## Stripe CLI Examples

Forward webhooks to a local dev server:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Trigger common events:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
stripe trigger invoice.payment_succeeded
```

Reconcile local subscription state against Stripe:

```bash
cd frontend
npm run stripe:reconcile -- --dry-run
```

## Launch Gate

Billing is launch-safe only when all are true:

- route QA passes
- Stripe test-mode checkout succeeds
- webhook signature rejection is verified
- duplicate webhook replay is idempotent
- cancellation-at-period-end copy is correct
- renewal/reactivation copy is correct
- billing portal opens for a subscribed user
- premium entitlement updates after webhook delivery
- expired/canceled subscriptions do not retain premium access
- no Stripe secrets appear in logs, route responses, monitoring payloads, or client bundles

If the Stripe test-mode lifecycle drill has not been completed, use final status:

```text
BILLING STILL NEEDS HARDENING
```
