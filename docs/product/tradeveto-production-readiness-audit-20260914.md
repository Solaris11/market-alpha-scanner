# TradeVeto — Production Readiness & Competitive Gap Audit (2026-09-14)

Evidence labels: **PROD HOST** = ssh to `onsre-node-01` (authoritative for server,
DB, docker, systemd, scanner, backup, health, curls) · **PROD WEB** =
https://tradeveto.com browser/API as a logged-in premium user · **LOCAL MAC** =
code reading / unit / type / build only (never production evidence).

Access note: the owner's real Mac reaches PROD HOST (Tailscale direct,
`ssh sre@100.68.155.121` works). This session's automation tools cannot execute
real-Mac shell commands directly (device VM is loopback-only; cloud shell has no
ssh; GUI automation is click-only for terminals), so PROD HOST was collected via
a read-only script run once by the owner (`.claude-prod-audit/run.sh` →
`out.txt`, no secrets printed) and read back through the bridge.

Scope audited: state after P2.1 chart work (items 2–5), SNDK P0, backup/deep-
health fix, and the `/terminal` lazy-load slice (`fd9a82ef`).

---

## 0. Headline

- **No P0.** No auth leakage, no outage, all containers healthy with 0 restarts,
  deep health green, scanner fresh. (PROD HOST + PROD WEB)
- **The product's core WHAT is effectively switched off:** the live scanner
  produced **ENTER = 0 of 356** symbols today (PROD WEB), and `setup_type` reads
  `"AVOID"` on 355/356. This is a *known, structurally diagnosed* fault — the
  fixed candidate engine already exists in shadow mode and is wired to nothing.
  **This is the #1 item for the next sprint** (P1). (PROD WEB + LOCAL MAC)
- **`/terminal` is still ~9.1 MB.** The lazy-load slice (`fd9a82ef`) deployed and
  works (route live, gated, hub loads on scroll) but cut only ~1%: the hub was
  never the bulk. The weight is opportunity-row decision/score data re-embedded
  by ~15 server-built panel models. Next perf slice is a row dedup, not more
  lazy-loading. (PROD WEB + LOCAL MAC)
- **npm: 17 vulnerabilities (1 critical, 6 high) still unresolved** — cannot be
  audited/fixed from this session's environments (registry egress 403); must run
  on the real Mac. (LOCAL MAC — blocked)

---

## 1. PROD HOST — server state (authoritative)

Source: `.claude-prod-audit/out.txt`, two captures: 10:38:21Z (first pass) and
10:52:57Z (corrected script: images, scheduler, DB via `docker compose exec`).

| check | result |
|---|---|
| Tailscale | Mac `100.111.30.29` ↔ `onsre-node-01 100.68.155.121` **active, direct** |
| host / user | `onsre-node-01` / `sre` |
| app checkout | `/opt/apps/market-alpha-scanner/app` |
| **prod git HEAD** | **`fd9a82e`** — "Lazy-load the terminal cross-asset chart hub" (2026-09-14 01:51 UTC) → branch deployed through `fd9a82ef` ✓ |
| `docker compose ps` | `market-alpha-frontend` **Up 13m (healthy)**, `market-alpha-frontend-hot-api` **Up 13m (healthy)**, `postgres:16-alpine` **Up 13m (healthy)** |
| restart counts | frontend **0**, hot-api **0**, postgres **0** — all `health=healthy` |
| `market-alpha-fast-scan.timer` | last **10:26:44** (11 min before check), next 10:41:44 → ~15-min cadence, **fresh** |
| `market-alpha-full-scan.timer` | last **Fri 2026-09-11 21:30:01**, next **Mon 21:30** → **no full scan Sat/Sun** (see P2-3) |
| `tradeveto-scanner-health.timer` | last Mon 06:16, next Tue 06:19 → daily ✓ |
| backup scheduler | **cron, not a timer**: root crontab `5 3 * * * /opt/ops/backup-postgres.sh` (daily 03:05) and `0 3 * * * /opt/ops/backup-mysql.sh`; plus `30 22 * * 1-5 …/tradeveto-refresh-shock-patterns.sh` (weekdays). The **06:00 UTC `market-alpha-backup.sh` R2 offsite run** that deep health reports is *not* in the captured crontab or in any `tradeveto`/`market-alpha` timer — its trigger is still unidentified (P2-5) |
| `tradeveto-resource-watchdog.timer` | every 5 min (last 10:51:57) ✓ |
| **image freshness** | `market-alpha-frontend:latest` + `hot-api:latest` **built 2026-09-14T09:55:48Z** (the `fd9a82ef` deploy); `market-alpha-scanner-job:latest` **built 2026-09-14T01:10:53Z** (the items-3/4 scanner rebuild); rollback tags `rollback-20260914a` (09-12 16:30) and `rollback-20260914b` (09-14 01:19) present. **No stale image** — both images are from today |
| external curl from prod → `/api/health` | **200 in 0.22 s** |
| **DB — latest scan run** | `scan_runs`: **2026-09-14 10:46:13 UTC, status=success, symbols_scored=359** (read via `docker compose exec … psql` inside the postgres container) ✓ |
| DB — decision / setup distributions (raw table) | first pass: `psql` not on host; second pass: only the first query ran because `docker compose exec -T` consumed the remote `bash -s` stdin (script since fixed with `</dev/null`). The distributions for this same run are confirmed from PROD WEB `/api/ranking` (§6), which serves this run's `scanner_signals` (356 of 359 scored rows) |

