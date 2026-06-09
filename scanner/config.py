from __future__ import annotations

from .universe import CORE_UNIVERSE

DEFAULT_UNIVERSE = CORE_UNIVERSE

MACRO_SYMBOLS = {
    "spx": "SPY",
    "qqq": "QQQ",
    "small_caps": "IWM",
    "dxy_proxy": "UUP",
    "bonds": "TLT",
    "high_yield": "HYG",
    "gold": "GLD",
    "oil": "USO",
    "btc": "BTC-USD",
    "vix": "^VIX",
}

COMMODITY_PROXIES = {"GLD", "SLV", "USO"}
BOND_PROXIES = {"TLT", "HYG"}
CURRENCY_PROXIES = {"UUP"}
CRYPTO_PROXY_ETFS = {"IBIT"}

ETF_SECTOR_MAP = {
    "SPY": "Broad Market",
    "QQQ": "Growth / Nasdaq",
    "DIA": "Large Cap Value",
    "IWM": "Small Caps",
    "SMH": "Semiconductors",
    "SOXX": "Semiconductors",
    "XLK": "Technology",
    "XLE": "Energy",
    "XLF": "Financial Services",
    "XLV": "Healthcare",
    "VNQ": "Real Estate",
    "ARKK": "High Beta Growth",
    "GLD": "Gold",
    "SLV": "Silver",
    "USO": "Oil",
    "TLT": "Long Duration Bonds",
    "HYG": "High Yield Credit",
    "UUP": "US Dollar",
    "IBIT": "Bitcoin",
}

DEFAULT_NEWS_LIMIT = 30
MIN_PRICE = 5.0
MIN_AVG_DOLLAR_VOL = 20_000_000
MIN_MARKET_CAP = 1_000_000_000
LOOKBACK_1M = 21
LOOKBACK_3M = 63
LOOKBACK_6M = 126
LOOKBACK_1Y = 252
DOWNLOAD_PERIOD = "2y"
TOP_N = 20
ACTION_LEVELS = ["STRONG SELL", "SELL", "WAIT / HOLD", "BUY", "STRONG BUY"]
