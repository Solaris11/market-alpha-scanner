# TradeVeto — /symbol chart & decision-analysis architecture audit (Phase 1)

**Date** 2026-09-11 · **Branch** `work/terminal-ia-simplification` · **Type**
audit only, no runtime change · **Goal** groundwork for turning /symbol into a
primary trading decision workspace (discovery → symbol → 1D/4H/1H inspection →
setup validation → entry/stop/target) without opening TradingView.

## Headline — the gap is not the chart library, and not "more AI text"

Two beliefs going in were worth testing against the code, and both change the plan:

1. **The chart stack is already capable.** The symbol chart is
   **lightweight-charts 5.2.0** rendering real candlesticks, crosshair, zoom/pan,
   signal markers, and — critically — **horizontal price-level overlays
   (`createPriceLine`) are already shipped and wired**: entry-zone, stop, and
   target lines draw today via `symbol-chart-utils.ts` (`addTradeLevelLines`,
   `addResearchContextLines`). Entry/stop/target overlays — the top trader ask —
   are **not a missing feature; they already exist.** No new chart library is
   needed or justified.

2. **The real gaps are data granularity and evidence surfacing**, not text:
   - **No intraday data anywhere.** The chart is daily-bars-only end to end
     (~500 bars/symbol). The "1D / 1W / 1M …" buttons are **lookback windows over
     daily candles, not granularity switches.** The target 1D→4H→1H→5m/15m
     workflow is impossible today without new ingestion + a schema change.
   - **The scanner computes evidence it never shows on the chart.** AVWAP
     anchors, the SuperTrend line, and the actual chosen support/resistance
     levels are computed and drive the decision, but are either not persisted or
     not drawn. The chart re-computes its *own* indicators from candles,
     independent of the scanner's authoritative values. And **the candle payload
     carries no volume**, which blocks both volume visualization and AVWAP.

So the path to replacing TradingView is: **(a) surface evidence that already
exists onto the capable chart, then (b) add intraday timeframes.** Neither
requires a new charting engine.

---

## 1. Current chart implementation

| Aspect | Finding |
|---|---|
| Library | **lightweight-charts 5.2.0** (symbol chart). Also echarts 6.0.0 (analytics), recharts (share assets), @visx / @nivo (mini visuals). No TradingView, d3, chart.js, plotly. |
| Symbol chart component | `frontend/src/components/terminal/SymbolChart.tsx` (`"use client"`, ~4517 lines) + helper `symbol-chart-utils.ts`. Candlesticks + optional line series, crosshair, markers, configurable indicator overlays. |
| Overlay capability | **Already present**: `createPriceLine` via `addTradeLevelLines` (entry/stop/target) and `addResearchContextLines` (support/resistance), wired at `SymbolChart.tsx:1047-1049`, fed by the `tradeLevels` prop from `buildSignalTradeLevels(row)`. |
| Client indicators (from candles) | `chart-intelligence-overlays.ts`: `sma20, ema20, ema50, rsi14, macd, atr14, volatility20, rangePressure, supertrend, anchoredVwap`. Default on: ema20, ema50, rsi14. `anchoredVwap` is **hard-disabled** — "unavailable in this OHLC-only payload" (no volume). |
| Server vs client | Symbol page is a server component (`force-dynamic`). `SymbolChart` is lazy `dynamic(ssr:false)` behind a `chartReady` flag; a lightweight SVG `FastSymbolChartShell` shows first. Data arrives as **props** (candles, signals, tradeLevels), no client fetch for candles. |
| Terminal overview chart | Separate implementation — `charts/InteractivePriceChart.tsx`, hand-rolled SVG line/area, no candles, no `createPriceLine`. Not shared with the symbol chart. |
| Performance cost | Symbol page ships **~77 JS chunks** (≈40 lazy `dynamic` panels each split out). Load is still fast (see §7) thanks to HTTP/2 + small chunks, but chunk count is high. |

## 2. Data & timeframes

