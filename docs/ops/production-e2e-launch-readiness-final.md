# Production E2E Launch Readiness Final

Date: 2026-05-10
Target: `https://tradeveto.com`
Execution environment: production host `onsre-node-01`
Execution user: `sre`
App path: `/opt/apps/market-alpha-scanner/app`
Commit: `b1f2682f2031344c8a6b9e8414c0e404ff2c69ac`

## Final Status

```text
TRADEVETO STILL BLOCKED
```

The retest was run from the real production host via `ssh sre@100.68.155.121`, not from the local Mac. Production health, backups, restore drill, monitoring ingest, SEO/social checks, security QA, and deployed-route performance are mostly healthy. The launch gate still fails because production is behind the local route/API surface, ops green does not return the required result, email inbox placement is not proven, Stripe full lifecycle is not proven, and invite-only beta controls are not configured/enforced.

## Executive GO / NO-GO

| Target | Verdict | Reason |
| --- | --- | --- |
| Controlled 25-user beta | NO-GO | Strict route parity fails, ops green fails, email canary is not proven, Stripe lifecycle is not proven, and invite/cap controls are not configured. |
| Limited paid beta | NO-GO | Billing route QA passes, but disposable test checkout, webhook, premium entitlement, cancellation, reactivation, and idempotency lifecycle are not proven. |
| Investor demos | CONDITIONAL | Deployed public/core product surfaces are healthy enough for curated demos, but avoid undeployed routes and do not claim launch readiness. |
| Mobile/PWA beta | NO-GO | `/mobile`, manifest, service worker, icons, and push status return `404`. |
| Public marketing push | NO-GO | `/intelligence/strategy-performance` returns `404`, email inbox placement is unproven, and launch-scope route policy is inconsistent. |
| Full public scale | NO-GO | Route parity, billing, email, API/PWA, and ops runbook parity are incomplete. |

## 1. Production Environment Proof

| Check | Result |
| --- | --- |
| Hostname | `onsre-node-01` |
| User | `sre` |
| App path | `/opt/apps/market-alpha-scanner/app` |
| Commit | `b1f2682f2031344c8a6b9e8414c0e404ff2c69ac` |
| Initial worktree | clean |
| Disk | 16% used, 761G available |
| Memory | 31Gi total, about 26Gi available |
| Load average | about `0.47, 0.42, 0.38` |
| Sudo non-interactive | available |

Visible containers:

| Container | Status |
| --- | --- |
| `market-alpha-frontend` | healthy |
| `market-alpha-scanner-market-alpha-postgres-1` | healthy |
| `hdsm-caddy` | healthy |
| `hdsm-mysql` | healthy |
| `hdsm-app` | unhealthy, appears outside TradeVeto/market-alpha surface but should be investigated by host owner |

## 2. Deploy Parity / Route Check

Strict launch-scope route check from production host:

| Route | Expected | Status | Verdict |
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
| `/terminal` | not 404 | 200 | PASS |
| `/dashboard` | not 404 | 200 | PASS |
| `/opportunities` | not 404 | 200 | PASS |
| `/history?symbol=AMD` | not 404 | 200 | PASS |
| `/paper` | not 404 | 200 | PASS |
| `/account` | not 404 | 200 | PASS |
| `/support` | not 404 | 200 | PASS |
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

Production/local mismatch:

- The production build does not include `/mobile`, `/community`, `/developers`, `/team`, `/strategy-labs`, `/api/v1/*`, or `/intelligence/strategy-performance`.
- The local repo includes those routes, so production is behind the requested launch scope.
- If those routes are not in controlled beta scope, remove them from the launch gate, public route list, sitemap/nav expectations, and beta readiness checklist.

## 3. Ops Green Check

The production repo does not have the newer `tools/ops/tradeveto-ops-green-check.sh` script. I executed the current check on the production host by streaming the checked script to `bash` so it could inspect real production Docker, cron, backup, R2, and log paths.

Result:

```text
RESULT: OPS HARDENING STILL REQUIRED
```

Passed:

- Landing, pricing, features, health, and deep health returned 200.
- OpenGraph image returned 200 image/png.
- TLS certificate expires in 86 days.
- Market-alpha containers are running without unhealthy status.
- Postgres accepts `pg_isready`.
- Monitoring cron exists and references `monitoring:synthetics`.
- No stale `rclone` process older than 3600s.
- No stale scanner process older than 7200s.
- Latest local Postgres backup gzip verifies.
- Latest scanner backup tar verifies.
- R2/offsite backup prefixes are listable.
- Recent ops logs did not show obvious secret patterns.

Failures:

- Backup cron exists but references `market-alpha-backup`, not the expected `tradeveto-backup` wrapper.
- Stripe reconciliation cron exists but references `market-alpha-stripe-reconcile`, not the expected `tradeveto-stripe-reconcile` wrapper.

Smallest fix:

- Either update production cron to use `/opt/ops/tradeveto-backup.sh` and `/opt/ops/tradeveto-stripe-reconcile.sh`, or update the ops green policy to explicitly accept the legacy script names as supported production aliases.
- Deploy the current `tradeveto-*` ops scripts into production repo or `/opt/ops` so launch checks are directly runnable without streaming scripts from another checkout.

## 4. Health / Deep Health

`/api/health`:

- HTTP 200.
- `ok: true`.
- Service: `tradeveto-frontend`.
- Uptime at check time: 51,163 seconds.

`/api/health/deep`:

| Component | Result |
| --- | --- |
| DB | ok |
| Scanner | ok |
| Scanner age | about 3 minutes |
| Local backup | ok |
| R2/offsite backup | ok |
| Backup age | about 48-49 minutes |
| Latest Postgres backup | `2026-05-10_12-00.sql.gz` |
| Latest scanner backup | `2026-05-10_12-00.tar.gz` |
| Active offsite provider | R2 |

Health verdict: PASS.

## 5. Backup Restore Drill

The production repo does not have `tools/ops/tradeveto-restore-drill.sh`, so I ran an equivalent isolated restore drill from the production host using `/opt/ops/market-alpha-restore.sh`.

Result:

```text
RESULT: BACKUP RESTORE DRILL PASSED
```

Restore proof:

| Item | Result |
| --- | --- |
| Latest Postgres backup | `2026-05-10_12-00.sql.gz` |
| Postgres backup size | 167,624,991 bytes |
| Latest scanner backup | `2026-05-10_12-00.tar.gz` |
| Scanner backup size | 59,861,543 bytes |
| Postgres gzip verification | passed |
| Scanner tar verification | passed |
| Temporary restore DB | `tradeveto_restore_drill_20260510_125059_3141950` |
| Postgres restore duration | 41 seconds |
| Total restore drill duration / RTO estimate | 50 seconds |
| RPO estimate | 50 minutes |
| Public table count | 51 |
| Scanner artifacts restored | 1,980 files, 413,286,858 bytes |
| Cleanup | Temporary DB and temp extraction path cleaned by trap |

Verified table counts:

| Table | Rows |
| --- | ---: |
| `scan_runs` | 1,846 |
| `scanner_signals` | 203,816 |
| `symbol_price_history` | 112,100 |
| `forward_returns` | 38,295 |
| `market_memory_snapshots` | 178,623 |
| `narrative_intelligence_snapshots` | 222 |
| `shock_move_patterns` | 333 |
| `shock_move_events` | 5,598 |
| `user_decision_journal` | 0 |
| `monitoring_events` | 694 |

Gap:

- `community_replay_studies` was not present in the restored production schema, consistent with the production deploy not including newer community/replay platform tables.

R2 verification:

- R2 Postgres prefix lists through `2026-05-10_12-00.sql.gz`.
- R2 scanner prefix lists through `2026-05-10_12-00.tar.gz`.
- Local backup files exist and match the latest health report.

## 6. Monitoring Synthetics And System

