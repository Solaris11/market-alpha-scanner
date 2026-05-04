from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import asdict, is_dataclass
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import get_database_url
from .repositories import add_scanner_signal_rows, create_scan_run
from .session import session_scope


def persist_scan_dataframe(df_rank: pd.DataFrame, *, scanner_version: str | None = None, notes: str | None = None) -> dict[str, Any]:
    _ = (scanner_version, notes)
    database_url = get_database_url(required=False)
    if not database_url:
        return {"enabled": False, "reason": "DATABASE_URL not configured"}

    started_at = _datetime_attr(df_rank.attrs.get("scan_started_at")) or datetime.now(timezone.utc)
    completed_at = _datetime_attr(df_rank.attrs.get("scan_completed_at")) or datetime.now(timezone.utc)
    requested_universe = df_rank.attrs.get("requested_universe", [])
    symbols_scored = _int_or_none(df_rank.attrs.get("scanned_count"))
    market_regime = _market_regime_value(df_rank)
    market_structure = _mapping_attr(df_rank.attrs.get("market_structure"))

    counts: dict[str, Any] = {
        "enabled": True,
        "scan_runs": 0,
        "scanner_signals": 0,
    }

    with session_scope() as session:
        scan_run = create_scan_run(
            session,
            started_at=started_at,
            completed_at=completed_at,
            run_type="scan",
            status="success",
            universe_count=_sequence_len(requested_universe),
            symbols_scored=symbols_scored,
            market_regime=market_regime,
            breadth=_string_or_none(market_structure.get("breadth")),
            leadership=_string_or_none(market_structure.get("leadership")),
            metadata={
                "notes": notes,
                "scanner_version": scanner_version,
                "requested_universe": _jsonable(requested_universe),
                "market_regime": _jsonable(df_rank.attrs.get("market_regime")),
                "market_structure": _jsonable(market_structure),
            },
        )
        counts["scan_runs"] = 1
        signal_rows = _dataframe_rows(df_rank)
        counts["scanner_signals"] = len(add_scanner_signal_rows(session, scan_run_id=scan_run.id, rows=signal_rows))
        counts["symbol_snapshots"] = _persist_symbol_snapshots(session, scan_run.id, df_rank)
        counts["symbol_price_history"] = _persist_symbol_price_history(session, df_rank)

    return counts


def persist_analysis_data(forward_returns_df: pd.DataFrame, summary_df: pd.DataFrame) -> dict[str, Any]:
    database_url = get_database_url(required=False)
    if not database_url:
        return {"enabled": False, "reason": "DATABASE_URL not configured"}

    counts: dict[str, Any] = {
        "enabled": True,
        "performance_summary": 0,
        "forward_returns": 0,
    }
    with session_scope() as session:
        scan_run_id = _latest_scan_run_id(session)
        counts["performance_summary"] = _persist_performance_summary(session, scan_run_id, summary_df)
        counts["forward_returns"] = _persist_forward_returns(session, scan_run_id, forward_returns_df)
    return counts


def _datetime_attr(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def _mapping_attr(value: object) -> dict[str, object]:
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items()}
    return {}


def _dataframe_rows(df: pd.DataFrame) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for rank_position, row in enumerate(df.to_dict(orient="records"), start=1):
        normalized_row = {str(key): _jsonable(value) for key, value in row.items()}
        normalized_row["rank_position"] = rank_position
        rows.append(normalized_row)
    return rows


def _latest_scan_run_id(session: Session) -> UUID | None:
    result = session.execute(
        text(
            """
            SELECT id
            FROM scan_runs
            WHERE status = 'success'
            ORDER BY completed_at DESC NULLS LAST, created_at DESC
            LIMIT 1
            """
        )
    ).scalar_one_or_none()
    return result if isinstance(result, UUID) else None


