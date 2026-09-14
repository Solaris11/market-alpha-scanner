from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

import pandas as pd


RUN_LOCK_FILENAME = "run.lock"
RUN_LOCK_ENV = "TRADEVETO_SCANNER_LOCK_PATH"
LOCK_STALE_AFTER = timedelta(minutes=30)
#: How long a FULL run waits for a fast run to release the lock before giving
#: up. The 21:30 UTC full scan (analysis + forward_returns) was skipped on
#: 2026-09-14 because the fast-scan timer, re-phased by a host reboot, held
#: the lock at 21:26:58-21:32; a fast scan takes ~5 minutes, so ten minutes
#: covers one full overlap with margin. Fast runs keep the old skip-at-once
#: behaviour: the next one is fifteen minutes away.
LOCK_WAIT_ENV = "TRADEVETO_SCANNER_LOCK_WAIT_SECONDS"
FULL_RUN_LOCK_WAIT = timedelta(minutes=10)
LOCK_POLL_INTERVAL = timedelta(seconds=15)
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


def scanner_lock_path(outdir: Path) -> Path:
    configured = os.getenv(RUN_LOCK_ENV)
    if configured:
        return Path(configured)

    resolved = outdir.resolve(strict=False)
    candidates = (resolved, *resolved.parents)
    for candidate in candidates:
        if candidate.name == "scanner_output":
            return candidate / RUN_LOCK_FILENAME
    return outdir / RUN_LOCK_FILENAME


def _lock_is_stale(lock_path: Path) -> bool:
    payload = _read_lock(lock_path)
    timestamp_text = str(payload.get("timestamp") or "")
    try:
        created_at = datetime.fromisoformat(timestamp_text.replace("Z", "+00:00"))
    except ValueError:
        created_at = None
    if created_at is not None and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return created_at is None or utc_now() - created_at > LOCK_STALE_AFTER


def lock_wait_seconds(default: timedelta = timedelta(0)) -> float:
    """Seconds a run waits for a held lock. `TRADEVETO_SCANNER_LOCK_WAIT_SECONDS`
    overrides the caller's default (0 = skip at once, as before)."""
    raw = os.getenv(LOCK_WAIT_ENV)
    if raw is None or not raw.strip():
        return max(0.0, default.total_seconds())
    try:
        return max(0.0, float(raw))
    except ValueError:
        return max(0.0, default.total_seconds())


@contextmanager
def scanner_run_lock(outdir: Path, wait_seconds: float = 0.0, sleep=None) -> Iterator[bool]:
    outdir.mkdir(parents=True, exist_ok=True)
    lock_path = scanner_lock_path(outdir)
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    acquired = False
    sleeper = sleep if sleep is not None else time.sleep
    deadline = utc_now() + timedelta(seconds=wait_seconds)

    while lock_path.exists():
        if _lock_is_stale(lock_path):
            print("[scanner] stale lock removed")
            lock_path.unlink(missing_ok=True)
            break
        remaining = (deadline - utc_now()).total_seconds()
        if remaining <= 0:
            print("[scanner] another run in progress, skipping")
            yield False
            return
        print(f"[scanner] another run in progress, waiting up to {remaining:.0f}s for the lock")
        sleeper(min(LOCK_POLL_INTERVAL.total_seconds(), remaining))

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
