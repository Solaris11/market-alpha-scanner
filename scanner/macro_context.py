from __future__ import annotations

from collections.abc import Mapping
from typing import Final, Literal, TypedDict

import numpy as np
import pandas as pd

from .utils import clamp_score, safe_float, safe_str


MacroProfile = Literal["broad", "crypto", "energy", "gold", "nasdaq", "small_cap"]


class SectorStats(TypedDict):
    average_score: float
    breadth_score: float
    count: int
    label: str


class MacroMarketContext(TypedDict):
    liquidity_pressure: float
    macro_pressure_score: float
    proxy_coverage_missing: list[str]
    proxy_coverage_used: list[str]
    risk_on_score: float
    rows_by_symbol: dict[str, dict[str, object]]
    sector_stats: dict[str, SectorStats]
    volatility_pressure: float


class ProxyScore(TypedDict):
    score: float
    symbol: str | None


class ExchangeScore(TypedDict):
    label: str
    score: float


class SectorScore(TypedDict):
    label: str
    score: float


class MacroContextAdjustment(TypedDict):
    exchange_context_adjustment: float
    exchange_context_label: str
    exchange_health_score: float
    liquidity_pressure: float
    liquidity_pressure_adjustment: float
    macro_alignment_adjustment: float
    macro_alignment_score: float
    macro_conflict_penalty: float
    macro_context_adjustment_total: float
    macro_context_label: str
    macro_context_reason_codes: list[str]
    macro_context_summary: str
    macro_pressure_score: float
    risk_on_score: float
    sector_alignment_adjustment: float
    sector_alignment_score: float
    sector_context_label: str
    volatility_pressure: float
    volatility_pressure_adjustment: float


BROAD_PROXIES: Final[tuple[str, ...]] = ("SPY", "QQQ", "DIA", "IWM")
VOLATILITY_PROXIES: Final[tuple[str, ...]] = ("^VIX", "VIX", "VXX", "UVXY")
DOLLAR_PROXIES: Final[tuple[str, ...]] = ("DXY", "UUP")
RATE_PROXIES: Final[tuple[str, ...]] = ("TLT", "IEF", "TNX", "^TNX")
GOLD_PROXIES: Final[tuple[str, ...]] = ("GLD", "GDX")
OIL_PROXIES: Final[tuple[str, ...]] = ("USO", "OIL", "OXY", "XLE")
CRYPTO_PROXIES: Final[tuple[str, ...]] = ("BTC-USD", "BTC", "IBIT", "ETH-USD", "ETH")
SEMICONDUCTOR_SYMBOLS: Final[frozenset[str]] = frozenset({"AMD", "ARM", "ASML", "AVGO", "INTC", "MU", "NVDA", "QCOM", "SMH", "SOXX", "TSM", "TXN"})
SOFTWARE_SYMBOLS: Final[frozenset[str]] = frozenset({"ADBE", "CRM", "CRWD", "DDOG", "MSFT", "NOW", "ORCL", "PANW", "SNOW", "TEAM"})
FINANCIAL_SYMBOLS: Final[frozenset[str]] = frozenset({"BAC", "C", "GS", "JPM", "MS", "WFC", "XLF"})
DEFENSIVE_SECTORS: Final[frozenset[str]] = frozenset({"consumer defensive", "consumer staples", "healthcare", "utilities"})


