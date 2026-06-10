from __future__ import annotations

import json
import os
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import pandas as pd

from .safety import atomic_write_dataframe_csv

ScannerDropState = Literal[
    "ranked",
    "filtered_liquidity",
    "filtered_market_cap",
    "filtered_stale",
    "filtered_low_confidence",
    "provider_unavailable",
    "provider_partial",
    "writeback_failed",
    "deduplicated",
    "unknown",
]

DROP_STATES: tuple[ScannerDropState, ...] = (
    "ranked",
    "filtered_liquidity",
    "filtered_market_cap",
    "filtered_stale",
    "filtered_low_confidence",
    "provider_unavailable",
    "provider_partial",
    "writeback_failed",
    "deduplicated",
    "unknown",
)


@dataclass
class ScannerDropRecord:
    selected_index: int
    symbol: str
    state: ScannerDropState
    detail: str
    price_history_rows: int | None = None
    data_timestamp: str = ""
    provider: str = ""
    provider_error: str = ""
    avg_dollar_volume: float | None = None
    market_cap: float | None = None
    final_score: float | None = None


class ScannerAccounting:
    def __init__(self, symbols: list[str]) -> None:
        self.started_at = datetime.now(timezone.utc)
        self.records: list[ScannerDropRecord] = []
        self.symbols_to_scan: list[str] = []
        self._record_by_symbol: dict[str, ScannerDropRecord] = {}
        seen: set[str] = set()

        for index, raw_symbol in enumerate(symbols, start=1):
            symbol = str(raw_symbol).strip().upper()
            record = ScannerDropRecord(selected_index=index, symbol=symbol, state="unknown", detail="selected")
            self.records.append(record)
            if not symbol:
                record.state = "provider_unavailable"
                record.detail = "empty symbol selected"
                continue
            if symbol in seen:
                record.state = "deduplicated"
                record.detail = "duplicate selected symbol"
                continue
            seen.add(symbol)
            self.symbols_to_scan.append(symbol)
            self._record_by_symbol[symbol] = record

    def mark(
        self,
        symbol: str,
        state: ScannerDropState,
        detail: str,
        *,
        frame: pd.DataFrame | None = None,
        provider: str = "",
        provider_error: str = "",
        avg_dollar_volume: float | None = None,
        market_cap: float | None = None,
        final_score: float | None = None,
    ) -> None:
        record = self._record_by_symbol.get(symbol.upper())
        if record is None:
            return
        record.state = state
        record.detail = detail
        if frame is not None:
            record.price_history_rows = int(len(frame)) if not frame.empty else 0
            record.data_timestamp = _frame_timestamp(frame)
            metadata = _frame_provider_metadata(frame)
            if not provider:
                provider = str(metadata.get("data_provider") or "")
            if not provider_error:
                provider_error = str(metadata.get("provider_error") or "")
        record.provider = provider
        record.provider_error = provider_error
        record.avg_dollar_volume = _finite_float_or_none(avg_dollar_volume)
        record.market_cap = _finite_float_or_none(market_cap)
        record.final_score = _finite_float_or_none(final_score)

    def mark_ranked(
        self,
        symbol: str,
        *,
        frame: pd.DataFrame | None = None,
        avg_dollar_volume: float | None = None,
        market_cap: float | None = None,
        final_score: float | None = None,
    ) -> None:
        self.mark(
            symbol,
            "ranked",
            "ranked and included in full_ranking.csv",
            frame=frame,
            avg_dollar_volume=avg_dollar_volume,
            market_cap=market_cap,
            final_score=final_score,
        )

    def mark_ranked_writeback_failed(self, detail: str) -> None:
        for record in self.records:
            if record.state == "ranked":
                record.state = "writeback_failed"
                record.detail = detail

    def summary(self) -> dict[str, object]:
        counts = Counter(record.state for record in self.records)
        normalized_counts = {state: int(counts.get(state, 0)) for state in DROP_STATES}
        selected = len(self.records)
        ranked = normalized_counts["ranked"]
        accounted = selected - normalized_counts["unknown"]
        return {
            "started_at": self.started_at.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "selected": selected,
            "unique_to_scan": len(self.symbols_to_scan),
            "ranked": ranked,
            "accounted": accounted,
            "unknown": normalized_counts["unknown"],
            "counts": normalized_counts,
            "unknown_symbols": [record.symbol for record in self.records if record.state == "unknown"],
        }

    def to_rows(self) -> list[dict[str, object]]:
        return [asdict(record) for record in self.records]


def write_scanner_accounting_report(accounting: ScannerAccounting, outdir: Path) -> dict[str, object]:
    outdir.mkdir(parents=True, exist_ok=True)
    summary = accounting.summary()
    rows = accounting.to_rows()
    csv_path = outdir / "scanner_drop_reasons.csv"
    json_path = outdir / "scanner_drop_reasons.json"
    history_dir = outdir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    history_csv_path = history_dir / f"drop_reasons_{stamp}.csv"
    history_json_path = history_dir / f"drop_reasons_{stamp}.json"
    frame = pd.DataFrame(rows)
    atomic_write_dataframe_csv(frame, csv_path, index=False)
    atomic_write_dataframe_csv(frame, history_csv_path, index=False)
    payload: dict[str, object] = {"summary": summary, "rows": rows}
    _atomic_write_json(json_path, payload)
    _atomic_write_json(history_json_path, payload)
    print(
        "[scanner] accounting:"
        f" selected={summary['selected']}"
        f" accounted={summary['accounted']}"
        f" ranked={summary['ranked']}"
        f" unknown={summary['unknown']}"
        f" report={csv_path}"
    )
    return {"summary": summary, "csv_path": str(csv_path), "json_path": str(json_path)}


def _atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.{os.getpid()}.{datetime.now(timezone.utc).timestamp():.6f}.tmp")
    try:
        tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def _frame_timestamp(frame: pd.DataFrame) -> str:
    if frame.empty:
        return ""
    try:
        return pd.Timestamp(frame.index[-1]).isoformat()
    except Exception:
        return ""


def _frame_provider_metadata(frame: pd.DataFrame) -> dict[str, object]:
    raw = frame.attrs.get("provider_metadata")
    if isinstance(raw, dict):
        return {str(key): value for key, value in raw.items()}
    return {}


def _finite_float_or_none(value: float | None) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed
