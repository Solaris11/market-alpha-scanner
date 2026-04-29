from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import func, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database.base import Base
from database.models import PaperPosition, PaperTradeEvent, ScanRun, ScannerSignal
from database.session import get_engine, session_scope
from scanner.paper_trading import run_paper_trading


def _add_avgo_scan(completed_at: datetime, price: Decimal) -> None:
    with session_scope() as session:
        scan_run = ScanRun(
            started_at=completed_at - timedelta(seconds=30),
            completed_at=completed_at,
            universe_count=1,
            symbols_scored=1,
            market_regime="TEST",
            breadth="TEST",
            leadership="TEST",
        )
        session.add(scan_run)
        session.flush()
        session.add(
            ScannerSignal(
                scan_run_id=scan_run.id,
                symbol="AVGO",
                company_name="Broadcom Test",
                asset_type="stock",
                sector="technology",
                price=price,
                final_score=Decimal("50"),
                final_score_adjusted=Decimal("50"),
                rating="HOLD",
                action="WAIT",
                setup_type="test",
                entry_status="OVEREXTENDED",
                recommendation_quality="AVOID",
                quality_score=Decimal("10"),
                final_decision="AVOID",
                suggested_entry=None,
                entry_distance_pct=None,
                buy_zone=None,
                stop_loss=Decimal("90"),
                conservative_target=Decimal("429.31"),
                risk_reward=Decimal("2"),
                market_regime="TEST",
            )
        )


def main() -> None:
    with TemporaryDirectory() as temp_dir:
        database_path = Path(temp_dir) / "paper_lifecycle_smoke.db"
        os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{database_path}"
        os.environ["FORCE_ENTER_SYMBOL"] = "AVGO"

        Base.metadata.create_all(get_engine())
        first_completed_at = datetime.now(timezone.utc)
        _add_avgo_scan(first_completed_at, Decimal("100"))
        first_result = run_paper_trading()
        assert first_result.opened_positions == 1

        with session_scope() as session:
            position = session.scalar(select(PaperPosition).where(PaperPosition.symbol == "AVGO"))
            assert position is not None
            assert position.status == "OPEN"
            position.target_price = position.entry_price * Decimal("0.99")

        _add_avgo_scan(first_completed_at + timedelta(minutes=1), Decimal("100"))
        second_result = run_paper_trading()
        assert second_result.closed_positions == 1
        assert second_result.opened_positions == 0

        with session_scope() as session:
            positions = list(session.scalars(select(PaperPosition).where(PaperPosition.symbol == "AVGO")).all())
            assert len(positions) == 1
            position = positions[0]
            assert position.status == "CLOSED"
            assert position.close_reason == "TARGET_HIT"
            assert position.exit_price == Decimal("100.0000000000") or position.exit_price == Decimal("100")

            close_events = session.scalar(
                select(func.count())
                .select_from(PaperTradeEvent)
                .where(
                    PaperTradeEvent.symbol == "AVGO",
                    PaperTradeEvent.event_type == "CLOSE",
                    PaperTradeEvent.event_reason == "TARGET_HIT",
                )
            )
            assert close_events == 1


if __name__ == "__main__":
    main()