| Aspect | Finding |
|---|---|
| Granularity | **Daily bars only.** yfinance `interval="1d"` (Alpaca fallback `1Day`), `period="2y"` → ~500 bars/symbol. `scanner/market_data.py:300-318`, `scanner/config.py:55`. |
| Storage | Single table `symbol_price_history (symbol, ts, open, high, low, close, volume, source)` — `db/migrations/20260505_122100_*.sql:153-170`. **No interval/timeframe column**; unique key `(symbol, ts, source)` structurally assumes one granularity. |
| Writer | `database/writeback.py:178-197`, source hardcoded `'scanner'`. |
| Readers | `frontend/src/lib/server/validated-price-history.ts`, `api/price-history/[symbol]/route.ts`, symbol page via `ScannerDataAdapter.getSymbolDetail(symbol,"2y").slice(-120)`. All read the daily table. Fallback: `scanner_signal_price_history` (daily-ish, reconstructed). |
| "Timeframe" buttons | `price-history-range.ts` — `1d/1wk/1mo/6mo/ytd/1y/5y/max` are **date-window cutoffs** over daily rows (`filterPriceHistoryRows`), not candle intervals. |
| Aggregation | **None** for candles. No daily→weekly or intraday→4H resample in scanner, DB, server, or client. (The `.groupby` in `analysis.py` is forward-return analytics; the `15m/1h` labels in `admin-*` are request-metric dashboards.) |
| **Volume on chart** | Table stores volume, but the candle payload delivered to the chart is **OHLC-only** — volume is dropped before the chart, which is why `anchoredVwap` is disabled and no volume pane exists. |
| Gap for 1D→4H→1H→5m/15m | **Everything.** No intraday fetch (interval hardcoded), no intraday storage (no interval column), no aggregation engine, no intraday-capable readers/UI. yfinance/Alpaca *can* serve 1m/5m/15m/1h but with shorter history caps (~60d for 1–5m, ~730d for 1h). |

## 3. Indicators inventory (computed vs visualized)

Structural fact: `database/repositories.py:86` dumps every `RankedAsset` column
into the `payload`, so **a value reaches /symbol iff it is a `RankedAsset`
column**. Values computed only inside a `scoring.py` function never leave the
scanner.

| Indicator | Computed | Persisted (column) | On /symbol | On chart today |
|---|---|---|---|---|
| EMA20/50 | `utils.py:ema`, `scoring.py` | No | No (value) | **Yes** (chart recomputes from candles) |
| SMA20/50/200 | `utils.py:sma` | No | No | Partial — chart draws sma20 only; scanner uses 50/200 |
| AVWAP (ytd, swing) | `scoring.py:214 score_avwap` | **No** (not in RankedAsset) | **No** | **No** (indicator disabled — needs volume) |
| RSI | `scoring.py:138` | `current_rsi` | Yes | Text tile; chart recomputes rsi14 separately |
| MACD hist | `scoring.py:139` | `current_macd_hist` | Yes | Text tile; chart recomputes macd separately |
| Stochastic RSI | — | — | — | Not implemented |
| ATR / atr_pct | `utils.py:atr`, `scoring.py:1070` | `atr_pct` | Yes | Text tile; chart recomputes atr14 separately |
| Bollinger Bands | `pre_expansion.py:152` (width percentile) | only pre_expansion_score | Partial (score) | No band overlay |
| Relative volume | `scoring.py:200` | `relative_volume_score` | Yes (score) | No volume series |
| Volume MA | inline in relvol | No | No | No |
| Support / resistance | `scoring.py:807-905` (candidates) | only the chosen buy_zone/stop/target | via those | chart recomputes generic S/R from candle highs/lows |
| Swing highs/lows | `scoring.py:680-810` | via derived levels | via those | No direct overlay |
| SuperTrend | `scoring.py:42,110` | `supertrend_score`; **line not persisted** | score only | chart recomputes its own line |
| Breakout/retest | `scoring.py:172` | `breakout_score` | score only | No explicit overlay |

## 4. Trade-plan levels — what can be drawn today with no new scanner work

Already drawn (via `buildSignalTradeLevels` → `createPriceLine`): **entry band**
(`entry_zone_low/high`), **stop** (`stop_loss`), **target** (`conservative_target`).

On the row / payload but **NOT drawn today** (drawable now, they are numeric):
- `take_profit_low` / `take_profit_high`, `balanced_target`, `aggressive_target`
  — a **1.5R / 2R / 3R target ladder** is available and undrawn.
- `suggested_entry`, `entry_distance_pct` (pct → annotation, not a line).

Text-only / not numeric (need scanner work to become chart lines):
- support / resistance / breakout / retest exist only inside `*_reason` strings
  and the chosen buy_zone/stop/target — the underlying selected numerics are not
  emitted separately.