def _persist_symbol_snapshots(session: Session, scan_run_id: UUID, df_rank: pd.DataFrame) -> int:
    ranked_assets = df_rank.attrs.get("ranked_assets")
    if not isinstance(ranked_assets, list):
        return 0

    inserted = 0
    statement = text(
        """
        INSERT INTO symbol_snapshots (scan_run_id, symbol, summary, created_at)
        VALUES (:scan_run_id, :symbol, CAST(:summary AS jsonb), now())
        ON CONFLICT (scan_run_id, symbol)
        DO UPDATE SET summary = EXCLUDED.summary
        """
    )
    for item in ranked_assets:
        summary = _asset_summary(item)
        symbol = _string_or_none(summary.get("symbol"))
        if symbol is None:
            continue
        session.execute(
            statement,
            {
                "scan_run_id": scan_run_id,
                "symbol": symbol.upper(),
                "summary": json.dumps(summary, separators=(",", ":")),
            },
        )
        inserted += 1
    return inserted


def _asset_summary(item: object) -> dict[str, object]:
    if is_dataclass(item) and not isinstance(item, type):
        raw = asdict(item)
    elif isinstance(item, Mapping):
        raw = {str(key): value for key, value in item.items()}
    else:
        symbol = getattr(item, "symbol", None)
        raw = {"symbol": symbol} if symbol is not None else {}
    return {str(key): _jsonable(value) for key, value in raw.items()}


def _persist_symbol_price_history(session: Session, df_rank: pd.DataFrame) -> int:
    price_map = df_rank.attrs.get("price_map")
    if not isinstance(price_map, Mapping):
        return 0

    statement = text(
        """
        INSERT INTO symbol_price_history (symbol, ts, open, high, low, close, volume, source, created_at)
        VALUES (:symbol, :ts, :open, :high, :low, :close, :volume, 'scanner', now())
        ON CONFLICT (symbol, ts, source)
        DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume
        """
    )
    params: list[dict[str, object]] = []
    for symbol_raw, frame_raw in price_map.items():
        symbol = _string_or_none(symbol_raw)
        if symbol is None or not isinstance(frame_raw, pd.DataFrame) or frame_raw.empty:
            continue
        frame = frame_raw.reset_index()
        for row in frame.to_dict(orient="records"):
            normalized_row: dict[str, object] = {str(key): value for key, value in row.items()}
            timestamp = _timestamp_or_none(_first_present_mapping(normalized_row, ("Date", "Datetime", "date", "datetime", "index")))
            if timestamp is None:
                continue
            params.append(
                {
                    "symbol": symbol.upper(),
                    "ts": timestamp,
                    "open": _float_or_none(_first_present_mapping(normalized_row, ("Open", "open"))),
                    "high": _float_or_none(_first_present_mapping(normalized_row, ("High", "high"))),
                    "low": _float_or_none(_first_present_mapping(normalized_row, ("Low", "low"))),
                    "close": _float_or_none(_first_present_mapping(normalized_row, ("Close", "close", "Adj Close", "adj_close"))),
                    "volume": _float_or_none(_first_present_mapping(normalized_row, ("Volume", "volume"))),
                }
            )

    total = 0
    for chunk_start in range(0, len(params), 1000):
        chunk = params[chunk_start : chunk_start + 1000]
        if chunk:
            session.execute(statement, chunk)
            total += len(chunk)
    return total


def _persist_performance_summary(session: Session, scan_run_id: UUID | None, summary_df: pd.DataFrame) -> int:
    if summary_df.empty:
        return 0
    statement = text(
        """
        INSERT INTO performance_summary (scan_run_id, grouping_key, grouping_value, horizon, metrics, created_at)
        VALUES (:scan_run_id, :grouping_key, :grouping_value, :horizon, CAST(:metrics AS jsonb), now())
        """
    )
    params: list[dict[str, object]] = []
    for row in _dataframe_rows(summary_df):
        grouping_key = _string_or_none(row.get("group_type") or row.get("grouping_key")) or "unknown"
        grouping_value = _string_or_none(row.get("group_value") or row.get("grouping_value") or row.get("label")) or "unknown"
        params.append(
            {
                "scan_run_id": scan_run_id,
                "grouping_key": grouping_key,
                "grouping_value": grouping_value,
                "horizon": _string_or_none(row.get("horizon")),
                "metrics": json.dumps(row, separators=(",", ":")),
            }
        )
    session.execute(statement, params)
    return len(params)


