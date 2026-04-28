from __future__ import annotations

import time


def timer_start() -> float:
    return time.perf_counter()


def log_timing(enabled: bool, phase: str, started_at: float) -> None:
    if not enabled:
        return
    elapsed = time.perf_counter() - started_at
    print(f"[perf] {phase} took {elapsed:.1f}s")
