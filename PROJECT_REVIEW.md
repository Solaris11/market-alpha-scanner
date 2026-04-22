# Project Review: market-alpha-scanner

## 1. Repository Understanding

- What the code currently does: The repo is a single-script CLI scanner centered on [investment_scanner_mvp.py](investment_scanner_mvp.py). It downloads daily price history for a fixed default universe of 111 liquid symbols, computes a small set of technical and fundamental scores, applies a simple macro regime adjustment, ranks the symbols, prints a top table, and writes two CSVs.
- Main data sources: All market and metadata inputs come from `yfinance`. Historical OHLCV comes from `yf.download()` and per-symbol metadata/fundamentals come from `yf.Ticker(symbol).info`. There is no caching layer, retry policy, timestamped run metadata, or secondary data source.
- Scoring logic summary: Each symbol gets `trend`, `momentum`, `breakout`, `rsi_macd`, `volume`, `fundamentals`, `macro`, and `risk` components. The final `total_score` is a weighted sum of those components plus an extra explicit subtraction for `risk_penalty`. `explosion_score` is a second weighted score tilted toward breakout, momentum, and volume. Ratings are hard-thresholded into `STRONG BUY`, `BUY`, `WATCH`, and `PASS`.
- Current output and user value: The user gets a ranked shortlist and full CSV export. For an early MVP, the main value is speed of idea triage: it is a practical way to sort a small curated watchlist by trend/momentum strength without manually checking 100 charts.
- Additional factual context from the current repo state:
  - The default universe size is 111 and all 111 symbols made it into the current ranking output, so the default filters are not meaningfully shaping the default run.
  - The current sample output produces 30 `STRONG BUY`, 26 `BUY`, 32 `WATCH`, and 23 `PASS`.
  - The latest local run completed in about 33 seconds using the repo `.venv`.
  - The implementation is materially smaller than the product vision: four tracked files, one production script, no test suite, no package structure, and no persistent storage.

## 2. Strengths

- What is already good:
  - The project has the right instinct: decision-support first, not prediction theater. The README and script both frame it as a ranking engine rather than a certainty engine.
  - It is simple enough to understand end-to-end in one read. That is valuable at this stage because it makes iteration fast.
  - The scoring dimensions are directionally sensible for a first pass: trend, multi-horizon momentum, breakout proximity, liquidity, basic fundamentals, and risk all matter in a practical scanner.
  - The output format is usable immediately. CSV export plus a concise terminal table is enough for an operator to inspect candidates.
  - The default universe is intentionally biased toward liquid names. That reduces garbage signals versus scanning the entire small-cap market too early.

- What is promising:
  - The project is already positioned around a useful user question: “what is strongest right now, across assets?”
  - A cross-asset scanner can be more interesting than yet another equities-only screener, especially if it becomes genuinely regime-aware instead of just mixing tickers in one table.
  - The current model can become a good internal backbone for a better product even if the present score formula is not yet commercially defensible.

- What could become a moat:
  - A validated ranking history tied to real forward outcomes by regime, asset class, and setup type.
  - Better feature engineering and calibration than generic retail scanners.
  - An explainable workflow that saves users time every day: shortlist, rationale, alerts, regime context, and post-signal tracking.
  - Proprietary labeled data from your own signal history and user interactions. The raw factor ideas are not a moat; calibration, data quality, and workflow can be.

## 3. Weaknesses / Risks

- Technical weaknesses:
  - The repo is a monolith. Almost all logic lives in one file, which makes it easy to start but harder to test, extend, and reason about as the product grows.
  - There are no tests, no backtest harness, no validation suite, no CI, and no packaging metadata beyond `requirements.txt`.
  - The scanner relies entirely on `yfinance`, including `Ticker.info`, which is free but operationally fragile for anything you want users to pay for.
  - The runtime path is not fully reproducible from the repo root unless the user manually uses the local virtualenv. `python3 investment_scanner_mvp.py` fails in the current environment because global dependencies are missing.
  - `scan_symbols()` does one metadata call per symbol with `fetch_info()`, which is slow and vulnerable to transient failures. A bad metadata fetch can silently remove an equity from consideration because missing `marketCap` fails the filter.
  - Filters are configured as global mutable state in `main()`. That is acceptable in a script but is poor footing for future library usage, testing, or a service layer.
  - The `top_n` argument is passed into `scan_symbols()` but not used inside the function. That is minor, but it signals the code has not yet been tightened.

