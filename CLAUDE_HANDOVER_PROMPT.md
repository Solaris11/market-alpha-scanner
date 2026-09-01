# Claude Handover Prompt - TradeVeto / market-alpha-scanner

Generated locally: 2026-09-01

This document is intended to be pasted into Claude as the starting handover prompt. It summarizes the repo, product, architecture, completed stages, current status, launch blockers, and practical working rules so Claude can continue without re-learning the project from zero.

## Claude Project Description

Paste this into Claude's Project description:

```text
TradeVeto is a WAIT-first, risk-first AI market-intelligence and decision-support platform built from the market-alpha-scanner repo. It combines a Python multi-asset scanner, PostgreSQL source-of-truth storage, a Next.js premium SaaS frontend, paper trading, alerts, market memory, conviction/fragility, verified event intelligence, grounded AI research/copilot flows, Stripe billing, admin/ops tooling, monitoring, backups, and production evidence docs.

This Claude project has a dedicated handover document: CLAUDE_HANDOVER_PROMPT.md. Read that file first before making changes. It contains the full repo context, completed phases, technology stack, current launch status, blockers, validation commands, production runbooks, feature inventory, and safe next-step priorities.

Important boundary: TradeVeto is research and decision support only, not financial advice, not broker execution, and not a promise of returns. Preserve WAIT/AVOID risk-first language, premium-data protections, legal gates, stale-data disclosure, and evidence-bound launch claims.
```

## Copy/Paste Prompt For Claude

You are taking over the TradeVeto project in `/Users/hdtv/dev/market-alpha-scanner`.

Before changing anything:

1. Read `AGENTS.md`.
2. Run `git status --short --branch`.
3. Treat the latest recertification docs as evidence, not marketing copy.
4. Do not revert user or prior-agent changes.
5. Do not claim launch readiness unless production evidence proves every gate.
6. Keep Python changes compatible with Pylance/Pyright strict mode.
7. Keep TypeScript strict, protect premium data, and preserve research-only/non-advisory language.

Current repo source of truth:

- Local path: `/Users/hdtv/dev/market-alpha-scanner`
- Git remote: `git@github.com:Solaris11/market-alpha-scanner.git`
- Main branch at handover: `main`
- HEAD at handover: `f283d5ca Fix symbol card close and scanner search fallback`
- Production target used in ops docs: `https://tradeveto.com`
- Production host/path recorded in docs: `sre@100.68.155.121:/opt/apps/market-alpha-scanner/app`
- Current local dirty state before this handover file was added: untracked `frontend/log/` and untracked root `package.json`. Do not stage or delete those unless the user explicitly asks.

Critical production workflow:

- Production is not operated from the Mac workspace directly.
- After any local code change is validated, committed, and pushed to GitHub, connect to the Linux production machine over SSH.
- SSH target: `ssh sre@100.68.155.121`.
- Production repo path after SSH: `cd /opt/apps/market-alpha-scanner/app`.
- Pull the pushed repository state on the Linux host with `git pull --ff-only origin main` after checking `git status --short --branch`.
- Run migrations, Docker rebuild/restart, scanner jobs, production smoke tests, production probes, backup checks, restore drills, R2 troubleshooting, systemd checks, Docker logs, and DB inspections from the Linux production host.
- Do not claim a production fix based only on local tests. Production proof must come from the Linux host and be recorded in `docs/ops/artifacts/...` plus a matching `docs/ops/...` summary when relevant.
- Never print secrets from production `.env`, backup env, Docker config, rclone config, Stripe, OpenAI, SMTP, or provider credentials. Use the existing redacted ops wrappers.

The product is TradeVeto: a WAIT-first, risk-first AI market-intelligence and decision-support platform for disciplined market research. It is not a broker, not an automated trading bot, not financial advice, and must not promise returns. The core value is explainable market cognition: scanner rankings, vetoes, conviction/fragility, shock/replay evidence, macro/event context, paper simulation, alerts, and grounded AI explanations.

The latest recorded overall launch status in the repo is **NOT READY** for broad public/V1 scale. Some subsystems are strong or certified, but critical launch blockers remain: retention, real-device mobile proof, provider freshness/crypto-events, revenue economics, chart workflow stability in Firefox/WebKit, 24h stability evidence, and R2/offsite backup recovery proof.

Owner-requested immediate P0 focus for the next session:

1. Page load/performance regression: pages still open too slowly. Start by measuring current route load and interaction timings, identify the heaviest routes/components/server queries, then fix the highest-impact bottlenecks. Do not add new product panels until performance is materially better and measured.
2. Discover ticker search/card-open workflow: in `/discover`, typing any ticker or stock name such as `NVDA`, `IREN`, etc. should directly surface/open that ticker's card or symbol intelligence card. This is still not behaving as desired. Reproduce it first, then fix search matching, symbol normalization, card selection/open behavior, and fallback handling so users can find any available stock/ticker from Discover and open its card reliably.

After verifying and addressing those two P0s, run a full current-state scan/audit of the app and production condition, then produce a concise report: what was fixed, what was measured, what still fails, what requires production SSH access, and what the next highest-priority blocker is.

Current in-progress coordination notes from 2026-09-01:

