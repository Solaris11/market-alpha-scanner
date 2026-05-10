# Phase 12.11 Operator Proof Closure And Final Launch Gate

Date: 2026-05-10

## Final Verdict

```text
TRADEVETO STILL BLOCKED
```

TradeVeto is **not ready to send controlled public beta invites** from this proof run.

The application-level production checks are healthy, but the operator-only blockers are not closed from this environment:

1. Production restore drill is not proven.
2. Production-host ops green check is not proven.
3. Monitoring synthetics/system ingest is not proven.
4. Live email canary/inbox placement is not proven.
5. The Phase 12.11 explicit public route list includes routes that still return `404` on production.

## Trusted Environment Prerequisites

This run was executed from the local development workspace, not from the production host. Required trusted-environment values were not present:

| Secret / Env | Status |
| --- | --- |
| `POSTGRES_USER` | missing |
| `POSTGRES_DB` | missing |
| `TRADEVETO_BACKUP_ENV_FILE` | missing |
| `TRADEVETO_MONITORING_TOKEN` | missing |
| `TRADEVETO_EMAIL_QA_SEND_TO` | missing |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | missing |
| `EMAIL_FROM` / `SUPPORT_EMAIL` / `BILLING_EMAIL` | missing |

These missing values are expected on a local desktop, but they prevent final proof closure.

## Production Restore Drill

Result: **blocked / not proven**.

Command attempted:

```bash
tools/ops/tradeveto-restore-drill.sh
```

Observed result:

```text
POSTGRES_USER is required
```

Production deep health did report current backup state:

- Local backup: ok.
- R2 offsite backup: ok.
- Latest Postgres backup: `2026-05-10_06-00.sql.gz`.
- Latest scanner backup: `2026-05-10_06-00.tar.gz`.
- Backup age at check time: about 334 minutes.
- Latest backup event: backup completed.

This proves backup reporting and freshness, not restoreability.

Required closure:

```bash
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-restore-drill.sh
```

Required result:

```text
RESULT: BACKUP RESTORE DRILL PASSED
```

RTO estimate: **not measured** because restore did not run.

RPO estimate: **not finally accepted**. Deep health showed the most recent R2 backup around 334 minutes old and scanner data around 3-4 minutes old during the check. The accepted RPO must come from the production restore drill report.

## Production Ops Green Check

Result: **failed locally / not proven from production host**.

Command attempted:

```bash
tools/ops/tradeveto-ops-green-check.sh --base-url https://tradeveto.com
```

Production HTTP checks inside the script passed, but host-local checks failed because this machine cannot see production Docker, cron, backup, or log paths:

- Docker containers not visible.
- Postgres container not visible.
- Backup cron file missing locally.
- Monitoring cron file missing locally.
- Stripe reconciliation cron file missing locally.
- No local Postgres backup found in `/opt/backups/market-alpha/postgres`.
- No local scanner backup found in `/opt/backups/market-alpha/scanner_output`.
- R2/primary backup remote env not visible locally.
- Log directory missing locally.

Observed result:

```text
RESULT: OPS HARDENING STILL REQUIRED
```

Required closure from production host:

```bash
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh --base-url https://tradeveto.com
```

Required result:

```text
RESULT: PRODUCTION OPS GREEN
```

## Monitoring Synthetics And System Proof

Result: **blocked / not proven**.

Commands attempted:

```bash
npm run monitoring:synthetics
npm run monitoring:system
```

Observed results:

```text
TRADEVETO_MONITORING_TOKEN is required
```

Required closure:

```bash
cd /opt/apps/market-alpha-scanner/app/frontend
TRADEVETO_MONITORING_TOKEN=... npm run monitoring:synthetics
TRADEVETO_MONITORING_TOKEN=... npm run monitoring:system
```

Required proof:

- Both scripts ingest successfully.
- `/admin/monitoring` shows current synthetic and system checks.
- Alert routing is verified from a trusted operator environment.
- No false-green monitoring behavior is observed.

