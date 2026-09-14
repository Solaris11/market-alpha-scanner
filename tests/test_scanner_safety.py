from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from scanner.safety import scanner_lock_path, scanner_run_lock


class ScannerSafetyTests(unittest.TestCase):
    def test_nested_scanner_output_uses_shared_root_lock(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir) / "scanner_output"
            nested = root / "phase35c1_500_fresh"
            resolved_root = root.resolve(strict=False)

            self.assertEqual(scanner_lock_path(nested), resolved_root / "run.lock")
            self.assertEqual(scanner_lock_path(root), resolved_root / "run.lock")

    def test_lock_blocks_nested_output_runs_under_same_scanner_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir) / "scanner_output"
            first = root / "scheduled"
            second = root / "manual"

            with scanner_run_lock(first) as first_acquired:
                self.assertTrue(first_acquired)
                with scanner_run_lock(second) as second_acquired:
                    self.assertFalse(second_acquired)

    def test_configured_lock_path_overrides_output_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            configured = Path(tmpdir) / "global.lock"
            previous = os.environ.get("TRADEVETO_SCANNER_LOCK_PATH")
            os.environ["TRADEVETO_SCANNER_LOCK_PATH"] = str(configured)
            try:
                self.assertEqual(scanner_lock_path(Path(tmpdir) / "other"), configured)
            finally:
                if previous is None:
                    os.environ.pop("TRADEVETO_SCANNER_LOCK_PATH", None)
                else:
                    os.environ["TRADEVETO_SCANNER_LOCK_PATH"] = previous


if __name__ == "__main__":
    unittest.main()


class LockWaitTests(unittest.TestCase):
    """A FULL run waits for a held lock instead of skipping the day; a fast
    run (wait 0) still skips at once. The 21:30 UTC full scan was skipped on
    2026-09-14 because the fast-scan timer held the lock for ~5 minutes."""

    def test_zero_wait_skips_immediately(self) -> None:
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp:
            outdir = Path(tmp) / "scanner_output"
            slept: list[float] = []
            with scanner_run_lock(outdir) as first:
                self.assertTrue(first)
                with scanner_run_lock(outdir, wait_seconds=0.0, sleep=slept.append) as second:
                    self.assertFalse(second)
            self.assertEqual(slept, [])

    def test_waiting_run_acquires_once_the_lock_is_released(self) -> None:
        import tempfile
        from pathlib import Path

        from scanner.safety import scanner_lock_path

        with tempfile.TemporaryDirectory() as tmp:
            outdir = Path(tmp) / "scanner_output"
            lock_path = scanner_lock_path(outdir)
            slept: list[float] = []

            def release_on_second_poll(seconds: float) -> None:
                slept.append(seconds)
                if len(slept) == 2:
                    lock_path.unlink(missing_ok=True)  # the fast run finishes

            with scanner_run_lock(outdir) as first:
                self.assertTrue(first)
                with scanner_run_lock(outdir, wait_seconds=600.0, sleep=release_on_second_poll) as second:
                    self.assertTrue(second, "the full run should acquire the lock once the fast run is done")
                    self.assertEqual(len(slept), 2)
                # The waiting run owned the lock and released it; the outer
                # context must not fail on the missing file.

    def test_wait_gives_up_at_the_deadline(self) -> None:
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as tmp:
            outdir = Path(tmp) / "scanner_output"
            slept: list[float] = []
            with scanner_run_lock(outdir) as first:
                self.assertTrue(first)
                with scanner_run_lock(outdir, wait_seconds=1.0, sleep=slept.append) as second:
                    self.assertFalse(second)
            self.assertTrue(slept and all(s <= 1.0 for s in slept))

    def test_env_override_and_defaults(self) -> None:
        import os
        from datetime import timedelta

        from scanner.safety import FULL_RUN_LOCK_WAIT, LOCK_WAIT_ENV, lock_wait_seconds

        saved = os.environ.pop(LOCK_WAIT_ENV, None)
        try:
            self.assertEqual(lock_wait_seconds(), 0.0)
            self.assertEqual(lock_wait_seconds(FULL_RUN_LOCK_WAIT), 600.0)
            os.environ[LOCK_WAIT_ENV] = "45"
            self.assertEqual(lock_wait_seconds(FULL_RUN_LOCK_WAIT), 45.0)
            os.environ[LOCK_WAIT_ENV] = "not a number"
            self.assertEqual(lock_wait_seconds(timedelta(seconds=7)), 7.0)
        finally:
            os.environ.pop(LOCK_WAIT_ENV, None)
            if saved is not None:
                os.environ[LOCK_WAIT_ENV] = saved
