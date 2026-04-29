from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from database.config import get_database_url
from database.models import PaperAccount, PaperPosition, PaperTradeEvent, ScanRun, ScannerSignal
from database.session import session_scope


DEFAULT_ACCOUNT_NAME = "default"
DEFAULT_STARTING_BALANCE = Decimal("10000")
ZERO = Decimal("0")


@dataclass(frozen=True)
class PaperTradingResult:
    skipped: bool
    opened_positions: int = 0
    closed_positions: int = 0
    warnings: int = 0
    reason: str | None = None


def run_paper_trading() -> PaperTradingResult:
    database_url = get_database_url(required=False)
    if not database_url:
        print("[paper] skipped: DATABASE_URL not configured")
        return PaperTradingResult(skipped=True, reason="DATABASE_URL not configured")

    try:
        with session_scope() as session:
            account = _get_or_create_default_account(session)
            print("[paper] account default ready")
            if not account.enabled:
                print("[paper] opened positions=0")
                print("[paper] closed positions=0")
                print("[paper] warnings=0")
                return PaperTradingResult(skipped=False)

            latest_run = _latest_scan_run(session)
            if latest_run is None:
                print("[paper] opened positions=0")
                print("[paper] closed positions=0")
                print("[paper] warnings=0")
                return PaperTradingResult(skipped=False)

            signals = _latest_signals(session, latest_run.id)
            signals_by_symbol = {signal.symbol.upper(): signal for signal in signals}
            forced_enter_symbol = _forced_enter_symbol()
            if forced_enter_symbol is not None:
                print(f"[paper] TEST-ONLY FORCE_ENTER_SYMBOL override active for {forced_enter_symbol}")
            opened, closed, warnings = _apply_paper_trading(
                session,
                account,
                signals,
                signals_by_symbol,
                forced_enter_symbol,
            )
            print(f"[paper] opened positions={opened}")
            print(f"[paper] closed positions={closed}")
            print(f"[paper] warnings={warnings}")
            return PaperTradingResult(skipped=False, opened_positions=opened, closed_positions=closed, warnings=warnings)
    except Exception as exc:
        print(f"[paper] skipped safely: {exc}")
        return PaperTradingResult(skipped=True, reason=str(exc))


def _get_or_create_default_account(session: Session) -> PaperAccount:
    account = session.scalar(select(PaperAccount).where(PaperAccount.name == DEFAULT_ACCOUNT_NAME))
    if account is not None:
        return account
    account = PaperAccount(
        name=DEFAULT_ACCOUNT_NAME,
        starting_balance=DEFAULT_STARTING_BALANCE,
        cash_balance=DEFAULT_STARTING_BALANCE,
        equity_value=ZERO,
        realized_pnl=ZERO,
        max_position_pct=Decimal("0.10"),
        risk_per_trade_pct=Decimal("0.01"),
        max_open_positions=5,
        enabled=True,
    )
    session.add(account)
    session.flush()
    return account


def _latest_scan_run(session: Session) -> ScanRun | None:
    return session.scalar(select(ScanRun).order_by(desc(ScanRun.completed_at), desc(ScanRun.created_at)).limit(1))


def _latest_signals(session: Session, scan_run_id: object) -> list[ScannerSignal]:
    return list(
        session.scalars(
            select(ScannerSignal)
            .where(ScannerSignal.scan_run_id == scan_run_id)
            .order_by(desc(ScannerSignal.final_score_adjusted), desc(ScannerSignal.final_score))
        ).all()
    )