## Live Email Canary And Inbox Placement

Result: **DNS/route QA passed with warnings; live canary not proven**.

Command run:

```bash
tools/ops/tradeveto-email-infrastructure-check.sh
```

Passed:

- MX uses Google Workspace.
- SPF exists and includes Google Workspace.
- DKIM exists at `google._domainkey.tradeveto.com`.
- DMARC exists.
- `/api/health`, `/api/health/deep`, `/support/contact`, and `/reset-password` returned expected statuses.
- SMTP STARTTLS to `smtp.gmail.com:587` was reachable.

Warnings / gaps:

- SPF uses `~all`.
- DMARC is `p=none`.
- SMTP env was missing, so smoke sends did not run.
- `TRADEVETO_EMAIL_QA_SEND_TO` was missing, so inbox placement was not checked.

Required closure:

```bash
TRADEVETO_EMAIL_QA_SEND_TO=<test inbox> \
SMTP_HOST=... SMTP_USER=... SMTP_PASS=... EMAIL_FROM=... SUPPORT_EMAIL=... BILLING_EMAIL=... \
  tools/ops/tradeveto-email-infrastructure-check.sh
```

Required proof:

- Password reset, onboarding, support, billing, and beta invite canaries arrive in inbox.
- SPF pass.
- DKIM pass.
- DMARC alignment pass.
- Sender names are clear.
- No stale Market Alpha branding.
- Links are valid on desktop and mobile.

## Stripe Lifecycle Proof

Result: **route QA passed; full test-mode lifecycle not proven in this run**.

Command run:

```bash
tools/ops/tradeveto-billing-lifecycle-check.sh
```

Passed:

- `/pricing` returned 200.
- `/account` returned 200.
- `/api/health` returned 200.
- `/api/health/deep` returned 200.
- Anonymous `/api/stripe/checkout` and `/api/stripe/portal` failed closed with auth/CSRF protection.
- Invalid Stripe webhook payload failed closed with 400.

Required closure for full lifecycle:

- Test-mode signup.
- Onboarding.
- Legal acceptance.
- Upgrade.
- Checkout completion.
- Webhook delivery.
- Premium entitlement update.
- Cancel at period end.
- Renewal/reactivation.
- Billing portal visibility.
- Duplicate webhook replay/idempotency check.

This cannot be marked complete from route QA alone.

## Route Parity And Public Route QA

Two route policies now conflict:

1. Existing Phase 12 route parity policy treats future beta/product routes as **unmarketed** and accepts production `404` for them.
2. Phase 12.11 explicitly listed those routes for public/marketed verification.

Existing route parity script result:

```text
RESULT: PRODUCTION ROUTE PARITY CHECK PASSED
```

Direct Phase 12.11 route status check:

| Route | Production status |
| --- | ---: |
| `/` | 200 |
| `/features` | 200 |
| `/pricing` | 200 |
| `/faq` | 200 |
| `/how-it-works` | 200 |
| `/intelligence` | 200 |
| `/intelligence/strategy-performance` | 404 |
| `/intelligence/shock-opportunities` | 200 |
| `/intelligence/macro-regime` | 200 |
| `/symbol/AMD` | 200 |
| `/dashboard` | 200 |
| `/terminal` | 200 |
| `/mobile` | 404 |
| `/community` | 404 |
| `/developers` | 404 |
| `/team` | 404 |
| `/strategy-labs` | 404 |

If `/mobile`, `/community`, `/developers`, `/team`, `/strategy-labs`, and `/intelligence/strategy-performance` are now considered marketed/public beta routes, production parity is **blocked** until they are deployed or removed from the Phase 12.11 public list.

## Production Health And R2 Backup Reporting

Result: **passed as health reporting**.

`https://tradeveto.com/api/health`:

- HTTP 200.
- `ok: true`.