- Another Claude Code session has local network limits: staging/file transfer works there, but its bridge VM has no usable DNS/routing and npm registry access returned 403. Assume SSH, GitHub push, and production Linux pull/deploy/probes still need to be done from this Codex/local environment unless that changes.
- Claude measured client-reachable source module graphs for P0 performance. The initial claim that `lightweight-charts` leaked into many routes was corrected: the broad edge was only a TypeScript `import type`, so it is erased by build output.
- Claude identified `/opportunities` as the concrete eager-chart culprit: `OpportunitiesWorkspace.tsx` statically imported `MiniPriceContextChart`, which pulled `SymbolChart` and `lightweight-charts` into the initial route client graph even though the chart is below the fold and tied to one highlighted symbol.
- Claude changed `frontend/src/components/opportunities/OpportunitiesWorkspace.tsx` to load `MiniPriceContextChart` with `next/dynamic` and `ssr: false`. Reported source-graph estimate: `/opportunities` initial client source `1519 KB -> 1278 KB` and modules `114 -> 105`; `lightweight-charts` no longer appears in that route's initial client graph. Treat these as source bytes, not minified/gzipped build output.
- Remaining performance candidates called out by Claude: `/strategy-labs` eagerly pulls several chart libraries through `PosterDataVisuals`; `/terminal` remains a very large client surface, but no single chart library culprit was found there.
- Claude's search UX decision was "type to filter/show, Enter to open card." Do not implement every-keystroke modal auto-open unless the owner explicitly asks for that behavior; if changed, use debounce and avoid disruptive modal popping while typing.
- Current local coordination risk: `frontend/src/components/opportunities/OpportunitiesWorkspace.tsx` may contain Claude's uncommitted performance patch. Do not overwrite it, and keep it separate from Discover/Market Memory work if staging or committing partial changes.

## Project Identity

TradeVeto started as a `market-alpha-scanner` MVP and evolved into a full SaaS-style market intelligence platform.

Core positioning:

- WAIT-first market analysis.
- Evidence-aware scanner, not prediction theater.
- Risk veto before opportunity excitement.
- Research and education only.
- Scores and AI copy explain structured data; they do not place trades or override deterministic decisions.

Important language boundaries:

- Say "research context", "decision support", "historical evidence", "probabilistic", "setup quality", "watch/wait/avoid".
- Avoid "guaranteed", "will go up", "buy now", "sell now", "AI predicts", "risk-free", "profit signal".
- Preserve legal, risk disclosure, premium gating, stale-data disclosure, and source-trust copy.

## Repository Layout

Important root files and folders:

- `investment_scanner_mvp.py`: Python scanner CLI entry point and orchestration.
- `scanner/`: Python scanner package with universe, data, scoring, events, regime, safety, output, paper trading, analysis, diagnostics.
- `database/`: SQLAlchemy models/repositories/writeback used by the Python scanner service.
- `db/migrations/`: canonical SQL migration ledger used by production.
- `alembic/`: older Alembic migration setup and versions.
- `frontend/`: Next.js SaaS app, API routes, components, server logic, tests, probes.
- `tools/ops/`: production wrappers for deploy checks, backups, restore drills, Stripe reconcile, monitoring, scanner refreshes.
- `tools/db/run-migrations.sh`: deterministic SQL migration runner.
- `docs/ops/`: production phase evidence, runbooks, audits, launch readiness docs.
- `docs/analysis/`: scanner calibration and UX/filter audits.
- `docs/beta/`: closed beta readiness and known limitations.
- `README.md`: scanner/product usage summary.
- `PROJECT_REVIEW.md`: older early-MVP review. Useful historically, but outdated for current SaaS state.
- `AGENTS.md`: strict Python typing and validation instructions.
- `frontend/package.json`: canonical Node/Next manifest. The root `package.json` is currently untracked at handover and should not be treated as the main app manifest without confirmation.

## Technology Stack

Python/scanner:

- Python target: 3.12 per `pyrightconfig.json`.
- Strict typing expectations: Pylance/Pyright strict mode.
- Main libs from `requirements.txt`: `numpy==2.4.4`, `pandas==3.0.2`, `pandas-stubs==3.0.0.260204`, `streamlit>=1.37`, `yfinance==1.3.0`, `SQLAlchemy>=2.0,<2.1`, `alembic>=1.16,<2.0`, `psycopg[binary]>=3.2,<3.3`, `psycopg2-binary>=2.9,<3.0`, `fastapi`, `uvicorn[standard]`.
- Data providers: Alpaca market data primary when configured, yfinance fallback; yfinance also used for fundamentals/news in scanner cache paths.
- Optional LLM path: OpenAI API for event/opportunity/narrative/copilot explanations, gated by env flags and validators.

Frontend/app:

- Next.js App Router: `next@16.2.6`.
- React: `react@19.2.5`, `react-dom@19.2.5`.
- TypeScript: `typescript@6.0.3`.
- UI/styling: Tailwind CSS 4, lucide-react, custom cinematic/terminal component system.
- Charts/visualization: `lightweight-charts@5.2.0`, `echarts@6.0.0`, Recharts, visx, Nivo heatmap.
- Server/runtime libs: `pg`, `bcryptjs`, `nodemailer`, `stripe`, `web-push`, `server-only`.
- Observability/testing: Sentry Next.js SDK, Playwright, BrowserStack SDK, axe-core Playwright, custom probe scripts.

Infrastructure/ops:

- Docker Compose with Postgres 16 Alpine.
- Production services in `compose.yaml`: `market-alpha-postgres`, `market-alpha-frontend`, `market-alpha-frontend-hot-api`, optional/legacy `market-alpha-app` Streamlit, optional `market-alpha-api`, scanner job profile.
- Public edge network: `public-edge`.
- Runtime source of truth: PostgreSQL. CSV artifacts remain backup/export/debug only.
- Backups: local `/opt/backups/market-alpha`, Cloudflare R2 primary offsite target, Google Drive only optional/legacy secondary.
- Email: Google Workspace Gmail SMTP for early transactional/support mail.
- Billing: Stripe Checkout/Portal/Webhooks, live/test mode separation.
- Monitoring: internal health/deep health, monitoring event tables, synthetics/system scripts, Sentry.

