"""Threshold calibration sweep for the scanner's final decision layer.

Question this answers: the entry gate requires final_score >= 80, and in the
latest production scan nothing that survived the earlier gates scored above
77.5, so the scanner emits zero ENTER rows. Is 80 miscalibrated, or is it
correctly refusing bad trades?

Method: take historical signals that already passed the setup gate, re-evaluate
the *post-setup* gates at a grid of thresholds, and join the resulting entries
to their realized forward returns. Every number below is measured, not assumed.

Honest limits, stated up front:
  - This does NOT re-run the setup engine. Rows whose setup_type was already
    forced to AVOID (including by the stale-data veto) cannot be recovered here;
    answering the stale-window question needs a scanner re-run, not this sweep.
  - It only re-evaluates gates whose inputs were recorded in the signal payload.
  - Forward returns exist only for signals old enough to have matured, so recent
    scans contribute nothing.

Usage:
    DATABASE_URL=postgresql://... .venv/bin/python tools/analysis/calibration_sweep.py
    ... --horizon 5d --min-samples 30 --out docs/analysis/calibration-sweep.json
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import statistics
import sys
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# Imported lazily inside load_signals so the pure gate logic below stays
# importable and testable in environments without a database driver.


# forward_returns.return_pct is stored as a FRACTION (exit/base - 1.0) despite the
# column name; see scanner/analysis.py. Converted to percent once, on load, so every
# number this tool prints is a real percentage.
RETURN_SCALE = 100.0


SEVERE_VETO_CODES: frozenset[str] = frozenset({
    "STALE_DATA",
    "LOW_CONFIDENCE_DATA",
    "PROVIDER_ERROR",
    "EXTREME_VOLATILITY",
    "POOR_RISK_REWARD",
    "STOP_RISK",
    "RISK_OFF_MARKET",
    "BEAR_MARKET",
})

# Production defaults, mirrored from scanner/engine.py so the sweep starts from
# the live configuration rather than a guess.
DEFAULT_BUY_SCORE = 80.0
DEFAULT_CONFIDENCE = 70.0


@dataclass(frozen=True)
class Signal:
    symbol: str
    setup_type: str
    final_score: Optional[float]
    confidence: Optional[float]
    setup_strength: Optional[float]
    vetoes: frozenset[str]
    horizon: str
    return_pct: float


@dataclass(frozen=True)
class Outcome:
    entries: int
    mean_return: Optional[float]
    median_return: Optional[float]
    hit_rate: Optional[float]
    worst_decile: Optional[float]


def parse_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        result = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    if result != result:  # NaN
        return None
    return result


def parse_vetoes(value: object) -> frozenset[str]:
    """Veto lists are stored as JSON arrays or python-ish strings in the payload."""
    if value is None:
        return frozenset()
    if isinstance(value, list):
        return frozenset(str(item).strip().upper() for item in value if str(item).strip())
    text = str(value).strip()
    if not text:
        return frozenset()
    for ch in "[]'\"":
        text = text.replace(ch, "")
    return frozenset(part.strip().upper() for part in text.split(",") if part.strip())


EXPORT_SQL = """\\copy (
  SELECT ss.symbol,
         coalesce(ss.setup_type,'')      AS setup_type,
         ss.payload->>'final_score'      AS final_score,
         ss.payload->>'confidence_score' AS confidence_score,
         ss.payload->>'setup_strength'   AS setup_strength,
         ss.payload->>'vetoes'           AS vetoes,
         fr.horizon,
         fr.return_pct
  FROM forward_returns fr
  JOIN scanner_signals ss ON ss.id = fr.scanner_signal_id
  WHERE fr.return_pct IS NOT NULL
) TO STDOUT WITH CSV HEADER"""


def load_signals_from_csv(path: str, horizon: Optional[str]) -> List[Signal]:
    """Load the joined dataset exported by EXPORT_SQL.

    Preferred over a live connection: psql exists in the database container on
    every deployment, while a Python driver does not, and the exported file can
    be reviewed and re-analysed without touching production again.
    """
    signals: List[Signal] = []
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            raw_return = parse_float(row.get("return_pct"))
            if raw_return is None:
                continue
            return_pct = raw_return * RETURN_SCALE
            row_horizon = str(row.get("horizon") or "")
            if horizon is not None and row_horizon != horizon:
                continue
            signals.append(Signal(
                symbol=str(row.get("symbol") or ""),
                setup_type=str(row.get("setup_type") or "").upper(),
                final_score=parse_float(row.get("final_score")),
                confidence=parse_float(row.get("confidence_score")),
                setup_strength=parse_float(row.get("setup_strength")),
                vetoes=parse_vetoes(row.get("vetoes")),
                horizon=row_horizon,
                return_pct=return_pct,
            ))
    return signals


def load_signals(dsn: str, horizon: Optional[str], limit: int) -> List[Signal]:
    sql = """
        SELECT
            ss.symbol,
            coalesce(ss.setup_type, '') AS setup_type,
            ss.payload->>'final_score'      AS final_score,
            ss.payload->>'confidence_score' AS confidence_score,
            ss.payload->>'setup_strength'   AS setup_strength,
            ss.payload->>'vetoes'           AS vetoes,
            fr.horizon,
            fr.return_pct
        FROM forward_returns fr
        JOIN scanner_signals ss ON ss.id = fr.scanner_signal_id
        WHERE fr.return_pct IS NOT NULL
          AND (%(horizon)s IS NULL OR fr.horizon = %(horizon)s)
        ORDER BY fr.signal_date DESC
        LIMIT %(limit)s
    """
    try:
        import psycopg
    except ImportError:  # pragma: no cover - environment guard
        print("psycopg is required: pip install 'psycopg[binary]'", file=sys.stderr)
        raise SystemExit(2)

    signals: List[Signal] = []
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"horizon": horizon, "limit": limit})
            for row in cur.fetchall():
                raw_return = parse_float(row[7])
                if raw_return is None:
                    continue
                return_pct = raw_return * RETURN_SCALE
                signals.append(Signal(
                    symbol=str(row[0]),
                    setup_type=str(row[1]).upper(),
                    final_score=parse_float(row[2]),
                    confidence=parse_float(row[3]),
                    setup_strength=parse_float(row[4]),
                    vetoes=parse_vetoes(row[5]),
                    horizon=str(row[6] or ""),
                    return_pct=return_pct,
                ))
    return signals


def would_enter(
    signal: Signal,
    buy_score: float,
    confidence: float,
    severe_codes: frozenset[str],
) -> bool:
    """Mirror the post-setup gates in scanner/engine.py, in the same order."""
    if signal.setup_type == "AVOID" or not signal.setup_type:
        return False
    if signal.vetoes & severe_codes:
        return False
    if signal.final_score is None or signal.final_score < buy_score:
        return False
    if signal.confidence is None or signal.confidence < confidence:
        return False
    return True


def summarize(returns: Sequence[float]) -> Outcome:
    if not returns:
        return Outcome(0, None, None, None, None)
    ordered = sorted(returns)
    decile_index = max(0, int(len(ordered) * 0.1) - 1)
    return Outcome(
        entries=len(ordered),
        mean_return=round(statistics.fmean(ordered), 3),
        median_return=round(statistics.median(ordered), 3),
        hit_rate=round(sum(1 for value in ordered if value > 0) / len(ordered) * 100, 1),
        worst_decile=round(ordered[decile_index], 3),
    )


def baseline(signals: Iterable[Signal]) -> Outcome:
    """Every matured signal, regardless of gates - the do-nothing comparison."""
    return summarize([signal.return_pct for signal in signals])


def sweep(
    signals: Sequence[Signal],
    scores: Sequence[float],
    confidences: Sequence[float],
    veto_sets: Sequence[Tuple[str, frozenset[str]]],
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for veto_label, veto_codes in veto_sets:
        for score in scores:
            for conf in confidences:
                matched = [s.return_pct for s in signals if would_enter(s, score, conf, veto_codes)]
                outcome = summarize(matched)
                results.append({
                    "vetoPolicy": veto_label,
                    "buyScoreThreshold": score,
                    "confidenceThreshold": conf,
                    "entries": outcome.entries,
                    "meanReturnPct": outcome.mean_return,
                    "medianReturnPct": outcome.median_return,
                    "hitRatePct": outcome.hit_rate,
                    "worstDecilePct": outcome.worst_decile,
                })
    return results


def print_table(rows: Sequence[Dict[str, Any]], base: Outcome, min_samples: int) -> None:
    print(f"{'veto policy':<18}{'score':>7}{'conf':>7}{'entries':>9}{'mean%':>9}{'median%':>9}{'hit%':>8}{'p10%':>9}")
    print("-" * 76)
    for row in rows:
        flag = "" if row["entries"] >= min_samples else "  (thin)"
        print(
            f"{row['vetoPolicy']:<18}"
            f"{row['buyScoreThreshold']:>7.0f}"
            f"{row['confidenceThreshold']:>7.0f}"
            f"{row['entries']:>9}"
            f"{_fmt(row['meanReturnPct']):>9}"
            f"{_fmt(row['medianReturnPct']):>9}"
            f"{_fmt(row['hitRatePct']):>8}"
            f"{_fmt(row['worstDecilePct']):>9}"
            f"{flag}"
        )
    print("-" * 76)
    print(
        f"{'ALL MATURED':<18}{'-':>7}{'-':>7}{base.entries:>9}"
        f"{_fmt(base.mean_return):>9}{_fmt(base.median_return):>9}"
        f"{_fmt(base.hit_rate):>8}{_fmt(base.worst_decile):>9}   <- baseline"
    )
    print()
    print("A threshold only earns a change if it beats the baseline on mean AND")
    print("does not blow out the worst decile. More entries is not better.")


def _fmt(value: Optional[float]) -> str:
    return "-" if value is None else f"{value:.2f}"


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--horizon", default=None, help="Restrict to one forward horizon (e.g. 5d)")
    parser.add_argument("--limit", type=int, default=200000, help="Max joined rows to load")
    parser.add_argument("--min-samples", type=int, default=30, help="Flag configurations below this entry count")
    parser.add_argument("--out", default=None, help="Write the full result set as JSON here")
    parser.add_argument("--from-csv", default=None, help="Analyse a CSV exported with --print-export-sql")
    parser.add_argument("--print-export-sql", action="store_true", help="Print the psql \\copy command and exit")
    args = parser.parse_args(argv)

    if args.print_export_sql:
        print(EXPORT_SQL)
        return 0

    if args.from_csv:
        signals = load_signals_from_csv(args.from_csv, args.horizon)
    else:
        dsn = os.environ.get("DATABASE_URL") or os.environ.get("SCANNER_DATABASE_URL")
        if not dsn:
            print("Pass --from-csv, or set DATABASE_URL for a live connection.", file=sys.stderr)
            return 2
        dsn = dsn.replace("postgresql+psycopg://", "postgresql://")
        signals = load_signals(dsn, args.horizon, args.limit)
    if not signals:
        print("No matured signals joined to forward returns. Nothing to calibrate yet.")
        return 1

    horizons = sorted({signal.horizon for signal in signals})
    passed_setup = sum(1 for signal in signals if signal.setup_type not in ("AVOID", ""))
    print(f"loaded {len(signals)} matured signals | horizons: {', '.join(horizons)}")
    print(f"passed the setup gate: {passed_setup} ({passed_setup / len(signals) * 100:.1f}%)")
    print(f"production defaults: buy_score={DEFAULT_BUY_SCORE:.0f} confidence={DEFAULT_CONFIDENCE:.0f}")
    print()

    veto_sets: List[Tuple[str, frozenset[str]]] = [
        ("production", SEVERE_VETO_CODES),
        ("without stale", SEVERE_VETO_CODES - {"STALE_DATA"}),
        ("data vetoes only", frozenset({"STALE_DATA", "LOW_CONFIDENCE_DATA", "PROVIDER_ERROR"})),
    ]
    scores = [80.0, 78.0, 76.0, 74.0, 72.0, 70.0]
    confidences = [70.0, 65.0, 60.0]

    rows = sweep(signals, scores, confidences, veto_sets)
    base = baseline(signals)
    print_table(rows, base, args.min_samples)

    if args.out:
        payload: Dict[str, Any] = {
            "signalsLoaded": len(signals),
            "passedSetupGate": passed_setup,
            "horizons": horizons,
            "productionDefaults": {"buyScore": DEFAULT_BUY_SCORE, "confidence": DEFAULT_CONFIDENCE},
            "baseline": {
                "entries": base.entries,
                "meanReturnPct": base.mean_return,
                "medianReturnPct": base.median_return,
                "hitRatePct": base.hit_rate,
                "worstDecilePct": base.worst_decile,
            },
            "results": rows,
        }
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        print(f"\nwrote {args.out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