- Product weaknesses:
  - This is not yet a “market scanner” in the strong sense. It is a ranking script over a fixed curated list of 111 symbols.
  - The ratings are too forceful relative to the model quality. Labels like `STRONG BUY` imply a level of validation the code does not support.
  - The output is not yet actionable enough for real decisions. There is no timeframe definition, no entry logic, no exit logic, no stop framework, no position sizing, no benchmark-relative context, and no evidence of edge persistence.
  - The score is not transparent enough for trust. Users will eventually ask “why is this ranked above that?” and “what usually happens after this signal?” The current note field is too thin for that.
  - There is no persistent run history, so the product cannot answer high-value questions like rank changes, setup persistence, or forward returns after ranking.

- Market / monetization risks:
  - Generic scanners are crowded and cheap. “Ranks assets by momentum plus macro” is not enough to command durable subscription revenue on its own.
  - If the project stays at CSV-plus-score level, it risks being perceived as a thin wrapper around free Yahoo data and common technical indicators.
  - If you overstate the intelligence of the score before it is validated, the product becomes a credibility trap. Early trust is hard to regain.
  - The customer base is sensitive to false precision. If the model is unstable, users will churn quickly.

- Anything misleading in the current scoring or output:
  - Commodity proxies are never actually classified as `COMMODITY_PROXY`. In `infer_asset_type()` the `quoteType == ETF` check happens before the symbol check for `GLD`, `SLV`, and `USO`, so those instruments become `ETF` instead of `COMMODITY_PROXY` ([investment_scanner_mvp.py](investment_scanner_mvp.py):350-358).
  - Because of that classification issue, the commodity macro branch is effectively dead in current output. The ranking only contains `EQUITY`, `ETF`, and `CRYPTO`.
  - Almost every ETF receives the same equity macro tailwind, including `TLT`, `UUP`, `GLD`, and `USO` ([investment_scanner_mvp.py](investment_scanner_mvp.py):558-563). That is conceptually wrong and makes the “macro-aware multi-asset” claim look stronger than the implementation really is.
  - Macro adds very little cross-sectional information right now. In the current ranking CSV there are only two macro scores: `79.5` for nearly everything non-crypto and `71.55` for crypto.
  - Some assets help define the macro regime and then benefit from that regime themselves. `SPY`, `QQQ`, and `BTC-USD` are both inputs to the macro model and ranked candidates, which creates self-referential scoring ([investment_scanner_mvp.py](investment_scanner_mvp.py):361-400, 558-563).
  - The score is not calibrated. On the current sample run, 56 of 111 names are `BUY` or `STRONG BUY`, which is too many if the goal is a high-signal shortlist.
  - Several components are heavily discretized and saturate quickly:
    - `trend_score` is a threshold stack.
    - `momentum_score` hits the 0 or 100 clamp fairly often.
    - `breakout_score` jumps sharply on proximity to highs.
    - `rsi_macd_score` uses large bucket jumps.
    This makes rankings less stable and less interpretable than percentile-based scoring would.
  - `fundamentals_score` is structurally generous. ETFs and crypto get a neutral `55`, while many equities land high enough that fundamentals act more like a soft boost than a discriminating filter.
  - Risk is awkwardly modeled. `risk_score` is already `100 - penalty`, but `total_score` also subtracts `risk_penalty` again ([investment_scanner_mvp.py](investment_scanner_mvp.py):272-303, 565-576). That is effectively double-counting risk.
  - The README overstates breadth. The repo does not actually scan the Dow, Nasdaq, or S&P 500 components; it scans a curated subset.
  - If you later backtest this naively, current `Ticker.info` fundamentals will create point-in-time integrity problems because they are present-day snapshots, not historical fundamentals.

## 4. Recommended Features

### A. Immediate next features

- Fix asset classification and macro routing.
  - Why it matters: Right now part of the multi-asset framing is not true in implementation.
  - Expected user value: More credible rankings and fewer obviously wrong macro labels.
  - Implementation difficulty: Low
  - Business impact: High
  - Category: MVP improvement

- Add run metadata, score breakdowns, and reproducibility output.
  - Why it matters: Users need to know when the scan ran, what filters were used, what data source was used, and why each asset ranked where it did.
  - Expected user value: Higher trust and easier debugging of signals.
  - Implementation difficulty: Low
  - Business impact: High
  - Category: MVP improvement

- Add a real backtest / forward-evaluation harness with simple holding rules.
  - Why it matters: Without outcome measurement, the score is only a story.
  - Expected user value: Evidence that the rankings are worth paying attention to.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: Serious trading-engine improvement

- Replace hard thresholds with percentile or z-score style cross-sectional ranking where practical.
  - Why it matters: The current score saturates too easily and produces too many ties and top-heavy ratings.
  - Expected user value: Cleaner differentiation between names and more stable rankings.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: Serious trading-engine improvement

- Separate universe construction from scoring.
  - Why it matters: A credible scanner needs a maintainable universe layer, not a hard-coded list.
  - Expected user value: Broader coverage, custom universes, and fewer false impressions about breadth.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: MVP improvement