`https://tradeveto.com/api/health/deep`:

- HTTP 200.
- DB: ok.
- Scanner: ok.
- Scanner age: about 3-4 minutes during check.
- Backup: ok.
- Local backup: ok.
- R2 offsite backup: ok.
- Active offsite provider: R2.

This is good operational telemetry, but it is not a substitute for a restore drill or direct R2 integrity drill from the trusted operator environment.

## Other QA Results

| Check | Result |
| --- | --- |
| Extended launch gate | Passed: `CONTROLLED PUBLIC BETA READY` under existing route policy |
| Performance budget | Passed for deployed routes |
| Billing route QA | Passed |
| Email DNS/route QA | Passed with warnings; canary not sent |
| Security abuse QA | Passed with 0 warnings |
| API platform route QA | Passed under current deployed-route policy |
| Public route parity script | Passed under current unmarketed-future-route policy |

## Local Validation

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm test -- --runInBand` | Passed, 363 tests |
| `npm run build` | Passed |
| `npm audit --omit=dev` | Passed, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | Passed |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | Passed, 0 errors |
| `git diff --check` | Passed |

## Final GO / NO-GO Review

| Launch target | Verdict | Reason |
| --- | --- | --- |
| Controlled 25-user beta | NO-GO | Operator-only restore, ops, monitoring, email canary proof not closed. Explicit Phase 12.11 route list also includes production 404s. |
| Limited paid beta | NO-GO | Stripe route QA passed, but full test-mode lifecycle proof was not completed in this run. |
| Investor demos | CONDITIONAL | Safe for product demo if avoiding undeployed routes and clearly stating ops proof is pending. Not safe to claim final launch-ready operations. |
| Mobile/PWA beta | NO-GO | `/mobile` returns 404 on production even though it exists in the local build. |
| Public marketing push | NO-GO | Listed public/future routes return 404, and email canary/inbox proof is not complete. |

## Safe Beta Cap

Keep the cap at:

```text
25 invited users
```

Do not send invites until all final blockers close. After closure, use the existing ramp:

1. First 10 invites.
2. Observe one market session.
3. Review onboarding, first useful action, support, LLM spend, route latency, and health.
4. Send remaining 15 only if daily ops review remains green.

## Rollback Conditions

Pause invites or roll back immediately if any of these occur:

- `/api/health` fails for more than 2 minutes.
- `/api/health/deep` reports DB, scanner, backup, or offsite backup failure.
- Restore drill fails.
- Monitoring scripts stop ingesting.
- Stripe checkout/webhook creates incorrect entitlement state.
- Email canaries fail or land in spam during launch.
- Core route p95 exceeds budget and does not recover.
- LLM spend crosses 80% of the daily budget before expected usage.
- Repeated support tickets report the same blocking workflow.
- Production logs expose secret-like values.

## Support Escalation Summary

Before invites:

- Assign launch owner, ops owner, billing owner, email owner, and support owner.
- Keep support macros active in `/admin/beta`.
- Route billing issues to billing owner.
- Route auth/email verification issues to support owner.
- Route health/backup/scanner issues to ops owner.
- Review `/admin/support`, `/admin/beta`, and `/admin/monitoring` daily.

## Required Closure Checklist

To change status to `TRADEVETO CONTROLLED BETA READY`, all of these must be true:

1. Production-host restore drill returns `BACKUP RESTORE DRILL PASSED`.
2. Production-host ops green check returns `PRODUCTION OPS GREEN`.
3. Monitoring synthetics and system checks ingest successfully with current timestamps.
4. Live email canaries arrive in inbox with SPF/DKIM/DMARC pass.
5. Full Stripe test-mode lifecycle is completed and documented.
6. Phase 12.11 route list is reconciled: either deploy listed routes or explicitly remove them from marketed/public beta scope.
7. `/api/health` and `/api/health/deep` remain green.
8. Performance budget remains green.
