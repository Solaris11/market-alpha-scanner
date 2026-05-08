#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from database.market_memory import refresh_market_memory_snapshots
from database.session import session_scope


SNAPSHOT_RE = re.compile(r"^scan_(\d{8})_(\d{6})\.csv$")

SCAN_RUN_INSERT_SQL = text(
    """
    INSERT INTO scan_runs (
        started_at,
        completed_at,
        run_type,
        status,
        universe_count,
        symbols_scored,
        market_regime,
        breadth,
        leadership,
        metadata
    )
    VALUES (
        :started_at,
        :completed_at,
        'history_backfill',
        'success',
        :universe_count,
        :symbols_scored,
        :market_regime,
        :breadth,
        :leadership,
        CAST(:metadata AS jsonb)
    )
    RETURNING id
    """
)

SCAN_RUN_BY_SOURCE_SQL = text(
    """
    SELECT id
    FROM scan_runs
    WHERE run_type = 'history_backfill'
      AND metadata->>'source_file' = :source_file
    LIMIT 1
    """
)

SCAN_RUN_BY_TIMESTAMP_SQL = text(
    """
    SELECT id
    FROM scan_runs
    WHERE status = 'success'
      AND date_trunc('second', COALESCE(completed_at, created_at)) = date_trunc('second', CAST(:completed_at AS timestamptz))
    ORDER BY
      CASE WHEN run_type = 'history_backfill' THEN 1 ELSE 0 END ASC,
      created_at DESC
    LIMIT 1
    """
)

SCANNER_SIGNAL_UPSERT_SQL = text(
    """
    INSERT INTO scanner_signals (
        scan_run_id,
        rank_position,
        symbol,
        company_name,
        asset_type,
        sector,
        price,
        final_score,
        final_score_adjusted,
        rating,
        action,
        setup_type,
        entry_status,
        recommendation_quality,
        quality_score,
        final_decision,
        suggested_entry,
        entry_distance_pct,
        entry_zone_low,
        entry_zone_high,
        buy_zone,
        stop_loss,
        take_profit,
        conservative_target,
        risk_reward,
        market_regime,
        payload
    )
    VALUES (
        CAST(:scan_run_id AS uuid),
        :rank_position,
        :symbol,
        :company_name,
        :asset_type,
        :sector,
        :price,
        :final_score,
        :final_score_adjusted,
        :rating,
        :action,
        :setup_type,
        :entry_status,
        :recommendation_quality,
        :quality_score,
        :final_decision,
        :suggested_entry,
        :entry_distance_pct,
        :entry_zone_low,
        :entry_zone_high,
        :buy_zone,
        :stop_loss,
        :take_profit,
        :conservative_target,
        :risk_reward,
        :market_regime,
        CAST(:payload AS jsonb)
    )
    ON CONFLICT (scan_run_id, symbol)
    DO UPDATE SET
        rank_position = EXCLUDED.rank_position,
        company_name = EXCLUDED.company_name,
        asset_type = EXCLUDED.asset_type,
        sector = EXCLUDED.sector,
        price = EXCLUDED.price,
        final_score = EXCLUDED.final_score,
        final_score_adjusted = EXCLUDED.final_score_adjusted,
        rating = EXCLUDED.rating,
        action = EXCLUDED.action,
        setup_type = EXCLUDED.setup_type,
        entry_status = EXCLUDED.entry_status,
        recommendation_quality = EXCLUDED.recommendation_quality,
        quality_score = EXCLUDED.quality_score,
        final_decision = EXCLUDED.final_decision,
        suggested_entry = EXCLUDED.suggested_entry,
        entry_distance_pct = EXCLUDED.entry_distance_pct,
        entry_zone_low = EXCLUDED.entry_zone_low,
        entry_zone_high = EXCLUDED.entry_zone_high,
        buy_zone = EXCLUDED.buy_zone,
        stop_loss = EXCLUDED.stop_loss,
        take_profit = EXCLUDED.take_profit,
        conservative_target = EXCLUDED.conservative_target,
        risk_reward = EXCLUDED.risk_reward,
        market_regime = EXCLUDED.market_regime,
        payload = EXCLUDED.payload
    """
)


@dataclass(frozen=True)
class SnapshotFile:
    path: Path
    timestamp: datetime


@dataclass(frozen=True)
class BackfillStats:
    files: int
    rows: int
    unique_symbols: int
    earliest: datetime | None
    latest: datetime | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill historical scanner snapshots into Market Memory storage.")
    parser.add_argument("--history-dir", default="scanner_output/history", help="Directory containing scan_YYYYMMDD_HHMMSS.csv snapshots.")
    parser.add_argument("--apply", action="store_true", help="Write rows to the database. Omit for a dry-run summary.")
    parser.add_argument("--max-files", type=int, default=250, help="Maximum files to process. Use 0 to process all matching files.")
    parser.add_argument("--batch-size", type=int, default=500, help="Scanner signal rows per database batch.")
    parser.add_argument("--from-date", default="", help="Optional inclusive UTC date filter, YYYY-MM-DD.")
    parser.add_argument("--to-date", default="", help="Optional inclusive UTC date filter, YYYY-MM-DD.")
    return parser.parse_args()