- Add caching, retries, and failure reporting for external data calls.
  - Why it matters: Free data failures will otherwise look like random product quality failures.
  - Expected user value: More reliable daily operation and fewer missing names.
  - Implementation difficulty: Medium
  - Business impact: Medium
  - Category: MVP improvement

### B. Medium-term product features

- Build historical rank tracking and rank-delta alerts.
  - Why it matters: Rank changes are often more useful than a single static score.
  - Expected user value: Users can focus on new entrants, upgrades, and deteriorations instead of rereading the full table every day.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: SaaS / product improvement

- Add benchmark-relative and sector-relative strength features.
  - Why it matters: Absolute momentum is not enough; users want to know what is outperforming its benchmark and peers.
  - Expected user value: Better signal quality and better explanation for why a name is strong.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: Serious trading-engine improvement

- Create asset-class-specific scorecards instead of one shared formula.
  - Why it matters: Equities, crypto, bond ETFs, and commodity proxies should not be scored as if they were the same object.
  - Expected user value: Rankings become more believable and less distorted by mismatched features.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: Serious trading-engine improvement

- Add setup templates instead of one monolithic score.
  - Why it matters: Breakout continuation, pullback-to-trend, defensive relative strength, and crypto momentum are different setups.
  - Expected user value: Users can choose the setup style that matches how they trade.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: Serious trading-engine improvement

- Add event awareness.
  - Why it matters: Earnings, CPI, Fed decisions, and ETF-specific events can invalidate an otherwise attractive chart setup.
  - Expected user value: Fewer blindside signals and better timing judgment.
  - Implementation difficulty: Medium
  - Business impact: Medium
  - Category: Serious trading-engine improvement

- Add watchlists, saved screens, and user-configurable filters.
  - Why it matters: A product becomes sticky when users can shape it around their own workflow.
  - Expected user value: Personal relevance and lower friction.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: SaaS / product improvement

### C. Long-term differentiators

- Build an outcome-calibrated signal layer on top of raw ranks.
  - Why it matters: Raw scores are easy to copy; calibrated expectancy by regime and setup is much harder.
  - Expected user value: Users see not only what is strong, but what historically worked under similar conditions.
  - Implementation difficulty: High
  - Business impact: High
  - Category: Serious trading-engine improvement

- Introduce better data than Yahoo alone.
  - Why it matters: If the product becomes commercial, data quality becomes product quality.
  - Expected user value: More stable signals, richer context, and better trust.
  - Implementation difficulty: High
  - Business impact: High
  - Category: Long-term proprietary edge

- Add portfolio-aware recommendations.
  - Why it matters: Users do not buy isolated scores; they manage portfolios, correlations, and risk budgets.
  - Expected user value: Better real-world usability and lower signal redundancy.
  - Implementation difficulty: High
  - Business impact: Medium
  - Category: SaaS / product improvement

- Build a regime dashboard plus daily narrative summary.
  - Why it matters: Many users will pay for concise synthesis, not raw tables.
  - Expected user value: Faster comprehension of the market backdrop and where leadership is shifting.
  - Implementation difficulty: Medium
  - Business impact: High
  - Category: SaaS / product improvement

- Add differentiated data features where they truly fit the use case.
  - Why it matters: Estimate revisions, options positioning, on-chain data, and futures structure can create real separation if used carefully.
  - Expected user value: Higher-confidence filters and richer context for advanced users.
  - Implementation difficulty: High
  - Business impact: High
  - Category: Long-term proprietary edge

## 5. Priority Roadmap

- Phase 1: next 1–2 weeks
  - Fix classification and macro-routing correctness first.
  - Refactor the single script into a small package with modules for data, features, scoring, CLI, and output.
  - Add run metadata, score contribution output, and a stored scan history table.
  - Add caching and error handling around data fetches.
  - Rename ratings to less loaded language if you do not yet have validation. `Tier 1`, `Tier 2`, `Watch`, `Avoid` is safer than `STRONG BUY`.
  - Start a minimal validation notebook or script that measures forward returns after ranking over rolling historical windows.

- Phase 2: next 1–2 months
  - Build a proper backtest / walk-forward framework.
  - Add benchmark-relative strength, sector-relative strength, and rank-change features.
  - Split scoring logic by asset class and setup family.
  - Replace hard-coded universe construction with configurable universe sources and presets.
  - Persist historical runs in DuckDB or SQLite so you can analyze rank stability and signal outcomes.
  - Add alerting for new entrants, rank upgrades, and setup confirmations.

- Phase 3: later SaaS / product evolution
  - Move the scanner into a service that computes scheduled scans and stores results centrally.
  - Build a web app around daily shortlists, saved watchlists, alerts, score decomposition, and historical setup performance.
  - Introduce premium data selectively where it clearly improves signal quality.
  - Create a paid product around validated workflows and personalization, not around raw CSV exports.
  - Consider an API or advisor-facing product only after the consumer workflow is proven.

