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