## Current Runtime And Data Model

Production source of truth:

- Next frontend reads scanner state primarily from PostgreSQL.
- `SCANNER_CSV_FALLBACK=false` is the production default. CSV fallback is only for explicit rollback/debug and should be treated as an incident if seen unexpectedly.
- Scanner still writes file artifacts to `scanner_output/` for backup/debug/export.

Core scanner DB tables from Python model:

- `scan_runs`
- `scanner_signals`
- `symbol_snapshots`
- `symbol_price_history`
- `performance_summary`
- `forward_returns`
- `paper_accounts`
- `paper_positions`
- `paper_trade_events`
- `users`
- `user_sessions`
- `user_watchlist`
- `user_risk_profile`
- `password_reset_tokens`
- `user_oauth_accounts`

Additional production SQL migrations add broader SaaS tables for:

- legal document acceptances
- notifications and notification actions
- Stripe billing/subscription lifecycle and webhook idempotency
- alert rules persistence
- distributed rate limits
- monitoring/request metrics
- admin console
- support center
- beta analytics
- market memory
- shock move patterns
- narrative intelligence
- personalized intelligence
- decision journal memory
- workflow habit loops
- mobile push intelligence
- team/community/developer platform
- LLM cost controls
- user workspace preferences
- chart workflow persistence
- retention cohorts
- user saved scans
- viral growth
- enterprise readiness

Migration rules:

- SQL migrations live in `db/migrations`.
- Filename format: `YYYYMMDD_HHMMSS_description.sql`.
- Runner: `tools/db/run-migrations.sh`.
- It creates/uses `schema_migrations`, applies sorted pending migrations once, and fails closed on first SQL error.

## Scanner Pipeline

Entry point: `investment_scanner_mvp.py`

Key CLI options:

- `--universe-size core|500|1000`
- `--symbols AAPL,NVDA,...`
- `--universe-csv path.csv`
- `--top N`
- `--outdir scanner_output`
- `--min-price`
- `--min-dollar-volume`
- `--min-market-cap`
- `--news-limit`
- `--skip-news`
- `--run-analysis`
- `--skip-analysis`
- `--analysis-raw`
- `--analysis-time-budget-seconds`
- `--analysis-max-snapshots`
- `--analysis-max-signal-rows`
- `--fast`
- `--timing`
- `--save-history` / `--no-save-history`
- `--send-alerts`
- `--paper-trade`
- `--reset-paper-account`
- `--paper-starting-balance`
- `--alerts-only`

Main scanner flow:

1. Build universe from explicit symbols, CSV, or built-in `core|500|1000`.
2. Acquire shared scanner lock under root scanner output so manual/scheduled scans cannot overlap.
3. Download daily price history.
4. Download macro proxies.
5. Load verified event context.
6. Score each symbol.
7. Enrich top names with headline/event context when not skipped.
8. Build ranking table.
9. Attach data-provider quality.
10. Apply diagnostics, regime adjustments, event intelligence, setup decision layer, recommendation quality, final decision, and hard safety gates.
11. Write CSV artifacts, per-symbol detail artifacts, scanner accounting/drop reasons, DB writeback, market regime/structure, optional analysis, alerts, and paper trading.

Core scores and factors:

- Technical: EMA/SMA trend alignment, SuperTrend, RSI/MACD momentum, breakout proximity, relative volume, anchored VWAP.
- Fundamentals: quality, growth, valuation for equities; neutral/base scores for non-equities.
- Macro: risk-on/risk-off, rates pressure, DXY/dollar, oil, gold, credit, VIX, asset/sector sensitivity.
- News/event: recent headline bias and verified event intelligence.
- Risk penalty: volatility, ATR%, drawdown, earnings proximity, overextension/fading momentum.
- Composite score weights vary by asset type.
- Ratings: `TOP`, `ACTIONABLE`, `WATCH`, `PASS`.
- Final decisions: `ENTER`, `WAIT_PULLBACK`, `WATCH`, `AVOID`, `EXIT`.

Universe state:

- Core universe is roughly 111 liquid equities, ETFs, proxies, and crypto symbols.
- Expanded universe CSV: `scanner/data/opportunity_universe_1000.csv`.
- Built-in sizes: `core`, `500`, `1000`.
- Required opportunity symbols include `RGTI`, `QBTS`, `QUBT`, `IONQ`, `LITE`, `SNDK`, `RKLB`, `ASTS`, `LUNR`, `TEM`, `SOUN`, `HIMS`, `APP`, `PL`.

Scanner accounting:

- Implemented in `scanner/drop_reasons.py`.
- Every selected symbol must end in a terminal state: `ranked`, `filtered_liquidity`, `filtered_market_cap`, `filtered_stale`, `filtered_low_confidence`, `provider_unavailable`, `provider_partial`, `writeback_failed`, `deduplicated`, or `unknown`.
- `unknown` must be zero for certification.
- Output files: `scanner_drop_reasons.csv`, `scanner_drop_reasons.json`, plus history copies.

Important current scanner certification evidence:

- Phase 35.0C.1 says scanner persistence and full-scan stability are accomplished.
- 500 proof: selected/accounted 500, ranked 335, unknown 0.
- 1000 proof: selected/accounted 1000, ranked 526, unknown 0.
- Full-analysis proof: selected/accounted 500, ranked 346, unknown 0, no exit 137 in proof.
- Caveat: latest production fast scan cited in Phase 35.0C.4 selected 500 but exposed 362 ranked/distinct symbols. That is accounting-certified, but not a 500-row user-facing scanner claim.

