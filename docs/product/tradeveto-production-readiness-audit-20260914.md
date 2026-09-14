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

Source: `.claude-prod-audit/out.txt`, captured 2026-09-14T10:38:21Z.

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
| backup scheduler | **not visible** as a `tradeveto`/`market-alpha` systemd timer in this capture (only `dpkg-db-backup`); backup *did* run — see PROD WEB deep health (P2-5) |
| external curl from prod → `/api/health` | **200 in 0.22 s** |
| DB read-only queries | **not captured this run** — `psql: command not found` on the host (postgres runs in a container). Script corrected to `docker compose exec … psql`; **needs one re-run** (see §8) |

Observation: frontend/hot-api were *created* 42 min before the check (the
`fd9a82ef` deploy) and **all three containers — including postgres — were
restarted ~13 min before the check (~10:25 UTC)**, i.e. a stack-wide restart.
Restart counters are 0, so it was a controlled restart, not a crash loop, but it
is a brief availability window — confirm it was intentional (P2-4).

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
**confirmed by design** (fault 4); stale image/universe — fast scan fresh, but
**full scan has not run since Fri** (P2-3) and image freshness is pending the DB/
image re-run; drop-reason coverage — `scanner_accounting` exists; coverage
numbers pending the DB re-run (§8).

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
- **P2-3 Full-scan cadence** — `market-alpha-full-scan.timer` last ran Fri
  21:30, next Mon 21:30: either intentionally weekday-only or it missed the
  weekend. The SNDK RCA established the full `--run-analysis` scan matters for
  universe coverage; confirm the OnCalendar intent and whether a weekend gap is
  acceptable.
- **P2-4 Stack-wide restart ~10:25 UTC** (all three containers, incl. postgres,
  "Up 13 minutes"; 0 restart counts) — confirm intentional; if not, find the
  cause (host reboot / compose down-up).
- **P2-5 Backup scheduler not visible as a systemd timer** in the capture
  (deep health proves the backup ran at 06:57 UTC and succeeded) — confirm the
  mechanism (cron vs a differently-named timer) so it is monitored explicitly.
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
- P3-6 `.git` cruft from bridge sessions (temp objects, stale locks, drifted
  local `origin/` ref) — `git fetch && git gc --prune=now` on the real Mac.

## 8. PROD HOST — items pending one re-run of the corrected script

`psql` is not installed on the host (postgres is a container), so the DB block
produced no data. `.claude-prod-audit/run.sh` now execs `psql` **inside the
`market-alpha-postgres` container** (using the container's own `POSTGRES_USER`/
`POSTGRES_DB`; nothing is echoed) and additionally captures image build dates
and the backup scheduler. One re-run of the same command yields: latest
`scan_runs` time/status/symbols_scored; `final_decision` and `setup_type`
distributions straight from `scanner_signals`; signals in the last 24 h; runs and
failures in the last 7 d; `docker compose images` + image `Created` timestamps;
`systemctl list-timers` filtered to tradeveto/market-alpha + `crontab` backup
entries. Until then the DB-level confirmation of §6 is **PROD WEB (API) evidence
only**, and image freshness / drop-reason coverage are **pending**.

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
