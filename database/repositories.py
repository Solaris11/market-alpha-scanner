from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

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
        price=snapshot_data.get("price"),
        trend_score=snapshot_data.get("trend_score"),
        momentum_score=snapshot_data.get("momentum_score"),
        breakout_score=snapshot_data.get("breakout_score"),
        rsi_macd_score=snapshot_data.get("rsi_macd_score"),
        volume_score=snapshot_data.get("volume_score"),
        fundamentals_score=snapshot_data.get("fundamentals_score"),
        risk_penalty=snapshot_data.get("risk_penalty"),
        macro_score=snapshot_data.get("macro_score"),
        short_score=snapshot_data.get("short_score"),
        mid_score=snapshot_data.get("mid_score"),
        long_score=snapshot_data.get("long_score"),
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
    created: list[PriceHistory] = []
    for row in rows:
        price_row = PriceHistory(
            symbol=symbol.strip(),
            date=_coerce_date(row.get("date")),
            open=row.get("open"),
            high=row.get("high"),
            low=row.get("low"),
            close=row.get("close"),
            adj_close=row.get("adj_close"),
            volume=row.get("volume"),
        )
        created.append(price_row)
        session.add(price_row)
    session.flush()
    return created


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
        market_cap=data.get("market_cap"),
        pe=data.get("pe"),
        forward_pe=data.get("forward_pe"),
        revenue_growth=data.get("revenue_growth"),
        earnings_growth=data.get("earnings_growth"),
        operating_margin=data.get("operating_margin"),
        debt_to_equity=data.get("debt_to_equity"),
        raw_json=data.get("raw_json"),
    )
    session.add(snapshot)
    session.flush()
    return snapshot


def add_news_items(session: Session, *, symbol: str, items: Sequence[Mapping[str, object]]) -> list[NewsItem]:
    created: list[NewsItem] = []
    normalized_symbol = symbol.strip()
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
        news_item = NewsItem(
            symbol=normalized_symbol,
            published_at=published_at,
            source=_string_or_none(item.get("source")),
            title=title,
            url=_string_or_none(item.get("url")),
            summary=_string_or_none(item.get("summary")),
            fingerprint=fingerprint,
        )
        created.append(news_item)
        session.add(news_item)
    session.flush()
    return created


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
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _coerce_date(value: object) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return date.fromisoformat(str(value))
