# Market Alpha Scanner

Multi-asset market scanner that ranks equities, ETFs, crypto, and liquid proxy instruments using a practical composite model:

- Technical structure
- Fundamentals
- Macro alignment
- Simple headline / event context
- Explicit risk penalty

This is a ranking tool for idea triage, not a prediction engine.

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

The dashboard reads those files directly from disk. It does not maintain a separate database or modify scanner behavior.

## Dashboard

The Streamlit dashboard is intended for internal operator use and provides four simple sections:

- `Overview / Latest Scan`
  - latest top candidates
  - latest full ranking
  - summary metrics and filters
- `Symbol Detail`
  - current row data
  - score breakdown
  - tags and diagnostics
  - score / price history when snapshots exist
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

## Known Caveats

- `yfinance` is convenient but not institutional-quality.
- Metadata fields can be missing or inconsistent across symbols.
- ETF and proxy fundamentals are often not meaningful.
- Headline scoring is shallow and can miss nuance.
- Backtesting and signal validation still matter before trusting the output with capital.
- Historical evaluation is useful, but it is not survivorship-free or point-in-time perfect.