## Frontend Product Surfaces

Core app routes:

- `/`: marketing/landing with WAIT-first positioning.
- `/terminal`: premium primary intelligence console.
- `/discover`: discovery/opportunity workspace and large-universe proof mode for admins/probe users.
- `/opportunities`: opportunity-focused UI.
- `/scanner`: admin-only scanner operations and refresh controls.
- `/symbol/[symbol]`: public preview plus premium symbol workstation.
- `/history`: historical signal/symbol history.
- `/performance`: forward returns, lifecycle, calibration, drift.
- `/macro`: macro/regime context.
- `/feed`: intelligence feed and notifications.
- `/market-memory`: market memory/replay/analog context.
- `/paper`: paper portfolio, positions, PnL, simulations.
- `/strategy-labs`: simulated strategy labs.
- `/alerts`: alert rules and active matches.
- `/account`, `/settings`: profile, billing, memory/privacy, risk profile, sessions.
- `/admin`: admin console, analytics, monitoring, billing, users, support, scanner.
- `/support`: support center and guarded support chat.
- `/pricing`, `/features`, `/faq`, `/how-it-works`, `/privacy`, `/terms`, `/risk-disclosure`, `/risk-disclaimer`.
- `/mobile`, `/community`, `/developers`, `/team`, `/enterprise`, `/invite`, `/join`, `/waitlist`.

Important frontend/API surfaces:

- Auth: email/password register/login/logout, forgot/reset password, email verification, dev login when enabled, Google OAuth start/callback.
- Entitlements: premium access, beta premium mode, legal acceptance requirements, premium locks, public preview without premium data leakage.
- Stripe: checkout, portal, live/test webhooks, test checkout/portal, reconcile script.
- Alerts: DB-backed alert rules, active matches, test-send, email/Telegram/Slack/web-push support paths.
- Notifications: notification list/read/read-all/feedback, mobile push subscribe/status/test/unsubscribe.
- Scanner data: ranking, top candidates, history latest/symbol/replay, price history, symbol detail.
- Intelligence APIs: discovery, live intelligence, live stream, provider source trust, predictive, platform moat, competitive leadership, feed.
- Paper trading: account, positions, open trades, events, analytics summary/groups/timeline.
- User data: watchlist, chart workspaces, saved scans, decision journal, memory settings/export, notification preferences, workspace preferences.
- Developer/API v1: `/api/v1/opportunities`, `/api/v1/macro`, `/api/v1/shocks`, `/api/v1/replay`, `/api/v1/portfolio/scenario`, developer API keys, webhooks.
- Support/admin/team/community/enterprise routes.

## Feature Inventory

Current implemented or partially implemented features:

- Multi-asset scanner over equities, ETFs, crypto, commodity/bond/FX proxies.
- Core/500/1000 universe support.
- Alpaca primary market data with yfinance fallback.
- Price/fundamental/macro/news/risk composite scoring.
- Regime-aware and setup-aware decision layers.
- Final decision layer with WAIT/AVOID/EXIT bias when conditions are poor.
- Trade plan levels: entry/buy zone, stop loss/invalidation, conservative/balanced/aggressive targets, risk/reward.
- Scanner data-quality diagnostics, confidence, vetoes, reason codes.
- Drop-reason accounting for selected-vs-ranked transparency.
- Historical snapshots and forward-return analysis.
- Performance summaries, signal lifecycle, auto-calibration, score calibration.
- Streamlit internal dashboard legacy path.
- Next.js premium SaaS frontend.
- Primary Terminal console with Daily Action, Best Trade Now, market command, heatmaps, watchlist, alerts, intelligence feed, adaptive learning, predictive intelligence, platform moat, portfolio/scenario/context panels.
- Symbol workstation with fast interactive chart shell, price history, symbol command search, share asset, public SEO/published symbol blocks, market memory, shock/narrative/context panels.
- Discovery workspace with filters/search/sort, saved scans, large-universe proof mode, risk-tolerant and shock opportunity radar.
- Market Memory analog engine and backfill path.
- Conviction/Fragility layer.
- Verified event/macro intelligence layer with trusted RSS/source policies.
- Optional LLM interpretation for events and opportunities with strict grounding.
- Narrative intelligence and intelligence feed OS.
- Decision journal memory and personalization.
- Workflow habit loops and daily-driver retention instrumentation.
- Paper trading engine: accounts, manual trades, positions, events, PnL, expectancy, portfolio panels, scenario lab.
- Alert rules and notifications persisted in Postgres.
- Telegram/email alert legacy plus SaaS alert routes.
- Web push/mobile push infrastructure.
- Auth/account/profile/risk profile/session system.
- Google OAuth support prepared.
- Legal document acceptance gates.
- Stripe billing/entitlements/test-mode isolation/webhook idempotency/reconciliation.
- Admin console for analytics, monitoring, billing, users, scanner, support.
- Support center and guarded support chat.
- Developer platform: API keys, scoped API routes, webhooks, SDK test.
- Community/team/enterprise intelligence surfaces.
- SEO/growth: public marketing pages, sitemap, robots, social crawler handling, OG assets, QR, referral/share attribution.
- PWA/mobile surfaces and BrowserStack/Playwright real-device/probe infrastructure.
- Production ops scripts for health, backup, restore, monitoring, billing, security, performance, deploy checks.

## Chronological Stage Summary

Early MVP:

- Initial repo and README.
- Added scanner script.
- Added technical, fundamentals, macro, and event scoring.
- Added historical snapshots and forward-return analysis.
- Added internal Streamlit dashboard.
- Added Telegram alerts with file-based dedup.
- Added multi-horizon recommendations and symbol detail artifacts.
- Refactored scanner/dashboard into modules.