- risk_reward (+ variants), setup_type, entry_status, decision_reason,
  confidence_score, vetoes, warnings — all reach /symbol as text/scores.

## 5. Score explainability (score → evidence → chart)

Every score reaches /symbol; the **underlying evidence is the gap**. `final_score`
components (technical/fundamental/news/macro − risk) are all on the row. But the
raw evidence behind the *technical* subscores is largely absent:

- `trend_score` ← price vs EMA20/SMA50/SMA200 + stack + slopes — **MA values not
  on row**.
- `supertrend_score` ← price vs supertrend_line — **line not on row**.
- `avwap_score` ← price vs YTD/swing AVWAP — **anchors not on row**.
- `momentum_score` ← RSI + MACD hist + returns — RSI & MACD **are on row**.
- `breakout_score` ← proximity to 3M/1Y highs + volume ratio — highs not emitted
  as numerics.
- `pre_expansion_score` ← compression (BB width rank) + contraction + volume
  accumulation — components in payload, underlying series not.

So "score → evidence → chart" is blocked mainly by **evidence persistence**, not
by the chart. Where evidence is already on the row (RSI, MACD, atr_pct), it is
shown as text tiles rather than reconciled onto the chart panes.

## 6. /symbol UX gap (as a trader)

- ~22 sections, **~20 of them score/narrative/card**; exactly one real
  candlestick chart (+ an SVG teaser in the instant shell). The page is
  **text/card-heavy**; two large advanced-detail groups are collapsed
  accordions; it is one long scroll with no tab/drawer navigation.
- Above the fold: back-nav → ready strip → instant shell (SVG + Decision/Score/
  Freshness) → **decision hero** → **chart**. So chart + decision are reachable
  early — good.
- Chart, score, levels and narrative are **separate GlassPanel components** but
  share data lineage (`row` + `buildSignalTradeLevels`), so numbers are
  consistent even though visually decoupled.
- **What a trader can already decide here**: the decision (WAIT/AVOID/ENTER),
  the score, and entry/stop/target — all present, and the levels are on the
  chart. **Where TradingView is still needed**: multi-timeframe inspection
  (1D→4H→1H), volume confirmation, and seeing the *evidence* behind a weak score
  on the chart rather than as text.
- Worth preserving: the lazy-loaded architecture, the fast instant shell, the
  early decision-hero + chart placement, the shared level lineage.

## 7. Performance baseline (production, measured 2026-09-11)

| Page | TTFB | domInteractive | load | doc (decoded) | doc (gzip) |
|---|---:|---:|---:|---:|---:|
| /symbol/AMD | 112 ms | 430 ms | 465 ms | 345 KB | 59 KB |
| /symbol/NVDA | 76 ms | 336 ms | 339 ms | 346 KB | 65 KB |
| /symbol/SNDK (evidence-limited) | 79 ms | 279 ms | 285 ms | 200 KB | 37 KB |
| /terminal | 67 ms | **2861 ms** | **2869 ms** | **9043 KB** | 754 KB |

- **/symbol is healthy and light** (~200–350 KB, load < 500 ms). Page weight
  scales with evidence (SNDK, less history, is ~200 KB vs ~345 KB for AMD).
- **/terminal is 26× heavier decoded (9 MB) and ~6–10× slower** — a caution:
  /symbol must **not** adopt /terminal's heavy shared-component patterns.
- Symbol page fetches **~77 JS chunks** (many small lazy panels).
- Console: 4 cosmetic 404s — `/manifest.json`, `/sw.js`,
  `/apple-touch-icon-precomposed.png` (PWA/icon probes). `/api/price-history/*`
  is 403 to an uncredentialed fetch (auth boundary, not an error). No 5xx.
- **Phase-1 added no instrumentation** — all metrics read from the browser's
  Navigation/Resource Timing and network/console. Nothing shipped, nothing to
  remove.

---

## 8. Phase 2 plan (prioritized by trader value)

The ordering deliberately front-loads the work that is **low-risk and reuses the
existing capable chart**, and defers the heavy new-data work.

