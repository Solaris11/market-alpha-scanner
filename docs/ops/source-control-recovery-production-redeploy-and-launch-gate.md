# Source Control Recovery, Production Redeploy, and Launch Gate Rerun

Date: 2026-05-10

## Executive Summary

Source-control drift was the root cause of the Phase 10-12 production mismatch. Local, origin, and production were all on `b1f2682`, while the local and production worktrees contained unpublished Phase 10-12 files. The intended work was committed, pushed, production was reset to Git source of truth, migrations were applied, the frontend was rebuilt, and route parity was restored.

The production operational gate is materially stronger now: ops green, deep health, monitoring, route parity, security, API route protection, performance budget, post-deploy R2 backup, and restore drill all passed from the production host.

Overall launch status remains blocked under the strict launch rule because full Stripe test-mode lifecycle proof and receiver-side email inbox placement proof are still not complete.

Final status: TRADEVETO STILL BLOCKED

## Source Control Recovery

- Initial local/prod/origin commit: `b1f2682f2031344c8a6b9e8414c0e404ff2c69ac`
- Initial local dirty count: 268 files
- Initial local dirty breakdown: 149 modified, 119 untracked
- Preserved production-only public verification file: `frontend/public/BingSiteAuth.xml`
- Added missing PWA asset: `frontend/public/icon-512.png`
- Commit 1: `f2eed383699897adcec8d67c118544576d89492c` - `Publish Phase 10-12 launch readiness work`
- Commit 2: `904449f35e878fa80c331060f66bccdcc6f97da2` - `Pass beta cap and email QA env to frontend`
- Local/origin/prod final commit: `904449f35e878fa80c331060f66bccdcc6f97da2`
- Local worktree after push: clean
- Production worktree after reset: clean

## Production Reset and Deploy

- Production host: `onsre-node-01`
- Production user: `sre`
- Production app path: `/opt/apps/market-alpha-scanner/app`
- Dirty production status preserved:
  - `/tmp/tradeveto-prod-dirty-status-before-reset.txt`
  - `/tmp/tradeveto-prod-dirty-diffstat-before-reset.txt`
- Production reset command path: `git fetch origin`, `git reset --hard origin/main`, `git clean -fd`
- Frontend service: `market-alpha-frontend`
- Rebuild/redeploy: `docker compose up -d --build market-alpha-frontend`
- Final TradeVeto containers:
  - `market-alpha-frontend`: healthy
  - `market-alpha-scanner-market-alpha-postgres-1`: healthy

## Migrations

Migration command used: `tools/db/run-migrations.sh`

Applied migrations:
- `20260509_100300_mobile_push_intelligence.sql`
- `20260509_110700_team_intelligence.sql`
- `20260509_120800_developer_platform.sql`
- `20260509_130900_community_intelligence.sql`
- `20260510_061500_developer_platform_hardening.sql`
- `20260510_071800_llm_cost_controls.sql`

Result: `applied=6 skipped=34`

## Route Parity

Production route parity is fixed. Representative statuses:

| Route | Status |
| --- | ---: |
| `/` | 200 |
| `/features` | 200 |
| `/pricing` | 200 |
| `/intelligence/strategy-performance` | 200 |
| `/mobile` | 200 |
| `/community` | 200 |
| `/developers` | 200 |
| `/team` | 200 |
| `/strategy-labs` | 200 |
| `/manifest.webmanifest` | 200 |
| `/tradeveto-sw.js` | 200 |
| `/icon-192.png` | 200 |
| `/icon-512.png` | 200 |
| `/api/v1/opportunities` | 401 |
| `/api/v1/macro` | 401 |
| `/api/v1/shocks` | 401 |
| `/api/v1/replay?symbol=AMD` | 401 |
| `/api/v1/portfolio/scenario` | 405/401 depending method |
| `/api/push/status` | 401 |

Protected API routes fail closed and no longer 404.

## Beta Invite Enforcement

Production env is configured and passed into the frontend container:
- `TRADEVETO_BETA_SIGNUP_MODE=invite`
- `TRADEVETO_BETA_USER_CAP=25`
- `TRADEVETO_BETA_ALLOWED_EMAILS` set
- `TRADEVETO_BETA_INVITE_CODE` set
- `TRADEVETO_EMAIL_QA_SEND_TO` set

Validation:
- Invalid invite rejected with 403.
- Valid invite accepted with 200 through the production app container.
- Disposable test user cleaned up.
- Active users after cleanup: 9.
- Unit tests cover 25-user cap behavior; production saturation at exactly 25 users was not exercised to avoid creating noisy accounts.

## Health and Ops

Health:
- `/api/health`: 200, `ok=true`
- `/api/health/deep`: 200, DB ok, scanner ok, local backup ok, R2 backup ok

Ops green:
- Result: `PRODUCTION OPS GREEN`
- Pass count: 18
- Warnings: 0
- Failures: 0

Cron/wrapper fix:
- `/etc/cron.d/market-alpha-backup` now references `/opt/ops/tradeveto-backup.sh`
- `/etc/cron.d/market-alpha-stripe-reconcile` now references `/opt/ops/tradeveto-stripe-reconcile.sh`

## Backup and Restore

Post-deploy backup:
- Result: `Post-deploy backup SUCCESS`
- Postgres backup: `2026-05-10_13-45.sql.gz`
- Scanner backup: `2026-05-10_13-46.tar.gz`
- R2/offsite verification: passed