Data/API/foundation:

- Added Docker and Postgres groundwork with Alembic.
- Added hybrid scanner writes to DB and file outputs.
- Fixed large volume storage using BIGINT for price history.
- Added read-only FastAPI, then complete FastAPI service for scanner data.
- Tightened imports and project-wide typing/editor errors.

Frontend SaaS foundation:

- Started Next.js premium frontend.
- Wired scanner integration, table filters, run actions, history UX, symbol detail, price chart ranges, tooltips, sortable tables.
- Added alerts page and active alert matches.
- Added frontend CSV parsing resilience and dashboard performance optimizations.

Scanner intelligence/calibration:

- Added canonical daily signal sampling.
- Added calibration insights, market regime engine, market structure engine, signal lifecycle tracker, recommendation quality gate.
- Added auto-calibration engine and final trade decision layer.
- Added fast scanner mode, timing logs, DB foundation, paper trading engine, paper lifecycle/risk tracking, paper analytics, paper reset utility.

Terminal/product UX:

- Redesigned trading terminal UX.
- Built symbol trade plan cockpit, radar layout, manual paper trades, lightweight candlestick chart.
- Added Best Trade Now, conviction layer, opportunities route, configurable paper account balance.
- Added dynamic lifecycle, correction price/trigger/pullback zone, production-grade what-if trade engine.
- Restored full universe search, filters, watchlist, paper trust layer, system confidence, equity curve/expectancy.
- Added AI risk veto system.

Auth/security/billing/ops:

- Added private beta identity, account persistence, production auth/profile, Google OAuth prep.
- Added account page, scanner health indicators, stale scanner data safety, guided onboarding, daily action.
- Hardened public API exposure, production frontend Docker service, security headers, health checks, CSRF/origin/rate limits.
- Added password reset email via SMTP, premium entitlement gating, page-level premium locks, billing/account state, stale data protection and premium leak prevention.
- Added legal acceptance, in-app notifications, Stripe billing, email verification, account deletion, subscription lifecycle notifications, Postgres alert persistence, rate limiting, transactional Stripe webhooks, CSP, Stripe reconciliation.
- Added production monitoring, backup runbooks, scanner DB source of truth, admin console, support center, external monitoring/Sentry, secrets hardening, deterministic migration ledger, Google Workspace email delivery, async categorized email.
- Rebranded app from Market Alpha to TradeVeto and completed runtime cutover/operator wrappers.

Phase 7/8 intelligence layers:

- Phase 7.1 Market Memory: derived analog/evidence layer from scanner signals, scan runs, and forward returns.
- Phase 7.2 Conviction/Fragility: structural evidence support, fragility, decay, invalidation, pressure contributors.
- Phase 7.3 Macro/Exchange and verified event intelligence: official/trusted feeds, event signatures, bounded pressure/conviction/fragility adjustments.
- Shock move and risk-tolerant opportunity engines.
- Narrative intelligence, personalization, decision journal memory, workflow habit loops.
- Institutional market pressure, meta-intelligence OS, adaptive learning, alpha lab/strategy intelligence, scenario and portfolio engines, execution timing, regime shift, conversational research copilot, decision replay, heatmaps, publishing.
- Phase 8.5 LLM grounding/eval harness: rejects invented prices/probabilities/news, deterministic override, forbidden advisory language, unsupported macro claims; uses deterministic fallback.

Launch/ops and beta readiness:

- Phase 10-12: launch readiness, Stripe test mode, public route parity, beta gate, production ops, monitoring, restore drill, support, security, email, API, cost controls, mobile/PWA.
- Phase 12 final audit showed strong controlled-beta ops and Stripe lifecycle proof but a concrete NO-GO until invite-only signup was enforced at that time.

UX and platform expansion:

- Phase 13: beta feedback, public auth hardening, QR, visual UX transformation, route/nav performance.
- Phase 14: interactive intelligence zones, real chart intelligence, progressive disclosure, mobile intelligence OS, intelligence graph, personalized workspace, feed notification OS, AI cognition, final UX audits.
- Phase 15: competitor/supremacy architecture, charting, mobile, scanner UX, Strategy Labs, Bloomberg/StockTitan-style feed, explainability, institutional trust, real-user telemetry.
- Phase 16: showcase parity, cinematic density, overlay unification, living intelligence OS, atmosphere, consciousness, ecosystem, superplatform, discovery scanner, market/symbol restoration, strategy labs, ranked zones, daily market command terminal.
- Phase 17-20: data depth, chart intelligence, macro/news ecosystem, strategy/portfolio realism, mobile native interactions, discovery dominance, living intelligence proof, hydration stability, scanner speed, production data depth, Bloomberg-level news, performance/stability, low-score recovery, chart persistence, information completion, design governance, trust architecture, resilience, mobile certification, scanner throughput, market memory performance, provider depth, daily-driver retention, institutional operations, ecosystem continuity, scale readiness.

Scale/performance/product proof:

