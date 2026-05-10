# Phase 11.13 Controlled Public Beta Launch Checklist

Date: 2026-05-10

This checklist is the launch gate for controlled public beta invites and limited paid growth. It does not replace the deeper Phase 11 runbooks; it ties them into one GO / NO-GO process.

## Current Verdict

Current readiness: **conditional GO for controlled public beta** after same-day production-host checks pass.

Use final launch status:

```text
CONTROLLED PUBLIC BETA READY
```

only when every required launch gate below is green or has an explicitly accepted controlled-beta exception. Any red gate means:

```text
PUBLIC BETA STILL BLOCKED
```

## Recommended Initial Beta Limits

| Limit | Recommendation | Reason |
| --- | ---: | --- |
| Invited users | 25 accounts for first real cohort | Keeps support, onboarding, LLM cost, and route-performance learning controlled before broader invite waves. |
| Paid seats | 10-15 subscribers | Enough to validate billing without turning support into incident response. |
| Concurrent active users | 10-20 | Matches the current controlled-beta infrastructure envelope. |
| API keys | 10-20 external consumers | Developer API still needs stronger async webhook infrastructure before larger use. |
| Daily LLM spend cap | $25 hard cap | Matches current LLM budget policy; protects public-beta cost exposure. |
| Per-user LLM cap | $1.50/day | Keeps copilot and explanation usage bounded. |
| Invite ramp | 10 users, then 25, then reassess | Increase only after at least one market session without P0/P1 incidents. |

Do not raise the cap until production route budgets, deep health, support load, and LLM spend remain stable for at least two consecutive market days.

## Launch Gate Matrix

| Gate | Required proof | Command / source | GO criteria |
| --- | --- | --- | --- |
| Production health | App health available | `curl -s https://tradeveto.com/api/health \| jq .` | HTTP 200 and `ok: true`. |
| Deep health | DB, scanner, and backups healthy | `curl -s https://tradeveto.com/api/health/deep \| jq .` | HTTP 200; DB ok; backup ok; scanner ok or documented warn. |
| Ops green check | Host, Docker, cron, backup, TLS, logs | `sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh` | `RESULT: PRODUCTION OPS GREEN`. |
| Backup restore proof | Latest backup is restorable | `sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-restore-drill.sh` | Restore drill passed within last 30 days. |
| Stripe lifecycle | Checkout, portal, webhooks, cancellation | `tools/ops/tradeveto-billing-lifecycle-check.sh` plus Stripe test-mode drill | Route QA passes and test-mode lifecycle drill is complete. |
| Email infrastructure | DNS, sender aliases, inbox placement | `tools/ops/tradeveto-email-infrastructure-check.sh` plus canary sends | DNS passes; canaries delivered; SPF/DKIM/DMARC pass. |
| Security / abuse | Headers, auth denial, webhooks, origins | `tools/ops/tradeveto-security-abuse-check.sh` | No failures. Warnings need owner sign-off. |
| API / webhook platform | Invalid-key denial, quotas, docs | `tools/ops/tradeveto-api-platform-check.sh` | Route QA passes; quotas documented; webhooks bounded. |
| Performance | Route budget stability | `tools/ops/tradeveto-performance-budget-check.sh` | All measured routes within budget. |
| LLM cost controls | Budgets, cache, fallback | `docs/ops/phase-11-llm-cost-controls.md` and admin monitoring | Budgets enabled; fallback confirmed; spend visible. |
| Mobile/PWA | Mobile web launch path | `docs/ops/phase-11-mobile-pwa-hardening.md` | PWA ready for beta; known native gaps accepted. |
| Onboarding | First-run clarity | `docs/ops/phase-11-public-beta-onboarding.md` | Beginner and advanced flows exist; no dead-end first-run path. |
| Public trust content | Public copy, SEO, legal/risk language | `docs/ops/phase-11-public-trust-content.md` | Public route QA passed; social metadata valid; risk language present. |
| Support readiness | Support routes and escalation | Support center plus this runbook | Contact/ticket flow works; owner and response windows defined. |
| Rollback readiness | Clear rollback command path | `docs/ops/phase-11-production-ops-green-check.md` | Operator can roll back without improvising. |

## One-Command Launch Gate

Run the read-only launch gate from an operator machine:

```bash
tools/ops/tradeveto-controlled-beta-launch-check.sh --base-url https://tradeveto.com --extended
```

The script checks public routes, health, deep health, SEO/social metadata, security headers, and then runs the focused billing, email, security, API, and performance QA scripts.

Expected launch-day result:

```text
RESULT: CONTROLLED PUBLIC BETA READY
```

If the script returns a conditional result, document the warning and owner before sending invites. If it returns blocked, do not launch.

## Launch-Day Checklist

### T-24 Hours

- Freeze non-critical feature work.
- Confirm no unresolved P0/P1 incidents.
- Confirm backup restore drill date is within the last 30 days.
- Confirm Stripe test-mode lifecycle drill is complete.
- Confirm support inbox owner and backup owner are available.
- Confirm OpenAI budget caps and fallback env are set.
- Confirm beta cap and invite list.
- Confirm launch communication copy includes research-only and not-financial-advice language.