Fresh restore drill:
- Result: `BACKUP RESTORE DRILL PASSED`
- Restored public tables: 68
- `scan_runs`: 1,853 rows
- `scanner_signals`: 204,593 rows
- `symbol_price_history`: 112,100 rows
- `forward_returns`: 38,295 rows
- `market_memory_snapshots`: 179,400 rows
- `shock_move_patterns`: 333 rows
- `shock_move_events`: 5,598 rows
- `community_replay_studies`: present, 0 rows
- Restored scanner files: 1,987
- RTO estimate: 46 seconds
- RPO estimate: 2 minutes Postgres, 1 minute scanner

## Monitoring

Monitoring commands:
- `npm run monitoring:synthetics`
- `npm run monitoring:system`

Results:
- Synthetics: 16 checked, 16 ok, 0 failed
- System metrics: ingested successfully
- Docker metrics reported TradeVeto frontend and Postgres healthy
- Disk usage: 16%
- Memory usage: 15.75%
- CPU: 2.68%

## Email Canary

DNS:
- MX: Google Workspace
- SPF: present and includes Google Workspace
- DKIM: present
- DMARC: present

Canary:
- SMTP env loaded from production `.env`
- STARTTLS reachable
- Smoke emails sent to `support@tradeveto.com` for system, verification, password reset, support, billing, strategy, replay, and onboarding templates
- No stale Market Alpha branding detected by template tests

Warnings:
- SPF uses `~all`
- DMARC is `p=none`
- Receiver-side inbox placement and received-header SPF/DKIM/DMARC alignment were not independently verified in a QA mailbox.

## Stripe Billing

Billing route QA passed:
- `/pricing`: 200
- `/account`: 200
- `/api/stripe/checkout` unauthenticated: 401
- `/api/stripe/portal` unauthenticated: 401
- `/api/stripe/webhook` unsigned payload: 400

Blocking gap:
- Production Stripe key mode is live, not test.
- A full disposable test-mode checkout, webhook delivery, entitlement unlock, portal, cancel, renew/reactivate, duplicate webhook replay, and cleanup flow was not completed.
- Limited paid beta remains blocked until this is proven in test mode or through a safe Stripe CLI/webhook drill.

## Validation Commands

Production-host validation:
- `npm run lint`: passed
- `npm test -- --runInBand`: 363 passed, 0 failed
- `npm run build`: passed
- `npm audit --omit=dev`: 0 vulnerabilities
- `python3 -m py_compile $(git ls-files '*.py')`: passed
- `npx pyright . --pythonpath .venv/bin/python --warnings`: 0 errors, 0 warnings
- `tools/ops/tradeveto-ops-green-check.sh --base-url https://tradeveto.com`: passed
- `tools/ops/tradeveto-restore-drill.sh`: passed
- `npm run monitoring:synthetics`: passed
- `npm run monitoring:system`: passed
- `tools/ops/tradeveto-email-infrastructure-check.sh`: passed with DNS policy warnings
- `tools/ops/tradeveto-billing-lifecycle-check.sh`: billing route QA passed
- `tools/ops/tradeveto-security-abuse-check.sh`: passed
- `tools/ops/tradeveto-api-platform-check.sh`: passed
- `tools/ops/tradeveto-performance-budget-check.sh`: passed
- `tools/ops/tradeveto-public-route-parity-check.sh --base-url https://tradeveto.com`: passed
- `tools/ops/tradeveto-controlled-beta-launch-check.sh --base-url https://tradeveto.com --extended`: `CONTROLLED PUBLIC BETA READY`

## Final Verdicts

| Launch Area | Verdict | Reason |
| --- | --- | --- |
| Controlled 25-user beta | NO-GO under strict gate | Technical gate passes, but strict operator rule requires full Stripe lifecycle and inbox placement proof. |
| Limited paid beta | NO-GO | Full Stripe test-mode lifecycle not proven. |
| Investor demos | CONDITIONAL | Product, routes, ops, restore, monitoring, and security are strong; disclose billing lifecycle gap. |
| Mobile/PWA beta | GO | `/mobile`, manifest, service worker, and icons are deployed. |
| Public marketing push | NO-GO | Email inbox proof and Stripe lifecycle proof remain incomplete. |
| Full public scale | NO-GO | Requires paid lifecycle proof, inbox placement proof, and broader scale testing. |

## Remaining Blockers

1. Stripe full lifecycle proof
   - Need safe test-mode production/staging credentials or Stripe CLI flow.
   - Must prove checkout completion, webhook delivery, entitlement unlock, billing portal, cancel-at-period-end, active-until messaging, renew/reactivate if supported, duplicate webhook idempotency, and cleanup.

2. Receiver-side email placement proof
   - Need access to a QA inbox or deliverability tool.
   - Must verify receipt, inbox vs spam, received headers, SPF pass, DKIM pass, and DMARC alignment.

3. Optional beta cap saturation proof
   - Environment and unit tests cover the 25-user cap.
   - Production was not intentionally filled to 25 users.

## Rollback Conditions

- Any health/deep-health DB or backup failure.
- Scanner freshness outside acceptable beta threshold.
- Monitoring synthetics failures on core routes.
- Email send failures after invite rollout.
- Stripe webhook failures or stale entitlement state.
- Route parity regression on marketed pages.
- Error-rate spike or repeated 5xx on `/terminal`, `/dashboard`, `/opportunities`, `/symbol/AMD`, or billing routes.

## Support Escalation Summary

- Keep 25-user cap.
- Review monitoring and support tickets daily during the first cohort.
- Re-run ops green and deep health after each deploy.
- Run post-deploy backup after every production schema change.
- Do not enable paid beta until Stripe lifecycle proof is complete.

Final status: TRADEVETO STILL BLOCKED