def _apply_paper_trading(
    session: Session,
    account: PaperAccount,
    signals: list[ScannerSignal],
    signals_by_symbol: dict[str, ScannerSignal],
    forced_enter_symbol: str | None,
) -> tuple[int, int, int]:
    opened = 0
    closed = 0
    warnings = 0
    now = datetime.now(timezone.utc)

    open_positions = _open_positions(session, account)
    for position in open_positions:
        signal = signals_by_symbol.get(position.symbol.upper())
        current_price = _price_for_position(position, signal)
        close_reason = _close_reason(position, signal, current_price, forced_enter_symbol)
        if signal is not None:
            _copy_signal_context(position, signal, forced_enter_symbol)

        if close_reason is not None:
            _close_position(session, account, position, current_price, close_reason, now)
            closed += 1
            continue

        if signal is not None and _effective_final_decision(signal, forced_enter_symbol) == "AVOID":
            _add_event(
                session,
                account=account,
                position=position,
                symbol=position.symbol,
                event_type="WARNING",
                event_reason="AVOID_SIGNAL",
                price=current_price,
                quantity=position.quantity,
                cash_delta=ZERO,
                pnl_delta=ZERO,
            )
            warnings += 1

    _update_equity_value(account, _open_positions(session, account), signals_by_symbol)
    open_symbols = {position.symbol.upper() for position in _open_positions(session, account)}

    for signal in signals:
        if _effective_final_decision(signal, forced_enter_symbol) != "ENTER":
            continue
        if signal.symbol.upper() in open_symbols:
            continue
        if len(open_symbols) >= int(account.max_open_positions):
            break

        entry_price = _decimal_or_none(signal.price)
        if entry_price is None or entry_price <= ZERO:
            continue

        total_value = _total_account_value(account)
        quantity = _position_quantity(account, entry_price, _decimal_or_none(signal.stop_loss), total_value)
        if quantity is None or quantity <= ZERO:
            continue

        position_value = entry_price * quantity
        if position_value > account.cash_balance:
            quantity = account.cash_balance / entry_price
            position_value = entry_price * quantity
        if quantity <= ZERO or position_value <= ZERO:
            continue

        position = PaperPosition(
            account_id=account.id,
            symbol=signal.symbol.upper(),
            status="OPEN",
            opened_at=now,
            entry_price=entry_price,
            quantity=quantity,
            stop_loss=_valid_stop_loss(entry_price, _decimal_or_none(signal.stop_loss)),
            target_price=_valid_target_price(entry_price, _decimal_or_none(signal.conservative_target)),
            final_decision=_effective_final_decision(signal, forced_enter_symbol),
            recommendation_quality=signal.recommendation_quality,
            entry_status=signal.entry_status,
            setup_type=signal.setup_type,
            rating=signal.rating,
            realized_pnl=ZERO,
            source_scan_run_id=signal.scan_run_id,
            source_signal_id=signal.id,
        )
        session.add(position)
        session.flush()
        account.cash_balance -= position_value
        account.updated_at = now
        _add_event(
            session,
            account=account,
            position=position,
            symbol=position.symbol,
            event_type="OPEN",
            event_reason="ENTER_SIGNAL",
            price=entry_price,
            quantity=quantity,
            cash_delta=-position_value,
            pnl_delta=ZERO,
        )
        opened += 1
        open_symbols.add(position.symbol.upper())
        _update_equity_value(account, _open_positions(session, account), signals_by_symbol)

    _update_equity_value(account, _open_positions(session, account), signals_by_symbol)
    account.updated_at = now
    return opened, closed, warnings


def _open_positions(session: Session, account: PaperAccount) -> list[PaperPosition]:
    return list(
        session.scalars(
            select(PaperPosition)
            .where(PaperPosition.account_id == account.id, PaperPosition.status == "OPEN")
            .order_by(PaperPosition.opened_at)
        ).all()
    )


def _copy_signal_context(position: PaperPosition, signal: ScannerSignal, forced_enter_symbol: str | None) -> None:
    position.final_decision = _effective_final_decision(signal, forced_enter_symbol)
    position.recommendation_quality = signal.recommendation_quality
    position.entry_status = signal.entry_status
    position.setup_type = signal.setup_type
    position.rating = signal.rating
    position.source_scan_run_id = signal.scan_run_id
    position.source_signal_id = signal.id
    stop_loss = _valid_stop_loss(position.entry_price, _decimal_or_none(signal.stop_loss))
    target_price = _valid_target_price(position.entry_price, _decimal_or_none(signal.conservative_target))
    if stop_loss is not None:
        position.stop_loss = stop_loss
    if target_price is not None:
        position.target_price = target_price


def _close_reason(
    position: PaperPosition,
    signal: ScannerSignal | None,
    current_price: Decimal,
    forced_enter_symbol: str | None,
) -> str | None:
    if position.stop_loss is not None and current_price <= position.stop_loss:
        return "STOP_HIT"
    if position.target_price is not None and current_price >= position.target_price:
        return "TARGET_HIT"
    if signal is not None and _effective_final_decision(signal, forced_enter_symbol) == "EXIT":
        return "EXIT_SIGNAL"
    return None


