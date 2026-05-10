# Phase 12 Final Beta Gate Rerun

Date: 2026-05-10

## Executive Summary

TradeVeto is now ready for a controlled beta cohort.

The previous blocker was production signup being open. Production now runs with invite-only signup, a 25-user cap, a configured invite code, and configured allowlisted emails. Missing and invalid invite codes are rejected, valid invite codes are accepted, allowlisted signup works, existing user login still works, and disposable users were cleaned up.

This is a controlled-beta GO, not a broad public-scale GO.

## Production Context

| Item | Result |
| --- | --- |
| Host | `onsre-node-01` |
| User/path | `sre` / `/opt/apps/market-alpha-scanner/app` |
| Commit | `fd76102d6b139a006180cc5dd07d3cdd6d8870b3` |
| Worktree | clean |
| Frontend service | `market-alpha-frontend` |
| Frontend container | healthy |
| Postgres container | healthy |

## Beta Env Presence

No secret values were printed.

| Env | Result |
| --- | --- |
| `TRADEVETO_BETA_SIGNUP_MODE` | `invite` |
| `TRADEVETO_BETA_USER_CAP` | `25` |
| `TRADEVETO_BETA_INVITE_CODE` | present |
| `TRADEVETO_BETA_ALLOWED_EMAILS` | present |

## Rebuild Result

Command used:

```bash
docker compose up -d --build market-alpha-frontend
```

Result:

- Frontend rebuilt from current production source.
- Frontend restarted successfully.
- `/api/health`: OK.
- `/api/health/deep`: OK.
- Scanner freshness: OK.
- Local/R2 backups: OK.

## Invite-Only Proof

The signup gate was tested from the production frontend container against the app runtime with canonical Host/Origin headers.

| Check | Result |
| --- | --- |
| Missing invite code | rejected with `403`, `beta_access_required` |
| Invalid invite code | rejected with `403`, `beta_access_required` |
| Valid invite code | accepted with `200` |
| Existing disposable user login | accepted with `200` |
| Temporarily allowlisted disposable email without invite | accepted with `200` |
| Active user count before | `9` |
| Active user count after cleanup | `9` |
| Disposable beta rows remaining | `0` |

Final beta gate status: invite-only enforcement passed.

## Validation Results

| Check | Result |
| --- | --- |
| `npm run lint` | passed |
| `npm test -- --runInBand` | passed, 366 tests |
| `npm run build` | passed |
| `npm audit --omit=dev` | passed, 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | passed |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | passed, 0 errors/warnings |
| Ops green | `RESULT: PRODUCTION OPS GREEN` |
| Monitoring synthetics | 16 checked, 16 OK |
| Monitoring system | CPU/memory/disk/container metrics ingested |
| Security abuse QA | passed, 0 warnings |
| API platform QA | passed |
| Billing route QA | passed |
| Performance budget | passed |
| Email infrastructure check | passed with SPF/DMARC policy warnings |
| Restore drill | latest full drill passed; RTO about 49s, RPO about 98m |
| Stripe lifecycle proof | fully verified in `docs/ops/final-stripe-test-lifecycle-proof.md` |

Email warnings:

- SPF uses `~all`; acceptable for beta, harden after sender inventory.
- DMARC is `p=none`; acceptable for monitored beta, move to quarantine/reject later.

## Route Parity

Public routes returned `200`, including:

- `/`, `/features`, `/pricing`, `/faq`, `/how-it-works`
- `/intelligence`, `/intelligence/strategy-performance`, `/intelligence/shock-opportunities`, `/intelligence/macro-regime`
- `/symbol/AMD`, `/risk-disclosure`, `/terms`, `/privacy`
- `/terminal`, `/dashboard`, `/opportunities`, `/history?symbol=AMD`, `/paper`, `/account`, `/support`
- `/mobile`, `/community`, `/developers`, `/team`, `/strategy-labs`
- `/manifest.webmanifest`, `/tradeveto-sw.js`, `/icon-192.png`, `/icon-512.png`

Protected routes failed closed:

- `/api/v1/opportunities`, `/api/v1/macro`, `/api/v1/shocks`, `/api/v1/replay?symbol=AMD`: `401`
- `/api/v1/portfolio/scenario`: `401`
- `/api/push/status`: `401`
- Stripe checkout/portal unauthenticated routes: `401`
- Invalid Stripe test webhook: `400`

## Remaining Blockers

Critical blockers: none for controlled beta.

Remaining non-blocking risks:

- New-user comprehension is still the biggest product risk.
- Retention loops are architecturally present but not real-user proven.
- Mobile/PWA is route-ready, but live device feedback is still needed.
- Public marketing should wait for first-cohort learning.
- Broad public scale should wait for cohort stability, support proof, and cloud/queue thresholds.

## Verdicts

| Surface | Verdict | Reason |
| --- | --- | --- |
| Controlled free beta | GO | Invite-only enforcement and ops checks pass. |
| Limited paid beta | GO | Stripe test lifecycle and entitlement proof are complete; keep paid invites controlled. |
| Investor demos | GO | Product, proof, billing, and ops are credible. |
| Mobile/PWA beta | GO | PWA/mobile routes/assets are deployed and healthy; collect device feedback. |
| Public marketing push | NO-GO | Wait for first-cohort confusion, retention, and support data. |
| Broad public scale | NO-GO | Needs cohort stability, support load proof, and scaling thresholds. |

## Safe Beta Plan

- Start with 5 external users.
- Observe one full market session before expanding.
- Expand to 10 only if health, support, onboarding, billing, and confusion signals stay green.
- Expand toward 25 after 3 market days without P0/P1 issues.

Daily checks:

- `/api/health` and `/api/health/deep`
- monitoring synthetics/system
- backup/R2 status
- scanner freshness
- support tickets and beta feedback
- onboarding completion
- first useful action
- watchlist creation
- OpenAI cost usage
- Stripe webhook/billing events
- route performance budget

Rollback / pause triggers:

- health/deep health red
- wrong entitlement or billing state
- signup gate accidentally opens
- backup/R2 failure
- scanner freshness failure during market hours
- repeated route budget misses
- support confusion cluster
- secret exposure
- data corruption

Final status: `TRADEVETO CONTROLLED BETA READY`
