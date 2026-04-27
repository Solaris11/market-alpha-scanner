from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .safety import utc_now


RETURN_COLUMNS = (
    "return_1d",
    "one_day_return",
    "daily_return",
    "price_return_1d",
    "price_change_pct_1d",
    "change_pct_1d",
    "one_day_change_pct",
    "day_return",
    "short_return",
)


def _normalized_text(value: object) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except TypeError:
        pass
    return str(value).strip().upper()


def _return_column(df: pd.DataFrame) -> str | None:
    by_lower = {str(column).lower(): str(column) for column in df.columns}
    for column in RETURN_COLUMNS:
        if column.lower() in by_lower:
            return by_lower[column.lower()]
    return None


def _breadth_state(ratio: float | None) -> str:
    if ratio is None:
        return "UNKNOWN"
    if ratio > 0.60:
        return "STRONG"
    if ratio < 0.45:
        return "WEAK"
    return "MIXED"


def _leadership_state(top_3_dominance: float | None) -> str:
    if top_3_dominance is None:
        return "UNKNOWN"
    if top_3_dominance > 0.35:
        return "CONCENTRATED"
    if top_3_dominance < 0.25:
        return "BALANCED"
    return "MIXED"


def _warning_for(breadth: str, leadership: str, return_field: str | None) -> str:
    if return_field is None:
        return "1D return data is unavailable; breadth will populate after the next scanner run."
    if breadth == "WEAK" and leadership == "CONCENTRATED":
        return "Market rally is narrow; high concentration risk."
    if breadth == "WEAK":
        return "Market breadth is weak; be selective with long entries."
    if leadership == "CONCENTRATED":
        return "Leadership is concentrated; confirm breakouts before chasing."
    if breadth == "STRONG" and leadership == "BALANCED":
        return "Market participation is broad and balanced."
    return "Market structure is mixed."


def compute_market_structure(full_ranking: pd.DataFrame) -> dict[str, Any]:
    if full_ranking is None or full_ranking.empty:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "breadth": "UNKNOWN",
            "breadth_ratio": None,
            "advancing": 0,
            "declining": 0,
            "advancing_symbols": 0,
            "declining_symbols": 0,
            "total_symbols": 0,
            "breadth_sample_size": 0,
            "strong_signals": 0,
            "leadership": "UNKNOWN",
            "top_3_symbols": [],
            "top_n_symbols": [],
            "top_3_dominance": None,
            "top_10_weight": None,
            "contribution_weight": None,
            "return_field": None,
            "warning": "No ranking data available for market structure analysis.",
        }

    df = full_ranking.copy()
    if "symbol" not in df.columns:
        df["symbol"] = ""
    symbols = df["symbol"].fillna("").astype(str).str.strip().str.upper()
    df = df.loc[symbols != ""].copy()
    df["symbol"] = symbols.loc[symbols != ""]

    total_symbols = int(len(df))
    return_field = _return_column(df)
    if return_field is not None:
        returns = pd.to_numeric(df[return_field], errors="coerce")
        advancing = int((returns > 0).sum())
        declining = int((returns < 0).sum())
        breadth_sample_size = int(returns.notna().sum())
        breadth_ratio = advancing / total_symbols if total_symbols else None
    else:
        advancing = 0
        declining = 0
        breadth_sample_size = 0
        breadth_ratio = None

    if "rating" not in df.columns:
        df["rating"] = ""
    if "action" not in df.columns:
        for fallback in ("composite_action", "long_action", "mid_action", "short_action"):
            if fallback in df.columns:
                df["action"] = df[fallback]
                break
        else:
            df["action"] = ""
    rating = df["rating"].map(_normalized_text)
    action = df["action"].map(lambda value: " ".join(_normalized_text(value).split()))
    strong_signal_mask = rating.isin({"TOP", "ACTIONABLE"}) & action.isin({"BUY", "STRONG BUY"})
    strong_signals = int(strong_signal_mask.sum())

    if "final_score" not in df.columns:
        scores = pd.Series(dtype=float)
        scored = df.copy()
        scored["_score"] = np.nan
    else:
        scored = df.copy()
        scored["_score"] = pd.to_numeric(scored["final_score"], errors="coerce").fillna(0.0).clip(lower=0)
        scores = scored["_score"]

    score_total = float(scores.sum()) if len(scores) else 0.0
    ranked = scored.sort_values(["_score", "symbol"], ascending=[False, True]).reset_index(drop=True)
    top_10 = ranked.head(10)
    top_3 = ranked.head(3)
    top_n_symbols = [str(symbol) for symbol in top_10["symbol"].tolist()]
    top_3_symbols = [str(symbol) for symbol in top_3["symbol"].tolist()]
    top_10_weight = float(top_10["_score"].sum() / score_total) if score_total > 0 else None
    top_3_dominance = float(top_3["_score"].sum() / score_total) if score_total > 0 else None

    breadth = _breadth_state(breadth_ratio)
    leadership = _leadership_state(top_3_dominance)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "breadth": breadth,
        "breadth_ratio": breadth_ratio,
        "advancing": advancing,
        "declining": declining,
        "advancing_symbols": advancing,
        "declining_symbols": declining,
        "total_symbols": total_symbols,
        "breadth_sample_size": breadth_sample_size,
        "strong_signals": strong_signals,
        "leadership": leadership,
        "top_3_symbols": top_3_symbols,
        "top_n_symbols": top_n_symbols,
        "top_3_dominance": top_3_dominance,
        "top_10_weight": top_10_weight,
        "contribution_weight": top_10_weight,
        "return_field": return_field,
        "warning": _warning_for(breadth, leadership, return_field),
    }


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if np.isnan(value) or not np.isfinite(value) else float(value)
    if value is None:
        return None
    return value


def write_market_structure(outdir: Path, full_ranking: pd.DataFrame | None = None) -> dict[str, Any]:
    if full_ranking is None:
        ranking_path = outdir / "full_ranking.csv"
        if ranking_path.exists():
            try:
                full_ranking = pd.read_csv(ranking_path)
            except Exception as exc:
                print(f"[analysis] market structure skipped: failed to read {ranking_path}: {exc}")
                full_ranking = pd.DataFrame()
        else:
            full_ranking = pd.DataFrame()

    payload = compute_market_structure(full_ranking)
    analysis_dir = outdir / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    path = analysis_dir / "market_structure.json"
    tmp_path = path.with_name(f"{path.name}.{os.getpid()}.{utc_now().timestamp():.6f}.tmp")
    try:
        tmp_path.write_text(json.dumps(_json_safe(payload), indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    finally:
        tmp_path.unlink(missing_ok=True)
    print(
        "[analysis] market structure written:"
        f" breadth={payload.get('breadth')},"
        f" leadership={payload.get('leadership')},"
        f" strong_signals={payload.get('strong_signals')}"
    )
    return payload


def read_market_structure(outdir: Path) -> dict[str, Any] | None:
    path = outdir / "analysis" / "market_structure.json"
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None
