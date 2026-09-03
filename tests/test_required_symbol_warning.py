"""The warning that would have caught SNDK four weeks earlier.

SNDK was added to REQUIRED_OPPORTUNITY_SYMBOLS on 2026-08-06. Production ran
without it until it was noticed by a user, because production executes the
scanner from a container image built on 2026-06-10 whose copy of the universe
CSV predates the change. The symbol was not in the drop reason ledger either --
the ledger only accounts for symbols that were selected, and SNDK never was.

So there was no signal anywhere. These tests pin the signal.
"""

from __future__ import annotations

import io
import unittest
from contextlib import redirect_stdout

from scanner.universe import REQUIRED_OPPORTUNITY_SYMBOLS, build_universe, warn_missing_required_symbols


class RequiredSymbolWarningTest(unittest.TestCase):
    def test_the_current_universe_is_complete_and_silent(self) -> None:
        universe = build_universe("500")
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            missing = warn_missing_required_symbols(universe)
        self.assertEqual(missing, [], "the checked-in universe should cover every required symbol")
        self.assertEqual(buffer.getvalue(), "", "a complete universe must not print a warning")

    def test_the_sndk_case_reproduced(self) -> None:
        """The exact production state: everything present except SNDK."""
        universe = [symbol for symbol in build_universe("500") if symbol != "SNDK"]
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            missing = warn_missing_required_symbols(universe)
        self.assertEqual(missing, ["SNDK"])
        output = buffer.getvalue()
        self.assertIn("SNDK", output)
        self.assertIn("WARNING", output)

    def test_it_names_every_missing_symbol_not_just_the_first(self) -> None:
        universe = [symbol for symbol in build_universe("500") if symbol not in {"SNDK", "IONQ", "RKLB"}]
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            missing = warn_missing_required_symbols(universe)
        self.assertEqual(sorted(missing), ["IONQ", "RKLB", "SNDK"])
        for symbol in ("IONQ", "RKLB", "SNDK"):
            self.assertIn(symbol, buffer.getvalue())

    def test_it_does_not_abort_the_scan(self) -> None:
        """A missing symbol is worth shouting about, not worth losing a scan over."""
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            missing = warn_missing_required_symbols([])
        self.assertEqual(sorted(missing), sorted(REQUIRED_OPPORTUNITY_SYMBOLS))


if __name__ == "__main__":
    unittest.main()