def discover_snapshots(history_dir: Path, *, from_date: str, to_date: str, max_files: int) -> list[SnapshotFile]:
    snapshots: list[SnapshotFile] = []
    start = date_bound(from_date, end_of_day=False)
    end = date_bound(to_date, end_of_day=True)
    for path in sorted(history_dir.glob("scan_*.csv")):
        timestamp = timestamp_from_name(path.name)
        if timestamp is None:
            continue
        if start is not None and timestamp < start:
            continue
        if end is not None and timestamp > end:
            continue
        snapshots.append(SnapshotFile(path=path, timestamp=timestamp))
    if max_files > 0:
        return snapshots[:max_files]
    return snapshots


def date_bound(value: str, *, end_of_day: bool) -> datetime | None:
    text_value = value.strip()
    if not text_value:
        return None
    suffix = "T23:59:59+00:00" if end_of_day else "T00:00:00+00:00"
    return datetime.fromisoformat(f"{text_value}{suffix}")


def timestamp_from_name(name: str) -> datetime | None:
    match = SNAPSHOT_RE.match(name)
    if match is None:
        return None
    date_part, time_part = match.groups()
    parsed = datetime.strptime(f"{date_part}{time_part}", "%Y%m%d%H%M%S")
    return parsed.replace(tzinfo=timezone.utc)