Commands run from production host with production env loaded:

```bash
cd /opt/apps/market-alpha-scanner/app/frontend
set -a && source ../.env && set +a
npm run monitoring:synthetics
npm run monitoring:system
```

Synthetics result:

```json
{"checked":16,"failed":0,"ok":16,"warned":0}
```

System result:

- CPU: about 4.71%.
- Disk: 16% used.
- Memory: about 14.89% used.
- Backup size: 15,359,950,096 bytes.
- Scanner output size: 416,605,595 bytes.
- Reported TradeVeto containers: frontend healthy, Postgres healthy.

Fresh DB proof:

| Metric | Value |
| --- | --- |
| Latest synthetic check row | `2026-05-10 12:55:04.487012+00` |
| Synthetic rows in last 10 minutes | 48 |
| Latest system metric row | `2026-05-10 12:55:02.152999+00` |
| System rows in last 10 minutes | 3 |
| Synthetic statuses in last 10 minutes | all `ok` |

Monitoring verdict: PASS.

## 7. Email Canary / Inbox Placement

The email infrastructure check was run from production host with production SMTP env loaded.

Result:

```text
RESULT: EMAIL DNS QA PASSED_WITH_WARNINGS warnings=3
```

Passed:

- Google Workspace MX present.
- SPF exists and includes Google Workspace.
- DKIM exists at `google._domainkey.tradeveto.com`.
- DMARC exists.
- SMTP env present, values redacted.
- `smtp.gmail.com:587` STARTTLS reachable.
- `/api/health`, `/api/health/deep`, `/support/contact`, and `/reset-password` returned expected statuses.

Warnings/blocker:

- `TRADEVETO_EMAIL_QA_SEND_TO` is not configured, so live inbox placement was not checked.
- SPF uses `~all`.
- DMARC is `p=none`.

Email verdict: NO-GO for launch proof until a QA inbox is configured and canaries are confirmed inbox, not spam.

## 8. Stripe Test-Mode Full Lifecycle

Route-level billing QA was run from production host.

Result:

```text
RESULT: BILLING ROUTE QA PASSED
```

Passed:

- `/pricing`: 200.
- `/account`: 200.
- `/api/health`: 200.
- `/api/health/deep`: 200.
- Anonymous checkout fails closed with 401.
- Anonymous portal fails closed with 401.
- Invalid webhook payload fails closed with 400.

Not proven:

- Disposable beta test account checkout.
- Legal acceptance to checkout path.
- Stripe checkout completion.
- 3-month coupon/trial behavior.
- Webhook delivery.
- Premium entitlement unlock.
- Account billing state.
- Billing portal for test customer.
- Cancel at period end.
- Renewal/reactivation.
- Duplicate webhook idempotency.
- Stripe customer cleanup.

Stripe lifecycle verdict: NO-GO for limited paid beta.

## 9. Auth / Invite / 25-User Cap

Findings:

- `GET /api/auth/oauth-providers`: Google OAuth disabled.
- `GET /api/auth/me`: anonymous state returns safely.
- `GET /reset-password`: 200.
- `GET /login`: 404.
- `GET /register`: 404.
- `GET /onboarding`: 404.
- No beta invite/cap env vars are configured:
  - `TRADEVETO_BETA_SIGNUP_MODE`: missing.
  - `MARKET_ALPHA_BETA_SIGNUP_MODE`: missing.
  - `TRADEVETO_BETA_USER_CAP`: missing.
  - `MARKET_ALPHA_BETA_USER_CAP`: missing.
  - `TRADEVETO_BETA_INVITE_CODE`: missing.
  - `MARKET_ALPHA_BETA_INVITE_CODE`: missing.
  - allowed beta email envs: missing.
- Production currently has 9 users after cleanup.

A disposable registration with `inviteCode: INVALID-CODE` was accepted by `/api/auth/register`. The test user was then deleted from child tables and `users`; remaining count for that disposable email is 0.

