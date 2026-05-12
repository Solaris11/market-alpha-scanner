# Phase 13 Full Platform Audit - Beta Reality + Competitive Scoring Review

Date: 2026-05-12

Final status: `TRADEVETO BETA EXPANSION READY`

## Executive Summary

TradeVeto is ready to expand the controlled beta from 5 users to 10 users, with daily monitoring and support review. It is not yet ready to jump directly to a full 25-user cohort without another feedback cycle.

The platform is materially stronger after Phase 13:
- Invite-only beta is enforced in production.
- Beta-premium entitlement confusion has been fixed for practical beta usage.
- Major route parity is clean.
- Navigation feels more responsive due to prefetching, route transition feedback, stable loading skeletons, and delayed secondary panels.
- Production operations, health, restore drill, monitoring, security QA, API route QA, and performance budget checks pass.

The main remaining risks are not raw engineering failures. They are beta-reality risks:
- New users can still feel overwhelmed.
- Retention loops are instrumented but not yet proven by enough real users.
- Beta entitlement is currently env-policy based and broad in invite mode, not persisted per invite source.
- Billing route QA has a policy mismatch: `/api/stripe/test/webhook` returns safe `400` fail-closed while the route QA script expects `404` when Stripe test mode is disabled.
- Email DNS is acceptable for beta, but live canary/inbox placement was not rerun in this audit because SMTP QA env was not available to the shell.

Verdict:
- Expand to 10 users: GO.
- Expand to 25 users: CONDITIONAL after one stable market session and support review.
- Start paid beta: CONDITIONAL, pending billing QA script alignment and current live payment smoke.
- Public marketing push: NO-GO until cohort learning and public trust proof improve.

## Production Source Of Truth

Production-sensitive checks were run from:

- Host: `onsre-node-01`
- User: `sre`
- App path: `/opt/apps/market-alpha-scanner/app`
- Branch: `main`
- Commit: `69faa073db273d9e3d090231b5d16551161e23e5`
- Local/origin/prod parity: clean and aligned
- Frontend container: `market-alpha-frontend`, healthy
- Postgres container: `market-alpha-scanner-market-alpha-postgres-1`, healthy

## Validation Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm run lint` | PASS | Production host |
| `npm test -- --runInBand` | PASS | 371 tests passed |
| `npm run build` | PASS | Re-run after `npm ci`; Next `16.2.6` |
| `npm audit --omit=dev` | PASS | 0 vulnerabilities |
| `python3 -m py_compile $(git ls-files '*.py')` | PASS | Production host |
| `npx pyright . --pythonpath .venv/bin/python --warnings` | PASS | 0 errors, warnings, infos |
| `git diff --check` | PASS | Production host |
| `/api/health` | PASS | HTTP 200, ok true |
| `/api/health/deep` | PASS | DB, scanner, local backup, R2 backup OK |
| Route parity | PASS | `RESULT: PRODUCTION ROUTE PARITY CHECK PASSED` |
| Ops green | PASS | Latest run before audit: `RESULT: PRODUCTION OPS GREEN` |
| Restore drill | PASS | `RESULT: BACKUP RESTORE DRILL PASSED` |
| Monitoring synthetics | PASS | 16 checked, 16 ok |
| Monitoring system | PASS | CPU 2.69%, memory 12.1%, disk 17%, containers healthy |
| Security abuse QA | PASS | `RESULT: SECURITY ABUSE QA PASSED` |
| API platform QA | PASS | `RESULT: API PLATFORM ROUTE QA PASSED` |
| Performance budget | PASS | `RESULT: PERFORMANCE BUDGET CHECK PASSED` |
| Billing route QA | FAIL / policy mismatch | Test webhook expected `404`, got safe `400` |
| Stripe lifecycle proof | PASS from prior proof | `STRIPE LIFECYCLE FULLY VERIFIED`, 2026-05-10 |
| Email QA | PASS_WITH_WARNINGS | DNS OK; SMTP canary env not available in shell |
| Migrations | PASS | `applied=0 skipped=41` |

## Restore Drill Proof

