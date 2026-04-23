# Market Alpha Scanner

Multi-asset market scanner that ranks equities, ETFs, crypto, and liquid proxy instruments using a practical composite model:

- Technical structure
- Fundamentals
- Macro alignment
- Simple headline / event context
- Explicit risk penalty

This is a ranking tool for idea triage, not a prediction engine.

The current version also adds:

- short-term / mid-term / long-term recommendation scores
- explainable horizon actions and reasons
- per-symbol detail artifacts for the dashboard

## What It Measures

The current scanner computes five main layers:

- `technical_score`
  - trend structure with EMA / SMA alignment
  - SuperTrend state
  - RSI / MACD momentum health
  - breakout quality
  - relative volume
  - anchored VWAP support using YTD and recent swing-low anchors
- `fundamental_score`
  - quality
  - growth
  - valuation
- `macro_score`
  - risk-on / risk-off
  - rates pressure
  - dollar trend
  - oil / gold / credit context
  - sector / asset-class sensitivity mapping
- `news_score`
  - simple recent headline bias for top-ranked single names
  - neutral by default for most non-single-name proxy instruments
- `risk_penalty`
  - annualized volatility
  - ATR percent
  - drawdown
  - earnings proximity for equities
  - overextended momentum fade

Those base layers are then reused to produce:

- `short_score` / `short_action`
- `mid_score` / `mid_action`
- `long_score` / `long_action`

## What It Does Not Pretend To Do

- It does not forecast returns with precision.
- It does not implement institutional-grade news NLP.
- It does not include VPVR because Yahoo daily bars are not reliable enough for that.
- AVWAP anchors are objective heuristics, not perfect discretionary anchors.
- Macro and headline layers are intentionally simple and should be treated as context, not certainty.

## Installation

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

This installs the scanner dependencies plus Streamlit for the internal dashboard.

## Usage

Run with the default universe:

```bash
python investment_scanner_mvp.py
```

Run with a custom CSV:

```bash
python investment_scanner_mvp.py --universe-csv my_symbols.csv
```

Example CSV:

```csv
symbol
NVDA
MSFT
QQQ
BTC-USD
GLD
USO
```

Adjust filters:

```bash
python investment_scanner_mvp.py \
  --min-price 3 \
  --min-dollar-volume 5000000 \
  --min-market-cap 500000000
```

Limit or skip headline enrichment:

```bash
python investment_scanner_mvp.py --news-limit 15
python investment_scanner_mvp.py --skip-news
```

Run with historical snapshot storage and forward-return analysis:

```bash
python investment_scanner_mvp.py --save-history
python investment_scanner_mvp.py --run-analysis
python investment_scanner_mvp.py --run-analysis --no-save-history
```

Run with Telegram alerts enabled:

```bash
python investment_scanner_mvp.py --save-history --send-alerts
```

The scanner now also writes per-symbol detail artifacts automatically for the dashboard:

```bash
python investment_scanner_mvp.py --save-history
```

Run the internal dashboard:

```bash
streamlit run dashboard.py
```

## Output

The scanner writes:

- `scanner_output/full_ranking.csv`
- `scanner_output/top_candidates.csv`
- `scanner_output/history/scan_YYYYMMDD_HHMMSS.csv`
- `scanner_output/analysis/forward_returns.csv`
- `scanner_output/analysis/performance_summary.csv`
- `scanner_output/alerts/telegram_alert_state.json`
- `scanner_output/symbols/<symbol>/history.csv`
- `scanner_output/symbols/<symbol>/summary.json`

The dashboard reads those files directly from disk. It does not maintain a separate database or modify scanner behavior.

## Telegram Alerts

The scanner supports a lightweight Telegram alert layer for internal operator notifications.

### Required Environment Variables

