from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, Iterable, Literal, Sequence

UniverseSize = Literal["core", "500", "1000"]

UNIVERSE_SIZE_CHOICES: tuple[UniverseSize, ...] = ("core", "500", "1000")

CORE_UNIVERSE: list[str] = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AVGO", "TSLA", "NFLX", "AMD",
    "ORCL", "CRM", "ADBE", "INTU", "QCOM", "MU", "PANW", "CRWD", "DDOG", "SNOW",
    "PLTR", "SHOP", "NOW", "ANET", "INTC", "ARM", "ASML", "TSM", "AMAT", "LRCX",
    "KLAC", "MRVL", "UBER", "ABNB", "MSTR", "COIN", "APP", "RBLX", "MDB", "ZS",
    "JPM", "GS", "MS", "BAC", "WFC", "BLK", "BRK-B", "V", "MA", "AXP",
    "CAT", "DE", "HON", "GE", "RTX", "LMT", "BA", "UNP", "UPS", "FDX",
    "WMT", "COST", "PG", "KO", "PEP", "MCD", "HD", "LOW", "NKE", "SBUX",
    "JNJ", "LLY", "UNH", "MRK", "ABBV", "PFE", "TMO", "ISRG", "DHR", "SYK",
    "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "VLO", "OXY", "DVN", "HAL",
    "SPY", "QQQ", "DIA", "IWM", "SMH", "SOXX", "XLK", "XLE", "XLF", "XLV",
    "ARKK", "IBIT", "GLD", "SLV", "USO", "TLT", "HYG", "UUP", "VNQ",
    "BTC-USD", "ETH-USD",
]

REQUIRED_OPPORTUNITY_SYMBOLS: tuple[str, ...] = (
    "RGTI",
    "QBTS",
    "QUBT",
    "IONQ",
    "LITE",
    "RKLB",
    "ASTS",
    "LUNR",
    "TEM",
    "SOUN",
    "HIMS",
    "APP",
    "PL",
)

DATA_DIR = Path(__file__).resolve().parent / "data"
EXPANDED_UNIVERSE_PATH = DATA_DIR / "opportunity_universe_1000.csv"


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def dedupe_symbols(symbols: Iterable[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for raw_symbol in symbols:
        symbol = normalize_symbol(raw_symbol)
        if not symbol or symbol in seen:
            continue
        unique.append(symbol)
        seen.add(symbol)
    return unique


def load_expanded_universe_rows(path: Path = EXPANDED_UNIVERSE_PATH) -> list[dict[str, str]]:
    if not path.exists():
        return [{"symbol": symbol, "source_category": "core_fallback"} for symbol in CORE_UNIVERSE]

    rows: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for raw_row in reader:
            row: Dict[str, str] = {
                str(key): str(value or "")
                for key, value in raw_row.items()
                if key is not None
            }
            symbol = normalize_symbol(row.get("symbol", ""))
            if not symbol:
                continue
            rows.append(
                {
                    "symbol": symbol,
                    "source_category": row.get("source_category", "unknown").strip() or "unknown",
                }
            )
    return rows


def load_expanded_universe(path: Path = EXPANDED_UNIVERSE_PATH) -> list[str]:
    return dedupe_symbols(row["symbol"] for row in load_expanded_universe_rows(path))


def build_universe(size: str) -> list[str]:
    normalized = size.strip().lower()
    if normalized == "core":
        return list(CORE_UNIVERSE)
    if normalized not in {"500", "1000"}:
        raise ValueError(f"Unsupported universe size: {size}")

    target_size = int(normalized)
    expanded = load_expanded_universe()
    if len(expanded) < target_size:
        raise ValueError(f"Expanded universe only has {len(expanded)} symbols; {target_size} requested")
    return expanded[:target_size]


def source_category_counts(symbols: Sequence[str], path: Path = EXPANDED_UNIVERSE_PATH) -> dict[str, int]:
    wanted = set(dedupe_symbols(symbols))
    counts: dict[str, int] = {}
    for row in load_expanded_universe_rows(path):
        symbol = row["symbol"]
        if symbol not in wanted:
            continue
        category = row["source_category"]
        counts[category] = counts.get(category, 0) + 1
    return counts


def missing_required_symbols(symbols: Sequence[str]) -> list[str]:
    available = set(dedupe_symbols(symbols))
    return [symbol for symbol in REQUIRED_OPPORTUNITY_SYMBOLS if symbol not in available]