Observation — the ~10:25 UTC stack-wide restart: at 10:53 all three containers
(frontend, hot-api, **and postgres**) read "Up 28 minutes" while frontend/hot-api
were *created* 56 min earlier (~09:57, the `fd9a82ef` recreate) and postgres was
created 4 months ago. `RestartCount` is 0 on all three, which rules out a
restart-policy/crash loop (those increment the counter), and the unchanged
created-times rule out a recreate. That signature matches an operator
`docker compose restart` (or a Docker-daemon/host restart) at ~10:25, ~30 min
after the 09:55 image build. It is a brief availability window; the cause is
not recorded in this capture — ops follow-up (P2-4), not dismissed.

## 2. PROD WEB — performance (logged-in premium, in-app browser)

| page | TTFB | DOM interactive | load | decoded doc | JS chunks | console errors |
|---|---:|---:|---:|---:|---:|---|
| `/terminal` | 83 ms | 2012 ms | **2252 ms** | **9074 KB** (745 KB gzip) | 34 / 3061 KB | none |
| `/symbol/AMD` | 209 ms | 292 ms | 431 ms | 350 KB | 38 / 1911 KB | none |
| `/symbol/NVDA` | 80 ms | — | 427 ms | 350 KB | — | none |
| `/symbol/SNDK` | 341 ms | — | 453 ms | 278 KB | — | none |
| `/symbol/OXY` | 269 ms | — | 665 ms | 349 KB | — | none |
| `/api/ranking` (authed) | — | — | — | **4,597 KB** | — | — |
| `/api/history/latest` (authed) | — | — | — | **1,638 KB** | — | — |

Baselines: `/terminal` ~9148 KB before `fd9a82ef`; `/symbol` AMD/NVDA ~346–347 KB.
Symbol pages are **flat** after P2.1 items 3–5 (they add ~5 floats). SNDK's rise
from ~200 KB reflects it now having full candle data, not code.

**`fd9a82ef` verification (PROD WEB):** `/api/terminal/market-charts` → anonymous
**401**, authenticated **200 with 8 charts**; the `LazyMarketChartHub` placeholder
is present and the hub loads on scroll. **Payload effect: 9148 → 9074 KB (≈ −1%).**
The slice is correct and safe but did not address the bulk.