def build_macro_market_context(df: pd.DataFrame) -> MacroMarketContext:
    rows = _records_from_dataframe(df)
    rows_by_symbol = _rows_by_symbol(rows)
    sector_stats = _sector_stats(rows)
    spy = _proxy_score(rows_by_symbol, ("SPY",))
    qqq = _proxy_score(rows_by_symbol, ("QQQ",))
    dia = _proxy_score(rows_by_symbol, ("DIA",))
    iwm = _proxy_score(rows_by_symbol, ("IWM",))
    btc = _proxy_score(rows_by_symbol, CRYPTO_PROXIES)
    risk_on_score = _weighted_average(
        (
            (spy["score"], 0.32),
            (qqq["score"], 0.30),
            (dia["score"], 0.14),
            (iwm["score"], 0.16),
            (btc["score"], 0.08),
        ),
        50.0,
    )
    volatility_pressure = _volatility_pressure(rows_by_symbol, risk_on_score)
    liquidity_pressure = _liquidity_pressure(rows_by_symbol, risk_on_score)
    macro_pressure_score = _clamp((100.0 - risk_on_score) * 0.38 + volatility_pressure * 0.32 + liquidity_pressure * 0.30)
    coverage = _proxy_coverage(rows_by_symbol)
    return {
        "liquidity_pressure": round(liquidity_pressure, 2),
        "macro_pressure_score": round(macro_pressure_score, 2),
        "proxy_coverage_missing": coverage["missing"],
        "proxy_coverage_used": coverage["used"],
        "risk_on_score": round(risk_on_score, 2),
        "rows_by_symbol": rows_by_symbol,
        "sector_stats": sector_stats,
        "volatility_pressure": round(volatility_pressure, 2),
    }


def contextual_adjustment_for_row(row: Mapping[str, object], context: MacroMarketContext, regime: str) -> MacroContextAdjustment:
    profile = _symbol_profile(row)
    exchange = _exchange_score(row, profile, context)
    sector = _sector_score(row, profile, context)
    row_macro = _bounded(row.get("macro_score"), default=55.0)
    macro_alignment_score = _clamp(exchange["score"] * 0.34 + sector["score"] * 0.28 + (100.0 - context["macro_pressure_score"]) * 0.24 + row_macro * 0.14)
    macro_adjustment = _macro_alignment_adjustment(macro_alignment_score, regime)
    exchange_adjustment = _range_adjustment(exchange["score"], positive_threshold=65.0, negative_threshold=45.0, positive_max=3.0, negative_max=3.0)
    sector_adjustment = _range_adjustment(sector["score"], positive_threshold=65.0, negative_threshold=45.0, positive_max=4.0, negative_max=4.0)
    volatility_adjustment = _volatility_adjustment(context["volatility_pressure"])
    liquidity_adjustment = _liquidity_adjustment(context["liquidity_pressure"])
    conflict_penalty = _macro_conflict_penalty(row, macro_alignment_score, regime)

    raw_total = macro_adjustment + exchange_adjustment + sector_adjustment + volatility_adjustment + liquidity_adjustment + conflict_penalty
    bounded_total = round(_clamp(raw_total, -18.0, 10.0), 2)
    reason_codes = _reason_codes(
        bounded=bounded_total != round(raw_total, 2),
        exchange_adjustment=exchange_adjustment,
        liquidity_adjustment=liquidity_adjustment,
        macro_adjustment=macro_adjustment,
        macro_conflict_penalty=conflict_penalty,
        sector_adjustment=sector_adjustment,
        volatility_adjustment=volatility_adjustment,
        volatility_pressure=context["volatility_pressure"],
    )
    label = _context_label(macro_alignment_score, "Macro Aligned", "Macro Mixed", "Macro Conflict")
    return {
        "exchange_context_adjustment": round(exchange_adjustment, 2),
        "exchange_context_label": _context_label(exchange["score"], f"{exchange['label']} Tailwind", f"{exchange['label']} Mixed", f"{exchange['label']} Headwind"),
        "exchange_health_score": round(exchange["score"], 2),
        "liquidity_pressure": round(context["liquidity_pressure"], 2),
        "liquidity_pressure_adjustment": round(liquidity_adjustment, 2),
        "macro_alignment_adjustment": round(macro_adjustment, 2),
        "macro_alignment_score": round(macro_alignment_score, 2),
        "macro_conflict_penalty": round(conflict_penalty, 2),
        "macro_context_adjustment_total": bounded_total,
        "macro_context_label": label,
        "macro_context_reason_codes": reason_codes,
        "macro_context_summary": _summary(label, bounded_total, exchange["label"], sector["label"], context),
        "macro_pressure_score": round(context["macro_pressure_score"], 2),
        "risk_on_score": round(context["risk_on_score"], 2),
        "sector_alignment_adjustment": round(sector_adjustment, 2),
        "sector_alignment_score": round(sector["score"], 2),
        "sector_context_label": _context_label(sector["score"], f"{sector['label']} Supportive", f"{sector['label']} Mixed", f"{sector['label']} Pressure"),
        "volatility_pressure": round(context["volatility_pressure"], 2),
        "volatility_pressure_adjustment": round(volatility_adjustment, 2),
    }


