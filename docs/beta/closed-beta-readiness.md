# TradeVeto Closed Beta Readiness

Target beta size: 10-25 users.

## Positioning

TradeVeto is AI-powered market intelligence for explainable decision support. The core product promise is disciplined filtering:

- Not every trade deserves risk.
- Trade less. Trade smarter.
- WAIT-first market analysis.
- Explainable veto, confidence, and readiness context.
- Research and education only. Not financial advice. Not a trading bot.

Avoid launch language that implies guaranteed returns, AI-generated winning signals, broker execution, or automated trading.

## Access Model

New account creation can be controlled with environment variables:

- `TRADEVETO_BETA_SIGNUP_MODE=open`: anyone can create an account.
- `TRADEVETO_BETA_SIGNUP_MODE=invite`: new email/password signups require `TRADEVETO_BETA_INVITE_CODE`; Google OAuth signup requires an allowlisted email.
- `TRADEVETO_BETA_SIGNUP_MODE=closed`: only emails in `TRADEVETO_BETA_ALLOWED_EMAILS` can create new accounts.

Existing users can continue to sign in. Keep beta access changes staged and reversible.

## Billing Incentives

Stripe checkout supports optional closed-beta incentives:

- `STRIPE_BETA_TRIAL_DAYS`: optional trial period, bounded to 1-30 days.
- `STRIPE_ALLOW_PROMOTION_CODES=true`: lets users enter Stripe promotion codes during Checkout.

Stripe remains the source of truth for trial state, discounts, renewals, cancellations, and subscription lifecycle webhooks. Trialing subscriptions grant premium access until Stripe indicates expiration/cancellation.

## Support Readiness

Required before inviting beta users:

- `support@tradeveto.com`, `billing@tradeveto.com`, and `noreply@tradeveto.com` deliver correctly.
- SPF, DKIM, DMARC, and MX are valid for `tradeveto.com`.
- Support ticket creation sends user confirmation and internal support notification.
- Admin support console shows tickets and email delivery failures.
- Support AI blocks financial advice while answering product usage questions.

## Operational Readiness

Required before beta cohort expansion:

- `/api/health` and `/api/health/deep` are healthy.
- Monitoring synthetics and system metrics write successfully.
- R2 offsite backup succeeds and deep health reports local/offsite/overall backup honestly.
- No orphan backup/rclone processes.
- Cloudflare routes and legacy redirects work.
- Admin analytics and monitoring are admin-only.

## Beta Feedback Loop

Use `/admin/analytics`, support tickets, and the beta feedback widget to watch:

- onboarding completion
- page and feature usage
- WAIT/veto/readiness engagement
- support AI prompts and helpfulness
- confusing signal reports
- repeat sessions and symbol opens

Review feedback daily during the first beta week.
