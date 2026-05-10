# Phase 12.9 Launch Gate Rerun And Operational Proof

Date: 2026-05-10

## Verdict

Current verdict: **NO-GO until operator-only proof is rerun from the production host and trusted email/monitoring environment.**

The production HTTP launch gate is green, route parity is green, deep health is green, billing route QA is green, security route QA is green, API route QA is green for the currently deployed route policy, and performance budgets are green.

The remaining blockers are operational proof gaps, not application-code failures:

1. Backup restore drill could not run from this local desktop environment because production backup env and Postgres container access are not present.
2. Production ops green check must be rerun on the production host; local execution cannot see `/opt/backups`, Docker containers, cron, or production logs.
3. Monitoring synthetics and monitoring system checks require `TRADEVETO_MONITORING_TOKEN`.
4. Email DNS/route QA passed with warnings, but live inbox canaries were not sent because SMTP env and `TRADEVETO_EMAIL_QA_SEND_TO` were unavailable.

Final status for this rerun:

```text
CONTROLLED BETA STILL BLOCKED
```

## Commands Run

| Area | Command | Result |
| --- | --- | --- |
| Route parity | `tools/ops/tradeveto-public-route-parity-check.sh https://tradeveto.com` | Passed |
| Extended beta gate | `tools/ops/tradeveto-controlled-beta-launch-check.sh --base-url https://tradeveto.com --extended` | Passed: `CONTROLLED PUBLIC BETA READY` |
| Production health | `GET https://tradeveto.com/api/health` | HTTP 200, `ok: true` |
| Deep health | `GET https://tradeveto.com/api/health/deep` | HTTP 200, DB ok, scanner ok, local backup ok, R2 offsite backup ok |
| Performance | `tools/ops/tradeveto-performance-budget-check.sh` | Passed for deployed routes |
| Billing route QA | `tools/ops/tradeveto-billing-lifecycle-check.sh` | Passed |
| Email DNS/route QA | `tools/ops/tradeveto-email-infrastructure-check.sh` | Passed with warnings |
| Security abuse QA | `tools/ops/tradeveto-security-abuse-check.sh` | Passed |
| API route QA | `tools/ops/tradeveto-api-platform-check.sh` | Passed for deployed route policy |
| Ops green check | `tools/ops/tradeveto-ops-green-check.sh --base-url https://tradeveto.com` | Failed locally because host-only Docker, cron, backup, and log paths are unavailable |
| Restore drill | `tools/ops/tradeveto-restore-drill.sh` | Blocked locally: `POSTGRES_USER is required` |
| Monitoring synthetics | `npm run monitoring:synthetics` | Blocked locally: `TRADEVETO_MONITORING_TOKEN is required` |
| Monitoring system | `npm run monitoring:system` | Blocked locally: `TRADEVETO_MONITORING_TOKEN is required` |

## Production Health Snapshot

Observed from `https://tradeveto.com/api/health/deep`:

- DB: ok.
- Scanner: ok, fresh within minutes.
- Backup: ok.
- Local backup: ok.
- Offsite backup: ok.
- Active offsite provider: R2.
- Latest event: backup completed.
- Latest Postgres backup: `2026-05-10_06-00.sql.gz`.
- Latest scanner backup: `2026-05-10_06-00.tar.gz`.

This proves backup freshness and R2 reporting. It does not replace the restore drill.

## Blocker List

### P0/P1 Launch Blockers

1. **Restore drill not rerun from production host**
   - Required command:
     ```bash
     sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-restore-drill.sh
     ```
   - Required result:
     ```text
     RESULT: BACKUP RESTORE DRILL PASSED
     ```

2. **Production ops green check not rerun from production host**
   - Required command:
     ```bash
     sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh --base-url https://tradeveto.com
     ```
   - Required result:
     ```text
     RESULT: PRODUCTION OPS GREEN
     ```

3. **Monitoring synthetics/system ingest not verified from tokened environment**
   - Required commands:
     ```bash
     cd /opt/apps/market-alpha-scanner/app/frontend
     TRADEVETO_MONITORING_TOKEN=... npm run monitoring:synthetics
     TRADEVETO_MONITORING_TOKEN=... npm run monitoring:system
     ```
   - Required result: both scripts ingest successfully and `/admin/monitoring` shows current checks.

4. **Email canary / inbox placement not verified**
   - DNS and route QA passed, but live canary send did not run.
   - Required command from a trusted environment:
     ```bash
     TRADEVETO_EMAIL_QA_SEND_TO=<test inbox> \
     SMTP_HOST=... SMTP_USER=... SMTP_PASS=... EMAIL_FROM=... SUPPORT_EMAIL=... BILLING_EMAIL=... \
       tools/ops/tradeveto-email-infrastructure-check.sh
     ```
   - Required proof: canaries delivered to inbox, not spam, with SPF/DKIM/DMARC pass in received headers.

## Non-Blocking Warnings

- SPF uses `~all`. Acceptable for controlled beta, but move to `-all` after sender inventory is complete.
- DMARC is `p=none`. Acceptable for monitoring mode, but move toward `quarantine` or `reject` after inbox placement is stable.
- `/strategy-labs`, `/community`, `/developers`, `/team`, `/api/v1/*`, and `/intelligence/strategy-performance` are still 404 on production. This is currently acceptable because route parity treats them as not marketed/deployed beta surfaces. Do not market those routes until they are deployed and added back to the launch gate.

## Launch Checklist

Before sending the first 25-user cohort:

1. Confirm production route parity passed.
2. Confirm extended beta gate passed.
3. Confirm `/api/health` and `/api/health/deep` are green.
4. Run production-host ops green check.
5. Run production-host backup restore drill.
6. Run monitoring synthetics and system checks with the production ingest token.
7. Run email canary sends and confirm inbox placement.
8. Confirm Stripe dashboard webhook delivery is healthy after the route QA pass.
9. Confirm `TRADEVETO_BETA_SIGNUP_MODE=invite`, `TRADEVETO_BETA_INVITE_CODE`, and `TRADEVETO_BETA_USER_CAP=25`.
10. Confirm support owner, billing owner, and rollback owner are available during invite send.

## Rollback Checklist

If any P0/P1 issue appears during launch:

1. Pause invites immediately.
2. Preserve evidence: health output, deep health output, deployment SHA, logs, Stripe event IDs, support examples, and route timing output.
3. Roll back to the last known-good image or commit.
4. Do not roll back DB migrations unless a tested migration-specific rollback exists.
5. Re-run `/api/health`, `/api/health/deep`, route parity, performance budget, monitoring checks, and post-deploy backup.
6. Resume invites only after the owner records the incident outcome and confirms the gate is green.

## Remaining Launch Risks

- Host-only operational checks still depend on production shell access.
- Email delivery is DNS-ready but not fully inbox-proven in this rerun.
- Monitoring scripts fail closed without `TRADEVETO_MONITORING_TOKEN`; that is correct behavior, but it means this desktop run cannot prove monitoring ingest.
- API/developer surfaces are not deployed on production and should remain unmarketed.
- Controlled beta should stay capped at 25 users until two consecutive market days show healthy deep health, route budgets, support load, LLM spend, and onboarding completion.