### P2.1 — Surface existing evidence onto the chart (highest value / lowest risk)
No new library, no schema change. Mostly scanner *persistence* + existing
`createPriceLine`/series.
1. **Persist the anchors the decision already uses**: add `avwap_ytd`,
   `avwap_swing`, `supertrend_line`, and the *chosen* `support_level` /
   `resistance_level` / `prior_breakout` as `RankedAsset` columns (they are
   already computed in `scoring.py`). This is additive scanner output — an
   **image-input change → rebuild + full scan required**, but no DB destructive
   change (payload absorbs new keys; add typed columns only if needed).
2. **Add volume to the candle payload** so the chart's `anchoredVwap` and a
   volume pane become possible. This is a reader/serialization change
   (`getSymbolDetail`/validated-price-history already select `volume`; it is
   dropped downstream). Verify payload size impact against §7 (must not regress).
3. **Draw the target ladder** (`take_profit_low/high`, `balanced_target`,
   `aggressive_target`) via the existing `addPriceLine` — pure frontend, the
   data is already on the row.
4. Draw the persisted AVWAP / SuperTrend / real S/R lines from #1 via the same
   helper, replacing the chart's independently-recomputed generic lines so the
   chart shows the levels the decision was *actually* made on.

### P2.2 — Score → evidence → chart (depends on P2.1 persistence)
Click a weak Trend / Volume / Structure / Momentum score → highlight the
contributing evidence on the chart (MA stack for trend, volume bars + relvol for
volume, AVWAP/SuperTrend for structure). The chart primitive exists; this needs
the evidence from P2.1 on the row + a light interaction layer.

### P2.3 — Intraday timeframes 1D → 4H → 1H (highest effort, real new data)
The only item requiring new ingestion + schema:
1. Intraday fetch path (yfinance/Alpaca `1h`/`15m`/`5m`; mind history caps).
2. Schema: add `interval` to `symbol_price_history` and change the unique key to
   `(symbol, ts, interval, source)` — **additive migration, rollback-scripted,
   no destructive change**; or a separate intraday table.
3. Scheduled intraday ingestion job (separate systemd timer; do not couple to
   the daily full scan).
4. Reader/UI: make the period selector choose *granularity*, with 4H derivable
   from 1H by server-side resample to limit fetch/storage.

### P2.4 — Volume confirmation visualization (depends on P2.1 #2)
Volume pane + volume MA + relative-volume shading, once volume is in the payload.

### P2.5 — Drawing tools & customizable indicators (last)
Only after the above prove the workflow. lightweight-charts supports the
primitives; no new library anticipated.

### Where the overlay/indicator architecture should live
Extend the existing seams, do not add a parallel system:
`NormalizedTradeLevels` / `ChartResearchLevel` + `symbol-chart-utils.ts`
(`addPriceLine`) for levels; `chart-intelligence-overlays.ts` for series.
Keep everything **client-side from props** as today — no new client fetch on
/symbol, to protect the §7 baseline.

### How to avoid bloating /symbol or /terminal
- Keep new overlays inside the already-lazy `SymbolChart`; do not add top-level
  sections. Prefer toggles on the existing chart over new panels.
- Do **not** pull /terminal's heavy shared components into /symbol (see the 9 MB
  vs 345 KB gap).
- Re-measure §7 after each P2 unit; treat any /symbol load regression beyond the
  current ~500 ms / ~350 KB as a blocker.