Auth/invite verdict: NO-GO for invite-only controlled beta. Invalid invite code acceptance is a launch blocker if the 25-user cohort must be invite-gated.

## 10. Premium Gating

Anonymous route/API checks:

| Surface | Status |
| --- | --- |
| `/api/auth/me` | anonymous, not premium |
| `/api/history/latest` | 401, premium access denied |
| `/api/admin/summary` | 401, admin denied |
| `/api/stripe/checkout` POST | 401, sign-in required |
| `/api/stripe/portal` POST | 401, sign-in required |
| `/api/paper/account` | 200 with `authenticated:false`, no account |
| `/api/developer/api-keys` | 404, route not deployed |
| `/api/team/workspace` | 404, route not deployed |

Not proven:

- Free user upgrade gates.
- Premium user unlocks.
- Cancelled-but-active state.
- Expired entitlement revocation.
- Premium Strategy Labs unlock, because `/strategy-labs` is not deployed.

Premium gating verdict: partial PASS for anonymous denial, NO-GO for full entitlement lifecycle proof.

## 11. Mobile / PWA

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

Mobile/PWA verdict: NO-GO.

## 12. SEO / Social / OG

Passed:

- `/robots.txt`: 200.
- `/sitemap.xml`: 200.
- `/og-image.png`: 200 image/png.
- Checked public pages did not show stale `Market Alpha` branding.
- Checked public pages include risk/research/not-advice language.
- Crawler user agents received 200 and OpenGraph tags:
  - `facebookexternalhit/1.1`
  - `Facebot`
  - `Twitterbot/1.0`
  - `LinkedInBot/1.0`
  - `Slackbot-LinkExpanding`
  - `Discordbot/2.0`

Remaining blocker:

- `/intelligence/strategy-performance` returns 404 while listed in launch scope.

Facebook thumbnail issue was not reproducible at the HTTP metadata level during this check.

## 13. Security And Abuse

Security script was executed from the production host by streaming the current check script to `bash`.

Result:

```text
RESULT: SECURITY ABUSE QA PASSED with 0 warning(s)
```

Verified:

- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy present.
- `/api/admin/summary`: 401.
- `/api/history/latest`: 401.
- malformed Stripe webhook: 400.
- unauthenticated support mutation: 403.
- no secret-like values in checked responses.

Security verdict: PASS for deployed production surface.

## 14. API And Webhook

API platform check result:

```text
RESULT: API PLATFORM ROUTE QA PASSED
```

But the check passes because API platform routes are accepted as intentionally undeployed. Strict launch-scope status:

| Route | Status |
| --- | ---: |
| `/developers` | 404 |
| `/api/v1/opportunities` | 404 |
| `/api/v1/macro` | 404 |
| `/api/v1/shocks` | 404 |
| `/api/v1/replay?symbol=AMD` | 404 |
| `/api/v1/portfolio/scenario` | 404 |

API/webhook verdict: NO-GO if developer/API platform is included in beta scope; acceptable only if explicitly hidden and removed from launch criteria.

## 15. Performance

Strict performance command:

```bash
TRADEVETO_PERFORMANCE_ALLOW_404=false tools/ops/tradeveto-performance-budget-check.sh
```

Executed on production host by streaming the current check script to `bash`.

Result: FAIL because `/strategy-labs` returns 404.

Measured deployed routes before failure:

| Route | Status | Latency |
| --- | ---: | ---: |
| `/api/health` | 200 | 117 ms |
| `/api/health/deep` | 200 | 115 ms |
| `/terminal` | 200 | 120 ms |
| `/dashboard` | 200 | 99 ms |
| `/opportunities` | 200 | 120 ms |
| `/symbol/AMD` | 200 | 200 ms |
| `/paper` | 200 | 100 ms |
| `/strategy-labs` | 404 | FAIL |

Performance verdict: deployed routes are fast; strict launch-scope performance fails on undeployed routes.

## 16. Support And Feedback

Checks:

