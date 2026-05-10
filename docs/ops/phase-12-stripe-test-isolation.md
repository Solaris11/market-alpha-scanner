# Phase 12.11b - Stripe Test Isolation + Billing Safety

## Architecture

TradeVeto now separates Stripe billing into explicit modes:

- `live`: the normal production billing path for real users.
- `test`: a hidden QA-only billing path for disposable lifecycle proof.

Normal users continue through:

- `/api/stripe/checkout`
- `/api/stripe/portal`
- `/api/stripe/webhook`

QA lifecycle testing uses isolated routes:

- `/api/stripe/test/checkout`
- `/api/stripe/test/portal`
- `/api/stripe/test/webhook`

The test routes are not linked in public UI and are blocked unless:

- `TRADEVETO_ENABLE_STRIPE_TEST_MODE=true`
- the authenticated user email is present in `TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS`
- the request passes normal auth, CSRF, legal acceptance, and email-verification checks

## Environment

Live billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

Test billing:

- `STRIPE_TEST_SECRET_KEY`
- `STRIPE_TEST_PRICE_ID`
- `STRIPE_TEST_WEBHOOK_SECRET`
- `TRADEVETO_ENABLE_STRIPE_TEST_MODE`
- `TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS`

Optional test-specific beta billing:

- `STRIPE_TEST_BETA_TRIAL_DAYS`
- `STRIPE_TEST_ALLOW_PROMOTION_CODES`

If the optional test-specific values are absent, the test checkout path falls back to the live beta trial/promotion flags but still uses test Stripe credentials and a test Stripe price.

## Webhook Isolation

Live webhook events are verified with `STRIPE_WEBHOOK_SECRET`.

Test webhook events are verified with `STRIPE_TEST_WEBHOOK_SECRET`.

Test event idempotency uses `test:<event_id>` when writing local `stripe_events`, `billing_events`, and notification dedupe ids. This prevents test webhook replay from colliding with live event ids.

Webhook processing also records `stripe_mode` for operator visibility.

## Data Safety

`user_subscriptions`, `billing_events`, and `stripe_events` now include `stripe_mode`.

Disposable QA users can receive test-mode premium entitlement, but test-mode subscription updates are ignored unless the user email is allowlisted. A user with an existing live billing profile cannot enter the test checkout path.

The live Stripe reconciliation job only scans `stripe_mode = 'live'` subscriptions so test customers are not reconciled through live Stripe credentials.

## Operational Validation

The billing lifecycle checker now verifies:

- unauthenticated live checkout and portal fail closed
- unauthenticated test checkout and portal fail closed
- invalid live webhook signatures fail closed
- disabled test webhook returns `404`
- enabled test mode requires test key, test webhook secret, test price, and allowlisted QA emails
- invalid test webhook signatures fail closed without leaking secrets

Full disposable lifecycle proof still requires production test-mode env values and a real allowlisted QA account:

1. sign up disposable QA user
2. complete onboarding and legal acceptance
3. create `/api/stripe/test/checkout` session
4. complete Stripe test checkout
5. deliver `/api/stripe/test/webhook` events
6. verify premium entitlement
7. open `/api/stripe/test/portal`
8. cancel at period end
9. verify active-until messaging
10. replay duplicate webhook
11. clean up disposable QA user/customer

## Remaining Billing Risks

- Limited paid beta remains blocked until production has test-mode Stripe env configured and the disposable lifecycle proof is run from the production host.
- The current implementation is intentionally QA-only. It is not a staging replacement.
- Test-mode entitlement uses the same user account table, so operators should use disposable QA accounts only.

