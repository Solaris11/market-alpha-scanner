# Final Stripe Test Lifecycle Proof

Date: 2026-05-10

## Production Context

- Host: `onsre-node-01`
- User: `sre`
- App path: `/opt/apps/market-alpha-scanner/app`
- Runtime commit tested: `dd8ef205c121bee665bea86b0b248f491e9cf0ef`
- Frontend container: `market-alpha-frontend`
- Validation target: `https://tradeveto.com`

## Environment Summary

The frontend runtime loaded the server-side Stripe test isolation variables after updating `compose.yaml` and recreating the container.

| Variable | Runtime Status |
| --- | --- |
| `TRADEVETO_ENABLE_STRIPE_TEST_MODE` | present |
| `TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS` | present |
| `STRIPE_TEST_SECRET_KEY` | present |
| `STRIPE_TEST_WEBHOOK_SECRET` | present |
| `STRIPE_TEST_PRICE_ID` | present |
| `NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY` | missing |

Note: `NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY` is not used by the current server-created Stripe Checkout redirect flow. It remains a follow-up configuration item if a client-side test Stripe flow is introduced.

## Route Safety Checks

| Check | Result |
| --- | --- |
| Unauthenticated `/api/stripe/test/checkout` | `401`, fail closed |
| Unauthenticated `/api/stripe/test/portal` | `401`, fail closed |
| Invalid `/api/stripe/test/webhook` signature | `400`, fail closed |
| Invalid `/api/stripe/webhook` signature | `400`, fail closed |
| Billing route QA script | `RESULT: BILLING ROUTE QA PASSED` |

## Disposable QA Lifecycle Proof

The lifecycle was executed from inside the production frontend runtime with a temporary allowlisted QA email. The temporary email was removed from `TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS` after the run and the frontend container was recreated.

| Step | Result |
| --- | --- |
| Disposable QA user registration | passed |
| Initial non-premium state | passed |
| Email verification for disposable user | passed via operator verification |
| Legal terms/privacy/risk acceptance | passed |
| Test checkout session creation | passed, `mode=test` |
| Stripe test customer creation | passed |
| Stripe test subscription creation | passed, status `active` |
| `checkout.session.completed` webhook | passed |
| `customer.subscription.created` webhook | passed |
| `invoice.payment_succeeded` webhook | passed |
| Premium entitlement unlock | passed |
| Premium route access | passed for `/terminal`, `/dashboard`, `/opportunities`, `/paper`, `/strategy-labs` |
| Test billing portal session | passed |
| Cancel at period end | passed |
| Active-until entitlement behavior | passed, premium remained active until period end |
| Reactivation | passed |
| Duplicate webhook replay | passed, duplicate returned and no duplicate rows were created |
| Cleanup cancellation event | passed |

Redacted proof IDs:

- Checkout session: `cs_test_b1...b8NA`
- Stripe customer: `cus_UUc7jG...sqRg`
- Stripe subscription: `sub_1TVcth...s8N0`

## Idempotency Proof

The reactivation webhook was replayed with the same signed test event ID.

| Table | Duplicate Count Result |
| --- | --- |
| `stripe_events` | `1` row |
| `billing_events` | `1` row |

## Cleanup Proof

| Cleanup Check | Result |
| --- | --- |
| Temporary QA user deleted | passed |
| Temporary Stripe test customer deleted | passed |
| Temporary Stripe subscription canceled | passed |
| Temporary allowlist email removed | passed |
| `stripe-qa-%@tradeveto.com` users remaining | `0` |
| `test:evt_tvqa_%` Stripe events remaining | `0` |
| Test-mode subscription rows remaining | `0` |

## Health After Run

- `/api/health`: OK
- `/api/health/deep`: OK
- DB: OK
- Scanner freshness: OK
- Local backup: OK
- R2/offsite backup: OK

## Verdicts

- Controlled free beta: GO
- Limited paid beta: GO

Remaining billing risk:

- Add `NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY` before introducing any browser-side Stripe test-key workflow. The current production Checkout redirect lifecycle does not depend on it.

Final status: `STRIPE LIFECYCLE FULLY VERIFIED`