def _close_position(
    session: Session,
    account: PaperAccount,
    position: PaperPosition,
    current_price: Decimal,
    close_reason: str,
    closed_at: datetime,
) -> None:
    entry_value = position.entry_price * position.quantity
    exit_value = current_price * position.quantity
    pnl = exit_value - entry_value
    position.status = "CLOSED"
    position.closed_at = closed_at
    position.realized_pnl = pnl
    position.return_pct = pnl / entry_value if entry_value > ZERO else None
    position.close_reason = close_reason
    position.updated_at = closed_at
    account.cash_balance += exit_value
    account.realized_pnl += pnl
    account.updated_at = closed_at
    _add_event(
        session,
        account=account,
        position=position,
        symbol=position.symbol,
        event_type="CLOSE",
        event_reason=close_reason,
        price=current_price,
        quantity=position.quantity,
        cash_delta=exit_value,
        pnl_delta=pnl,
    )


def _add_event(
    session: Session,
    *,
    account: PaperAccount,
    position: PaperPosition | None,
    symbol: str,
    event_type: str,
    event_reason: str,
    price: Decimal | None,
    quantity: Decimal | None,
    cash_delta: Decimal | None,
    pnl_delta: Decimal | None,
) -> None:
    event = PaperTradeEvent(
        account_id=account.id,
        position_id=position.id if position is not None else None,
        symbol=symbol.upper(),
        event_type=event_type,
        event_reason=event_reason,
        price=price,
        quantity=quantity,
        cash_delta=cash_delta,
        pnl_delta=pnl_delta,
    )
    session.add(event)


def _price_for_position(position: PaperPosition, signal: ScannerSignal | None) -> Decimal:
    if signal is not None:
        price = _decimal_or_none(signal.price)
        if price is not None and price > ZERO:
            return price
    return position.entry_price


def _update_equity_value(
    account: PaperAccount,
    open_positions: list[PaperPosition],
    signals_by_symbol: dict[str, ScannerSignal],
) -> None:
    equity = ZERO
    for position in open_positions:
        equity += _price_for_position(position, signals_by_symbol.get(position.symbol.upper())) * position.quantity
    account.equity_value = equity


def _position_quantity(
    account: PaperAccount,
    entry_price: Decimal,
    stop_loss: Decimal | None,
    total_account_value: Decimal,
) -> Decimal | None:
    max_position_value = total_account_value * account.max_position_pct
    max_quantity = max_position_value / entry_price
    if stop_loss is not None and stop_loss < entry_price:
        risk_per_share = entry_price - stop_loss
        if risk_per_share > ZERO:
            risk_amount = account.cash_balance * account.risk_per_trade_pct
            return min(risk_amount / risk_per_share, max_quantity)
    return max_quantity


def _total_account_value(account: PaperAccount) -> Decimal:
    return account.cash_balance + account.equity_value


def _valid_stop_loss(entry_price: Decimal, stop_loss: Decimal | None) -> Decimal | None:
    if stop_loss is None or stop_loss <= ZERO or stop_loss >= entry_price:
        return None
    return stop_loss


def _valid_target_price(entry_price: Decimal, target_price: Decimal | None) -> Decimal | None:
    if target_price is None or target_price <= entry_price:
        return None
    return target_price


def _decimal_or_none(value: object) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value if value.is_finite() else None
    try:
        decimal_value = Decimal(str(value).replace("$", "").replace(",", "").replace("%", "").strip())
    except (InvalidOperation, ValueError):
        return None
    return decimal_value if decimal_value.is_finite() else None


def _normalized(value: object) -> str:
    return str(value or "").strip().upper()


def _forced_enter_symbol() -> str | None:
    # TEST-ONLY: lets the paper engine simulate an ENTER signal without changing scanner output.
    symbol = os.environ.get("FORCE_ENTER_SYMBOL", "").strip().upper()
    return symbol or None


def _effective_final_decision(signal: ScannerSignal, forced_enter_symbol: str | None) -> str:
    if forced_enter_symbol is not None and signal.symbol.upper() == forced_enter_symbol:
        return "ENTER"
    return _normalized(signal.final_decision)