Latest restore drill:
- Postgres backup: `/opt/backups/market-alpha/postgres/2026-05-12_00-00.sql.gz`
- Scanner backup: `/opt/backups/market-alpha/scanner_output/2026-05-12_00-00.tar.gz`
- Temporary restore DB created and cleaned safely.
- Public tables restored: 68.
- Scanner artifacts restored: 2,114 files.
- RTO estimate: 53 seconds.
- RPO estimate: 344 minutes.

Restored table counts:
- `scan_runs`: 1,979
- `scanner_signals`: 218,579
- `symbol_price_history`: 112,211
- `forward_returns`: 38,295
- `market_memory_snapshots`: 193,386
- `narrative_intelligence_snapshots`: 222
- `shock_move_patterns`: 333
- `shock_move_events`: 5,621
- `monitoring_events`: 733

## Beta Entitlement Test Result

Production runtime env:
- `TRADEVETO_BETA_SIGNUP_MODE`: present, `invite`
- `TRADEVETO_BETA_USER_CAP`: present, `25`
- `TRADEVETO_BETA_INVITE_CODE`: present
- `TRADEVETO_BETA_ALLOWED_EMAILS`: present
- `TRADEVETO_BETA_PREMIUM_ACCESS`: missing

Implementation behavior:
- In invite mode, if an invite code is configured, `betaPremiumAccessForEmail()` grants beta premium to authenticated users via `invite_beta`.
- Existing users pick this up through entitlement recomputation on session refresh/login.
- Account/billing UI has labels for `Beta Premium Access` and `Founding Beta User`.
- Premium CTA logic suppresses upgrade CTAs for beta-premium users.
- Tests cover retroactive invite-mode beta premium behavior.

Audit limitation:
- This audit did not use a named real beta user's credentials, so `/api/auth/me` and live browser UI were not verified for a specific existing invited user session.
- The deterministic production env + entitlement policy prove the expected behavior after session refresh.

Important risk:
- The current entitlement model is intentionally broad: any authenticated user in invite mode can receive beta premium when `TRADEVETO_BETA_INVITE_CODE` is configured. This solves beta confusion quickly, but it is not a precise persisted entitlement model.

Required for 95+:
- Persist `beta_signup_source`, `beta_invited_at`, and `beta_premium_until` per user.
- Backfill existing beta invite users once.
- Grant beta premium from persisted user state, not only global env mode.
- Keep allowlist as an operator override.

Score: 91/100.

## Navigation / Route Performance Result

Raw production route timing:

| Route | HTTP | Total | TTFB | Size |
| --- | ---: | ---: | ---: | ---: |
| `/terminal` | 200 | 225ms | 169ms | 73KB |
| `/opportunities` | 200 | 278ms | 229ms | 63KB |
| `/dashboard` | 200 | 233ms | 223ms | 60KB |
| `/history?symbol=AMD` | 200 | 275ms | 274ms | 58KB |
| `/paper` | 200 | 173ms | 125ms | 76KB |
| `/strategy-labs` | 200 | 145ms | 140ms | 59KB |
| `/symbol/AMD` | 200 | 294ms | 275ms | 97KB |
| `/intelligence/strategy-performance` | 200 | 205ms | 189ms | 66KB |
| `/mobile` | 200 | 187ms | 185ms | 39KB |

Performance budget script:
- `/terminal`: 153ms
- `/dashboard`: 164ms
- `/opportunities`: 162ms
- `/symbol/AMD`: 299ms
- `/paper`: 157ms
- `/strategy-labs`: 131ms
- `/history`: 265ms
- Result: `PERFORMANCE BUDGET CHECK PASSED`

Perceived-speed improvements now deployed:
- Idle prefetch for high-priority routes.
- Hover/focus prefetch for nav links.
- Top route-transition progress indicator on click.
- Shell-preserving loading skeletons.
- `/paper` loading fallback.
- Strategy Labs common loading skeleton.
- Opportunities advanced panels moved below ranked cards and deferred until opened.
- Opportunities tab/filter computation uses deferred state.

