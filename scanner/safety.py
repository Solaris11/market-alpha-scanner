from __future__ import annotations

import json
import os
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

import pandas as pd


RUN_LOCK_FILENAME = "run.lock"
LOCK_STALE_AFTER = timedelta(minutes=30)
DATA_STALE_AFTER = timedelta(minutes=60)
REQUIRED_RANKING_COLUMNS = ("symbol", "price", "final_score", "rating", "action")


@dataclass(frozen=True)
class FileFreshness:
    path: Path
    status: str
    last_updated: datetime | None
    age_minutes: float | None


@dataclass(frozen=True)
class DataFreshness:
    status: str
    last_updated: datetime | None
    files: tuple[FileFreshness, ...]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _temp_path(path: Path) -> Path:
    return path.with_name(f"{path.name}.{os.getpid()}.{utc_now().timestamp():.6f}.tmp")


def atomic_write_dataframe_csv(df: pd.DataFrame, path: Path, index: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = _temp_path(path)
    try:
        df.to_csv(tmp_path, index=index)
        tmp_path.replace(path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def ensure_action_column(df: pd.DataFrame) -> pd.DataFrame:
    if "action" in df.columns:
        return df
    working = df.copy()
    for column in ("composite_action", "mid_action", "short_action", "long_action"):
        if column in working.columns:
            working["action"] = working[column]
            return working
    working["action"] = ""
    return working


def validate_ranking_schema(df: pd.DataFrame, label: str = "ranking data") -> bool:
    missing = [column for column in REQUIRED_RANKING_COLUMNS if column not in df.columns]
    if missing:
        print(f"[data] schema mismatch in {label}: missing columns {', '.join(missing)}")
        return False
    return True


def _file_freshness(path: Path, stale_after: timedelta = DATA_STALE_AFTER) -> FileFreshness:
    if not path.exists():
        return FileFreshness(path=path, status="missing", last_updated=None, age_minutes=None)
    modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    age = utc_now() - modified
    status = "stale" if age > stale_after else "fresh"
    return FileFreshness(path=path, status=status, last_updated=modified, age_minutes=age.total_seconds() / 60)


def check_data_freshness(outdir: Path, stale_after: timedelta = DATA_STALE_AFTER) -> DataFreshness:
    files = (
        _file_freshness(outdir / "full_ranking.csv", stale_after),
        _file_freshness(outdir / "top_candidates.csv", stale_after),
    )
    last_updated_values = [item.last_updated for item in files if item.last_updated is not None]
    last_updated = min(last_updated_values) if last_updated_values else None
    if any(item.status == "missing" for item in files):
        status = "missing"
    elif any(item.status == "stale" for item in files):
        status = "stale"
    else:
        status = "fresh"
    if status == "missing":
        missing = ", ".join(item.path.name for item in files if item.status == "missing")
        print(f"[data] missing: {missing}")
    elif status == "stale":
        oldest = max((item.age_minutes or 0 for item in files), default=0)
        print(f"[data] stale: last update {oldest:.0f} minutes ago")
    return DataFreshness(status=status, last_updated=last_updated, files=files)


def _read_lock(lock_path: Path) -> dict[str, object]:
    try:
        payload = json.loads(lock_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


@contextmanager
def scanner_run_lock(outdir: Path) -> Iterator[bool]:
    outdir.mkdir(parents=True, exist_ok=True)
    lock_path = outdir / RUN_LOCK_FILENAME
    acquired = False

    if lock_path.exists():
        payload = _read_lock(lock_path)
        timestamp_text = str(payload.get("timestamp") or "")
        try:
            created_at = datetime.fromisoformat(timestamp_text.replace("Z", "+00:00"))
        except ValueError:
            created_at = None
        if created_at is not None and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        is_stale = created_at is None or utc_now() - created_at > LOCK_STALE_AFTER
        if is_stale:
            print("[scanner] stale lock removed")
            lock_path.unlink(missing_ok=True)
        else:
            print("[scanner] another run in progress, skipping")
            yield False
            return

    payload = {"timestamp": utc_now().isoformat(), "pid": os.getpid()}
    try:
        fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        print("[scanner] another run in progress, skipping")
        yield False
        return

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as lock_file:
            lock_file.write(json.dumps(payload, indent=2))
        acquired = True
        print("[scanner] lock acquired")
        yield True
    finally:
        if acquired:
            lock_path.unlink(missing_ok=True)
            print("[scanner] lock released")
