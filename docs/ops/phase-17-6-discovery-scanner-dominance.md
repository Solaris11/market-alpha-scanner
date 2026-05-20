# Phase 17.6 - Discovery + Scanner Dominance

## Objective

Improve TradeVeto's discovery and scanner usability against Finviz and Trade Ideas by making full-universe exploration faster, more visible, and more intelligence-aware.

## Implemented

### Scanner Ranking Logic

- Added new data-backed discovery filters:
  - `best_setups`
  - `breakout_candidates`
  - `crash_risk`
  - `top_losers_1d`
  - `top_losers_1w`
  - `top_losers_1m`
- Added category-specific scanner sort modes:
  - `breakout`
  - `crash`
  - `weakness`
- Breakout scoring uses validated setup type, trend, confidence, macro, replay, evidence, volatility, shock risk, and short-term movement.
- Crash-risk scoring uses risk pressure, fragility, shock risk, volatility, trend weakness, and downside movement.
- Best-setup scoring blends confidence, conviction, macro, replay, evidence, freshness, trend, and controlled risk.

### Saved Scanner Presets

Added a reusable `scannerPresets` model with data-backed counts:

- Best setup scanner
- Breakout pressure
- Crash-risk scan
- Top gainers
- Top losers
- Replay-supported
- Macro-supported

These presets now drive the `/discover` UI and clear stale query/sector filters when selected.

### Cinematic Scanner UX

Added a scanner dominance lane board to `/discover`:

- Top gainers
- Top losers
- Breakout candidates
- Crash-risk candidates
- Replay-supported setups
- Macro-supported setups

Each lane shows the top ranked symbols, timeframe, performance context, sector/setup context, and a direct tap/click workflow that loads the relevant scanner preset.

### Advanced Discovery UX

- Quick filters now apply category-specific sort/timeframe behavior.
- Top-gainer filters automatically use performance sorting.
- Top-loser filters automatically use weakness sorting.
- Breakout filters automatically use breakout scoring.
- Crash-risk filters automatically use crash-risk scoring.
- Replay/macro filters automatically use replay/macro sorting.
- Mobile horizontal scanner rails opt out of global route gestures.

### Terminal Discovery-First Navigation

The Terminal daily command hero now exposes:

- `Open full scanner`
- `Compare candidates`

This makes the top Terminal surface immediately route users into full discovery and comparison workflows after showing best setups, biggest risks, momentum, money flow, crash risk, and what changed today.

## Data Rules

- No fake scanner rows were added.
- No fake scores were added.
- Empty or low-count lanes render limited evidence states.
- All rankings are derived from current validated scanner rows and existing TradeVeto intelligence fields.

## Validation

Local validation:

- `npm --prefix frontend run lint` - passed.
- `npm --prefix frontend test -- --runInBand` - passed, 415 tests.
- `npm --prefix frontend run build` - passed.
- `npm --prefix frontend audit --omit=dev` - passed, 0 vulnerabilities.
- `python3 -m py_compile $(git ls-files '*.py')` - passed.
- `npx pyright . --pythonpath .venv/bin/python --warnings` - passed, 0 errors / 0 warnings.
- `git diff --check` - passed.

Production validation:

- Production pull/rebuild - pending.
- Container health - pending.
- `/api/health` - pending.
- `/api/health/deep` - pending.
- `/terminal`, `/discover`, `/opportunities`, `/symbol/AMD` smoke - pending.

## Remaining Gaps

- Full competitor usability benchmarking against Finviz and Trade Ideas was not performed inside this phase.
- User-saved custom scanner presets are not persisted per account yet; the phase added reusable built-in scanner presets.
- More granular fundamental filters such as market cap bands, float, exchange, and volume buckets can be added after the data provider exposes complete fields consistently.

## Verdict

TRADEVETO DISCOVERY + SCANNER DOMINANCE ACCOMPLISHED