def _records_from_dataframe(df: pd.DataFrame) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for row in df.to_dict(orient="records"):
        records.append({str(key): value for key, value in row.items()})
    return records


def _rows_by_symbol(rows: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    mapped: dict[str, dict[str, object]] = {}
    for row in rows:
        symbol = _normalize_symbol(row.get("symbol"))
        if symbol:
            mapped[symbol] = row
    return mapped


def _sector_stats(rows: list[dict[str, object]]) -> dict[str, SectorStats]:
    groups: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        sector = _sector_key(row)
        if not sector:
            continue
        group = groups.get(sector, [])
        group.append(row)
        groups[sector] = group

    stats: dict[str, SectorStats] = {}
    for sector, group in groups.items():
        scores = [_row_context_score(item) for item in group]
        average_score = _average(scores, 50.0)
        breadth_score = 50.0 if not scores else len([score for score in scores if score >= 60.0]) / len(scores) * 100.0
        stats[sector] = {
            "average_score": round(average_score, 2),
            "breadth_score": round(breadth_score, 2),
            "count": len(group),
            "label": _title_label(sector),
        }
    return stats


def _proxy_score(rows_by_symbol: Mapping[str, Mapping[str, object]], symbols: tuple[str, ...], *, exclude_symbol: str = "") -> ProxyScore:
    excluded = _normalize_symbol(exclude_symbol)
    for symbol in symbols:
        normalized = _normalize_symbol(symbol)
        if excluded and normalized == excluded:
            continue
        row = rows_by_symbol.get(normalized)
        if row is not None:
            return {"score": _row_context_score(row), "symbol": normalized}
    return {"score": 50.0, "symbol": None}


def _row_context_score(row: Mapping[str, object]) -> float:
    return _first_score(row, ("final_score_base", "base_score", "final_score", "final_score_adjusted", "technical_score", "quality_score"), 50.0)


def _volatility_pressure(rows_by_symbol: Mapping[str, Mapping[str, object]], risk_on_score: float) -> float:
    volatility = _proxy_score(rows_by_symbol, VOLATILITY_PROXIES)
    if volatility["symbol"] is not None:
        return _clamp(volatility["score"])
    return _clamp(52.0 + (50.0 - risk_on_score) * 0.48)


def _liquidity_pressure(rows_by_symbol: Mapping[str, Mapping[str, object]], risk_on_score: float) -> float:
    dollar = _proxy_score(rows_by_symbol, DOLLAR_PROXIES)
    rates = _proxy_score(rows_by_symbol, RATE_PROXIES)
    iwm = _proxy_score(rows_by_symbol, ("IWM",))
    dollar_pressure = dollar["score"] if dollar["symbol"] is not None else 50.0
    rates_pressure = 100.0 - rates["score"] if rates["symbol"] is not None else 50.0
    small_cap_pressure = 100.0 - iwm["score"] if iwm["symbol"] is not None else 100.0 - risk_on_score
    return _clamp(dollar_pressure * 0.34 + rates_pressure * 0.28 + small_cap_pressure * 0.24 + (100.0 - risk_on_score) * 0.14)


def _exchange_score(row: Mapping[str, object], profile: MacroProfile, context: MacroMarketContext) -> ExchangeScore:
    rows = context["rows_by_symbol"]
    symbol = _normalize_symbol(row.get("symbol"))
    spy = _proxy_score(rows, ("SPY",), exclude_symbol=symbol)
    qqq = _proxy_score(rows, ("QQQ",), exclude_symbol=symbol)
    dia = _proxy_score(rows, ("DIA",), exclude_symbol=symbol)
    iwm = _proxy_score(rows, ("IWM",), exclude_symbol=symbol)
    crypto = _proxy_score(rows, CRYPTO_PROXIES, exclude_symbol=symbol)
    oil = _proxy_score(rows, OIL_PROXIES, exclude_symbol=symbol)
    gold = _proxy_score(rows, GOLD_PROXIES, exclude_symbol=symbol)
    if profile == "crypto":
        return {
            "label": "Crypto / Risk Asset Context",
            "score": _weighted_average(((crypto["score"], 0.66), (context["risk_on_score"], 0.34)), 50.0),
        }
    if profile == "energy":
        return {
            "label": "Energy Context",
            "score": _weighted_average(((oil["score"], 0.62), (spy["score"], 0.24), (context["risk_on_score"], 0.14)), 50.0),
        }
    if profile == "gold":
        dollar = _proxy_score(rows, DOLLAR_PROXIES, exclude_symbol=symbol)
        return {
            "label": "Gold / Defensive Context",
            "score": _weighted_average(((gold["score"], 0.58), (100.0 - context["liquidity_pressure"], 0.24), (100.0 - dollar["score"], 0.18)), 50.0),
        }
    if profile == "small_cap":
        return {
            "label": "Small-Cap Risk Appetite",
            "score": _weighted_average(((iwm["score"], 0.56), (spy["score"], 0.20), (context["risk_on_score"], 0.24)), 50.0),
        }
    if profile == "nasdaq":
        return {
            "label": "Nasdaq Context",
            "score": _weighted_average(((qqq["score"], 0.52), (spy["score"], 0.22), (iwm["score"], 0.10), (context["risk_on_score"], 0.16)), 50.0),
        }
    return {
        "label": "Broad Exchange Context",
        "score": _weighted_average(((spy["score"], 0.42), (dia["score"], 0.22), (iwm["score"], 0.16), (context["risk_on_score"], 0.20)), 50.0),
    }


def _sector_score(row: Mapping[str, object], profile: MacroProfile, context: MacroMarketContext) -> SectorScore:
    sector = _sector_key(row)
    stats = context["sector_stats"].get(sector) if sector else None
    theme = _theme_score(row, profile, context["rows_by_symbol"])
    fallback = _row_context_score(row)
    stats_score = stats["average_score"] * 0.68 + stats["breadth_score"] * 0.32 if stats is not None else fallback
    label = stats["label"] if stats is not None else _title_label(sector or profile)
    return {"label": label or "Symbol Group", "score": _clamp(stats_score * 0.62 + theme * 0.38)}


def _theme_score(row: Mapping[str, object], profile: MacroProfile, rows_by_symbol: Mapping[str, Mapping[str, object]]) -> float:
    symbol = _normalize_symbol(row.get("symbol"))
    if profile == "energy":
        return _proxy_score(rows_by_symbol, OIL_PROXIES, exclude_symbol=symbol)["score"]
    if profile == "gold":
        return _proxy_score(rows_by_symbol, GOLD_PROXIES, exclude_symbol=symbol)["score"]
    if profile == "crypto":
        return _proxy_score(rows_by_symbol, CRYPTO_PROXIES, exclude_symbol=symbol)["score"]
    if symbol in SEMICONDUCTOR_SYMBOLS:
        return _basket_score(rows_by_symbol, SEMICONDUCTOR_SYMBOLS, exclude_symbol=symbol)
    if symbol in SOFTWARE_SYMBOLS:
        return _basket_score(rows_by_symbol, SOFTWARE_SYMBOLS, exclude_symbol=symbol)
    if symbol in FINANCIAL_SYMBOLS:
        return _basket_score(rows_by_symbol, FINANCIAL_SYMBOLS, exclude_symbol=symbol)
    return _row_context_score(row)


def _basket_score(rows_by_symbol: Mapping[str, Mapping[str, object]], symbols: frozenset[str], *, exclude_symbol: str) -> float:
    scores: list[float] = []
    for symbol in symbols:
        if symbol == exclude_symbol:
            continue
        row = rows_by_symbol.get(symbol)
        if row is not None:
            scores.append(_row_context_score(row))
    return _average(scores, 50.0)


def _symbol_profile(row: Mapping[str, object]) -> MacroProfile:
    symbol = _normalize_symbol(row.get("symbol"))
    sector = _sector_key(row)
    asset_type = safe_str(row.get("asset_type"), "").lower()
    if "crypto" in asset_type or symbol in CRYPTO_PROXIES:
        return "crypto"
    if "energy" in sector or symbol in OIL_PROXIES:
        return "energy"
    if "gold" in sector or "metal" in sector or symbol in GOLD_PROXIES or "GOLD" in symbol:
        return "gold"
    if "small" in asset_type or symbol == "IWM":
        return "small_cap"
    if symbol in SEMICONDUCTOR_SYMBOLS or symbol in SOFTWARE_SYMBOLS or "technology" in sector or "communication" in sector:
        return "nasdaq"
    if sector in DEFENSIVE_SECTORS:
        return "broad"
    return "broad"


def _macro_alignment_adjustment(score: float, regime: str) -> float:
    if score >= 65.0:
        adjustment = (score - 65.0) / 35.0 * 5.0
    elif score < 50.0:
        adjustment = -((50.0 - score) / 50.0 * 8.0)
    else:
        adjustment = 0.0

    normalized_regime = regime.strip().upper()
    if normalized_regime == "BULL":
        adjustment += 1.0
    elif normalized_regime == "OVERHEATED":
        adjustment -= 2.0
    elif normalized_regime == "RISK_OFF":
        adjustment -= 4.0
    elif normalized_regime == "BEAR":
        adjustment -= 6.0
    return _clamp(adjustment, -8.0, 5.0)


def _range_adjustment(score: float, *, positive_threshold: float, negative_threshold: float, positive_max: float, negative_max: float) -> float:
    if score >= positive_threshold:
        return _clamp((score - positive_threshold) / (100.0 - positive_threshold) * positive_max, 0.0, positive_max)
    if score < negative_threshold:
        return -_clamp((negative_threshold - score) / negative_threshold * negative_max, 0.0, negative_max)
    return 0.0


def _volatility_adjustment(pressure: float) -> float:
    if pressure < 55.0:
        return 0.0
    return -_clamp((pressure - 55.0) / 45.0 * 5.0, 0.0, 5.0)


def _liquidity_adjustment(pressure: float) -> float:
    if pressure <= 38.0:
        return _clamp((38.0 - pressure) / 38.0 * 2.0, 0.0, 2.0)
    if pressure >= 55.0:
        return -_clamp((pressure - 55.0) / 45.0 * 5.0, 0.0, 5.0)
    return 0.0


def _macro_conflict_penalty(row: Mapping[str, object], macro_alignment_score: float, regime: str) -> float:
    technical_score = _first_score(row, ("technical_score", "final_score_base", "final_score"), 50.0)
    penalty = 0.0
    if macro_alignment_score < 42.0 and technical_score >= 70.0:
        penalty -= _clamp((42.0 - macro_alignment_score) / 42.0 * 4.0, 0.0, 4.0)
    normalized_regime = regime.strip().upper()
    if normalized_regime == "RISK_OFF" and macro_alignment_score < 55.0:
        penalty -= 1.5
    elif normalized_regime == "BEAR" and macro_alignment_score < 55.0:
        penalty -= 2.5
    return _clamp(penalty, -4.0, 0.0)


def _reason_codes(
    *,
    bounded: bool,
    exchange_adjustment: float,
    liquidity_adjustment: float,
    macro_adjustment: float,
    macro_conflict_penalty: float,
    sector_adjustment: float,
    volatility_adjustment: float,
    volatility_pressure: float,
) -> list[str]:
    codes: list[str] = []
    if macro_adjustment >= 1.0:
        codes.append("MACRO_TAILWIND")
    elif macro_adjustment <= -1.0:
        codes.append("MACRO_CONFLICT")
    else:
        codes.append("MACRO_MIXED")

    if exchange_adjustment >= 0.75:
        codes.append("EXCHANGE_TAILWIND")
    elif exchange_adjustment <= -0.75:
        codes.append("EXCHANGE_HEADWIND")
    if sector_adjustment >= 0.75:
        codes.append("SECTOR_SUPPORTIVE")
    elif sector_adjustment <= -0.75:
        codes.append("SECTOR_PRESSURE")
    if volatility_adjustment <= -0.75:
        codes.append("VOLATILITY_PRESSURE")
    elif volatility_pressure <= 40.0:
        codes.append("VOLATILITY_CONTAINED")
    if liquidity_adjustment <= -0.75:
        codes.append("LIQUIDITY_TIGHTENING")
    elif liquidity_adjustment >= 0.75:
        codes.append("LIQUIDITY_SUPPORTIVE")
    if macro_conflict_penalty <= -0.75:
        codes.append("MACRO_CONFLICT_PENALTY")
    if bounded:
        codes.append("CONTEXT_ADJUSTMENT_BOUNDED")
    return _unique_codes(codes)


def _summary(label: str, adjustment: float, exchange_label: str, sector_label: str, context: MacroMarketContext) -> str:
    direction = "supports" if adjustment > 0.75 else "reduces" if adjustment < -0.75 else "keeps"
    return (
        f"{label}: macro/exchange context {direction} decision quality by {adjustment:+.2f} points. "
        f"{exchange_label}; {sector_label}; risk-on {context['risk_on_score']:.0f}/100, "
        f"macro pressure {context['macro_pressure_score']:.0f}/100, volatility pressure {context['volatility_pressure']:.0f}/100, "
        f"liquidity pressure {context['liquidity_pressure']:.0f}/100."
    )


def _proxy_coverage(rows_by_symbol: Mapping[str, Mapping[str, object]]) -> dict[str, list[str]]:
    expected = ("SPY", "QQQ", "DIA", "IWM", "VIX/VXX", "DXY/UUP", "TLT/IEF", "GLD", "USO", "BTC/IBIT")
    used: list[str] = []
    for symbol in BROAD_PROXIES:
        if symbol in rows_by_symbol:
            used.append(symbol)
    for group in (VOLATILITY_PROXIES, DOLLAR_PROXIES, RATE_PROXIES, GOLD_PROXIES, OIL_PROXIES, CRYPTO_PROXIES):
        present = _first_present(rows_by_symbol, group)
        if present is not None:
            used.append(present)
    missing = [symbol for symbol in expected if symbol not in used and not any(part in used for part in symbol.split("/"))]
    return {"missing": missing, "used": _unique_codes(used)}


def _first_present(rows_by_symbol: Mapping[str, Mapping[str, object]], symbols: tuple[str, ...]) -> str | None:
    for symbol in symbols:
        normalized = _normalize_symbol(symbol)
        if normalized in rows_by_symbol:
            return normalized
    return None


def _context_label(score: float, tailwind: str, mixed: str, headwind: str) -> str:
    if score >= 65.0:
        return tailwind
    if score < 45.0:
        return headwind
    return mixed


def _first_score(row: Mapping[str, object], keys: tuple[str, ...], default: float) -> float:
    for key in keys:
        score = safe_float(row.get(key), np.nan)
        if not np.isnan(score) and np.isfinite(score):
            return _clamp(score)
    return default


def _bounded(value: object, *, default: float) -> float:
    parsed = safe_float(value, np.nan)
    if np.isnan(parsed) or not np.isfinite(parsed):
        return default
    return _clamp(parsed)


def _sector_key(row: Mapping[str, object]) -> str:
    return safe_str(row.get("sector"), "").strip().lower()


def _normalize_symbol(value: object) -> str:
    return safe_str(value, "").strip().upper()


def _title_label(value: str) -> str:
    text = value.replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in text.split())


def _average(values: list[float], fallback: float) -> float:
    numbers = [value for value in values if np.isfinite(value)]
    if not numbers:
        return fallback
    return float(sum(numbers) / len(numbers))


def _weighted_average(values: tuple[tuple[float, float], ...], fallback: float) -> float:
    numerator = 0.0
    denominator = 0.0
    for value, weight in values:
        if not np.isfinite(value):
            continue
        numerator += value * weight
        denominator += weight
    return numerator / denominator if denominator > 0.0 else fallback


def _clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return clamp_score(value, lower, upper)


def _unique_codes(codes: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for code in codes:
        if code and code not in seen:
            seen.add(code)
            unique.append(code)
    return unique
