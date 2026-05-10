# Production End-To-End Launch Readiness Test

Date: 2026-05-10
Target: `https://tradeveto.com`
Run location: `DJ-MGs-MacBook-Pro.local`

## Final Status

```text
TRADEVETO STILL BLOCKED
```

This run did **not** close the final launch gate. The production application is reachable and many route/security/build checks pass, but the requested test explicitly requires the production host or trusted operator environment. This shell is a local macOS development machine and cannot see production Docker containers, cron jobs, local backup archives, R2 config, production logs, monitoring token, Stripe test credentials, or SMTP credentials.

The stricter route contract in this request also fails: several routes that exist in the local build still return `404` on production.

## GO / NO-GO

| Target | Verdict | Reason |
| --- | --- | --- |
| Controlled 25-user beta | NO-GO | Restore drill, production-host ops green, monitoring ingest, email canary, Stripe full lifecycle, and strict route parity are not proven. |
| Limited paid beta | NO-GO | Billing route QA passed, but disposable test account checkout/webhook/cancel/reactivation lifecycle was not completed. |
| Investor demos | CONDITIONAL | Safe for controlled product demos on deployed routes only. Do not claim final ops launch readiness. |
| Mobile/PWA beta | NO-GO | `/mobile`, manifest, service worker, icons, and push status return `404` on production. |
| Public marketing push | NO-GO | A listed public route returns `404`; live email deliverability is not proven. |
| Full public scale | NO-GO | Operator proof, route parity, PWA, API platform, and billing lifecycle gaps remain. |

## Execution Boundary

The following production/trusted values were missing in this environment:

| Required value | Status |
| --- | --- |
| `POSTGRES_USER` | missing |
| `POSTGRES_DB` | missing |
| `TRADEVETO_BACKUP_ENV_FILE` | missing |
| `TRADEVETO_MONITORING_TOKEN` | missing |
| `TRADEVETO_EMAIL_QA_SEND_TO` | missing |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | missing |
| `EMAIL_FROM`, `SUPPORT_EMAIL`, `BILLING_EMAIL` | missing |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | missing |

Host-local production paths were also missing:

- `/opt/apps/market-alpha-scanner/app`
- `/opt/backups/market-alpha`
- `/var/log/market-alpha`
- `/etc/market-alpha-backup.env`
- `/etc/cron.d/market-alpha-backup`
- `/etc/cron.d/market-alpha-monitoring`
- `/etc/cron.d/market-alpha-stripe-reconcile`

No `market-alpha` Docker containers were visible locally.

## 1. Production Deploy Parity

Local build contains the requested Phase 10/11/12 routes, including `/mobile`, `/community`, `/developers`, `/team`, `/strategy-labs`, `/intelligence/strategy-performance`, and `/api/v1/*`.

Strict production route check:

| Route | Expected | Production status | Verdict |
| --- | ---: | ---: | --- |
| `/` | 200 | 200 | PASS |
| `/features` | 200 | 200 | PASS |
| `/pricing` | 200 | 200 | PASS |
| `/faq` | 200 | 200 | PASS |
| `/how-it-works` | 200 | 200 | PASS |
| `/intelligence` | 200 | 200 | PASS |
| `/intelligence/strategy-performance` | 200 | 404 | FAIL |
| `/intelligence/shock-opportunities` | 200 | 200 | PASS |
| `/intelligence/macro-regime` | 200 | 200 | PASS |
| `/symbol/AMD` | 200 | 200 | PASS |
| `/risk-disclosure` | 200 | 200 | PASS |
| `/terms` | 200 | 200 | PASS |
| `/privacy` | 200 | 200 | PASS |
| `/terminal` | 200/auth-gated | 200 | PASS |
| `/dashboard` | 200/auth-gated | 200 | PASS |
| `/opportunities` | 200/auth-gated | 200 | PASS |
| `/history?symbol=AMD` | 200/auth-gated | 200 | PASS |
| `/paper` | 200/auth-gated | 200 | PASS |
| `/account` | 200/auth-gated | 200 | PASS |
| `/support` | 200/auth-gated | 200 | PASS |
| `/mobile` | not 404 | 404 | FAIL |
| `/community` | not 404 | 404 | FAIL |
| `/developers` | not 404 | 404 | FAIL |
| `/team` | not 404 | 404 | FAIL |
| `/strategy-labs` | not 404 | 404 | FAIL |
| `/api/health` | 200 | 200 | PASS |
| `/api/health/deep` | 200 | 200 | PASS |
| `/api/v1/opportunities` | 401/403/429 | 404 | FAIL |
| `/api/community` | protected or hidden | 404 | PASS if intentionally hidden |
| `/api/push/status` | protected or hidden | 404 | PASS if intentionally hidden |
| `/api/stripe/checkout` POST | 401/403 | 401 | PASS |
| `/api/stripe/portal` POST | 401/403 | 401 | PASS |

