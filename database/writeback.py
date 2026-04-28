from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

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
            universe_count=_sequence_len(requested_universe),
            symbols_scored=symbols_scored,
            market_regime=market_regime,
            breadth=_string_or_none(market_structure.get("breadth")),
            leadership=_string_or_none(market_structure.get("leadership")),
        )
        counts["scan_runs"] = 1
        signal_rows = _dataframe_rows(df_rank)
        counts["scanner_signals"] = len(add_scanner_signal_rows(session, scan_run_id=scan_run.id, rows=signal_rows))

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
    for row in df.to_dict(orient="records"):
        rows.append({str(key): value for key, value in row.items()})
    return rows


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