## 6. Architecture Recommendation

- Recommend a practical next-step repository structure:

```text
market-alpha-scanner/
  pyproject.toml
  README.md
  configs/
    default.yaml
    universes/
      default.csv
  src/
    market_alpha_scanner/
      __init__.py
      cli.py
      settings.py
      models.py
      universe.py
      data/
        yahoo.py
        cache.py
      features/
        trend.py
        momentum.py
        volatility.py
        fundamentals.py
        regime.py
      scoring/
        ranker.py
        explain.py
      storage/
        runs.py
      outputs/
        console.py
        csv_export.py
  tests/
    test_features.py
    test_scoring.py
    test_universe.py
```

- Keep it realistic:
  - Do not introduce microservices.
  - Do not build a full event bus.
  - Do not add a database server yet.
  - Use DuckDB or SQLite first for cached market data, scan runs, and historical analysis.
  - Keep one CLI entrypoint plus a small internal library.
  - Add clear interfaces only where you need them: data provider, universe provider, scoring pipeline, and storage.

- Practical architecture advice:
  - Separate pure feature functions from I/O. That makes testing easy.
  - Treat scan configuration as explicit input, not mutable global state.
  - Store each run with timestamp, universe hash, config, and results.
  - Make score explanation a first-class output, not an afterthought.
  - Design for one scheduled batch pipeline first. Real-time can wait.

## 7. Public vs Private Strategy

- What should stay open-source/public:
  - The basic CLI scanner framework.
  - Core technical indicator implementations.
  - A Yahoo-based reference data adapter.
  - Documentation, examples, and sample configs.
  - A limited free ranking mode that proves the product concept.

- What may become proprietary later:
  - Exact score weighting, calibration, and regime logic once validated.
  - Historical labeled signal/outcome datasets.
  - Premium universes and watchlist intelligence.
  - Alert thresholds, ranking history analytics, and expectancy modeling.
  - Integrations with paid data vendors.
  - The hosted app, user data, and personalization logic.

- How to preserve monetizable edge:
  - Open-source the framework, not the best recipe.
  - Keep the highest-value logic server-side so users see results and explanations without receiving the full ranking engine internals.
  - Build proprietary value from validation, outcome tracking, UX, and data quality.
  - Avoid giving away the part that customers would actually pay for: trustable, monitored, historically grounded signal intelligence.

## 8. Web App / SaaS Strategy

- Target user:
  - Primary target: self-directed swing traders and active investors who want a short, high-quality nightly shortlist.
  - Secondary target later: small advisors, research newsletters, and trader communities that want a reusable signal feed.

- Core paid feature:
  - A validated daily shortlist with alerts, rank changes, regime context, and transparent score decomposition.

- Free vs paid boundaries:
  - Free:
    - Delayed or limited top rankings
    - Small default universe
    - Basic score breakdown
    - Weekly or end-of-day refresh
  - Paid:
    - Full universe access
    - Saved watchlists and custom screens
    - Historical rank changes
    - Setup-specific alerts
    - Forward-performance stats for each setup
    - Better data freshness and richer context

- Best monetization path:
  - Start with subscriptions, not brokerage or execution.
  - Position it as time-saving decision support for active traders.
  - Price only after validation, but the likely path is a retail subscription tier first and a higher-tier pro plan later.
  - A plausible shape is something like a lower retail tier for rankings and alerts, then a higher tier for historical analytics, custom universes, and advanced setup filters.

- What would actually make people pay:
  - Evidence that the shortlist is better than random market-watching.
  - Faster daily workflow than manually scanning charts.
  - Trustworthy explanations for why names are ranked.
  - Signal history that shows what happened after past rankings.
  - Alerts that surface meaningful changes instead of noise.
  - Personalization. People pay for relevance, not raw data dumps.

## 9. Final Verdict

- Is this project commercially promising or not?
  - Yes, but only as a starting point. The current code is commercially adjacent, not commercially ready.

- What is the strongest angle?
  - Cross-asset, regime-aware swing-trade discovery with strong explanation and validation. The best angle is not “AI stock picker”; it is “high-signal daily market triage for active investors.”

- What is the biggest danger?
  - Mistaking a plausible composite score for a validated edge. If you market confidence before earning it, the product will become untrustworthy faster than it becomes useful.

- What 3 things should be done next?
  - Fix the scoring correctness issues and make the model honest about what it is.
  - Build historical evaluation so you can measure whether rankings actually have predictive value.
  - Refactor the script into a small testable package with persistent run history, because that is the minimum foundation for both serious model work and a future web product.
