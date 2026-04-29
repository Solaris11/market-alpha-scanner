from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import PaperAccount, PaperPosition


ZERO = Decimal("0")
GROUP_TYPES = ("symbol", "setup_type", "rating", "recommendation_quality", "final_decision")


@dataclass(frozen=True)
class PaperAnalyticsSummary:
    total_trades: int
    open_trades: int
    closed_trades: int
    win_rate: Decimal
    avg_return_pct: Decimal
    total_realized_pnl: Decimal
    total_unrealized_pnl: Decimal
    total_pnl: Decimal
    max_drawdown: Decimal


@dataclass(frozen=True)
class PaperAnalyticsGroup:
    group_type: str
    group_value: str
    count: int
    avg_return_pct: Decimal
    win_rate: Decimal
    total_pnl: Decimal


@dataclass(frozen=True)
class PaperAnalyticsTimelinePoint:
    date: str
    daily_pnl: Decimal
    cumulative_pnl: Decimal


@dataclass(frozen=True)
class PaperAnalyticsResult:
    summary: PaperAnalyticsSummary
    groups: list[PaperAnalyticsGroup]
    timeline: list[PaperAnalyticsTimelinePoint]


@dataclass
class _GroupAccumulator:
    count: int = 0
    wins: int = 0
    total_pnl: Decimal = ZERO
    total_return_pct: Decimal = ZERO
    return_count: int = 0


def compute_paper_analytics(session: Session, account_name: str = "default") -> PaperAnalyticsResult:
    positions = _paper_positions(session, account_name)
    closed_positions = [position for position in positions if _status(position) == "CLOSED"]
    open_positions = [position for position in positions if _status(position) == "OPEN"]
    timeline = _timeline(closed_positions)
    total_realized_pnl = sum((_decimal_or_zero(position.realized_pnl) for position in closed_positions), ZERO)
    total_unrealized_pnl = sum((_decimal_or_zero(position.unrealized_pnl) for position in open_positions), ZERO)
    closed_count = len(closed_positions)
    wins = sum(1 for position in closed_positions if _decimal_or_zero(position.realized_pnl) > ZERO)
    summary = PaperAnalyticsSummary(
        total_trades=len(positions),
        open_trades=len(open_positions),
        closed_trades=closed_count,
        win_rate=_ratio(wins, closed_count),
        avg_return_pct=_average_return(closed_positions),
        total_realized_pnl=total_realized_pnl,
        total_unrealized_pnl=total_unrealized_pnl,
        total_pnl=total_realized_pnl + total_unrealized_pnl,
        max_drawdown=_max_drawdown(timeline),
    )
    return PaperAnalyticsResult(summary=summary, groups=_groups(closed_positions), timeline=timeline)


def _paper_positions(session: Session, account_name: str) -> list[PaperPosition]:
    account = session.scalar(select(PaperAccount).where(PaperAccount.name == account_name))
    if account is None:
        return []
    return list(session.scalars(select(PaperPosition).where(PaperPosition.account_id == account.id)).all())


def _groups(closed_positions: list[PaperPosition]) -> list[PaperAnalyticsGroup]:
    accumulators: dict[tuple[str, str], _GroupAccumulator] = {}
    for position in closed_positions:
        for group_type in GROUP_TYPES:
            group_value = _group_value(position, group_type)
            key = (group_type, group_value)
            accumulator = accumulators.setdefault(key, _GroupAccumulator())
            pnl = _decimal_or_zero(position.realized_pnl)
            return_pct = position.return_pct
            accumulator.count += 1
            accumulator.total_pnl += pnl
            if pnl > ZERO:
                accumulator.wins += 1
            if return_pct is not None:
                accumulator.total_return_pct += return_pct
                accumulator.return_count += 1

    groups = [
        PaperAnalyticsGroup(
            group_type=group_type,
            group_value=group_value,
            count=accumulator.count,
            avg_return_pct=_ratio_decimal(accumulator.total_return_pct, accumulator.return_count),
            win_rate=_ratio(accumulator.wins, accumulator.count),
            total_pnl=accumulator.total_pnl,
        )
        for (group_type, group_value), accumulator in accumulators.items()
    ]
    return sorted(groups, key=lambda group: (group.group_type, -group.total_pnl, group.group_value))


def _timeline(closed_positions: list[PaperPosition]) -> list[PaperAnalyticsTimelinePoint]:
    daily_pnl: dict[date, Decimal] = {}
    for position in closed_positions:
        if position.closed_at is None:
            continue
        closed_date = position.closed_at.date()
        daily_pnl[closed_date] = daily_pnl.get(closed_date, ZERO) + _decimal_or_zero(position.realized_pnl)

    cumulative_pnl = ZERO
    rows: list[PaperAnalyticsTimelinePoint] = []
    for closed_date in sorted(daily_pnl):
        daily_value = daily_pnl[closed_date]
        cumulative_pnl += daily_value
        rows.append(
            PaperAnalyticsTimelinePoint(
                date=closed_date.isoformat(),
                daily_pnl=daily_value,
                cumulative_pnl=cumulative_pnl,
            )
        )
    return rows


def _max_drawdown(timeline: list[PaperAnalyticsTimelinePoint]) -> Decimal:
    peak = ZERO
    max_drawdown = ZERO
    for point in timeline:
        cumulative_pnl = point.cumulative_pnl
        if cumulative_pnl > peak:
            peak = cumulative_pnl
        drawdown = cumulative_pnl - peak
        if drawdown < max_drawdown:
            max_drawdown = drawdown
    return max_drawdown


def _average_return(closed_positions: list[PaperPosition]) -> Decimal:
    total_return_pct = ZERO
    count = 0
    for position in closed_positions:
        if position.return_pct is None:
            continue
        total_return_pct += position.return_pct
        count += 1
    return _ratio_decimal(total_return_pct, count)


def _group_value(position: PaperPosition, group_type: str) -> str:
    if group_type == "symbol":
        return _clean_group_value(position.symbol)
    if group_type == "setup_type":
        return _clean_group_value(position.setup_type)
    if group_type == "rating":
        return _clean_group_value(position.rating)
    if group_type == "recommendation_quality":
        return _clean_group_value(position.recommendation_quality)
    if group_type == "final_decision":
        return _clean_group_value(position.final_decision)
    return "UNKNOWN"


def _clean_group_value(value: object) -> str:
    text = str(value or "").strip()
    return text if text else "UNKNOWN"


def _status(position: PaperPosition) -> str:
    return str(position.status or "").strip().upper()


def _decimal_or_zero(value: Decimal | None) -> Decimal:
    return value if value is not None else ZERO


def _ratio(numerator: int, denominator: int) -> Decimal:
    if denominator <= 0:
        return ZERO
    return Decimal(numerator) / Decimal(denominator)


def _ratio_decimal(numerator: Decimal, denominator: int) -> Decimal:
    if denominator <= 0:
        return ZERO
    return numerator / Decimal(denominator)
