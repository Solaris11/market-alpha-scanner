from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from .config import get_database_url
from .repositories import (
    add_fundamental_snapshot,
    add_news_items,
    add_price_history_rows,
    add_symbol_snapshot,
    create_scan_run,
)
from .session import session_scope


def persist_scan_dataframe(df_rank: pd.DataFrame, *, scanner_version: str | None = None, notes: str | None = None) -> dict[str, Any]:
    database_url = get_database_url(required=False)
    if not database_url:
        return {"enabled": False, "reason": "DATABASE_URL not configured"}

    ranked_assets = df_rank.attrs.get("ranked_assets", [])
    price_map = df_rank.attrs.get("price_map", {})
    info_cache = df_rank.attrs.get("info_cache", {})
    news_cache = df_rank.attrs.get("news_cache", {})
    started_at = df_rank.attrs.get("scan_started_at")
    completed_at = df_rank.attrs.get("scan_completed_at") or datetime.now(timezone.utc)
    requested_universe = df_rank.attrs.get("requested_universe", [])
    scanned_count = df_rank.attrs.get("scanned_count", len(info_cache) or len(ranked_assets))

    counts = {
        "enabled": True,
        "scan_runs": 0,
        "symbol_snapshots": 0,
        "symbol_reasons": 0,
        "price_history": 0,
        "fundamental_snapshots": 0,
        "news_items": 0,
    }

    with session_scope() as session:
        scan_run = create_scan_run(
            session,
            started_at=started_at,
            completed_at=completed_at,
            universe_size=len(requested_universe) or None,
            scanned_count=scanned_count,
            ranked_count=len(df_rank),
            scanner_version=scanner_version,
            notes=notes,
        )
        counts["scan_runs"] = 1

        for asset in ranked_assets:
            snapshot_data = _build_snapshot_payload(asset)
            reasons_by_horizon = _build_reason_rows(asset)
            snapshot = add_symbol_snapshot(
                session,
                scan_run_id=scan_run.id,
                snapshot_data=snapshot_data,
                reasons_by_horizon=reasons_by_horizon,
            )
            counts["symbol_snapshots"] += 1
            counts["symbol_reasons"] += sum(len(items) for items in reasons_by_horizon.values())

            news_items = news_cache.get(asset.symbol, [])
            if news_items:
                counts["news_items"] += len(add_news_items(session, symbol=asset.symbol, items=news_items))

        for symbol, price_df in price_map.items():
            if price_df is None or price_df.empty:
                continue
            price_rows = _build_price_rows(price_df)
            counts["price_history"] += len(add_price_history_rows(session, symbol=symbol, rows=price_rows))

        for symbol, info in info_cache.items():
            asset = next((item for item in ranked_assets if item.symbol == symbol), None)
            fundamentals_payload = _build_fundamental_payload(asset, info)
            if any(value is not None for key, value in fundamentals_payload.items() if key != "raw_json"):
                add_fundamental_snapshot(session, symbol=symbol, data=fundamentals_payload, captured_at=completed_at)
                counts["fundamental_snapshots"] += 1

    return counts


def _build_snapshot_payload(asset) -> dict[str, object]:
    return {
        "symbol": asset.symbol,
        "asset_type": asset.asset_type,
        "price": asset.price,
        "trend_score": asset.trend_score,
        "momentum_score": asset.momentum_score,
        "breakout_score": asset.breakout_score,
        # The scanner already rolls RSI/MACD into the momentum bucket, so the DB keeps the same source of truth here.
        "rsi_macd_score": asset.momentum_score,
        "volume_score": asset.relative_volume_score,
        "fundamentals_score": asset.fundamental_score,
        "risk_penalty": asset.risk_penalty,
        "macro_score": asset.macro_score,
        "short_score": asset.short_score,
        "mid_score": asset.mid_score,
        "long_score": asset.long_score,
        "short_action": asset.short_action,
        "mid_action": asset.mid_action,
        "long_action": asset.long_action,
        "composite_action": asset.composite_action,
    }


def _build_reason_rows(asset) -> dict[str, list[str]]:
    reason_map = {
        "short": _split_reason_text(asset.short_reason),
        "mid": _split_reason_text(asset.mid_reason),
        "long": _split_reason_text(asset.long_reason),
    }
    selection_reasons = _split_reason_text(asset.selection_reason.split(":", 1)[1] if ":" in asset.selection_reason else asset.selection_reason)
    if selection_reasons:
        reason_map["selection"] = selection_reasons
    return {horizon: reasons for horizon, reasons in reason_map.items() if reasons}


def _split_reason_text(text: str | None) -> list[str]:
    if not text:
        return []
    parts = [item.strip() for item in str(text).split(";")]
    return [item for item in parts if item]


def _build_price_rows(price_df: pd.DataFrame) -> list[dict[str, object]]:
    history_df = price_df.reset_index().rename(columns={"Date": "date"}).copy()
    history_df.columns = [str(column).strip().lower().replace(" ", "_") for column in history_df.columns]
    if "adj_close" not in history_df.columns and "close" in history_df.columns:
        history_df["adj_close"] = history_df["close"]

    rows: list[dict[str, object]] = []
    for row in history_df.to_dict(orient="records"):
        date_value = row.get("date")
        if date_value is None or pd.isna(date_value):
            continue
        rows.append(
            {
                "date": pd.Timestamp(date_value).date().isoformat(),
                "open": row.get("open"),
                "high": row.get("high"),
                "low": row.get("low"),
                "close": row.get("close"),
                "adj_close": row.get("adj_close"),
                "volume": row.get("volume"),
            }
        )
    return rows


def _build_fundamental_payload(asset, info: dict) -> dict[str, object]:
    raw_payload = dict(info or {})
    return {
        "market_cap": getattr(asset, "market_cap", None) if asset is not None else info.get("marketCap"),
        "pe": getattr(asset, "trailing_pe", None) if asset is not None else info.get("trailingPE"),
        "forward_pe": getattr(asset, "forward_pe", None) if asset is not None else info.get("forwardPE"),
        "revenue_growth": getattr(asset, "revenue_growth", None) if asset is not None else info.get("revenueGrowth"),
        "earnings_growth": getattr(asset, "earnings_growth", None) if asset is not None else info.get("earningsGrowth"),
        "operating_margin": getattr(asset, "operating_margin", None) if asset is not None else info.get("operatingMargins"),
        "debt_to_equity": getattr(asset, "debt_to_equity", None) if asset is not None else info.get("debtToEquity"),
        "raw_json": _safe_jsonable(raw_payload),
    }


def _safe_jsonable(value):
    if isinstance(value, dict):
        return {str(key): _safe_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_safe_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_safe_jsonable(item) for item in value]
    if isinstance(value, (str, int, bool)) or value is None:
        return value
    if isinstance(value, float):
        return None if pd.isna(value) else value
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    try:
        return asdict(value)
    except Exception:
        return str(value)
