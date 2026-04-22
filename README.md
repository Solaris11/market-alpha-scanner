# 🚀 Market Alpha Scanner

Multi-asset market scanner that ranks stocks, crypto, ETFs, and commodities using momentum, macro alignment, and risk-based scoring to identify top trading opportunities.

---

## 🧠 What This Project Does

This tool scans a broad market universe and answers one key question:

> **“What are the strongest assets RIGHT NOW?”**

It evaluates each asset using:

- 📈 Trend strength (moving averages)
- ⚡ Momentum (multi-timeframe returns)
- 💣 Breakout potential (near highs / resistance)
- 📊 Volume expansion
- 🧾 Basic fundamentals (for equities)
- 🌍 Macro alignment (risk-on / risk-off)
- ⚠️ Risk (volatility, drawdown, ATR)

Then ranks everything and outputs:

- ✅ **Top candidates (Strong Buy)**
- 📊 Full ranking (CSV)
- 💣 Explosion score (short-term opportunity)

---

## 🔥 Key Concept

This is NOT a prediction engine.

👉 It is a **ranking engine for market strength and opportunity**

---

## ⚙️ Installation

```
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

▶️ Usage

Run with default universe

```
python investment_scanner_mvp.py
```
Run with a csv file
```
python investment_scanner_mvp.py --universe-csv my_symbols.csv
```

symbol
NVDA
MSFT
QQQ
BTC-USD
GLD
USO

Adjust filters (recommended)

```
python investment_scanner_mvp.py \
  --min-price 3 \
  --min-dollar-volume 5000000 \
  --min-market-cap 500000000
```
