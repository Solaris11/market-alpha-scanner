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

The project can still run locally without Docker. The Docker and PostgreSQL setup added below is groundwork for persistent app storage and containerized deployment.

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
- `scanner_output/symbols/<symbol>/history.csv`
- `scanner_output/symbols/<symbol>/summary.json`

The scanner now also writes PostgreSQL records when `DATABASE_URL` is configured:

- `scan_runs`
- `scanner_signals`
- `symbol_snapshots`
- `symbol_price_history`
- `performance_summary`
- `forward_returns`

Postgres is the production SaaS source of truth. Existing file outputs remain backup/export/debug artifacts. Runtime CSV fallback is disabled by default with `SCANNER_CSV_FALLBACK=false`; enable it only for explicit rollback/debug operations and expect a server warning when it is used.

## Rule-Based Alerts

Market Alpha Scanner stores SaaS user alert rules in Postgres through the `/api/alerts` routes. Scanner artifacts remain read-only market data outputs; account-owned alert rules are not stored in scanner output directories.

Legacy JSON alert files from the MVP should not exist in the active `scanner_output/alerts` path. If found during operations, archive them under `/opt/backups/market-alpha/legacy-alert-json/<timestamp>/` before removal.

### Required Environment Variables

Set these before running Telegram alerts:

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
```

Set these before running email alerts:

```bash
export ALERT_EMAIL_FROM="scanner@example.com"
export ALERT_EMAIL_TO="operator@example.com"
export SMTP_HOST="smtp.example.com"
export SMTP_PORT="587"
export SMTP_USER="smtp_user"
export SMTP_PASSWORD="smtp_password"
```

Supported alert types:

- `price_above`
- `price_below`
- `buy_zone_hit`
- `stop_loss_broken`
- `take_profit_hit`
- `score_above`
- `score_below`
- `score_changed_by`
- `rating_changed`
- `action_changed`
- `new_top_candidate`

### Dedup Behavior

Alerts are deduplicated with cooldown state stored per account in Postgres. Each rule tracks last sent time, last trigger value, and message hash. A rule will not resend until its configured `cooldown_minutes` has elapsed.

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

## Production Ops Notes

Run Stripe subscription reconciliation through the Docker-network wrapper so the script can reach the private Postgres service:

```bash
sudo /opt/ops/market-alpha-stripe-reconcile.sh --dry-run
sudo /opt/ops/market-alpha-stripe-reconcile.sh
```

Do not use raw host `npm run stripe:reconcile` on production; host DNS cannot resolve the private Docker service name.

### Manual Test

From the repo root:

```bash
source .venv/bin/activate
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
python investment_scanner_mvp.py --alerts-only --send-alerts
```

For a timer or systemd service, use:

```bash
/opt/apps/market-alpha-scanner/venv/bin/python investment_scanner_mvp.py --save-history --send-alerts
```

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

The Streamlit dashboard is legacy/internal tooling. Do not expose it publicly. On an Ubuntu or other Linux server, run it only on localhost or a private interface from the project root inside the same virtual environment used for the scanner:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
streamlit run dashboard.py --server.address 127.0.0.1 --server.port 8501
```

Notes:

- The app expects `dashboard.py` to live in the repo root.
- It reads `scanner_output/`, `scanner_output/history/`, and `scanner_output/analysis/` using paths relative to the repo root.
- It also reads per-symbol artifacts from `scanner_output/symbols/`.
- If history or analysis files do not exist yet, the dashboard shows a friendly message instead of failing.

## Docker And PostgreSQL

The repo now includes a separate Docker Compose stack for `market-alpha-scanner`. It is isolated from any unrelated Docker workloads on the host:

- PostgreSQL does not publish `5432` to the host
- the stack uses its own private Docker network
- runtime data uses bind mounts under `/opt/apps/market-alpha-scanner/runtime`
- nothing here assumes ownership of any existing `hdsm-*` containers or networks