### T-2 Hours

Run:

```bash
curl -s https://tradeveto.com/api/health | jq .
curl -s https://tradeveto.com/api/health/deep | jq .
tools/ops/tradeveto-controlled-beta-launch-check.sh --base-url https://tradeveto.com --extended
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh
```

Then verify:

- Uptime checks are green.
- Monitoring synthetics and system checks are green.
- Backup health is `ok`.
- R2/offsite backup is recent and listable.
- Recent logs do not show secret-like values.
- Stripe webhooks are delivering.
- Support/contact route works.
- Email canary messages are delivered.

### Invite Send

- Send first batch to no more than 25 users.
- Keep paid upgrade visible only if billing route QA and Stripe test-mode drill are green.
- Watch `/api/health/deep`, request metrics, Stripe webhook logs, support inbox, and LLM spend for two hours.
- Record first-hour status in launch notes.

### T+4 Hours

- Review new account count, login errors, checkout errors, support tickets, email failures, route latency, and LLM usage.
- If no P0/P1 and support load is manageable, continue invites up to the day-one cap.
- If any gate degrades, pause invites before debugging.

### T+24 Hours

- Run the launch gate again.
- Run a post-launch backup.
- Review onboarding completion, route budgets, support themes, billing failures, LLM spend, and deep health.
- Decide whether to hold cap, increase by 25 users, or pause.

## Launch-Week Checklist

Daily during the first market week:

- Run `/api/health` and `/api/health/deep`.
- Run monitoring synthetics and system checks.
- Check backup freshness and latest R2 success.
- Review Stripe webhook delivery and failed payments.
- Review support tickets and response time.
- Review LLM spend, blocked calls, cache hits, and fallback events.
- Review route budgets for terminal, dashboard, opportunities, symbol detail, replay, and strategy pages.
- Review onboarding drop-off and account verification issues.
- Review security logs for rate-limit spikes, invalid API keys, CSRF failures, and origin failures.
- Record GO / HOLD / PAUSE status for the next invite batch.

## Incident Severity And Escalation

| Severity | Examples | Response |
| --- | --- | --- |
| P0 | App down, DB unavailable, broken auth, active secret leak, paid users cannot access premium, corrupt billing state | Pause invites immediately; page owner; rollback if deploy-related; post user-facing status if impact persists. |
| P1 | Deep health backup failed, scanner stale during market hours, Stripe webhooks failing, email auth failures, LLM cost runaway | Pause paid growth; assign owner; mitigate within same day; communicate to affected users if needed. |
| P2 | One public page broken, route budget degradation, onboarding confusion, mobile layout issue, support backlog | Keep beta capped; fix before increasing invites. |
| P3 | Copy polish, route-specific OG image, non-critical FAQ/docs gaps | Track but do not block controlled beta. |

Escalation note format:

```text
Time:
Severity:
User impact:
Current health:
Suspected cause:
Actions taken:
Rollback needed:
Owner:
Next update:
```

## Rollback Conditions

Rollback or pause launch immediately if any of these happen:

- `/api/health` fails for more than 2 minutes.
- `/api/health/deep` reports DB failure, backup failure, or scanner failure during market hours.
- Login/signup breaks for new users.
- Stripe checkout or webhook handling creates incorrect entitlements.
- Cancellation or renewal copy becomes misleading.
- Production logs expose secret-like values.
- LLM spend exceeds 80% of daily cap before the planned invite count is reached.
- Route p95 exceeds budget on terminal/dashboard/opportunities/symbol detail and does not recover.
- Support inbox receives repeated reports of the same blocking workflow.
- A deploy introduced the issue and the last known-good release is available.

Rollback checklist:

1. Stop invites and paid-growth communication.
2. Preserve evidence: health output, deep health output, deployment SHA, logs, Stripe event IDs, support examples.
3. Revert to last known-good image/tag or commit.
4. Do not reverse DB migrations unless a tested migration-specific rollback exists.
5. Re-run health, deep health, monitoring, route QA, and post-deploy backup.
6. Record incident and user impact before resuming invites.

## Support Checklist

Before invites:

- `support@tradeveto.com` receives messages.
- `billing@tradeveto.com` receives billing replies.
- Contact form works without leaking stack traces or secrets.
- Support tickets are visible to admin users.
- Billing questions have canned responses for upgrade, cancellation, renewal, refund policy, and research-only limitations.
- User-facing copy avoids direct financial advice.

Expected first-week support load for the first 25 invited users:

- 2-6 total support tickets.
- 1-3 onboarding or email verification issues.
- 0-2 billing or upgrade questions if paid growth is enabled.
- 1-3 product-understanding questions around WAIT, fragility, replay, simulated strategies, and shock radar.

Pause invite expansion if support exceeds 5 unresolved P1/P2 tickets or if median first response time exceeds one business day.

## Launch Communication

Invite message must say:

- TradeVeto is in controlled public beta.
- The product is research and decision-support software, not financial advice.
- Simulated strategies and replay studies are educational and may be wrong or incomplete.
- AI explanations summarize structured TradeVeto data and do not override deterministic scores.
- Users can report issues through support.
- Paid beta seats are limited and may be paused if operational quality degrades.

Do not use:

- guaranteed returns
- AI predicts markets
- buy now / sell now language
- claims that simulated performance proves future results

## Expected First Bottlenecks

| Area | Likely bottleneck | Mitigation |
| --- | --- | --- |
| Database | Full-universe scanner reads and symbol detail history under dashboard/replay traffic | Keep invite cap low; monitor route budgets; precompute summaries before scaling. |
| Scanner artifacts | Local `scanner_output` mount limits horizontal scaling | Keep single-host beta; plan object-storage migration before larger growth. |
| LLM cost | Copilot and scheduled summaries under curious beta users | Enforce daily/user/route budgets; cache; fallback deterministically. |
| Support | New users need help understanding WAIT-first and research-only language | Use onboarding, FAQ, support macros, and daily support review. |
| Billing | Edge cases around cancellation, renewal, webhook replay | Keep paid cap low; run Stripe reconciliation; monitor webhook failures. |
| Email | Inbox placement and verification mail deliverability | Run canaries; watch support; keep DMARC/SPF hardening plan. |
| Mobile | PWA install and push differences across iOS/Android browsers | Treat native-app parity as future work; document browser limits. |
| API/webhooks | Inline webhook delivery is bounded but not durable queue-backed | Keep API cap low; do not market developer platform broadly yet. |

## Cost Expectations

For the initial 25-user cohort:

- OpenAI expected spend: roughly **$2-$8/day** if caching is healthy and copilot usage is moderate.
- OpenAI hard cap: **$25/day** until usage behavior is measured.
- Stripe costs scale with paid subscriptions and are not an operational bottleneck.
- Email cost should remain negligible under Google Workspace SMTP beta volume.
- Infrastructure cost should remain inside current Linux Docker baseline unless route budgets degrade.

Investigate immediately if:

- daily LLM spend exceeds $20 before end of market day,
- cache hit rate drops materially,
- blocked LLM calls spike,
- copilot timeouts become a common support issue.

## Production Snapshot

Remote production spot checks from the development workstation on 2026-05-10:

- `https://tradeveto.com/api/health`: HTTP 200.
- `https://tradeveto.com/api/health/deep`: HTTP 200.
- Deep health reported DB ok, backup ok, R2 offsite backup ok, and scanner ok.
- Latest R2 backup age in the sampled response was about 94 minutes.
- Scanner freshness in the sampled response was about 18 minutes.
- `tools/ops/tradeveto-controlled-beta-launch-check.sh --base-url https://tradeveto.com --extended` ran successfully across health, billing route QA, email DNS/route QA, security QA, API route QA, and performance route budgets after the Phase 12.1 public-route parity cleanup.
- Phase 12.1 update: `/intelligence/strategy-performance` is no longer treated as a marketed production route. It was removed from sitemap/social/launch-gate public surfaces until the strategy proof route is deployed and intentionally relaunched.
- Email QA passed with beta-acceptable warnings: SPF uses `~all`, DMARC uses `p=none`, SMTP canary sends were not run from this workstation, and live inbox placement was not inspected.
- Developer/API, Strategy Labs, Community, and related v1 API routes are still not deployed on production; existing API/performance checks allow 404 for those controlled-beta developer surfaces.

This is not a substitute for launch-day production-host checks, but it confirms the public health endpoints were green during this checklist sprint.

## Development Validation Snapshot

Repository validation run on 2026-05-10:

- `npm run lint`: passed.
- `npm test -- --runInBand`: passed, 354 tests.
- `npm run build`: passed.
- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')`: passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings`: passed with 0 errors and 0 warnings.
- `bash -n` passed for the launch-gate script and existing Phase 11 ops scripts.
- `npm run monitoring:synthetics` and `npm run monitoring:system` could not run from this workstation because `TRADEVETO_MONITORING_TOKEN` is not configured. Run them from the production host or an operator environment with the monitoring token before launch-day GO.

## Remaining Launch Risks

- Restore confidence depends on a recent production-host restore drill, not just backup freshness.
- Stripe paid lifecycle still requires an operator-run test-mode checkout and webhook replay before enabling paid growth.
- Email inbox placement requires real mailbox inspection, not only DNS checks.
- API/webhook platform is controlled-beta only until durable async webhook delivery exists.
- Mobile/PWA is beta-ready, but native app parity is not complete.
- Current Linux Docker deployment should not be pushed beyond the controlled cap without cloud/object-storage migration work.

## Final GO / NO-GO Rule

Use **GO** only when:

- the one-command launch gate passes,
- production ops green check passes,
- restore drill proof is current,
- Stripe and email manual drills are complete,
- support owner is available,
- rollback owner is available,
- invite cap is enforced.

Anything else is **NO-GO** or **conditional GO with written operator exception**.