Set these before running with `--send-alerts`:

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
```

### Trigger Logic

An alert is sent when the latest scan contains any row matching one of these conditions:

- `rating == "TOP"`
- `final_score >= 80`
- secondary inclusion:
  - `rating == "ACTIONABLE"`
  - `final_score >= 78`
  - `risk_penalty == 0`

If no rows qualify, nothing is sent.

### Dedup Behavior

Alerts are deduplicated using a small local state file:

- `scanner_output/alerts/telegram_alert_state.json`

The scanner fingerprints the current qualifying alert set and only sends a Telegram message when that qualifying set changes. This avoids resending the same alert every 15 minutes.

### Create a Telegram Bot

1. Open Telegram and message `@BotFather`
2. Run `/newbot`
3. Follow the prompts and copy the bot token

### Get Your Chat ID

Simple option:

1. Start a chat with your bot and send any message
2. Open this URL in a browser, replacing the token:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

3. Find the `chat` object in the JSON response and copy the numeric `id`

### Manual Test

From the repo root:

```bash
source .venv/bin/activate
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
python investment_scanner_mvp.py --send-alerts
```

For a timer or systemd service, add `--send-alerts` to the scanner command once the environment variables are available to that service.

## Dashboard

The Streamlit dashboard is intended for internal operator use and provides four simple sections:

- `Overview / Latest Scan`
  - latest top candidates
  - latest full ranking
  - summary metrics and filters
  - quick symbol inspection buttons
- `Symbol Detail`
  - short / mid / long actions and scores
  - historical price chart and table
  - practical fundamentals
  - recent news when available
  - why-selected reasons
  - scan snapshot timeline when history exists
- `Performance Analysis`
  - grouped forward-return summary from `scanner_output/analysis/`
- `Scan History`
  - snapshot file list
  - snapshot table view
  - optional two-snapshot comparison

### Local Run

From the repo root:

```bash
source .venv/bin/activate
streamlit run dashboard.py
```

### Linux Server Run

On an Ubuntu or other Linux server, run from the project root inside the same virtual environment used for the scanner:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
streamlit run dashboard.py --server.address 0.0.0.0 --server.port 8501
```

Notes:

- The app expects `dashboard.py` to live in the repo root.
- It reads `scanner_output/`, `scanner_output/history/`, and `scanner_output/analysis/` using paths relative to the repo root.
- It also reads per-symbol artifacts from `scanner_output/symbols/`.
- If history or analysis files do not exist yet, the dashboard shows a friendly message instead of failing.

The CSV schema now includes practical decision-support fields such as:

- `symbol`
- `asset_type`
- `sector`
- `price`
- `technical_score`
- `fundamental_score`
- `news_score`
- `macro_score`
- `risk_penalty`
- `final_score`
- `short_score`
- `mid_score`
- `long_score`
- `short_action`
- `mid_action`
- `long_action`
- `short_reason`
- `mid_reason`
- `long_reason`
- `composite_action`
- `setup_type`
- `entry_zone`
- `invalidation_level`
- `upside_driver`
- `key_risk`
- `earnings_date`
- `dividend_yield`
- `profitability_status`
- `valuation_flag`
- `macro_sensitivity`
- `confidence_level`

## Current Scoring Model

The final score is a weighted composite:

- Equities
  - `technical 42%`
  - `fundamental 28%`
  - `news 10%`
  - `macro 20%`
  - minus `risk_penalty`
- ETFs / proxies
  - more weight on technicals and macro
  - less weight on fundamentals
- Crypto
  - highest weight on technicals and macro
  - very low weight on fundamentals

This is meant to keep the model explainable and avoid pretending that all asset classes should be scored the same way.

## Recommendation Model

Each symbol now gets three horizon recommendations:

- `short-term`
  - emphasizes recent momentum, breakout behavior, recent volume expansion, and near-term risk
- `mid-term`
  - emphasizes 1M / 3M trend quality, medium trend structure, pullback / breakout behavior, and macro support
- `long-term`
  - emphasizes 6M / 1Y trend structure, fundamentals, drawdown quality, and macro alignment

The action labels are:

- `STRONG BUY`
- `BUY`
- `WAIT / HOLD`
- `SELL`
- `STRONG SELL`

The first version uses simple score bands plus a few guardrails so elevated risk or weak trend structure can cap otherwise noisy recommendations.

## Known Caveats

- `yfinance` is convenient but not institutional-quality.
- Metadata fields can be missing or inconsistent across symbols.
- ETF and proxy fundamentals are often not meaningful.
- Headline scoring is shallow and can miss nuance.
- Backtesting and signal validation still matter before trusting the output with capital.
- Historical evaluation is useful, but it is not survivorship-free or point-in-time perfect.
