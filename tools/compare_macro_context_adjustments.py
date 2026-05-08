from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Final

import pandas as pd

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scanner.regime import apply_regime_adjustments


DEFAULT_TARGETS: Final[tuple[str, ...]] = ("NVDA", "TSM", "AMD", "DDOG", "OXY", "SPY", "QQQ", "GLD", "USO", "BTC-USD", "BTC", "IBIT")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare bounded macro context score adjustments without running the scanner.")
    parser.add_argument("--csv", default="scanner_output/full_ranking.csv", help="Ranking CSV to read.")
    parser.add_argument("--regime-json", default="scanner_output/analysis/market_regime.json", help="Market regime JSON artifact.")
    parser.add_argument("--symbols", nargs="*", default=list(DEFAULT_TARGETS), help="Symbols to include in the comparison.")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"ranking CSV not found: {csv_path}")
    df = pd.read_csv(csv_path)
    if "base_score" in df.columns:
        df["final_score"] = pd.to_numeric(df["base_score"], errors="coerce")

    regime = _read_regime(Path(args.regime_json), df)
    adjusted = apply_regime_adjustments(df, regime)
    targets = {symbol.strip().upper() for symbol in args.symbols if symbol.strip()}
    rows = adjusted[adjusted["symbol"].astype(str).str.upper().isin(targets)].copy()
    if rows.empty:
        print("No requested symbols found in ranking CSV.")
        return 0

    rows["score_change"] = pd.to_numeric(rows["final_score"], errors="coerce") - pd.to_numeric(rows["base_score"], errors="coerce")
    columns = [
        "symbol",
        "base_score",
        "final_score",
        "score_change",
        "macro_alignment_score",
        "exchange_health_score",
        "sector_alignment_score",
        "macro_context_adjustment_total",
        "macro_context_reason_codes",
    ]
    print(rows[columns].sort_values("symbol").to_string(index=False))
    print("\nGuardrails: component bounds are macro +5/-8, exchange +3/-3, sector +4/-4, volatility 0/-5, liquidity +2/-5, conflict 0/-4, total +10/-18.")
    return 0


def _read_regime(path: Path, df: pd.DataFrame) -> dict[str, object]:
    if path.exists():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                return {str(key): value for key, value in payload.items()}
        except Exception:
            pass
    if "market_regime" in df.columns:
        first = df["market_regime"].dropna()
        if not first.empty:
            return {"regime": str(first.iloc[0])}
    return {"regime": "NEUTRAL"}


if __name__ == "__main__":
    raise SystemExit(main())