- Phase 21: BrowserStack/authenticated performance, mobile safe area fixes, live scanner performance, persistent chart workflow sync, provider event depth, daily-driver retention, institutional portfolio proof, resilience/scale chaos.
- Phase 22: real-device mobile certification checks, authenticated scale probe, telemetry hot-path indexes, daily-driver notifications, scanner workflow dominance, chart workflow maturity, provider source trust, portfolio credibility, observability/trust, utility accessibility.
- Phase 23: notification drawer UX, mobile certification templates, provider outage simulation, cached hot reads, paid early access founding flow, daily-driver recovery, chart workflow closure, provider freshness SLA, institutional ledger, primary platform audit.
- Phase 24-26: scanner/discovery dominance, TradingView-class chart workflow, Bloomberg-class provider/event intelligence, retention workflow gravity, institutional operations, symbol-history performance, 100c discovery/live performance, provider freshness, chart/scanner browser timing, institutional proof boundary, runtime isolation for 100c, paid retention proof, real-device mobile certification, final primary platform recertifications.
- Phase 27-29: global symbol intelligence card overlay, chart decision workstation, symbol knowledge graph/market memory, primary workflow dependence loops, full platform performance probe, chart/symbol latency optimization, route performance, discovery 100c overhead, large-universe scanner proof, retention instrumentation, dedicated discovery scale, chart/symbol instant workflow rewrite.
- Sprint 30-32: retention emergency recovery, habit loop engine, viral growth, SEO organic acquisition, enterprise readiness, AI trading copilot, competitive leadership certification, predictive intelligence engine, platform moat construction.
- Phase 33-35: full platform audits, retention crisis forensics, mobile/provider/revenue recertifications, V1 launch readiness recertification, production performance root causes, expanded 500/1000 universe, scanner persistence/drop reasons, chart workflow latency instrumentation, R2/backup/stability work, final Phase 35.0C performance recertification.
- Latest HEAD after Phase 35 docs: fixed symbol card close/return behavior and scanner search fallback; updated expanded universe data/tests.

## Latest Evidence-Bound Status

Use the latest recertification docs as the current recorded source of truth:

- `docs/ops/phase-35-0c-4-final-performance-recertification.md`
- `docs/ops/phase-35-0c-3-long-duration-stability-backup-recovery-closure.md`
- `docs/ops/phase-35-0c-2-chart-workspace-restore-symbol-switch-latency-closure.md`
- `docs/ops/phase-35-0c-1-scanner-persistence-full-scan-stability.md`
- `docs/ops/phase-35-0-v1-launch-readiness-recertification.md`

Current recorded verdict:

- Overall Phase 35.0C.4: **NOT READY**.
- Scanner persistence/full-scan stability: **ACCOMPLISHED**.
- Chart workspace restore: metric closed under 250 ms, but full chart workflow certification **NOT ACCOMPLISHED** because Firefox route interactive and WebKit symbol switch failed final matrix targets.
- Stability/backup recovery: **NOT ACCOMPLISHED**; 24h observation not elapsed in docs, R2 current backup unhealthy, R2 restore pending.
- V1/public launch readiness: **NOT READY**.

Specific latest blockers from Phase 35.0C.4:

- R2 current backup unhealthy; latest R2 listing did not show current June 10 backups in the recorded proof.
- Current large-object R2 backup upload did not complete.
- R2 restore drill impossible until current R2 backup exists.
- 24h stability observation was running but not elapsed.
- Firefox `/symbol/AMD` interactive failed final matrix at 4495 ms against `<2500 ms`.
- WebKit symbol switch failed final matrix at 149 ms against `<100 ms`.
- `/market-memory` route was slow enough to keep watching.
- User-facing ranked universe in latest fast scan was 362 distinct rows from 500 selected, which is accounting-valid but not a 500-row UI claim.

Specific V1 launch blockers from Phase 35.0:

- Retention: D1 0.815%, D7 0%, 2+ active-day 0.815%, far below targets.
- Mobile: no required real-device matrix proof for iPhone Safari, Android Chrome, iPad Safari, Facebook in-app browser, Instagram in-app browser.
- Provider trust: `crypto-events` availability/freshness limited or unmeasured.
- Revenue: 2 paid users and 2 free-to-paid conversions were partial positives, but no trial-to-paid, retained paid, ARPU, LTV, CAC proof.
- Full route/browser workflow performance not green in that recertification.
- Disaster recovery only partial; full app/container/R2/failover proof incomplete.

Older positive evidence still relevant:

- Production routes have repeatedly smoked 200 in many phase docs.
- Authenticated 100c discovery/live API scale had strong prior proof.
- AI copilot, predictive intelligence, competitive leadership, and platform moat proofs were marked ready/bounded in sprint/phase docs.
- Stripe lifecycle was fully verified in Phase 12, but later revenue economics still failed as a launch gate.
- Local backup/restore drill passed in later Phase 35.0C.3 evidence.

## Development Priorities

P0: close launch blockers before building more surfaces.

- Owner's first two P0 fixes for the next work session are page performance and Discover ticker search/card opening.
- Performance P0: pages are still opening too slowly. Measure route load, API/server timing, browser interaction timing, and heavy component hydration. Fix bottlenecks before adding new feature surface area.
- Discover search P0: `/discover` ticker/name search must let the user type symbols or stock names such as `NVDA`, `IREN`, etc. and open that stock's card/symbol intelligence card reliably. Check `frontend/src/components/discovery/IntelligenceDiscoveryWorkspace.tsx`, `frontend/src/lib/trading/intelligence-discovery.ts`, symbol search/indexing utilities, and symbol overlay/card components before changing behavior.
- After those fixes, run a full current-state audit/scan and write a report covering measurements, remaining failures, production-only checks, and next blockers.
- Fix R2/offsite backup current-artifact upload and verify current Postgres/scanner artifacts are visible in R2.
- Run restore drill from R2-downloaded current artifacts.
- Let 24h stability observation complete; analyze memory, restarts, orphan processes, route latency, scanner/backup timers.
- Fix Firefox/WebKit chart workflow variance and rerun authenticated Chromium/Firefox/WebKit matrix.
- Run required real-device mobile certification matrix with screenshots/videos/session URLs/perf numbers.
- Resolve provider readiness, especially `crypto-events` coverage/freshness or adjust product claims to exclude it.
- Improve first-session activation/retention and gather real cohort evidence before public launch.
- Prove revenue lifecycle/economics: retained paid users, trial-to-paid, ARPU, LTV, CAC, churn.
- Re-run V1 launch readiness recertification after P0 proof exists.