Remaining performance gap:
- No browser RUM yet for actual click-to-usable timing.
- Authenticated premium route transitions need measurement from real beta sessions.
- Terminal still synthesizes many server-side intelligence systems before final render.

Score:
- Raw Route Performance: 95
- Perceived Navigation Speed: 92
- Mobile Navigation Speed: 90
- Desktop Navigation Speed: 93

## Product / UX Scores

| Category | Score | Why Below 95 / Fix |
| --- | ---: | --- |
| Overall Product Quality | 91 | Strong intelligence and ops, but real cohort usability still under-proven. Phase 13: observe 10-user cohort. |
| Overall Controlled Beta Readiness | 93 | Ready for 10 users; 25 requires support/retention evidence. Phase 13. |
| Overall Public Launch Readiness | 86 | Public marketing, support, retention, and cohort proof not mature enough. Phase 14+. P1. |
| User Friendliness | 89 | Simpler than before, still dense for new users. Add 5-user onboarding study and confusion taxonomy. Phase 13. P1. |
| Onboarding Quality | 89 | Start Here exists, but first-session evidence is limited. Instrument completion/drop-offs. Phase 13. P1. |
| First Useful Action Clarity | 90 | Better, but needs real analytics on first symbol/watchlist/replay action. Phase 13. |
| Opportunity Actionability | 92 | Cards answer key questions; needs beta comprehension testing. Phase 13. |
| Terminal UX | 92 | Strong main workspace; still dense for beginners. Phase 13. |
| Dashboard UX | 90 | Institutional but can overwhelm. Hide more advanced layers by default. Phase 13. |
| Symbol Detail UX | 91 | Strong detail, but needs mobile readability feedback. Phase 13. |
| Replay UX | 89 | Valuable proof layer, but educational framing still needs beta validation. Phase 13. P1. |
| Strategy Labs UX | 90 | Transparent simulation, but users may over-trust backtests. Add beginner proof explanations. Phase 13. |
| Mobile UX | 90 | PWA works and nav improved; real-device beta feedback still needed. Phase 13. |
| Desktop UX | 93 | Premium and coherent after nav cleanup. Needs continued simplification. Phase 13. |
| Tabs / Navigation Clarity | 93 | Better semantics and active states; observe real users. Phase 13. |
| Perceived Speed | 92 | Prefetch/skeletons deployed; needs RUM. Phase 13. |

## Engineering Scores

| Category | Score | Why Below 95 / Fix |
| --- | ---: | --- |
| Code Quality | 94 | Strong test/type posture; some large route components remain dense. Refactor only after beta evidence. Phase 13/14. |
| Architecture | 92 | Modular intelligence systems, but terminal route still orchestrates too much synchronously. Split primary/secondary payloads. Phase 14. |
| Maintainability | 91 | Many systems and panels increase cognitive load. Add ownership maps and route-level data contracts. Phase 14. |
| Test Coverage | 94 | 371 tests pass; needs browser/RUM/e2e coverage. Phase 13. |
| TypeScript Quality | 95 | Strict build passes. |
| Python Quality | 95 | `py_compile` and pyright pass. |
| Migration Safety | 94 | Migration ledger clean; add migration dry-run report to launch gate. Phase 14. |
| Dependency Security | 95 | `npm audit --omit=dev` clean. |
| Route Parity | 96 | Route parity passed. |
| Raw Route Performance | 95 | Production timings inside budget. |
| Hydration / Client Cost | 88 | No browser profiling/RUM yet; heavy client work remains in dashboards/charts. Phase 13. P1. |

## Operations Scores

| Category | Score | Why Below 95 / Fix |
| --- | ---: | --- |
| Ops Maturity | 94 | Ops green, restore, monitoring pass; still requires daily cohort runbook discipline. Phase 13. |
| Docker / Container Health | 96 | Frontend and Postgres healthy. |
| Deploy Process | 94 | Git-based deploy working; add one-command deploy wrapper with validation transcript. Phase 14. |
| Monitoring | 93 | Synthetics/system pass; need user-facing RUM and alert drills. Phase 13/14. |
| Backup / DR | 96 | Restore drill passed with table/artifact proof. |
| Logs / Secrets Hygiene | 95 | Ops green secret scan passed. |
| Rollback Readiness | 92 | Runbooks exist; needs live rollback drill during low-risk window. Phase 14. |
| Support Readiness | 88 | Support routes exist, but real support workflow and macros need 10-user proof. Phase 13. P1. |
| Scalability | 86 | 25-user cap is safe; broad scale needs Redis/RDS/worker separation and RUM. Phase 14. P1. |