Existing route parity script result:

```text
RESULT: PRODUCTION ROUTE PARITY CHECK PASSED
```

Important: that script treats `/strategy-labs`, `/community`, `/developers`, `/team`, and `/intelligence/strategy-performance` as intentionally undeployed future routes. The stricter route list in this launch request treats them as in-scope. Under this request, route parity is **blocked**.

## 2. Production Ops Green Check

Command:

```bash
tools/ops/tradeveto-ops-green-check.sh --base-url https://tradeveto.com
```

Result:

```text
RESULT: OPS HARDENING STILL REQUIRED
```

HTTP/TLS checks passed:

- Landing, pricing, features, health, deep health: HTTP 200.
- OpenGraph image: HTTP 200 image/png.
- TLS certificate: expires in 86 days.
- No stale local `rclone` or scanner process was observed from this host.

Blocked/failed because this was not run from the production host:

- Docker containers not visible.
- Postgres container not visible.
- Backup cron file missing locally.
- Monitoring cron file missing locally.
- Stripe reconciliation cron file missing locally.
- Local Postgres backup path missing.
- Local scanner backup path missing.
- R2 backup env missing.
- Production log directory missing.

Ops status: **RED for launch proof**. It must be rerun from the production host.

## 3. Health And Deep Health

`/api/health`:

| Field | Value |
| --- | --- |
| HTTP | 200 |
| `ok` | true |
| service | `tradeveto-frontend` |
| uptime | 47,511 seconds at check time |

`/api/health/deep`:

| Component | Status |
| --- | --- |
| DB | ok |
| Scanner | ok |
| Scanner age | about 2 minutes |
| Local backup | ok |
| R2/offsite backup | ok |
| Active offsite provider | R2 |
| Latest Postgres backup | `2026-05-10_06-00.sql.gz` |
| Latest scanner backup | `2026-05-10_06-00.tar.gz` |
| Backup event | `backup completed` |
| Backup age | about 348 minutes |

Verdict: **health reporting passed**. This does not replace restore proof.

## 4. Backup And Restore Drill

Command:

```bash
tools/ops/tradeveto-restore-drill.sh
```

Result:

```text
POSTGRES_USER is required
```

Restore drill verdict: **FAILED / NOT PROVEN**.

RTO: not measured.
RPO: not accepted from this run. Deep health reports recent backup state, but restore proof must come from an isolated production-host restore drill.

Required closure:

```bash
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-restore-drill.sh
```

Required result:

```text
RESULT: BACKUP RESTORE DRILL PASSED
```

## 5. Monitoring Synthetics And System Proof

Commands:

```bash
cd frontend && npm run monitoring:synthetics
cd frontend && npm run monitoring:system
```

Both failed with:

```text
TRADEVETO_MONITORING_TOKEN is required.
```

Monitoring verdict: **FAILED / NOT PROVEN**.

Required closure:

- Run from production/trusted environment with `TRADEVETO_MONITORING_TOKEN`.
- Verify ingest succeeds.
- Verify `/admin/monitoring` shows current synthetic and system data.
- Verify failures do not produce false-green status.

## 6. Email Canary And Inbox Placement

Command:

```bash
tools/ops/tradeveto-email-infrastructure-check.sh
```

Passed:

- Google Workspace MX present.
- SPF exists and includes Google Workspace.
- DKIM exists at `google._domainkey.tradeveto.com`.
- DMARC exists.
- `/api/health`, `/api/health/deep`, `/support/contact`, and `/reset-password` return expected status.
- `smtp.gmail.com:587` STARTTLS reachable.

Warnings/gaps:

- SPF uses `~all`.
- DMARC is `p=none`.
- SMTP env missing, so no emails were sent.
- `TRADEVETO_EMAIL_QA_SEND_TO` missing, so inbox/spam placement was not checked.

Email verdict: **DNS/route QA passed with warnings; live canary not proven**.

## 7. Stripe Test-Mode Full Lifecycle

Command:

```bash
tools/ops/tradeveto-billing-lifecycle-check.sh
```

Passed route-level checks:

- `/pricing`: 200.
- `/account`: 200.
- `/api/health`: 200.
- `/api/health/deep`: 200.
- Anonymous checkout and portal mutations fail closed with 401.
- Invalid webhook payload fails closed with 400.

Not proven:

- Disposable test account creation.
- Legal acceptance/onboarding.
- Checkout completion.
- Webhook delivery.
- Premium entitlement unlock.
- Billing portal session for test customer.
- Cancel at period end.
- Renewal/reactivation.
- Duplicate webhook replay/idempotency.
- Cleanup of test customer/user.

Stripe verdict: **route QA passed; full lifecycle not proven**.

## 8. Login, Registration, And Invite Code

Safe unauthenticated checks:

| Check | Status | Notes |
| --- | ---: | --- |
| `GET /login` | 404 | No deployed page route. |
| `GET /register` | 404 | No deployed page route. |
| `GET /reset-password` | 200 | Reset route is deployed. |
| `GET /onboarding` | 404 | No deployed page route. |
| `POST /api/auth/register` invalid payload | 400 | Fails safely. |

No disposable user was created because production cleanup credentials and invite/test-flow credentials were unavailable.

Auth/invite verdict: **not proven end-to-end**.

## 9. Premium Gating And Entitlement

Verified:

- Anonymous Stripe checkout and portal fail closed.
- Premium API history route fails closed with 401.
- Admin summary API fails closed with 401.
- Invalid webhook fails closed.

Not proven:

- Free user gates.
- Premium user unlocks.
- Cancelled-but-active state.
- Expired entitlement revocation.
- Team/developer/community route protection in deployed production, because those routes currently return 404.

Premium gating verdict: **partial route-level proof only**.

## 10. Mobile / PWA Production Test

Production status:

| Route / asset | Status |
| --- | ---: |
| `/mobile` | 404 |
| `/manifest.webmanifest` | 404 |
| `/manifest.json` | 404 |
| `/tradeveto-sw.js` | 404 |
| `/icon-192.png` | 404 |
| `/icon-512.png` | 404 |
| `/api/push/status` | 404 |

Mobile/PWA verdict: **FAILED / NOT DEPLOYED**.

## 11. Public Content, SEO, And Social Preview

Passed:

- `/robots.txt`: 200.
- `/sitemap.xml`: 200.
- `/og-image.png`: 200 `image/png`.
- Social preview crawlers received 200 with OpenGraph metadata:
  - `facebookexternalhit`
  - `Facebot`
  - `meta-externalagent`
  - `meta-externalfetcher`
  - `Twitterbot`
  - `LinkedInBot`
  - `Slackbot`
  - `Discordbot`
- Checked public pages did not expose stale `Market Alpha` branding.
- Checked public pages include risk/research/not-advice language.

Blocked:

- `/intelligence/strategy-performance` is in the requested public list but returns 404.

SEO/social verdict: **mostly passed, with one strict public-route blocker**.

## 12. Security And Abuse

Command:

```bash
tools/ops/tradeveto-security-abuse-check.sh
```

Result:

```text
RESULT: SECURITY ABUSE QA PASSED with 0 warning(s)
```

Passed:

- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy present.
- Admin summary API fails closed.
- History API fails closed.
- Stripe webhook malformed request fails closed.
- Support mutation without required protection fails closed.
- No secret-like patterns detected in checked responses.

Security verdict: **passed for current deployed surface**.

## 13. API And Webhook Production Test

Command:

```bash
tools/ops/tradeveto-api-platform-check.sh
```

Script result:

```text
RESULT: API PLATFORM ROUTE QA PASSED
```

But the script currently accepts 404 for undeployed API platform routes. Strict production status:

| Route | Status |
| --- | ---: |
| `/developers` | 404 |
| `/api/v1/opportunities` | 404 |
| `/api/v1/macro` | 404 |
| `/api/v1/shocks` | 404 |
| `/api/v1/replay?symbol=AMD` | 404 |
| `/api/v1/portfolio/scenario` | 404 |

API/webhook verdict: **not ready if public API is in beta scope; acceptable only if intentionally hidden and removed from launch scope**.

## 14. Performance And Load Sanity

Strict performance command:

```bash
TRADEVETO_PERFORMANCE_ALLOW_404=false tools/ops/tradeveto-performance-budget-check.sh
```

Result: failed on `404`.

Observed deployed route timings before failure:

| Route | Status | Latency |
| --- | ---: | ---: |
| `/api/health` | 200 | 112 ms |
| `/api/health/deep` | 200 | 216 ms |
| `/terminal` | 200 | 88 ms |
| `/dashboard` | 200 | 100 ms |
| `/opportunities` | 200 | 183 ms |
| `/symbol/AMD` | 200 | 270 ms |
| `/paper` | 200 | 287 ms |
| `/strategy-labs` | 404 | FAIL |

