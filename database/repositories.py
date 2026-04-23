from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .models import FundamentalSnapshot, NewsItem, PriceHistory, ScanRun, SymbolReason, SymbolSnapshot


def create_scan_run(
    session: Session,
    *,
    universe_size: int | None = None,
    scanned_count: int | None = None,
    ranked_count: int | None = None,
    scanner_version: str | None = None,
    notes: str | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
) -> ScanRun:
    scan_run = ScanRun(
        universe_size=universe_size,
        scanned_count=scanned_count,
        ranked_count=ranked_count,
        scanner_version=scanner_version,
        notes=notes,
        started_at=started_at or datetime.now(timezone.utc),
        completed_at=completed_at,
    )
    session.add(scan_run)
    session.flush()
    return scan_run


def add_symbol_snapshot(
    session: Session,
    *,
    scan_run_id: int,
    snapshot_data: Mapping[str, object],
    reasons_by_horizon: Mapping[str, Sequence[str]] | None = None,
) -> SymbolSnapshot:
    # This stays explicit on purpose so the next write-path task can call it directly.
    snapshot = SymbolSnapshot(
        scan_run_id=scan_run_id,
        symbol=str(snapshot_data.get("symbol", "")).strip(),
        asset_type=_string_or_none(snapshot_data.get("asset_type")),
        price=_number_or_none(snapshot_data.get("price")),
        trend_score=_number_or_none(snapshot_data.get("trend_score")),
        momentum_score=_number_or_none(snapshot_data.get("momentum_score")),
        breakout_score=_number_or_none(snapshot_data.get("breakout_score")),
        rsi_macd_score=_number_or_none(snapshot_data.get("rsi_macd_score")),
        volume_score=_number_or_none(snapshot_data.get("volume_score")),
        fundamentals_score=_number_or_none(snapshot_data.get("fundamentals_score")),
        risk_penalty=_number_or_none(snapshot_data.get("risk_penalty")),
        macro_score=_number_or_none(snapshot_data.get("macro_score")),
        short_score=_number_or_none(snapshot_data.get("short_score")),
        mid_score=_number_or_none(snapshot_data.get("mid_score")),
        long_score=_number_or_none(snapshot_data.get("long_score")),
        short_action=_string_or_none(snapshot_data.get("short_action")),
        mid_action=_string_or_none(snapshot_data.get("mid_action")),
        long_action=_string_or_none(snapshot_data.get("long_action")),
        composite_action=_string_or_none(snapshot_data.get("composite_action")),
    )
    session.add(snapshot)
    session.flush()

    if reasons_by_horizon:
        for horizon, reasons in reasons_by_horizon.items():
            for reason_order, reason_text in enumerate(reasons, start=1):
                text = str(reason_text).strip()
                if not text:
                    continue
                session.add(
                    SymbolReason(
                        snapshot_id=snapshot.id,
                        horizon=str(horizon).strip(),
                        reason_order=reason_order,
                        reason_text=text,
                    )
                )

    session.flush()
    return snapshot


def add_price_history_rows(session: Session, *, symbol: str, rows: Sequence[Mapping[str, object]]) -> list[PriceHistory]:
    normalized_symbol = symbol.strip()
    payload_rows = []
    for row in rows:
        date_value = row.get("date")
        if date_value is None or date_value == "":
            continue
        payload_rows.append(
            {
                "symbol": normalized_symbol,
                "date": _coerce_date(date_value),
                "open": _number_or_none(row.get("open")),
                "high": _number_or_none(row.get("high")),
                "low": _number_or_none(row.get("low")),
                "close": _number_or_none(row.get("close")),
                "adj_close": _number_or_none(row.get("adj_close")),
                "volume": _int_or_none(row.get("volume")),
            }
        )
    if not payload_rows:
        return []

    _insert_ignore_rows(session, PriceHistory, payload_rows, conflict_columns=["symbol", "date"])

    rows_in_db = session.scalars(
        select(PriceHistory).where(
            PriceHistory.symbol == normalized_symbol,
            PriceHistory.date.in_([item["date"] for item in payload_rows]),
        )
    ).all()
    return list(rows_in_db)


def add_fundamental_snapshot(
    session: Session,
    *,
    symbol: str,
    data: Mapping[str, object],
    captured_at: datetime | None = None,
) -> FundamentalSnapshot:
    snapshot = FundamentalSnapshot(
        symbol=symbol.strip(),
        captured_at=captured_at or datetime.now(timezone.utc),
        market_cap=_number_or_none(data.get("market_cap")),
        pe=_number_or_none(data.get("pe")),
        forward_pe=_number_or_none(data.get("forward_pe")),
        revenue_growth=_number_or_none(data.get("revenue_growth")),
        earnings_growth=_number_or_none(data.get("earnings_growth")),
        operating_margin=_number_or_none(data.get("operating_margin")),
        debt_to_equity=_number_or_none(data.get("debt_to_equity")),
        raw_json=data.get("raw_json"),
    )
    session.add(snapshot)
    session.flush()
    return snapshot


def add_news_items(session: Session, *, symbol: str, items: Sequence[Mapping[str, object]]) -> list[NewsItem]:
    normalized_symbol = symbol.strip()
    payload_rows = []
    for item in items:
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        published_at = _coerce_datetime(item.get("published_at"))
        fingerprint = str(item.get("fingerprint", "")).strip() or build_news_fingerprint(
            normalized_symbol,
            title=title,
            url=item.get("url"),
            published_at=published_at,
        )
        payload_rows.append(
            {
                "symbol": normalized_symbol,
                "published_at": published_at,
                "source": _string_or_none(item.get("source")),
                "title": title,
                "url": _string_or_none(item.get("url")),
                "summary": _string_or_none(item.get("summary")),
                "fingerprint": fingerprint,
            }
        )
    if not payload_rows:
        return []

    _insert_ignore_rows(session, NewsItem, payload_rows, conflict_columns=["fingerprint"])
    rows_in_db = session.scalars(
        select(NewsItem).where(NewsItem.fingerprint.in_([item["fingerprint"] for item in payload_rows]))
    ).all()
    return list(rows_in_db)


def build_news_fingerprint(symbol: str, *, title: str, url: object = None, published_at: datetime | None = None) -> str:
    published_text = published_at.isoformat() if published_at else ""
    raw = f"{symbol.strip()}|{title.strip()}|{_string_or_none(url) or ''}|{published_text}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _string_or_none(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _coerce_datetime(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _coerce_date(value: object) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return date.fromisoformat(str(value))


def _number_or_none(value: object) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(str(value))
    except (TypeError, ValueError):
        return None
    return None if numeric != numeric else numeric


def _int_or_none(value: object) -> int | None:
    if value is None:
        return None
    try:
        numeric = int(str(value))
    except (TypeError, ValueError):
        return None
    return numeric


def _insert_ignore_rows(session: Session, model, rows: Sequence[Mapping[str, object]], conflict_columns: Sequence[str]) -> None:
    if not rows:
        return

    dialect_name = session.bind.dialect.name if session.bind is not None else ""
    if dialect_name == "postgresql":
        statement = pg_insert(model).values(list(rows)).on_conflict_do_nothing(index_elements=list(conflict_columns))
        session.execute(statement)
        session.flush()
        return
    if dialect_name == "sqlite":
        statement = sqlite_insert(model).values(list(rows)).on_conflict_do_nothing(index_elements=list(conflict_columns))
        session.execute(statement)
        session.flush()
        return

    for row in rows:
        try:
            session.add(model(**dict(row)))
            session.flush()
        except IntegrityError:
            session.rollback()