## Security / Billing Scores

| Category | Score | Why Below 95 / Fix |
| --- | ---: | --- |
| Security | 94 | Security QA passed; add more abuse/rate-limit evidence before public launch. Phase 14. |
| Auth / Invite Gate | 94 | Invite mode/cap present; add persisted invite acceptance records. Phase 13. |
| Premium Entitlement Accuracy | 91 | Beta premium fixed but broad env-based model. Persist beta entitlement per user. Phase 13. |
| Billing Confidence | 90 | Full lifecycle proof exists; current route QA script has policy mismatch. Align script/route expectation. Phase 13. |
| Stripe Lifecycle | 92 | Full proof passed 2026-05-10; rerun after any billing env changes before paid beta. Phase 13. |
| Stripe Live/Test Isolation | 91 | Test lifecycle proof strong; shell test mode disabled causes route QA mismatch. Phase 13. |
| Webhook Idempotency | 94 | Proven in lifecycle report; rerun periodically. Phase 13/14. |
| API Security | 95 | API QA passed, protected routes fail closed. |
| Admin Protection | 95 | Security QA shows admin route 401 unauthenticated. |
| Rate Limiting / Abuse | 90 | Code/tests exist; needs public traffic proof and rate-limit telemetry. Phase 14. |
| CSRF / Origin Checks | 94 | Covered by security/billing route QA; more browser e2e would raise score. Phase 13. |

## AI / Intelligence Scores

| Category | Score | Why Below 95 / Fix |
| --- | ---: | --- |
| AI Intelligence | 93 | Broad and differentiated; real user trust proof still limited. Phase 13. |
| LLM Grounding | 94 | Strong eval coverage; add production hallucination sampling. Phase 13. |
| Shock Intelligence | 94 | Strong proof and false-positive cleanup; more live cohort examples needed. Phase 13. |
| Macro Intelligence | 92 | Useful but feed depth and real-time shifts need more proof. Phase 14. |
| Event Intelligence | 89 | Architecture strong; feed/citation depth still below 95. Phase 14. P1. |
| Market Memory | 93 | Strong historical context; continue backfill and analog quality scoring. Phase 14. |
| Conviction / Fragility | 94 | One of strongest systems; needs live outcome calibration. Phase 13. |
| Opportunity Scoring | 92 | Good ranking; needs cohort outcome analysis and false-positive review. Phase 13. |
| Risk / Reward Controls | 93 | Differentiated and conservative; needs user comprehension testing. Phase 13. |
| Replay / Proof | 91 | Valuable moat, but current replay study rows are still low. Phase 13/14. |
| Research Copilot | 91 | Grounded and useful; needs real conversation quality review. Phase 13. |
| Strategy Intelligence | 91 | Strong simulation/proof idea; needs clearer beginner framing and live trust proof. Phase 13. |
| Strategy Labs | 90 | Deployed and transparent; add replayable examples and plain-English limitations. Phase 13. |
| Explainability | 93 | Strong, but some explanations remain dense for new users. Phase 13. |

## Growth / SEO / Social Scores

| Category | Score | Why Below 95 / Fix |
| --- | ---: | --- |
| Public Trust | 89 | Strong risk language; still needs real beta testimonials/proof and cleaner public proof pages. Phase 14. P1. |
| SEO / Growth | 88 | Sitemap/robots/OG pass; content depth and Search Console proof needed. Phase 14. P1. |
| Social Sharing | 88 | OG metadata passes route parity; Facebook thumbnail behavior needs live debugger verification. Phase 13/14. P1. |
| Facebook OG Readiness | 87 | OG image route returns 200 PNG, but Facebook cache/debugger behavior not verified in this audit. Phase 13. P1. |
| Google Search Console Readiness | 86 | Technical groundwork exists; submit/inspect/indexing proof still missing. Phase 14. P1. |
| Public Marketing Push | 84 | Invite-only positioning is fine, but public traffic before 10-user learning is premature. Phase 14. P0/P1. |