### Files Added

- `compose.yaml`
- `Dockerfile`
- `.env.example`
- `database/`
- `alembic.ini`
- `alembic/`

### Create Runtime Directories

On the Linux host:

```bash
sudo mkdir -p /opt/apps/market-alpha-scanner/runtime/postgres
sudo mkdir -p /opt/apps/market-alpha-scanner/runtime/scanner_output
sudo mkdir -p /opt/apps/market-alpha-scanner/runtime/logs
sudo chown -R "$USER":"$USER" /opt/apps/market-alpha-scanner/runtime
```

### Configure Environment

Copy the example file and set a real PostgreSQL password:

```bash
cp .env.example .env
```

Important variables:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `FRONTEND_DATABASE_URL`
- `SCANNER_OUTPUT_DIR`
- `APP_LOG_DIR`

Inside Docker, `DATABASE_URL` should point at `market-alpha-postgres` on the private stack network.
The Next.js frontend receives `FRONTEND_DATABASE_URL` as its container `DATABASE_URL`; use the standard `postgresql://` format for this value.

### Start PostgreSQL

Bring up the isolated stack:

```bash
docker compose --env-file .env up -d market-alpha-postgres
```

Start the production frontend:

```bash
docker compose --env-file .env up -d market-alpha-frontend
```

The legacy Streamlit dashboard and legacy Python API are opt-in Compose profiles and are not started by default:

```bash
docker compose --env-file .env --profile legacy-dashboard up -d market-alpha-app
docker compose --env-file .env --profile legacy-python-api up -d market-alpha-api
```

These services use Docker `expose`, not host `ports`; PostgreSQL and internal app services remain private to Docker networks unless explicitly routed by the reverse proxy.

### Verify Database Health

Check container and health status:

```bash
docker compose ps
docker compose logs market-alpha-postgres
```

The PostgreSQL service includes a `pg_isready` healthcheck in `compose.yaml`.

### Run SQL Migrations

Production schema changes are applied through the migration ledger runner:

```bash
tools/db/run-migrations.sh
```

The runner records applied SQL files in `schema_migrations` and skips files already recorded.

### Legacy Alembic Migrations

If you are running migrations from the host shell:

```bash
set -a
source .env
set +a
alembic upgrade head
```

If you prefer to run them inside the app container:

```bash
docker compose --env-file .env run --rm market-alpha-app alembic upgrade head
```

You can also generate the SQL offline if you want to inspect the migration output first:

```bash
alembic upgrade head --sql
```

### Scanner And Dashboard Commands In Docker

Run the scanner manually in the container:

```bash
docker compose --env-file .env run --rm market-alpha-app python investment_scanner_mvp.py --save-history
```

Run the dashboard via the container service:

```bash
docker compose --env-file .env up -d market-alpha-app
```

### Next.js Frontend Production Container

The production frontend service is `market-alpha-frontend`. It builds `frontend/Dockerfile` with Node 22, runs `npm run build`, and starts the app with `npm start` on `0.0.0.0:3001`. It mounts the shared scanner artifacts at `/app/scanner_output` because the Next.js routes read scanner CSV and JSON outputs.

Build and start only the frontend service:

```bash
docker compose up -d --build market-alpha-frontend
```

Follow the frontend logs:

```bash
docker logs -f market-alpha-frontend
```

Verify the route is reachable from the host:

```bash
curl -I http://localhost:3001/terminal
```

Do not use `npm run dev` for the public deployment.

### Database Layer Notes

The new `database/` package provides:

- environment-based config loading
- SQLAlchemy engine and session helpers
- first-pass query/state models for:
  - `scan_runs`
  - `scanner_signals`
- lightweight repository helpers for writing the latest scanner decisions to PostgreSQL

CSV and artifact outputs remain in place. The database layer is intentionally narrow and does not replace the raw file history.
Apply schema changes with the migration ledger runner described above.

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