def read_csv_rows(path: Path) -> list[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader: Iterable[Dict[str, str]] = csv.DictReader(handle)
        return [{str(key): str(value or "") for key, value in row.items() if key is not None} for row in reader]


def summarize(snapshots: Sequence[SnapshotFile]) -> BackfillStats:
    symbols: set[str] = set()
    rows = 0
    for snapshot in snapshots:
        snapshot_rows = read_csv_rows(snapshot.path)
        rows += len(snapshot_rows)
        for row in snapshot_rows:
            symbol = string_or_none(row.get("symbol"))
            if symbol is not None:
                symbols.add(symbol.upper())
    return BackfillStats(
        earliest=snapshots[0].timestamp if snapshots else None,
        files=len(snapshots),
        latest=snapshots[-1].timestamp if snapshots else None,
        rows=rows,
        unique_symbols=len(symbols),
    )


def apply_backfill(snapshots: Sequence[SnapshotFile], *, batch_size: int) -> BackfillStats:
    symbols: set[str] = set()
    row_count = 0
    with session_scope() as session:
        for snapshot in snapshots:
            rows = read_csv_rows(snapshot.path)
            row_count += len(rows)
            for row in rows:
                symbol = string_or_none(row.get("symbol"))
                if symbol is not None:
                    symbols.add(symbol.upper())
            scan_run_id = resolve_scan_run(session, snapshot, rows)
            upsert_signal_rows(session, scan_run_id, rows, batch_size=batch_size)
            refresh_market_memory_snapshots(session, scan_run_id)
    return BackfillStats(
        earliest=snapshots[0].timestamp if snapshots else None,
        files=len(snapshots),
        latest=snapshots[-1].timestamp if snapshots else None,
        rows=row_count,
        unique_symbols=len(symbols),
    )


def resolve_scan_run(session: Session, snapshot: SnapshotFile, rows: Sequence[Dict[str, str]]) -> UUID:
    source_file = snapshot.path.name
    existing_source = session.execute(SCAN_RUN_BY_SOURCE_SQL, {"source_file": source_file}).scalar_one_or_none()
    if isinstance(existing_source, UUID):
        return existing_source

    existing_timestamp = session.execute(SCAN_RUN_BY_TIMESTAMP_SQL, {"completed_at": snapshot.timestamp.isoformat()}).scalar_one_or_none()
    if isinstance(existing_timestamp, UUID):
        return existing_timestamp

    symbols = {string_or_none(row.get("symbol")) for row in rows}
    clean_symbols = {symbol.upper() for symbol in symbols if symbol is not None}
    metadata = {
        "backfill_version": "market_memory_v1",
        "source": "scanner_output/history",
        "source_file": source_file,
    }
    inserted = session.execute(
        SCAN_RUN_INSERT_SQL,
        {
            "breadth": common_value(rows, "breadth"),
            "completed_at": snapshot.timestamp,
            "leadership": common_value(rows, "leadership"),
            "market_regime": common_value(rows, "market_regime"),
            "metadata": json.dumps(metadata, separators=(",", ":")),
            "started_at": snapshot.timestamp,
            "symbols_scored": len(clean_symbols),
            "universe_count": len(clean_symbols),
        },
    ).scalar_one()
    if not isinstance(inserted, UUID):
        return UUID(str(inserted))
    return inserted


def upsert_signal_rows(session: Session, scan_run_id: UUID, rows: Sequence[Dict[str, str]], *, batch_size: int) -> None:
    params = [signal_params(scan_run_id, index, row) for index, row in enumerate(rows, start=1) if string_or_none(row.get("symbol")) is not None]
    for start in range(0, len(params), batch_size):
        chunk = params[start : start + batch_size]
        if chunk:
            session.execute(SCANNER_SIGNAL_UPSERT_SQL, chunk)


def signal_params(scan_run_id: UUID, rank_position: int, row: Dict[str, str]) -> dict[str, object]:
    symbol = string_or_none(row.get("symbol")) or ""
    return {
        "action": string_or_none(first_present(row, ("action", "composite_action", "mid_action", "short_action", "long_action"))),
        "asset_type": string_or_none(row.get("asset_type")),
        "buy_zone": string_or_none(first_present(row, ("buy_zone", "entry_zone"))),
        "company_name": string_or_none(first_present(row, ("company_name", "long_name", "short_name", "name"))),
        "conservative_target": number_or_none(row.get("conservative_target")),
        "entry_distance_pct": number_or_none(row.get("entry_distance_pct")),
        "entry_status": string_or_none(row.get("entry_status")),
        "entry_zone_high": number_or_none(first_present(row, ("entry_zone_high", "buy_zone_high"))),
        "entry_zone_low": number_or_none(first_present(row, ("entry_zone_low", "buy_zone_low"))),
        "final_decision": string_or_none(row.get("final_decision")),
        "final_score": number_or_none(row.get("final_score")),
        "final_score_adjusted": number_or_none(row.get("final_score_adjusted")),
        "market_regime": string_or_none(row.get("market_regime")),
        "payload": json.dumps(row, separators=(",", ":")),
        "price": number_or_none(row.get("price")),
        "quality_score": number_or_none(row.get("quality_score")),
        "rank_position": rank_position,
        "rating": string_or_none(row.get("rating")),
        "recommendation_quality": string_or_none(row.get("recommendation_quality")),
        "risk_reward": number_or_none(row.get("risk_reward")),
        "scan_run_id": str(scan_run_id),
        "sector": string_or_none(row.get("sector")),
        "setup_type": string_or_none(row.get("setup_type")),
        "stop_loss": number_or_none(row.get("stop_loss")),
        "suggested_entry": string_or_none(row.get("suggested_entry")),
        "symbol": symbol.upper(),
        "take_profit": number_or_none(first_present(row, ("take_profit", "take_profit_high", "conservative_target"))),
    }


def first_present(row: Dict[str, str], columns: Sequence[str]) -> str | None:
    for column in columns:
        value = string_or_none(row.get(column))
        if value is not None:
            return value
    return None


def common_value(rows: Sequence[Dict[str, str]], column: str) -> str | None:
    counts: dict[str, int] = {}
    for row in rows:
        value = string_or_none(row.get(column))
        if value is not None:
            counts[value] = counts.get(value, 0) + 1
    if not counts:
        return None
    return sorted(counts.items(), key=lambda item: item[1], reverse=True)[0][0]


def string_or_none(value: object) -> str | None:
    if value is None:
        return None
    text_value = str(value).strip()
    if not text_value or text_value.lower() in {"nan", "none", "null", "n/a", "na"}:
        return None
    return text_value


def number_or_none(value: object) -> float | None:
    text_value = string_or_none(value)
    if text_value is None:
        return None
    normalized = text_value.replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        parsed = float(normalized)
    except ValueError:
        return None
    if not parsed == parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed


def print_stats(prefix: str, stats: BackfillStats) -> None:
    earliest = stats.earliest.isoformat() if stats.earliest is not None else "none"
    latest = stats.latest.isoformat() if stats.latest is not None else "none"
    print(
        json.dumps(
            {
                "earliest": earliest,
                "files": stats.files,
                "latest": latest,
                "mode": prefix,
                "rows": stats.rows,
                "unique_symbols": stats.unique_symbols,
            },
            sort_keys=True,
        )
    )


def main() -> None:
    args = parse_args()
    history_dir = Path(str(args.history_dir)).expanduser()
    snapshots = discover_snapshots(history_dir, from_date=str(args.from_date), to_date=str(args.to_date), max_files=int(args.max_files))
    if not args.apply:
        print_stats("dry_run", summarize(snapshots))
        return
    print_stats("applied", apply_backfill(snapshots, batch_size=max(1, int(args.batch_size))))


if __name__ == "__main__":
    main()