## Retention / Beta Learning Scores

| Category | Score | Why Below 95 / Fix |
| --- | ---: | --- |
| First Cohort Readiness | 93 | Ready for 10 users with daily operator review. |
| Analytics Readiness | 91 | Events exist; dashboard needs daily cohort review routine. Phase 13. |
| First Useful Action Tracking | 90 | Instrumented but needs observed funnel rates. Phase 13. |
| Watchlist Creation Loop | 89 | Useful but not yet proven. Phase 13. P1. |
| Replay Engagement | 88 | High-value but likely underused without education. Phase 13. P1. |
| Support Ticket Categories | 89 | Support exists; confusion taxonomy needs real cohort data. Phase 13. P1. |
| DAU / WAU Readiness | 86 | Not enough user volume. Phase 13. P1. |
| Retention Readiness | 86 | Habit loops are built, not proven. Phase 13. P1. |

## Below-90 Priority List

| Area | Score | Priority | Exact Fix |
| --- | ---: | --- | --- |
| Public Marketing Push | 84 | P0/P1 | Do not start broad marketing until 10-user cohort shows onboarding, support, and revisit stability. |
| Scalability | 86 | P1 | Keep 25-user cap; add RUM, DB query dashboards, Redis/RDS threshold plan. |
| Retention Readiness | 86 | P1 | Track DAU/WAU, first useful action, watchlist creation, replay use, daily revisit. |
| DAU / WAU Readiness | 86 | P1 | Add beta cohort dashboard review cadence and weekly cohort notes. |
| Google Search Console Readiness | 86 | P1 | Submit sitemap, verify indexed pages, inspect public symbol/intelligence pages. |
| Facebook OG Readiness | 87 | P1 | Use Facebook Sharing Debugger and verify thumbnail refresh/caching. |
| SEO / Growth | 88 | P1 | Build only proof-backed public pages; avoid broad SEO before cohort proof. |
| Social Sharing | 88 | P1 | Validate crawler previews for Facebook, LinkedIn, X, Slack, Discord after each deploy. |
| Replay UX / Engagement | 88 | P1 | Add "how to use replay" first-run card and one default AMD/MU case study. |
| Support Readiness | 88 | P1 | Daily support triage, confusion tags, canned non-advisory answers. |
| User Friendliness | 89 | P1 | Run 5-user onboarding observation and remove/merge confusing panels. |
| Onboarding Quality | 89 | P1 | Measure completion and first useful action; tune Start Here. |
| Event Intelligence | 89 | P1 | Add richer earnings/calendar/source citation coverage. |
| Public Trust | 89 | P1 | Add transparent limitations and cohort proof once available. |
| Watchlist Creation Loop | 89 | P1 | Make first watchlist action part of onboarding. |
| Support Ticket Categories | 89 | P1 | Enforce beta feedback taxonomy and weekly issue report. |

## Competitor Comparison

Public competitor notes use current official/public information where available:
- TradingView: official feature page describes advanced charting, alerts, Pine Script, screeners, strategy testing, community, macro/financial data.
- TrendSpider: official/product pages describe automated technical analysis, charting, alerts/bots, AI Sidekick, AI Strategy Lab.
- Trade Ideas: official Holly AI page describes real-time scanner, entry/exit ideas, and nightly simulated backtesting.
- Danelfin: official page describes explainable AI Score for stocks/ETFs and probability of outperforming over the next 3 months.
- Finviz Elite: official page describes real-time quotes, advanced charts, backtests, correlations, screeners, alerts, and APIs.
- Composer: official/help/App Store pages describe AI strategy creation, backtesting, automated execution, and APIs.
- StockTitan: official FAQ/pricing/about pages describe official-company news aggregation, AI sentiment/commentary, alerts, watchlists, and momentum scanner.