P1: strengthen reliability and maintainability.

- Decide whether the product needs 500+ ranked user-facing rows, or only 500 selected/accounted symbols. If 500+ ranked is required, improve provider/filter coverage.
- Reduce scanner memory and runtime before increasing cadence or going beyond 1000 symbols.
- Add provider coverage monitoring for fallback-heavy symbols.
- Add scheduled 111/500/1000 comparison reports.
- Address large DB table pressure: request metrics, scanner signals, market memory, symbol snapshots, forward returns.
- Add `pg_stat_statements` or another query attribution path in staging/production.
- Centralize shared intelligence packets so terminal/dashboard/opportunities/symbol pages consume one contract instead of recomputing parallel models.
- Add route/API/service catalog and owner map.
- Improve CI coverage for auth, billing, copilot, replay, public pages, API, mobile flows, ops scripts, and docs links.
- Build a staging environment that restores latest backup and runs the app against it.

P2: future differentiation after launch proof.

- Outcome-calibrated signal layer by regime/setup/asset class.
- Richer official event citations and earnings/calendar coverage.
- Portfolio import/manual holdings, covariance clustering, stress-test validation.
- Durable webhook queue/dead-letter handling for developer platform.
- Public API docs/schema examples and SDK maturity.
- Native mobile only after PWA usage proves daily engagement.
- Cloud migration to managed Postgres/object storage/queue/worker plane after demand or scale thresholds.

## Quality And Safety Rules For Future Work

Python:

- Follow `AGENTS.md`.
- Add explicit type annotations for function arguments and returns.
- Avoid implicit `Any`.
- Type CSV readers as `Iterable[Dict[str, str]]`.
- Use `row.get(...)` and explicit `float(...)`/`int(...)` conversions.
- Do not add broad suppressions.
- Required before committing Python changes:
  - `python3 -m py_compile $(git ls-files '*.py')`
  - `npx pyright . --pythonpath .venv/bin/python --warnings`

TypeScript/frontend:

- Keep `npm --prefix frontend run lint` clean.
- Keep `npm --prefix frontend test -- --runInBand` clean for broad frontend changes.
- Run `npm --prefix frontend run build` for app/router/server changes.
- Run `npm --prefix frontend audit --omit=dev` for release/ops/security work.
- Use existing component patterns and domain models.
- Preserve premium locks and `assertNoPremiumFields` style public-preview boundaries.
- Mutating API routes should keep origin validation, CSRF, rate limiting, and access-control gates.
- Server-only modules should remain server-only.
- Avoid synthetic success metrics and fake market data in production-facing proof.

Ops/security:

- Never paste raw production `docker compose config`; use redacted wrappers.
- Do not print secrets from `.env`, `/etc/market-alpha-backup.env`, Docker env, rclone config, Stripe/OpenAI keys.
- DB migrations must go through `db/migrations` and `tools/db/run-migrations.sh`.
- Post-deploy backup/restore/health proofs should be recorded under `docs/ops/artifacts/...` and summarized in a docs/ops phase file.
- Production claims must be evidence-bound: route smoke, probe JSON, logs, screenshots/traces, DB counts, or test output.

Product copy:

- Keep research-only, non-advisory language.
- "WAIT" and "AVOID" are first-class positive product outcomes when risk is poor.
- If data is stale/limited/unavailable, surface it clearly rather than hiding it.
- Do not market API/community/strategy/native-mobile surfaces unless production evidence proves them.

## Common Commands

Local Python setup:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Run scanner:

```bash
python investment_scanner_mvp.py --fast --timing --universe-size 500
python investment_scanner_mvp.py --run-analysis --timing
python investment_scanner_mvp.py --symbols NVDA,AMD,SPY --fast --timing
python investment_scanner_mvp.py --alerts-only --send-alerts
```

Python validation:

```bash
python3 -m py_compile $(git ls-files '*.py')
npx pyright . --pythonpath .venv/bin/python --warnings
```

Frontend local commands:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
npm --prefix frontend run lint
npm --prefix frontend test -- --runInBand
npm --prefix frontend run build
npm --prefix frontend audit --omit=dev
```

Selected probes:

```bash
npm --prefix frontend run probe:phase35:chart-workflow-latency
npm --prefix frontend run probe:phase34:provider-freshness
npm --prefix frontend run probe:phase34:revenue-validation
npm --prefix frontend run probe:phase34:retention-crisis
npm --prefix frontend run probe:phase27:performance
npm --prefix frontend run test:browserstack:mobile
```

Required local-to-production loop:

```bash
# Local Mac workspace
git status --short --branch
# run the relevant local validations
git add <changed-files>
git commit -m "<clear message>"
git push origin main

# Linux production host
ssh sre@100.68.155.121
cd /opt/apps/market-alpha-scanner/app
git status --short --branch
git pull --ff-only origin main
```

Production migration/deploy/check patterns from docs must be run after SSH on the Linux host:

```bash
cd /opt/apps/market-alpha-scanner/app
tools/db/run-migrations.sh
tools/db/run-migrations.sh
docker compose --env-file .env up -d --build market-alpha-frontend market-alpha-frontend-hot-api
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-ops-green-check.sh
sudo /opt/ops/tradeveto-post-deploy-backup.sh
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-restore-drill.sh
sudo /opt/ops/tradeveto-stripe-reconcile.sh --dry-run
sudo /opt/ops/tradeveto-stripe-reconcile.sh
```

24h stability observer from Phase 35.0C.3:

```bash
sudo /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-stability-observe.sh \
  --duration-seconds 86400 \
  --interval-seconds 60 \
  --output-dir /opt/apps/market-alpha-scanner/app/docs/ops/artifacts/phase-35-0c-3-stability/observation-24h