### How to test & deploy safely
- Frontend-only units (P2.1 #3–4, P2.2, P2.4): typecheck + test suite + prod
  build gate (worktree docker build) → deploy → smoke + browser + re-measure §7.
- Scanner-persistence units (P2.1 #1, P2.3): additive only; dry-run scan into an
  isolated outdir first (per the SNDK runbook), verify new columns populate,
  then rebuild scanner-job + one real scan. Rollback tag before build.
- Every unit: commit + push; image-input change → rebuild+deploy; docs/ops-only
  → no rebuild but prod pull + verify + smoke.

## Biggest gaps vs a TradingView-style workflow (summary)
1. **No intraday** — cannot inspect 1D→4H→1H. (P2.3)
2. **No volume on the chart** — no volume confirmation, AVWAP disabled. (P2.1 #2)
3. **Decision evidence not on the chart** — AVWAP/SuperTrend/real S/R computed
   but not persisted/drawn; scores explained as text, not on the chart. (P2.1/P2.2)
4. **Single target drawn** — the R-ladder exists on the row, undrawn. (P2.1 #3)

## What already exists and should be reused (do not rebuild)
- lightweight-charts candlestick chart with crosshair/zoom/markers.
- `createPriceLine` overlay helpers (entry/stop/target/support/resistance).
- Client indicator engine (EMA/SMA/RSI/MACD/ATR/SuperTrend from candles).
- Shared level lineage (`buildSignalTradeLevels`) keeping chart/hero/ticket
  numbers consistent.
- Lazy architecture + fast instant shell + early decision-hero/chart placement.


---

## Phase 2 progress log (updated as units ship)

Governing principle: **WHAT → WHERE → WHICH** (see standing instructions). Every
unit below is judged by whether it improves the decision, the levels, or the
ranking — not decoration.

### Shipped to prod
- **P2.1 #1 — R-target ladder** (commit `721f5951`, deployed). Draws T1/T2/T3
  from `conservative_target` / `take_profit_high` / `aggressive_target_high`,
  ascending-guard so degenerate rungs never draw. Frontend-only. Verified: OXY
  T1=62.19/T2=66.83/T3=69.74, AMD T1-only. **WHERE.**
- **P2.1 #2 — volume on the symbol chart** (commit `a7d86d59`, deployed).
  Volume was already in the RSC payload (getSymbolPriceHistory returns it);
  surfaced as a bottom-scale histogram + 20-bar average line, toggle, honest
  disabled state when absent. **WHERE / WHAT** ("is this move backed by real
  volume?").

### Measured performance (prod, decoded doc size — the reliable regression signal)

| Page | Baseline | After #1 (R-ladder) | After #2 (volume) |
|---|---:|---:|---:|
| /symbol/AMD | 345 KB | 346 KB | 346.0 KB |
| /symbol/NVDA | 346 KB | ~346 KB | 346.8 KB |
| /symbol/SNDK | 200 KB | ~200 KB | 200.3 KB |

Decoded size flat across both units — volume added **zero** payload cost
because it already shipped. No new long tasks; console shows only the
pre-existing cosmetic 404s (manifest/sw/apple-touch-icon). Mobile 375px: no
horizontal overflow; chart canvas fits. No regression.

### Deferred / follow-ups
- Fullscreen modal chart does not yet render volume (separate series setup) — next.
- T2/T3 axis labels can lose contrast inside the breakout-zone band — polish (item 5).
- Missing-volume disabled state verified by unit test, not a live no-volume symbol.

---

## Session update — 2026-09-11 (continuation)

- **P2.1 item 2 polish — decisive WHERE labels + readable T2/T3** (commit
  `10fc7ef0`, **local only, NOT yet pushed/deployed**). Entry line → "Ideal
  entry", stop line → "Stop / invalidation", legend copy matched; T2/T3 axis
  labels moved from washed-out light blues (#7dd3fc/#bae6fd) to saturated
  #0ea5e9/#0284c7 so they stay legible inside the breakout-retest band. Labels
  and colours only; ladder values and the ascending guard untouched. Closes the
  "T2/T3 lose contrast" deferred follow-up. Verified locally on the owner's
  machine: `tsc --noEmit` clean; ladder+volume+chart-utils unit tests **17/17**.
- **Test hygiene** (commit `f17b0b26`) and **WHAT/WHERE/WHICH + progress log**
  (commit `30dff812`) are committed locally and **were never pushed** — they are
  the two commits this branch is ahead of `origin` by, plus `10fc7ef0`. Push
  from a machine with GitHub access: `git push origin
  work/terminal-ia-simplification` (branch is 3 ahead of origin).
- Full implementation spec for **items 3–5** is in the project doc
  `claude/symbol-chart-p2.1-items-3-5-spec-2026-09-11.md` (scanner persistence
  path, exact file:line anchors, deploy classes, tests, perf guards).
- **Environment note:** this continuation session ran after a container
  reclaim. It had no push (GitHub egress blocked), no prod reach (ssh
  unreachable), and no cloud toolchain (npm 403). All verification was done on
  the owner's connected machine via the device bridge. Deploy of item 2 (and of
  items 3–5) is therefore pending a session/host that can reach prod.

### Deferred / follow-ups (updated)
- Fullscreen modal chart volume: **still unverified** — modal charts via
  `SymbolChartModal`/`ChartLayoutExplorer`, not a recursive `<SymbolChart>`;
  needs a live fullscreen look at a symbol with volume.
- Missing-volume disabled state: verified by unit test, not yet on a live
  no-volume symbol.