| Platform | AI Intelligence | Explainability | Market Cognition | Opportunity Quality | Risk Awareness | Shock Detection | Replay / Proof | Macro/Event Awareness | Portfolio/Scenario | Strategy Simulation | Mobile | Desktop | Community/Ecosystem | Charting | Automation | API/Dev | Retention | Institutional Feel | Overall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TradeVeto | 93 | 93 | 94 | 92 | 95 | 94 | 91 | 91 | 88 | 90 | 90 | 93 | 78 | 72 | 76 | 86 | 86 | 94 | 91 |
| TradingView | 76 | 72 | 76 | 82 | 78 | 75 | 82 | 83 | 72 | 90 | 96 | 97 | 98 | 99 | 88 | 92 | 96 | 90 | 94 |
| TrendSpider | 84 | 78 | 80 | 85 | 82 | 83 | 84 | 78 | 74 | 88 | 87 | 92 | 78 | 93 | 91 | 80 | 86 | 88 | 89 |
| Trade Ideas | 86 | 72 | 82 | 88 | 76 | 89 | 78 | 72 | 65 | 82 | 74 | 88 | 75 | 78 | 84 | 70 | 84 | 82 | 85 |
| Danelfin | 88 | 84 | 80 | 84 | 82 | 70 | 76 | 74 | 70 | 72 | 78 | 82 | 68 | 65 | 66 | 78 | 78 | 80 | 82 |
| Finviz Elite | 62 | 66 | 74 | 78 | 76 | 70 | 72 | 78 | 76 | 78 | 76 | 88 | 72 | 82 | 72 | 82 | 82 | 78 | 81 |
| Composer | 88 | 78 | 76 | 80 | 82 | 62 | 84 | 68 | 86 | 94 | 92 | 86 | 86 | 68 | 96 | 90 | 88 | 76 | 87 |
| StockTitan | 76 | 75 | 76 | 80 | 72 | 84 | 68 | 86 | 60 | 58 | 80 | 82 | 70 | 60 | 72 | 62 | 80 | 76 | 78 |

Interpretation:
- TradeVeto's strongest relative edge is not charting or automation. It is market cognition, risk-first reasoning, shock/replay proof, and explainable intelligence synthesis.
- TradingView remains far ahead in charting, community, mobile polish, and scripting ecosystem.
- Composer remains far ahead in live strategy automation and native mobile app.
- TrendSpider and Trade Ideas remain stronger in mature trader tooling/automation/scanning workflows.
- TradeVeto can compete as a differentiated decision-intelligence workspace if it proves cohort retention and avoids feature overload.

## Moat Analysis

Strongest moat layers:
- Risk-first reasoning: WAIT/AVOID discipline and fragility framing are product-defining.
- Shock Intelligence: stronger than typical scanners because it includes chase risk, timing proof, and low-liquidity suppression.
- Replay/proof layer: "what would the system have said before the move?" is hard to copy well because it requires historical state capture.
- Grounded AI explanations: deterministic packets + LLM safety/eval harness reduce hallucination risk.
- Meta console: "What Matters Now" creates a decision OS, not just a dashboard.
- Strategy Labs: useful trust layer when framed clearly as simulation, not advice.
- Invite-only beta loop: lets product quality improve before broad marketing.

Weak moat layers:
- Charting ecosystem.
- Native mobile.
- Broad community/network effects.
- Live streaming/intraday infrastructure.
- Broker execution/automation.
- Public performance history.
- Enterprise/team workflows.

What competitors can copy:
- Basic AI summaries.
- Opportunity cards.
- WAIT labels.
- Public symbol pages.

What is harder to copy:
- Historical state replay.
- Multi-layer deterministic intelligence synthesis.
- Evidence maturity + calibration + shock proof.
- User workflow memory tied to scanner states.

What still needs proof:
- Real cohort retention.
- User comprehension.
- Reduced support burden.
- Real follow-through between scores and outcomes.
- Public trust from transparent performance/replay examples.