Default performance script with 404 skips passes for deployed routes. Under this launch request, strict performance is **blocked** by undeployed routes.

## 15. Support And Feedback Flow

Verified:

- `/support`: 200.
- `/support/contact`: 200.
- `/api/support/contact` without required production send path returns safe error: `400 {"ok":false,"error":"support_contact_unavailable"}`.
- Admin support route is not deployed on production in this route set: `/admin/support` returned 404 from unauthenticated production check.

Support verdict: **public support pages reachable; notification/persistence/admin workflow not proven end-to-end**.

## Validation Commands

| Command | Result |
| --- | --- |
| `npm run lint` | passed |
| `npm test -- --runInBand` | passed, 363 tests |
| `npm run build` | passed |
| `npm audit --omit=dev` | passed, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | passed |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | passed, 0 errors |
| `/api/health` | passed |
| `/api/health/deep` | passed |
| `monitoring:synthetics` | failed, missing token |
| `monitoring:system` | failed, missing token |
| Restore drill | failed, missing production Postgres env |
| Ops green check | failed locally, production host unavailable |
| Beta launch check | passed under older route policy |
| Strict performance budget | failed on production `404` |
| Email infrastructure | passed with warnings; canary not sent |
| Billing lifecycle route QA | passed; full lifecycle not proven |
| Route parity script | passed under older hidden-route policy |

## Remaining Critical Blockers

1. Run restore drill from production host and capture `BACKUP RESTORE DRILL PASSED`.
2. Run ops green check from production host and capture `PRODUCTION OPS GREEN`.
3. Run monitoring synthetics/system with production token and verify fresh ingest.
4. Send live email canaries to a QA inbox and verify SPF/DKIM/DMARC plus inbox placement.
5. Complete Stripe test-mode lifecycle with disposable account/customer and cleanup.
6. Reconcile route contract:
   - deploy `/intelligence/strategy-performance`, `/mobile`, `/community`, `/developers`, `/team`, `/strategy-labs`, `/api/v1/opportunities`, and PWA assets; or
   - remove them from public beta scope, nav, sitemap, launch gate, and this readiness checklist.
7. Prove auth/invite/25-user cap with disposable user flow.
8. Prove premium entitlement state transitions with real test-mode Stripe webhooks.
9. Prove support notification/admin workflow with production SMTP/support config.

## Safe Beta User Cap

Keep the cap at:

```text
25 invited users
```

Do not send invites until all critical blockers above are closed. After closure, use a staged ramp:

1. Send 5-10 invites.
2. Observe one market session.
3. Review health, deep health, monitoring, support tickets, onboarding completion, Stripe state, email delivery, LLM spend, and route latency.
4. Continue toward 25 only if daily ops review remains green.

## Rollback Conditions

Pause invites or roll back if any of these occur:

- `/api/health` fails for more than 2 minutes.
- `/api/health/deep` reports DB, scanner, local backup, or R2 backup failure.
- Restore drill fails or cannot be repeated.
- Monitoring ingest stops.
- Email canaries fail or land in spam.
- Stripe checkout/webhook creates stale or wrong entitlement state.
- Core routes exceed latency budget and do not recover.
- LLM spend exceeds 80% of daily budget before expected usage.
- Logs expose secret-like values.
- Multiple users report the same onboarding, billing, or premium-gating blocker.

## Support Escalation Plan

Before beta invites:

- Assign launch owner, ops owner, billing owner, email owner, and support owner.
- Review `/admin/support`, `/admin/beta`, and `/admin/monitoring` daily after they are deployed/reachable.
- Route billing issues to billing owner.
- Route auth/email issues to support owner.
- Route health/scanner/backup issues to ops owner.
- Keep rollback authority explicit and fast.

## Smallest Fixes Required For GO

Minimum launch path:

1. Decide whether Phase 10/11/12 routes are in beta scope.
2. If in scope, deploy them to production and rerun strict route/performance/PWA checks.
3. If out of scope, remove them from the launch gate and public lists.
4. Run the restore drill and ops green check on the production host.
5. Run monitoring scripts with the production monitoring token.
6. Run live email canary with SMTP and QA inbox configured.
7. Run Stripe test-mode lifecycle with disposable account and cleanup.

Only after those pass should the final status change to:

```text
TRADEVETO CONTROLLED BETA READY
```