| Surface | Status | Notes |
| --- | ---: | --- |
| `/support` | 200 | reachable |
| `/support/contact` | 200 | reachable |
| `/support/tickets` | 200 | reachable |
| `/admin/support` | 404 | admin support surface not deployed in current production build |
| `/api/support/contact` POST | 400 | `support_contact_unavailable` |
| `/api/analytics/feedback` POST | 200 | feedback accepted; disposable feedback row was deleted after test |

Support verdict: public support pages are reachable, but support notification/admin workflow is not fully proven.

## 17. Production Code Validation

Run from production host:

| Command | Result |
| --- | --- |
| `npm run lint` | passed |
| `npm test -- --runInBand` | passed, 289 tests |
| `npm run build` | passed |
| `npm audit --omit=dev` | passed, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | passed |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | passed, 0 errors |

Note: local development repo has a larger/newer route and test surface than production. Production passed its own current validation, but this reinforces the deploy parity blocker.

## Remaining Blockers

1. Deploy or remove from beta scope all strict-launch routes currently returning 404:
   - `/intelligence/strategy-performance`
   - `/mobile`
   - `/community`
   - `/developers`
   - `/team`
   - `/strategy-labs`
   - `/api/v1/opportunities`
   - PWA assets and push status route
2. Fix ops green failures by aligning cron jobs with expected `tradeveto-*` wrappers or updating the policy to accept legacy `market-alpha-*` scripts.
3. Deploy the current `tradeveto-*` ops scripts to production so checks are runnable directly from `/opt/apps/market-alpha-scanner/app/tools/ops`.
4. Configure `TRADEVETO_EMAIL_QA_SEND_TO` and prove real inbox delivery with SPF/DKIM/DMARC pass.
5. Complete Stripe test-mode lifecycle with a disposable verified user/customer.
6. Configure invite-only beta controls and 25-user cap, or explicitly document open signup as intentional.
7. Prove free, premium, cancelled-active, and expired entitlement states end-to-end.
8. Investigate unrelated unhealthy `hdsm-app` container or document it as outside TradeVeto launch scope.
9. Deploy or explicitly remove admin support/developer/team/community surfaces from beta scope.

## Safe Beta Cap

Keep the planned cap at:

```text
25 invited users
```

Do not send invites until the blockers above are closed. After closure, use a staged ramp:

1. Invite 5-10 users.
2. Observe one full market session.
3. Review monitoring, support, onboarding, billing, email, scanner freshness, LLM spend, route latency, and backup health.
4. Invite the remaining users only if the daily operator review stays green.

## Rollback Conditions

Pause invites or roll back if any of these occur:

- `/api/health` fails for more than 2 minutes.
- `/api/health/deep` reports DB, scanner, local backup, or R2 backup failure.
- Restore drill cannot be repeated successfully.
- Monitoring synthetic/system ingestion stops.
- Email canaries fail or land in spam.
- Stripe checkout/webhook creates stale or incorrect entitlement state.
- Core route latency exceeds budget and does not recover.
- LLM spend crosses 80% of daily budget before expected usage.
- Logs expose secret-like values.
- Multiple users report the same onboarding, billing, or premium-gating blocker.

## Support Escalation Plan

Before invites:

- Assign launch owner, ops owner, billing owner, email owner, and support owner.
- Route billing failures to billing owner.
- Route auth/email failures to support owner.
- Route scanner/backup/health failures to ops owner.
- Review monitoring and support queues daily after the admin support/monitoring surfaces are deployed and reachable.
- Keep rollback authority explicit for launch owner and ops owner.

## Final Recommendation

TradeVeto is operationally healthier than the prior local-only audit suggested: restore drill passed, R2 backups are listable, monitoring ingestion is fresh, and deployed routes are fast. It is still not ready for controlled beta because production does not match the requested launch route/API scope, ops green fails on cron policy, live email inbox proof is missing, Stripe lifecycle is unproven, and invite/cap controls are not configured.

Final status:

```text
TRADEVETO STILL BLOCKED
```
