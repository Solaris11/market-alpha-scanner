from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


CACHE_TTL = timedelta(hours=24)


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0


def symbol_cache_name(symbol: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", symbol.strip().upper())
    return normalized or "UNKNOWN"


def _cache_path(cache_dir: Path | None, namespace: str, symbol: str) -> Path | None:
    if cache_dir is None:
        return None
    return cache_dir / namespace / f"{symbol_cache_name(symbol)}.json"


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, np.integer):
        return int(value.item())
    if isinstance(value, np.floating):
        numeric_value = float(value.item())
        return None if np.isnan(numeric_value) or not np.isfinite(numeric_value) else numeric_value
    if isinstance(value, float):
        return None if np.isnan(value) or not np.isfinite(value) else value
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def _parse_cached_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def read_symbol_cache(cache_dir: Path | None, namespace: str, symbol: str) -> dict[str, object] | None:
    path = _cache_path(cache_dir, namespace, symbol)
    if path is None:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    fetched_at = _parse_cached_timestamp(payload.get("fetched_at"))
    if fetched_at is None or datetime.now(timezone.utc) - fetched_at > CACHE_TTL:
        return None
    data = payload.get("data")
    if isinstance(data, dict):
        return {str(key): item for key, item in data.items()}
    return None


def write_symbol_cache(cache_dir: Path | None, namespace: str, symbol: str, data: dict[str, object]) -> None:
    path = _cache_path(cache_dir, namespace, symbol)
    if path is None:
        return
    tmp_path: Path | None = None
    payload = {
        "symbol": symbol.strip().upper(),
        "namespace": namespace,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "data": _jsonable(data),
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_name(f"{path.name}.{os.getpid()}.{datetime.now(timezone.utc).timestamp():.6f}.tmp")
        tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    except Exception:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