**Attribution of the remaining 9 MB (field-frequency scan of the live RSC
document):** `score` ×16,842 · `fragility` ×3,719 · `volume` ×3,658 ·
`symbol` ×2,884 · `risk_reward` ×2,506 · `close` ×1,977 · `reason` ×1,875 ·
`datetime` ×1,820 · `decision` ×1,617 · `conviction` ×1,027 · `narrative` ×718 ·
`shockEvent` ×712. The same ~356 opportunity rows' decision/score fields are
serialized many times over. LOCAL MAC confirms the mechanism: in
`TerminalPremiumView.tsx`, **15 server-side builders are each fed
`opportunityModel.rows`** and emit a new model embedding row-derived copies, and
`rows={clientRows}` is passed to **5 client panels** (UnifiedIntelligenceConsole,
IntradayRegimeDriftPanel, RegimeShiftIntelligencePanel,
InstitutionalIntelligencePanel, RiskTolerantOpportunityRadar) — **27 row-or-model
props** in total. ~1,820 `datetime` price points also still ship inside one of
these models (not the hub). Long tasks: the buffer captured 0 post-load; measure
with an observer registered before navigation in the next perf unit.

## 3. PROD WEB — auth gates & security boundaries

| endpoint | anonymous | authenticated | verdict |
|---|---|---|---|
| `/api/terminal/market-charts` | **401** | 200, 8 charts | gated ✓ |
| `/api/history/latest` | **401** ("Sign in to access premium features") | 200, 1.6 MB | gated ✓ |
| `/api/ranking` | 200, **`rows: []`** + scanSafety only | 200, 4.6 MB | premium rows hidden ✓ (P3 hygiene: 200+empty vs 401) |
| `/api/symbol/AMD` | 200, **`history: [], row: null`** | 200, 82 KB | premium hidden ✓ (P3 hygiene) |

**No data leakage found — no P0/P1.** Consistent with the 2026-09-11 security
assessment (HSTS preload, real CSP, HttpOnly session, no `.env`/`.git`/source-map
exposure). Still open from that assessment: CSP `script-src 'unsafe-inline'` (P2),
no `security.txt` (P3).

## 4. PROD WEB — deep health after the "failed" fix