```

R2 helper validation:

```bash
sudo python3 /opt/ops/tradeveto-r2-current-backup-sync.py \
  --remote r2:market-alpha-backups \
  --object /tmp/validation.txt ops-validation/manual/validation.txt
```

## Important Environment Variables

Scanner/data:

- `DATABASE_URL`
- `SCANNER_DATABASE_URL`
- `SCANNER_OUTPUT_DIR`
- `SCANNER_CSV_FALLBACK`
- `MARKET_DATA_PROVIDER`
- `MARKET_DATA_FALLBACK`
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `ALPACA_DATA_BASE_URL`
- `ALPACA_DATA_FEED`
- `TRADEVETO_UNIVERSE_SIZE`
- `TRADEVETO_SCANNER_UNIVERSE_SIZE`
- `TRADEVETO_ANALYSIS_TIME_BUDGET_SECONDS`
- `TRADEVETO_ANALYSIS_MAX_SNAPSHOTS`
- `TRADEVETO_ANALYSIS_MAX_SIGNAL_ROWS`

LLM/intelligence:

- `TRADEVETO_EVENT_INTELLIGENCE`
- `TRADEVETO_EVENT_CACHE_TTL_MINUTES`
- `TRADEVETO_EVENT_FEEDS_JSON`
- `TRADEVETO_EVENT_LLM_ENABLED`
- `TRADEVETO_EVENT_LLM_MODEL`
- `TRADEVETO_EVENT_LLM_TIMEOUT_SECONDS`
- `TRADEVETO_OPPORTUNITY_LLM_ENABLED`
- `TRADEVETO_OPPORTUNITY_LLM_MODEL`
- `TRADEVETO_OPPORTUNITY_LLM_TIMEOUT_SECONDS`
- `OPENAI_API_KEY`

Auth/beta/premium:

- `TRADEVETO_SESSION_SECRET`
- `TRADEVETO_ENABLE_DEV_LOGIN`
- `TRADEVETO_BETA_SIGNUP_MODE`
- `TRADEVETO_BETA_INVITE_CODE`
- `TRADEVETO_BETA_ALLOWED_EMAILS`
- `TRADEVETO_BETA_USER_CAP`
- `TRADEVETO_ADMIN_EMAILS`
- `TRADEVETO_PREMIUM_EMAILS`
- `TRADEVETO_DEV_PREMIUM_EMAILS`
- `TRADEVETO_MOCK_PREMIUM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Billing:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_BETA_TRIAL_DAYS`
- `STRIPE_ALLOW_PROMOTION_CODES`
- `TRADEVETO_ENABLE_STRIPE_TEST_MODE`
- `TRADEVETO_STRIPE_TEST_ALLOWED_EMAILS`
- `STRIPE_TEST_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY`
- `STRIPE_TEST_PRICE_ID`
- `STRIPE_TEST_WEBHOOK_SECRET`

Email/alerts/push/monitoring:

- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SUPPORT_EMAIL`
- `BILLING_EMAIL`
- `TRADEVETO_ALERT_EMAIL_TO`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TRADEVETO_ALERT_TELEGRAM_CHAT_ID`
- `SLACK_WEBHOOK_URL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `TRADEVETO_MONITORING_TOKEN`
- `TRADEVETO_MAX_SCAN_AGE_MINUTES`

## Must-Read Docs For Any Next Agent

Read these first:

- `AGENTS.md`
- `README.md`
- `docs/ops/phase-35-0c-4-final-performance-recertification.md`
- `docs/ops/phase-35-0c-3-long-duration-stability-backup-recovery-closure.md`
- `docs/ops/phase-35-0c-2-chart-workspace-restore-symbol-switch-latency-closure.md`
- `docs/ops/phase-35-0c-1-scanner-persistence-full-scan-stability.md`
- `docs/ops/phase-35-0-v1-launch-readiness-recertification.md`
- `docs/ops/production-ops.md`
- `docs/ops/backup-restore.md`
- `docs/ops/migration-ledger.md`
- `docs/beta/closed-beta-readiness.md`
- `docs/beta/known-limitations.md`
- `docs/analysis/scanner-calibration-report.md`

Read these when touching related areas:

- LLM/event safety: `docs/phase-8-llm-grounding-eval.md`, `docs/phase-7-verified-event-intelligence.md`.
- Market memory/fragility: `docs/phase-7-market-memory.md`, `docs/phase-7-conviction-fragility.md`.
- Early global audit context: `docs/ops/final-global-platform-audit.md`.
- Current scanner scale: `docs/ops/phase-35-0b-3-1000-symbol-scale-certification.md`.
- Chart workflow history: `docs/ops/phase-29-3-chart-symbol-instant-workflow-rewrite.md`.
- Production runbooks: `docs/ops/production-ops.md`, `docs/ops/backup-restore.md`, `docs/ops/secrets-hardening.md`.

## Practical Next Step Recommendation

Do not start with another feature panel. Start with evidence closure:

1. Re-check current production status against the latest code and docs.
2. Close R2/offsite backup and R2 restore proof.
3. Finish/analyze 24h stability observation.
4. Fix chart workflow full-matrix failures.
5. Run real-device mobile certification.
6. Re-run launch readiness recertification.
7. Only then decide whether the next product work should target retention onboarding, provider coverage, revenue proof, or cloud migration.

End of handover.