## Beta Expansion Verdict

| Decision | Verdict | Reason |
| --- | --- | --- |
| Keep at 5 users | NO-GO | Too conservative; ops and route health support measured expansion. |
| Expand to 10 users | GO | Production is healthy; core beta confusion fixes deployed; monitor daily. |
| Expand to 25 users | CONDITIONAL | Wait for one stable 10-user cycle with low confusion/support pressure. |
| Start paid beta | CONDITIONAL | Stripe lifecycle proof exists, but current billing route QA script mismatch must be fixed/rerun. |
| Start public marketing | NO-GO | Cohort learning and public trust proof are not mature enough. |
| Prepare cloud migration | CONDITIONAL | Plan thresholds now; do not migrate before cohort data. |
| Start native mobile | NO-GO | PWA beta first; native app after mobile cohort feedback. |
| Start enterprise/team sales | NO-GO | Team features exist but enterprise readiness/support/audit workflows are underproven. |

## Safe Beta Expansion Plan

Recommended ramp:
1. Expand from 5 to 10 users.
2. Observe at least one full market session.
3. Review support tickets, feedback, first useful action, watchlist creation, replay usage, and route performance.
4. If no P0/P1 issues and confusion remains manageable, expand to 15.
5. Hold before 25 until onboarding completion and support load are measured.

Daily operator checklist:
- `/api/health` and `/api/health/deep`.
- Monitoring synthetics/system.
- Support tickets and beta feedback.
- Route performance budget.
- OpenAI cost/usage.
- New-user onboarding completion.
- First useful action rate.
- Watchlist/replay/Strategy Labs usage.

Rollback/pause triggers:
- Auth/invite/premium entitlement confusion recurs.
- Health/deep health red.
- Restore/backup failure.
- Stripe webhook or entitlement issue.
- Repeated route budget misses.
- More than 2 users report the same blocking UX confusion.
- Any secret/log exposure or admin/API auth failure.

## Phase 13 Recommendations

Keep Phase 13 focused on real user learning:
1. Fix billing route QA policy mismatch for `/api/stripe/test/webhook`.
2. Persist beta entitlement source per user; stop relying solely on broad invite-mode env policy.
3. Run 10-user onboarding observation.
4. Track first useful action, watchlist creation, replay usage, Strategy Labs usage.
5. Add a simple beta confusion taxonomy and weekly report.
6. Add RUM/click-to-usable route timing.
7. Add one replay education flow and one Strategy Labs "simulation only" education card.
8. Verify Facebook OG thumbnail in the official debugger.

## Phase 14 Recommendations

Only after 10-user cohort proof:
- RUM-backed performance and query profiling.
- Redis/RDS/worker separation plan.
- Public trust pages and Search Console proof.
- Native mobile decision after PWA feedback.
- API/developer expansion after quota/support maturity.
- Enterprise/team workflows only after beta support load is understood.

## Final Verdict

TradeVeto is ready for controlled beta expansion to 10 users.

It should not jump directly to 25 users, paid beta scale, broad public marketing, native mobile, or enterprise sales until the remaining beta-learning and operational proof gaps close.

Final status: `TRADEVETO BETA EXPANSION READY`

## External Sources Used

- TradingView official features: https://www.tradingview.com/features/
- TrendSpider official/product pages: https://trendspider.com/ and https://trendspider.com/product/
- TrendSpider automated technical analysis docs: https://help.trendspider.com/kb/features/automated-technical-analysis
- Trade Ideas Holly AI: https://www.trade-ideas.com/ti-ai-virtual-trade-assistant/
- Danelfin how it works: https://danelfin.com/how-it-works
- Finviz Elite: https://elite.finviz.com/elite and https://finviz.com/help/elite.ashx
- Composer official/help: https://www.composer.trade/ and https://help.composer.trade/article/65-how-does-composer-trade
- Composer App Store listing: https://apps.apple.com/us/app/composer-automate-trades/id6471564746
- StockTitan FAQ/pricing/about: https://www.stocktitan.net/faq, https://www.stocktitan.net/pricing, https://www.stocktitan.net/about