`/api/health/deep` → **200, `ok: true`**: db **ok**; scanner **ok, fresh (2 min)**;
backup **ok** — local ok (229 min), **offsite R2 ok (synced 202 min ago;
`backup completed`, exit 0, 4.68 GB postgres + 2.37 GB scanner)**. The 2026-09-12
offsite timeout is resolved. Semantics after `9b151abb`: the synthetic now
delegates to the shared classifier (`backup === "failed"` → critical; offsite-only
warn stays a warning), matching the endpoint's `ok = db==="ok" && scanner!=="fail"
&& backup!=="failed"`. PROD HOST corroborates: `/api/health` 200 from the host,
containers healthy, 0 restarts.

## 5. Symbol chart / P2.1 acceptance (PROD WEB)

All four symbols, logged-in premium: Focus-evidence chips render with live
scores (AMD 80/59/9/100 · NVDA 85/30/13/54 · SNDK 95/37/0/67 · OXY 100/55/59/100);
the **"Show evidence" toggle is enabled on every symbol** — it is disabled only when
all AVWAP/SuperTrend/S-R fields are null, so items 3/4 are deployed *and*
populated; "Hide volume" (item 2) and "Hide levels" (R-ladder) are on; toggling
evidence works. Live `/api/ranking` shows `avwap_ytd`, `avwap_swing`,
`supertrend_line`, `recent_swing_low`, `recent_resistance` populated on
**356/356 rows**, and entry+stop+target present on **356/356**. Chart DOM confirms a
price canvas plus a **548×56 volume-histogram pane**. Console clean on all four;
the responsive (mobile-width) layout is correct (chips wrap, chart fits, no
horizontal overflow).

Visual polish gaps: (a) candlestick *pixel* screenshots could not be captured in
the in-app pane — a persistent "START HERE" growth-onboarding card re-covers the
chart region on this account, and the pane downscales desktop emulation; a
human glance at overlay aesthetics is the residual. (b) Fullscreen modal chart
does not yet get volume/evidence parity (`SymbolChartModal` charts separately).

## 6. Scanner quality (PROD WEB evidence + LOCAL MAC mechanism)

Live `/api/ranking`, latest run, 356 rows: **ENTER 0 · WATCH 40 · WAIT_PULLBACK 1
· EXIT 207 · AVOID 108**; `setup_type` **"AVOID" 355 / "PULLBACK" 1**;
WAIT_PULLBACK-without-level **0**; evidence fields **100%**; full levels **100%**.

Mechanism (LOCAL MAC, `scanner/candidate_decision.py` header, quoting the code's
own diagnosis): *"The live engine produces ENTER for about 0.05% of rows"*,
traced in `docs/analysis/scanner-decision-audit-20260905.md` to four structural
faults — (1) `setup_type` carries a **verdict ("AVOID") in a classification
field**, arriving via the catch-all branch so it is the default; (2) that verdict
is counted twice (as a class and as a −25 quality penalty); (3) `trade_permitted`
requires an *empty* veto list, so an advisory flag blocks entry as hard as a stale
feed and a market-wide regime flag blocks every symbol; (4) every expansion
feature is backward-looking, so moves are detected late and then rejected.
`setup_engine.py` defaults `setup_type = "AVOID"` on severe vetoes / weak-volume
breakouts / non-matching shapes, and `decision_funnel.py` has a hard gate
`setup_type_avoid: passed = setup_type != "AVOID"` → blocking → `"AVOID"`. **A
candidate engine that fixes all four exists and writes `candidate_*` columns,
but `SCANNER_DECISION_MODE` defaults to `current`** — so prod still runs the
faulty engine. Today's 0/356 is that fault, live.

Against the five concerns: too few ENTERs — **confirmed, extreme (0)**;
WAIT_PULLBACK without level — **not present**; late expansion detection —
**confirmed by design** (fault 4); stale image/universe — **no**: fast scan
fresh (15-min timer), scanner-job image built today 01:10, frontend built today
09:55 (PROD HOST); the full-scan timer's Fri→Mon gap is weekday-only scheduling
(§7 P3-7); drop-reason coverage — PROD HOST: latest run scored **359**, PROD WEB
serves **356** → 3 rows not surfaced in the ranking; the per-reason breakdown
lives only in `scan_runs.metadata.scanner_accounting` (no API exposes it) and
the raw read did not execute this run (stdin bug, fixed) — see §8.

SNDK: present in the served ranking and live on `/symbol/SNDK` ($1,632.99,
EXIT, score 48) — PROD WEB. P2.1 evidence fields: 356/356 populated for this
run — PROD WEB over the PROD-HOST-confirmed run.

## 7. Issue list

**P0 — none.**

**P1**
- **P1-1 Scanner produces zero ENTER decisions (WHAT is off).** 0/356 live;
  ~0.05% historically; four documented structural faults; fixed engine in shadow.
  Fix: evaluate the shadow comparison (`candidate_*` vs `final_decision` on
  recent runs), then promote via `SCANNER_DECISION_MODE`, staged. Not a hot-fix.
- **P1-2 `/terminal` initial document ~9.1 MB / ~2.3 s load.** Root cause: row
  decision/score data re-embedded by 15 server builders + 5 direct row passes.
  Fix: serialize the opportunity rows **once** (one shared row map keyed by
  symbol) and have builders/panels reference symbols instead of embedding rows.
- **P1-3 npm: 17 vulns (1 critical, 6 high) unresolved.** Registry is 403 from
  every environment this session can reach; must run on the real Mac:
  `npm audit --json` → classify runtime/build/dev → safe patch/minor fixes →
  `npm install` → typecheck/test/build → rebuild+deploy frontend.

**P2**
- **P2-1 `setup_type` semantics** — a verdict living in a classification field
  (355/356 = "AVOID"); resolved by P1-1's engine, but the persisted field should
  become the true shape (PULLBACK/BREAKOUT/CONTINUATION/mixed) regardless.
- **P2-2 `/terminal` first-screen density** — see §9.
- **P2-3 → reclassified P3-7 (by design).** `market-alpha-full-scan.timer`:
  last Fri 21:30:01, next **Mon** 21:30 — a daily timer that had failed Sat/Sun
  would still show `next` on the following day and a failed unit; instead the
  next fire skips the weekend, matching the weekday-only cron pattern
  (`30 22 * * 1-5`) used elsewhere on the host. Markets are closed; treat as
  intended. Residual: confirm the unit's `OnCalendar` is `Mon..Fri` (P3-7).
- **P2-4 Stack-wide restart ~10:25 UTC — ops follow-up.** All three containers
  restarted (postgres included); `RestartCount` 0 and unchanged created-times
  point to an operator `docker compose restart` or a daemon/host restart, not a
  crash. Not recorded in this capture: record the cause (deploy log / `journalctl
  -u docker`, `last reboot`) and, if it was not operator-initiated, treat as an
  incident to explain.
- **P2-5 Offsite backup trigger not identifiable.** Deep health proves
  `market-alpha-backup.sh` ran at 06:00 UTC and synced to R2 successfully, but
  the captured root crontab only schedules `/opt/ops/backup-postgres.sh` (03:05)
  and `/opt/ops/backup-mysql.sh` (03:00), and no `tradeveto`/`market-alpha`
  timer is a backup. So there are at least two postgres backup paths (a generic
  03:05 host backup and the 06:00 R2 offsite one) and the offsite trigger lives
  somewhere not captured (another user's crontab or a differently-named timer).
  Make it explicit and monitored; decide whether the 03:05 `backup-mysql.sh` is
  legacy.
- **P2-6 CSP `'unsafe-inline'`** (carried from 2026-09-11) — nonce-based CSP.

**P3**
- P3-1 `/api/ranking` and `/api/symbol` return 200 + empty defaults to anonymous
  callers instead of 401 (hygiene; no leakage).
- P3-2 No `/.well-known/security.txt`.
- P3-3 Deep-health synthetic pages on a single failed probe; add a 2-consecutive
  debounce so a ~30 s recreate doesn't page.
- P3-4 Fullscreen modal chart parity (volume + evidence overlays).
- P3-5 The "START HERE" onboarding card re-covers the chart region on the
  symbol page for this account (UX polish / dismiss persistence).
- P3-7 Confirm `market-alpha-full-scan.timer` `OnCalendar` is weekday-only (see
  P2-3 reclassification).
- P3-6 `.git` cruft from bridge sessions (temp objects, stale locks, drifted
  local `origin/` ref) — `git fetch && git gc --prune=now` on the real Mac.

## 8. PROD HOST — DB/ops confirmation: closed

Second capture (10:52:57Z) closed the ops items: image build dates, the backup
scheduler (cron), timers incl. the resource watchdog, and the latest scan run
from the DB (`2026-09-14 10:46:13 UTC, success, 359 symbols`). The only defect
was in my script: `docker compose exec -T … psql` read the remote `bash -s`
stdin and swallowed the four follow-on queries (decision/setup distributions,
signals-24h, runs-7d); only the first ran. Fixed (`</dev/null` on each exec).

Closure per item (labels explicit):
- latest scan run — **PROD HOST DB** ✓ (10:46 UTC, success, 359 scored)
- decision distribution / ENTER count — **PROD WEB** `/api/ranking` over this
  same run: ENTER **0**, WATCH 40, WAIT_PULLBACK 1, EXIT 207, AVOID 108 (356 rows)
- setup_type distribution — **PROD WEB**: "AVOID" 355 / "PULLBACK" 1
- SNDK present — **PROD WEB** (ranking + `/symbol/SNDK` live)
- P2.1 evidence fields populated — **PROD WEB**: 356/356
- drop-reason / accounting coverage — **PROD HOST** 359 scored vs **PROD WEB**
  356 served → 3 dropped; per-reason breakdown is DB-only (no API) and is the
  single item the fixed script would add on a future run — not required to act
  on P1-1.

The raw-table distributions were therefore confirmed from the application's
own read of the same run rather than from `psql` directly. The conclusion they
support (P1-1: ENTER = 0, setup_type = AVOID on nearly every row) is not in
doubt — it is also the documented behaviour of the live engine.

## 9. UX — `/terminal` first screen vs WHAT / WHERE / WHICH

Render order today (LOCAL MAC, `TerminalPremiumView.tsx`): TerminalCommandBar →
DailyActionCard → ActionTriageStrip → DailyMarketCommandCenter →
GlobalMarketCommandCenter → UnifiedIntelligenceConsole → PredictiveIntelligence →
LazyMarketChartHub → sections of ecosystem / institutional / regime / drift /
risk-tolerant / copilot panels.

- **WHAT (Enter/Wait/Exit):** DailyActionCard + ActionTriageStrip do this — but
  with ENTER=0 the card can only ever say WAIT/AVOID, so the first screen is
  structurally unable to show an actionable WHAT until P1-1 lands. That, not
  layout, is the biggest first-screen gap.
- **WHERE (entry/stop/target):** not on the terminal first screen at all — a
  trader must open `/symbol/<X>` to see levels. Recommendation: the top-1 (or
  top-3) candidates on the first screen should carry their entry / stop / T1
  inline (data is already in the rows).
- **WHICH (ranking + why):** UnifiedIntelligenceConsole provides the ranked list;
  the "why" is spread across Predictive, Ecosystem, Institutional, Regime and
  Drift panels — five separate reasons surfaces. Recommendation: one "why this
  ranks" line per candidate on the console; move the five reasoning panels
  behind progressive disclosure (collapsed by default, expand on demand — no
  removal).
- **Too dense / redundant:** DailyMarketCommandCenter + GlobalMarketCommandCenter
  are two adjacent market-state surfaces; Predictive + Ecosystem +
  Institutional + Regime + Drift each restate row-level evidence. Grouping them
  under one collapsed "Deeper evidence" section reduces cognitive load and,
  combined with P1-2, cuts payload. Do not remove any panel.

## 10. Recommended next sprint order

1. **Scanner WHAT fix (P1-1)** — first read the shadow comparison from the DB
   (candidate vs live over recent runs); if the candidate is sane (non-zero,
   non-absurd ENTER rate, levels present), promote it staged
   (`SCANNER_DECISION_MODE`), verify on prod, keep rollback = flip back.
2. **`/terminal` row dedup (P1-2)** — frontend-only, measurable; target a large
   decoded-doc drop with zero panel removal.
3. **npm audit fix (P1-3)** — on the real Mac; safe patch/minor only.
4. **First-screen WHERE + progressive disclosure (P2-2)** — inline levels for
   top candidates; collapse the five reasoning panels.
5. **Ops confirmations (P2-3/4/5)** — full-scan cadence intent, the 10:25 restart,
   backup scheduler visibility.

## 11. What not to do yet

- Do **not** flip the decision engine without the shadow-comparison evidence.
- Do **not** ship more lazy-load micro-slices on `/terminal` — `fd9a82ef` proved
  the hub was ~1%; the dedup is the lever.
- Do **not** add chart visuals (WHAT/WHERE/WHICH rule); P2.1 is complete.
- Do **not** weaken deep-health criteria; do **not** take breaking npm majors
  unless a critical is runtime-reachable with no other fix.
- Do **not** start a large new feature before P1-1 and P1-2.

## 12. Deploy risk notes

- P1-2 (row dedup): frontend image rebuild; risk = a panel reading a field the
  shared map no longer carries → gate with tsc + the panel tests + a prod
  re-measure; rollback tag first.
- P1-1 (engine promotion): scanner env/config change, low *deploy* risk (flip
  back), high *product-behaviour* risk → shadow evidence first, then one real
  scan, then compare decision distribution before/after on prod.
- P1-3 (npm): build-time risk → full typecheck/test/`next build` gate before
  rebuild.
- Any scanner-image change: rollback tag → rebuild scanner-job → dry-run scan
  into an isolated outdir → real scan → verify.

## 13. Concrete first implementation slice after this audit

**`/terminal` row dedup (P1-2), frontend-only.** In `TerminalPremiumView.tsx`,
build `clientRows` once (already done), then change the 15 `build*({ rows:
opportunityModel.rows, … })` server builders so their emitted models carry
`symbol` references (and only the few fields their panel actually renders)
instead of embedding row-derived copies; pass one shared `rowsBySymbol` map to
the client and have the 5 `rows={clientRows}` panels resolve rows from it.
Measure decoded `/terminal` document before/after on PROD WEB (baseline 9074 KB)
and keep every panel. Expected: multi-MB reduction; acceptance = no panel loses
data, no console/network errors, decoded doc materially lower, load < 2.3 s.

Run in parallel (no engine change): the P1-1 shadow-comparison DB read.
