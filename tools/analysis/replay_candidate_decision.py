"""Replay the candidate decision engine against real production rows.

Reads two relay exports -- one scan run's `scanner_signals` rows, and daily
OHLCV for a stratified symbol sample from `symbol_price_history` -- and runs
the real `pre_expansion` and `candidate_decision` modules over them. Nothing
is written anywhere; this reads exports and prints.

Three fields the live engine uses are **not persisted** in `scanner_signals`:
`vetoes`, `confidence_score` and `setup_detail`. This replay therefore cannot
exercise the severe/advisory veto split or the confidence gate, and falls back
to `setup_type` for the shape. Both absences make the candidate look *more*
permissive here than it will be in production, never less:

  * no vetoes    -> the SEVERE_VETO block never fires
  * no confidence -> the LOW_CONFIDENCE gate is skipped (NaN comparison)
  * no setup_detail -> shape is NONE for AVOID rows, so the RR floor is the
    generic 1.20 rather than the shape-specific one

Read every ENTER count below as an upper bound.
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

import pandas as pd

if "yfinance" not in sys.modules:  # pragma: no cover - import shim
    try:
        import yfinance  # noqa: F401
    except ModuleNotFoundError:
        sys.modules["yfinance"] = types.ModuleType("yfinance")

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scanner.candidate_decision import CandidateConfig, apply_candidate_decision, candidate_summary
from scanner.pre_expansion import apply_pre_expansion

SIGNAL_COLUMNS = [
    "symbol", "asset_type", "price", "rating", "action", "final_decision", "final_score",
    "setup_type", "entry_status", "recommendation_quality", "quality_score", "suggested_entry",
    "entry_distance_pct", "buy_zone", "stop_loss", "take_profit", "risk_reward", "market_regime",
]
BAR_COLUMNS = ["symbol", "date", "open", "high", "low", "close", "volume"]


def _rows(path: Path, width: int) -> list[list[str]]:
    out = []
    for line in path.read_text().splitlines():
        if line.startswith(("#", "$", "[relay]")) or not line.strip():
            continue
        parts = line.split("|")
        if len(parts) == width:
            out.append(parts)
    return out


def load_signals(path: Path) -> pd.DataFrame:
    frame = pd.DataFrame(_rows(path, len(SIGNAL_COLUMNS)), columns=SIGNAL_COLUMNS)
    for column in ("price", "final_score", "quality_score", "entry_distance_pct", "risk_reward"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    # take_profit is the engine's target field; the candidate reads
    # take_profit_zone, which is what the live frame calls it in memory.
    frame["take_profit_zone"] = frame["take_profit"]
    frame["composite_action"] = frame["action"]
    return frame


def load_prices(path: Path) -> dict[str, pd.DataFrame]:
    frame = pd.DataFrame(_rows(path, len(BAR_COLUMNS)), columns=BAR_COLUMNS)
    for column in ("open", "high", "low", "close", "volume"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["date"] = pd.to_datetime(frame["date"])
    out: dict[str, pd.DataFrame] = {}
    for symbol, group in frame.groupby("symbol"):
        bars = group.sort_values("date").set_index("date")[["open", "high", "low", "close", "volume"]]
        out[str(symbol).upper()] = bars
    return out


def main() -> int:
    root = Path(__file__).resolve().parents[2] / ".tvops" / "out"
    signals = load_signals(root / "0150.out")
    prices = load_prices(root / "0153.out")

    sample = signals[signals["symbol"].str.upper().isin(prices)].reset_index(drop=True)
    print(f"scan rows={len(signals)}  sample with price history={len(sample)}  symbols={len(prices)}")
    print()

    enriched = apply_pre_expansion(sample, prices)
    result = apply_candidate_decision(enriched, CandidateConfig(mode="candidate"))

    print("--- live decisions on this sample ---")
    print(result["final_decision"].value_counts().to_string())
    print()
    print("--- candidate decisions on the same rows ---")
    summary = candidate_summary(result.rename(columns={"final_decision": "_live"}).assign(
        candidate_decision=result["candidate_decision"]))
    for name, count in (summary["by_decision"] or {}).items():
        print(f"{name:>14}  {count}")
    print(f"enter_already_expanded={summary['enter_already_expanded']}  (0 by construction)")
    print()

    print("--- pre-expansion coverage ---")
    available = result["pre_expansion_available"].astype(bool)
    print(f"measurable={int(available.sum())}/{len(result)}  "
          f"already_expanded={int(result['pre_expansion_already_expanded'].astype(bool).sum())}")
    scores = pd.to_numeric(result["pre_expansion_score"], errors="coerce").dropna()
    if len(scores):
        print(f"score  min={scores.min():.1f}  p25={scores.quantile(.25):.1f}  "
              f"median={scores.median():.1f}  p75={scores.quantile(.75):.1f}  max={scores.max():.1f}")
    print()

    print("--- every row, live vs candidate ---")
    view = result[[
        "symbol", "final_score", "setup_type", "entry_status", "recommendation_quality",
        "risk_reward", "pre_expansion_score", "pre_expansion_already_expanded",
        "final_decision", "candidate_decision", "candidate_why",
    ]].copy()
    view["pre_expansion_score"] = pd.to_numeric(view["pre_expansion_score"], errors="coerce").round(1)
    view["final_score"] = view["final_score"].round(1)
    view["risk_reward"] = view["risk_reward"].round(2)
    view = view.sort_values("final_score", ascending=False)
    for _, row in view.iterrows():
        print(
            f"{row['symbol']:<8} score={row['final_score']:<6} rr={row['risk_reward']:<6} "
            f"setup={row['setup_type']:<12} entry={row['entry_status']:<12} "
            f"qual={row['recommendation_quality']:<12} pre={row['pre_expansion_score']} "
            f"expanded={bool(row['pre_expansion_already_expanded'])}"
        )
        print(f"         live={row['final_decision']:<14} candidate={row['candidate_decision']}")
        print(f"         why: {row['candidate_why']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
