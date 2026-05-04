#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import psycopg


@dataclass(frozen=True)
class SignalComparisonRow:
    rank: int
    symbol: str
    score: float | None
    action: str


@dataclass(frozen=True)
class Mismatch:
    rank: int
    field: str
    csv_value: str
    db_value: str


def normalize_database_url(value: str) -> str:
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


def clean_text(value: object) -> str:
    text = str(value or "").strip()
    return "" if text.lower() in {"nan", "none", "null", "n/a", "na"} else text


def number_or_none(value: object) -> float | None:
    text = clean_text(value).replace("$", "").replace(",", "").replace("%", "")
    if not text:
        return None
    try:
        parsed = float(text)
    except ValueError:
        return None
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed


def first_present(row: dict[str, str], keys: tuple[str, ...]) -> str:
    lowered = {key.lower(): value for key, value in row.items()}
    for key in keys:
        value = row.get(key) or lowered.get(key.lower())
        if clean_text(value):
            return clean_text(value)
    return ""


def read_csv_top_rows(path: Path, limit: int) -> list[SignalComparisonRow]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader: Iterable[dict[str, str]] = csv.DictReader(handle)
        rows: list[SignalComparisonRow] = []
        for rank, row in enumerate(reader, start=1):
            symbol = first_present(row, ("symbol", "ticker", "Symbol", "Ticker")).upper()
            if not symbol:
                continue
            rows.append(
                SignalComparisonRow(
                    rank=len(rows) + 1,
                    symbol=symbol,
                    score=number_or_none(first_present(row, ("final_score", "final_score_adjusted"))),
                    action=first_present(row, ("action", "composite_action", "mid_action", "short_action", "long_action")).upper(),
                )
            )
            if len(rows) >= limit:
                break
        return rows


def read_db_top_rows(database_url: str, limit: int) -> tuple[str, str, list[SignalComparisonRow]]:
    with psycopg.connect(normalize_database_url(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id::text AS id, completed_at::text AS completed_at
                FROM scan_runs
                WHERE status = 'success'
                ORDER BY completed_at DESC NULLS LAST, created_at DESC
                LIMIT 1
                """
            )
            run = cursor.fetchone()
            if run is None:
                return "", "", []
            run_id = clean_text(run[0])
            completed_at = clean_text(run[1])
            cursor.execute(
                """
                SELECT rank_position, symbol, final_score, action
                FROM scanner_signals
                WHERE scan_run_id = %s
                ORDER BY rank_position ASC NULLS LAST, final_score DESC NULLS LAST, symbol ASC
                LIMIT %s
                """,
                (run_id, limit),
            )
            rows = [
                SignalComparisonRow(
                    rank=int(row[0] or index),
                    symbol=clean_text(row[1]).upper(),
                    score=number_or_none(row[2]),
                    action=clean_text(row[3]).upper(),
                )
                for index, row in enumerate(cursor.fetchall(), start=1)
                if len(row) >= 4
            ]
            return run_id, completed_at, rows


def compare_rows(csv_rows: list[SignalComparisonRow], db_rows: list[SignalComparisonRow], tolerance: float) -> list[Mismatch]:
    mismatches: list[Mismatch] = []
    max_rows = max(len(csv_rows), len(db_rows))
    for index in range(max_rows):
        rank = index + 1
        csv_row = csv_rows[index] if index < len(csv_rows) else None
        db_row = db_rows[index] if index < len(db_rows) else None
        if csv_row is None or db_row is None:
            mismatches.append(Mismatch(rank, "row_count", str(csv_row), str(db_row)))
            continue
        if csv_row.symbol != db_row.symbol:
            mismatches.append(Mismatch(rank, "symbol", csv_row.symbol, db_row.symbol))
        csv_score = csv_row.score
        db_score = db_row.score
        if csv_score is None or db_score is None:
            if csv_score != db_score:
                mismatches.append(Mismatch(rank, "final_score", str(csv_score), str(db_score)))
        elif abs(csv_score - db_score) > tolerance:
            mismatches.append(Mismatch(rank, "final_score", f"{csv_score:.6f}", f"{db_score:.6f}"))
        if csv_row.action != db_row.action:
            mismatches.append(Mismatch(rank, "action", csv_row.action, db_row.action))
    return mismatches


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compare scanner CSV output with latest DB writeback rows.")
    parser.add_argument("--csv", default=os.getenv("SCANNER_CSV_PATH", "scanner_output/full_ranking.csv"))
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", ""))
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--tolerance", type=float, default=0.01)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"CSV file not found: {csv_path}", file=sys.stderr)
        return 2
    database_url = clean_text(args.database_url)
    if not database_url:
        print("DATABASE_URL is required.", file=sys.stderr)
        return 2

    csv_rows = read_csv_top_rows(csv_path, args.limit)
    run_id, completed_at, db_rows = read_db_top_rows(database_url, args.limit)
    mismatches = compare_rows(csv_rows, db_rows, args.tolerance)

    print(f"DB run: {run_id or 'none'} completed_at={completed_at or 'n/a'}")
    print(f"Compared top {args.limit}: csv_rows={len(csv_rows)} db_rows={len(db_rows)} tolerance={args.tolerance}")
    if mismatches:
        print("MISMATCHES:")
        for mismatch in mismatches:
            print(f"rank={mismatch.rank} field={mismatch.field} csv={mismatch.csv_value} db={mismatch.db_value}")
        return 1
    print("PASS: CSV and DB top rows match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