def _persist_forward_returns(session: Session, scan_run_id: UUID | None, forward_returns_df: pd.DataFrame) -> int:
    if forward_returns_df.empty:
        return 0
    statement = text(
        """
        INSERT INTO forward_returns (scan_run_id, symbol, signal_date, horizon, return_pct, metrics, created_at)
        VALUES (:scan_run_id, :symbol, :signal_date, :horizon, :return_pct, CAST(:metrics AS jsonb), now())
        """
    )
    params: list[dict[str, object]] = []
    for row in _dataframe_rows(forward_returns_df):
        symbol = _string_or_none(row.get("symbol"))
        if symbol is None:
            continue
        params.append(
            {
                "scan_run_id": scan_run_id,
                "symbol": symbol.upper(),
                "signal_date": _date_or_none(_first_present_mapping(row, ("signal_date", "date", "timestamp_utc", "scan_timestamp"))),
                "horizon": _string_or_none(row.get("horizon")),
                "return_pct": _float_or_none(row.get("return_pct") or row.get("forward_return") or row.get("return")),
                "metrics": json.dumps(row, separators=(",", ":")),
            }
        )
    for chunk_start in range(0, len(params), 1000):
        chunk = params[chunk_start : chunk_start + 1000]
        if chunk:
            session.execute(statement, chunk)
    return len(params)


def _sequence_len(value: object) -> int | None:
    if isinstance(value, (list, tuple, set)):
        return len(value)
    return None


def _int_or_none(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null", "n/a", "na"}:
        return None
    return text


def _market_regime_value(df_rank: pd.DataFrame) -> str | None:
    attr_value = df_rank.attrs.get("market_regime")
    if isinstance(attr_value, dict):
        regime = _string_or_none(attr_value.get("regime"))
        if regime is not None:
            return regime
    attr_text = _string_or_none(attr_value)
    if attr_text is not None:
        return attr_text
    if "market_regime" not in df_rank.columns or df_rank.empty:
        return None
    for value in df_rank["market_regime"].tolist():
        regime = _string_or_none(value)
        if regime is not None:
            return regime
    return None


def _float_or_none(value: object) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(str(value).replace("$", "").replace(",", "").replace("%", "").strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed and parsed not in (float("inf"), float("-inf")) else None


def _timestamp_or_none(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if isinstance(value, pd.Timestamp):
        parsed_timestamp = value.to_pydatetime()
        return parsed_timestamp if parsed_timestamp.tzinfo is not None else parsed_timestamp.replace(tzinfo=timezone.utc)
    if value is None:
        return None
    if not isinstance(value, (str, int, float, date)):
        return None
    try:
        parsed = pd.Timestamp(value).to_pydatetime()
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)


def _date_or_none(value: object) -> str | None:
    timestamp = _timestamp_or_none(value)
    return timestamp.date().isoformat() if timestamp else None


def _first_present_mapping(row: Mapping[str, object], keys: tuple[str, ...]) -> object | None:
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]
    lowered = {str(key).lower(): value for key, value in row.items()}
    for key in keys:
        value = lowered.get(key.lower())
        if value is not None:
            return value
    return None


def _jsonable(value: object) -> object:
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        if isinstance(value, float) and value != value:
            return None
        if isinstance(value, str) and value.strip().lower() in {"nan", "none", "null", "n/a", "na", "<na>"}:
            return None
        return value
    return str(value)
