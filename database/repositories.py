from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from .models import ScanRun, ScannerSignal


def create_scan_run(
    session: Session,
    *,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    run_type: str = "scan",
    status: str = "success",
    universe_count: int | None = None,
    symbols_scored: int | None = None,
    market_regime: str | None = None,
    breadth: str | None = None,
    leadership: str | None = None,
    metadata: Mapping[str, object] | None = None,
) -> ScanRun:
    scan_run = ScanRun(
        started_at=started_at or datetime.now(timezone.utc),
        completed_at=completed_at,
        run_type=run_type,
        status=status,
        universe_count=universe_count,
        symbols_scored=symbols_scored,
        market_regime=market_regime,
        breadth=breadth,
        leadership=leadership,
        run_metadata={str(key): value for key, value in (metadata or {}).items()},
    )
    session.add(scan_run)
    session.flush()
    return scan_run


def add_scanner_signal_rows(
    session: Session,
    *,
    scan_run_id: UUID,
    rows: Sequence[Mapping[str, object]],
) -> list[ScannerSignal]:
    signals: list[ScannerSignal] = []
    seen_symbols: set[str] = set()
    for row in rows:
        symbol = _string_or_none(row.get("symbol"))
        if symbol is None:
            continue
        normalized_symbol = symbol.upper()
        if normalized_symbol in seen_symbols:
            continue
        seen_symbols.add(normalized_symbol)
        signal = ScannerSignal(
            scan_run_id=scan_run_id,
            rank_position=_int_or_none(row.get("rank_position")),
            symbol=normalized_symbol,
            company_name=_string_or_none(row.get("company_name")),
            asset_type=_string_or_none(row.get("asset_type")),
            sector=_string_or_none(row.get("sector")),
            price=_number_or_none(row.get("price")),
            final_score=_number_or_none(row.get("final_score")),
            final_score_adjusted=_number_or_none(row.get("final_score_adjusted")),
            rating=_string_or_none(row.get("rating")),
            action=_string_or_none(_first_present(row, ("action", "composite_action", "mid_action", "short_action", "long_action"))),
            setup_type=_string_or_none(row.get("setup_type")),
            entry_status=_string_or_none(row.get("entry_status")),
            recommendation_quality=_string_or_none(row.get("recommendation_quality")),
            quality_score=_number_or_none(row.get("quality_score")),
            final_decision=_string_or_none(row.get("final_decision")),
            suggested_entry=_string_or_none(row.get("suggested_entry")),
            entry_distance_pct=_number_or_none(row.get("entry_distance_pct")),
            entry_zone_low=_number_or_none(_first_present(row, ("entry_zone_low", "buy_zone_low"))),
            entry_zone_high=_number_or_none(_first_present(row, ("entry_zone_high", "buy_zone_high"))),
            buy_zone=_string_or_none(_first_present(row, ("buy_zone", "entry_zone"))),
            stop_loss=_number_or_none(row.get("stop_loss")),
            take_profit=_number_or_none(_first_present(row, ("take_profit", "take_profit_high", "conservative_target"))),
            conservative_target=_number_or_none(row.get("conservative_target")),
            risk_reward=_number_or_none(row.get("risk_reward")),
            market_regime=_string_or_none(row.get("market_regime")),
            payload={str(key): value for key, value in row.items()},
        )
        session.add(signal)
        signals.append(signal)
    session.flush()
    return signals


def _first_present(row: Mapping[str, object], columns: Sequence[str]) -> object | None:
    for column in columns:
        value = row.get(column)
        if _string_or_none(value) is not None:
            return value
    return None


def _string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null", "n/a", "na"}:
        return None
    return text


def _number_or_none(value: object) -> float | None:
    text = _string_or_none(value)
    if text is None:
        return None
    normalized = text.replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        numeric = float(normalized)
    except ValueError:
        return None
    if numeric != numeric:
        return None
    if numeric in (float("inf"), float("-inf")):
        return None
    return numeric


def _int_or_none(value: object) -> int | None:
    text = _string_or_none(value)
    if text is None:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None
