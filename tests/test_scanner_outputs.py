from __future__ import annotations

import unittest

try:
    import pandas  # noqa: F401
except ModuleNotFoundError:  # pragma: no cover - local workstation without scanner deps
    has_pandas = False
else:
    has_pandas = True


@unittest.skipUnless(has_pandas, "pandas is required for scanner output tests")
class ScannerOutputTests(unittest.TestCase):
    def test_operator_text_humanizes_diagnostic_codes(self) -> None:
        from scanner.outputs import readable_operator_text

        self.assertEqual(
            readable_operator_text("Entry blocked by veto: OVERHEATED_MARKET"),
            "Entry blocked by veto: Overheated Market",
        )
        self.assertEqual(
            readable_operator_text("LOW_CONFIDENCE_DATA requires another scan"),
            "Low Confidence Data requires another scan",
        )


if __name__ == "__main__":
    unittest.main()
