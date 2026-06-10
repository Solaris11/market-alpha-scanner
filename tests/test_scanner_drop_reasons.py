from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from scanner.drop_reasons import ScannerAccounting, write_scanner_accounting_report


class ScannerDropReasonTests(unittest.TestCase):
    def test_accounting_requires_terminal_state_for_each_selected_symbol(self) -> None:
        accounting = ScannerAccounting(["AMD", "NVDA", "AMD", "PENNY"])
        frame = pd.DataFrame(
            {"Close": [100.0, 101.0], "Volume": [1_000_000.0, 1_100_000.0]},
            index=pd.date_range("2026-01-01", periods=2, freq="D", tz="UTC"),
        )

        accounting.mark_ranked("AMD", frame=frame, avg_dollar_volume=100_000_000.0, market_cap=1_000_000_000.0, final_score=75.0)
        accounting.mark("NVDA", "provider_partial", "missing enough history", frame=frame)
        accounting.mark("PENNY", "filtered_liquidity", "average dollar volume below minimum", frame=frame, avg_dollar_volume=10_000.0)

        summary = accounting.summary()

        self.assertEqual(summary["selected"], 4)
        self.assertEqual(summary["accounted"], 4)
        self.assertEqual(summary["unknown"], 0)
        counts_obj = summary["counts"]
        self.assertIsInstance(counts_obj, dict)
        counts = {str(key): int(value) for key, value in counts_obj.items()} if isinstance(counts_obj, dict) else {}
        self.assertEqual(counts["ranked"], 1)
        self.assertEqual(counts["provider_partial"], 1)
        self.assertEqual(counts["filtered_liquidity"], 1)
        self.assertEqual(counts["deduplicated"], 1)

    def test_writeback_failure_reclassifies_ranked_rows(self) -> None:
        accounting = ScannerAccounting(["AMD", "NVDA"])
        accounting.mark_ranked("AMD", final_score=80.0)
        accounting.mark("NVDA", "filtered_market_cap", "market cap unavailable")

        accounting.mark_ranked_writeback_failed("database write failed")
        summary = accounting.summary()
        counts_obj = summary["counts"]
        self.assertIsInstance(counts_obj, dict)
        counts = {str(key): int(value) for key, value in counts_obj.items()} if isinstance(counts_obj, dict) else {}

        self.assertEqual(summary["unknown"], 0)
        self.assertEqual(counts["ranked"], 0)
        self.assertEqual(counts["writeback_failed"], 1)
        self.assertEqual(counts["filtered_market_cap"], 1)

    def test_report_writes_current_and_history_artifacts(self) -> None:
        accounting = ScannerAccounting(["AMD", "NVDA"])
        accounting.mark_ranked("AMD", final_score=80.0)
        accounting.mark("NVDA", "provider_unavailable", "no provider frame")

        with tempfile.TemporaryDirectory() as tmp:
            outdir = Path(tmp)
            report = write_scanner_accounting_report(accounting, outdir)
            csv_path = Path(str(report["csv_path"]))
            json_path = Path(str(report["json_path"]))

            self.assertTrue(csv_path.exists())
            self.assertTrue(json_path.exists())
            self.assertTrue(list((outdir / "history").glob("drop_reasons_*.csv")))
            self.assertTrue(list((outdir / "history").glob("drop_reasons_*.json")))
            payload = json.loads(json_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["summary"]["selected"], 2)
            self.assertEqual(payload["summary"]["unknown"], 0)


if __name__ == "__main__":
    unittest.main()
