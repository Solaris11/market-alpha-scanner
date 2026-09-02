"""Holdout study of the scanner's entry score threshold.

Question: the entry gate requires final_score >= 80. Does that threshold, on
matured forward returns, select signals that do better than the scanner's own
universe - and how would a 55-70 band compare?

This script is the reproducible record behind docs/analysis/. It changes no
production behaviour and reads only an exported CSV.

Reproduce:
  1. Export on the production host (read-only):

     docker compose exec -T market-alpha-postgres \\
       sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > calibration-dated.csv <<'SQL'
     \\copy (SELECT ss.symbol, coalesce(ss.setup_type,'') AS setup_type,
                   ss.payload->>'final_score'      AS final_score,
                   ss.payload->>'confidence_score' AS confidence_score,
                   ss.payload->>'setup_strength'   AS setup_strength,
                   ss.payload->>'vetoes'           AS vetoes,
                   fr.horizon, fr.signal_date, fr.return_pct
            FROM forward_returns fr
            JOIN scanner_signals ss ON ss.id = fr.scanner_signal_id
            WHERE fr.return_pct IS NOT NULL AND fr.horizon IN ('5D','10D','20D')
     ) TO STDOUT WITH CSV HEADER
     SQL

  2. python3 tools/analysis/threshold_holdout_study.py --csv calibration-dated.csv \\
       --out docs/analysis/threshold-holdout-study.json
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

# Mirrors scanner/engine.py so the reconstructed funnel matches production order.
SEVERE_VETO_CODES = frozenset({
    "STALE_DATA", "LOW_CONFIDENCE_DATA", "PROVIDER_ERROR", "EXTREME_VOLATILITY",
    "POOR_RISK_REWARD", "STOP_RISK", "RISK_OFF_MARKET", "BEAR_MARKET",
})
PROD_SCORE_FLOOR = 80.0
PROD_CONFIDENCE_FLOOR = 70.0
PROPOSED_BAND = (55.0, 70.0)
HORIZONS = ("5D", "10D", "20D")
SPLIT_DATE = "2026-07-01"          # calibration < SPLIT_DATE <= holdout
RETURN_SCALE = 100.0               # return_pct is a fraction (exit/base - 1)
BOOTSTRAP_ITERATIONS = 2000
COST_SCENARIOS_BPS = (0.0, 5.0, 10.0, 25.0)


class Rows:
    """Column arrays for one horizon. Kept as numpy for the bootstrap."""

    def __init__(self, records: Sequence[Dict[str, Any]]) -> None:
        self.symbol = np.array([r["symbol"] for r in records], dtype=object)
        self.date = np.array([r["date"] for r in records], dtype=object)
        self.score = np.array([r["score"] for r in records], dtype=float)
        self.confidence = np.array([r["confidence"] for r in records], dtype=float)
        self.ret = np.array([r["ret"] for r in records], dtype=float)
        self.setup_ok = np.array([r["setup_ok"] for r in records], dtype=bool)
        self.veto_ok = np.array([r["veto_ok"] for r in records], dtype=bool)

    def __len__(self) -> int:
        return int(self.score.size)

    def mask(self, m: np.ndarray) -> "Rows":
        out = object.__new__(Rows)
        out.symbol = self.symbol[m]; out.date = self.date[m]
        out.score = self.score[m]; out.confidence = self.confidence[m]
        out.ret = self.ret[m]; out.setup_ok = self.setup_ok[m]; out.veto_ok = self.veto_ok[m]
        return out


def parse_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        result = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return None if result != result else result


def parse_vetoes(value: object) -> frozenset[str]:
    if not value:
        return frozenset()
    text = str(value)
    for ch in "[]'\"":
        text = text.replace(ch, "")
    return frozenset(p.strip().upper() for p in text.split(",") if p.strip())


def load(path: str) -> Dict[str, Rows]:
    buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    with open(path, newline="", encoding="utf-8") as handle:
        for raw in csv.DictReader(handle):
            score = parse_float(raw.get("final_score"))
            ret = parse_float(raw.get("return_pct"))
            date = (raw.get("signal_date") or "").strip()
            horizon = (raw.get("horizon") or "").strip()
            if score is None or ret is None or not date or horizon not in HORIZONS:
                continue
            vetoes = parse_vetoes(raw.get("vetoes"))
            setup = (raw.get("setup_type") or "").strip().upper()
            buckets[horizon].append({
                "symbol": (raw.get("symbol") or "").strip(),
                "date": date,
                "score": score,
                "confidence": parse_float(raw.get("confidence_score")) or float("nan"),
                "ret": ret * RETURN_SCALE,
                "setup_ok": setup not in ("AVOID", ""),
                "veto_ok": not (vetoes & SEVERE_VETO_CODES),
            })
    return {h: Rows(v) for h, v in buckets.items() if v}


def describe(values: np.ndarray, cost_bps: float = 0.0) -> Dict[str, Any]:
    """Summary of a return series, optionally after a round-trip cost."""
    if values.size == 0:
        return {"n": 0}
    adjusted = values - (cost_bps / 100.0)
    return {
        "n": int(adjusted.size),
        "meanPct": round(float(np.mean(adjusted)), 4),
        "medianPct": round(float(np.median(adjusted)), 4),
        "hitRatePct": round(float(np.mean(adjusted > 0) * 100), 2),
        "stdPct": round(float(np.std(adjusted, ddof=1)) if adjusted.size > 1 else 0.0, 4),
        "p10Pct": round(float(np.percentile(adjusted, 10)), 4),
        "p90Pct": round(float(np.percentile(adjusted, 90)), 4),
    }


def cluster_bootstrap_diff(
    rows: Rows,
    selection: np.ndarray,
    cluster_key: np.ndarray,
    iterations: int = BOOTSTRAP_ITERATIONS,
    seed: int = 20260902,
) -> Dict[str, Any]:
    """CI for (mean of selected) - (mean of all), resampling whole clusters.

    Signals are not independent: one symbol contributes many rows, and rows on
    neighbouring dates share overlapping forward windows. Resampling individual
    rows would understate the spread badly, so entire clusters are resampled.
    """
    if selection.sum() == 0:
        return {"clusters": 0, "note": "no selected observations"}

    keys, inverse = np.unique(cluster_key, return_inverse=True)
    n_clusters = keys.size
    sel_sum = np.bincount(inverse, weights=rows.ret * selection, minlength=n_clusters)
    sel_cnt = np.bincount(inverse, weights=selection.astype(float), minlength=n_clusters)
    all_sum = np.bincount(inverse, weights=rows.ret, minlength=n_clusters)
    all_cnt = np.bincount(inverse, minlength=n_clusters).astype(float)

    rng = np.random.default_rng(seed)
    diffs = np.empty(iterations, dtype=float)
    for i in range(iterations):
        pick = rng.integers(0, n_clusters, n_clusters)
        s_c = sel_cnt[pick].sum()
        a_c = all_cnt[pick].sum()
        if s_c == 0 or a_c == 0:
            diffs[i] = np.nan
            continue
        diffs[i] = (sel_sum[pick].sum() / s_c) - (all_sum[pick].sum() / a_c)
    diffs = diffs[~np.isnan(diffs)]
    if diffs.size == 0:
        return {"clusters": int(n_clusters), "note": "bootstrap produced no usable draws"}
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    return {
        "clusters": int(n_clusters),
        "iterations": int(diffs.size),
        "pointDiffPct": round(float(np.mean(rows.ret[selection.astype(bool)]) - np.mean(rows.ret)), 4),
        "ci95LowPct": round(float(lo), 4),
        "ci95HighPct": round(float(hi), 4),
        "shareAboveZero": round(float(np.mean(diffs > 0)), 3),
    }


def funnel(rows: Rows, band: Optional[Tuple[float, float]]) -> Dict[str, Any]:
    """Reconstruct the production decision order on this cohort."""
    stages: List[Dict[str, Any]] = []
    alive = np.ones(len(rows), dtype=bool)
    stages.append({"stage": "all matured signals", "surviving": int(alive.sum())})

    alive = alive & rows.setup_ok
    stages.append({"stage": "setup gate (setup_type != AVOID)", "surviving": int(alive.sum())})

    alive = alive & rows.veto_ok
    stages.append({"stage": "severe veto gate", "surviving": int(alive.sum())})

    conf_ok = np.nan_to_num(rows.confidence, nan=-1.0) >= PROD_CONFIDENCE_FLOOR
    alive = alive & conf_ok
    stages.append({"stage": f"confidence >= {PROD_CONFIDENCE_FLOOR:.0f}", "surviving": int(alive.sum())})

    prod = alive & (rows.score >= PROD_SCORE_FLOOR)
    result: Dict[str, Any] = {
        "stages": stages,
        "enterUnderProduction": int(prod.sum()),
        "productionOutcome": describe(rows.ret[prod]),
    }
    if band is not None:
        lo, hi = band
        banded = alive & (rows.score >= lo) & (rows.score <= hi)
        result["enterUnderBand"] = int(banded.sum())
        result["bandOutcome"] = describe(rows.ret[banded])
    return result


def walk_forward(rows: Rows, band: Tuple[float, float]) -> List[Dict[str, Any]]:
    """Expanding-window months: everything before the month, tested on it."""
    months = sorted({d[:7] for d in rows.date.tolist()})
    out: List[Dict[str, Any]] = []
    lo, hi = band
    for month in months[1:]:
        train_mask = np.array([d[:7] < month for d in rows.date.tolist()], dtype=bool)
        test_mask = np.array([d[:7] == month for d in rows.date.tolist()], dtype=bool)
        if train_mask.sum() < 2000 or test_mask.sum() < 500:
            continue
        test = rows.mask(test_mask)
        base = describe(test.ret)
        band_sel = (test.score >= lo) & (test.score <= hi)
        prod_sel = test.score >= PROD_SCORE_FLOOR
        out.append({
            "testMonth": month,
            "trainRows": int(train_mask.sum()),
            "baseline": base,
            "band": describe(test.ret[band_sel]),
            "production80": describe(test.ret[prod_sel]),
        })
    return out


def coverage_gaps(dates: Sequence[str], min_gap_days: int = 5) -> List[Dict[str, Any]]:
    """Runs of consecutive signal dates missing from the export.

    Gaps matter: a horizon whose calibration and holdout windows sit either side
    of a long gap is comparing two disjoint market episodes, not two halves of
    one continuous record.
    """
    from datetime import date as _date
    unique = sorted({d for d in dates})
    gaps: List[Dict[str, Any]] = []
    previous: Optional[_date] = None
    for value in unique:
        current = _date.fromisoformat(value)
        if previous is not None and (current - previous).days >= min_gap_days:
            gaps.append({
                "afterDate": previous.isoformat(),
                "beforeDate": current.isoformat(),
                "days": (current - previous).days,
            })
        previous = current
    return gaps


def inventory(data: Dict[str, Rows]) -> Dict[str, Any]:
    inv: Dict[str, Any] = {}
    for horizon, rows in data.items():
        dates = rows.date.tolist()
        months = Counter(d[:7] for d in dates)
        inv[horizon] = {
            "rows": len(rows),
            "distinctSymbols": int(np.unique(rows.symbol).size),
            "distinctSignalDates": len({d for d in dates}),
            "firstSignalDate": min(dates),
            "lastSignalDate": max(dates),
            "rowsPerMonth": dict(sorted(months.items())),
            "coverageGaps": coverage_gaps(dates),
            # Maturity: a horizon can only carry signals old enough for the window
            # to have closed, so the newest signal date is expected to trail the
            # export date. A newest date that does NOT trail would indicate the
            # return was written before the window closed - i.e. look-ahead.
            "expectedMaturityLagTradingDays": int(horizon.rstrip("D")),
        }
    return inv


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default="calibration-dated.csv")
    parser.add_argument("--out", default=None)
    parser.add_argument("--split", default=SPLIT_DATE)
    args = parser.parse_args()

    data = load(args.csv)
    report: Dict[str, Any] = {
        "split": args.split,
        "proposedBand": list(PROPOSED_BAND),
        "productionScoreFloor": PROD_SCORE_FLOOR,
        "productionConfidenceFloor": PROD_CONFIDENCE_FLOOR,
        "bootstrapIterations": BOOTSTRAP_ITERATIONS,
        "inventory": inventory(data),
        "horizons": {},
    }

    for horizon in HORIZONS:
        rows = data.get(horizon)
        if rows is None:
            continue
        dates = np.array(rows.date.tolist())
        cal = rows.mask(dates < args.split)
        hold = rows.mask(dates >= args.split)
        lo, hi = PROPOSED_BAND

        entry: Dict[str, Any] = {
            "calibrationRows": len(cal),
            "holdoutRows": len(hold),
            "calibration": {},
            "holdout": {},
        }

        for label, subset in (("calibration", cal), ("holdout", hold)):
            if len(subset) == 0:
                continue
            band_sel = (subset.score >= lo) & (subset.score <= hi)
            prod_sel = subset.score >= PROD_SCORE_FLOOR
            block: Dict[str, Any] = {
                "baseline": describe(subset.ret),
                "band55to70": describe(subset.ret[band_sel]),
                "production80plus": describe(subset.ret[prod_sel]),
                "costSensitivity": {
                    f"{int(bps)}bps": {
                        "baseline": describe(subset.ret, bps)["meanPct"],
                        "band55to70": describe(subset.ret[band_sel], bps).get("meanPct"),
                        "production80plus": describe(subset.ret[prod_sel], bps).get("meanPct"),
                    } for bps in COST_SCENARIOS_BPS
                },
            }
            if label == "holdout":
                block["bandBootstrapBySymbol"] = cluster_bootstrap_diff(subset, band_sel.astype(float), subset.symbol)
                block["bandBootstrapByDate"] = cluster_bootstrap_diff(subset, band_sel.astype(float), np.array(subset.date.tolist()))
                block["production80Bootstrap"] = cluster_bootstrap_diff(subset, prod_sel.astype(float), subset.symbol)
            entry[label] = block

        entry["decisionCohortHoldout"] = funnel(hold, PROPOSED_BAND) if len(hold) else {}
        entry["decisionCohortAll"] = funnel(rows, PROPOSED_BAND)
        entry["walkForward"] = walk_forward(rows, PROPOSED_BAND)
        report["horizons"][horizon] = entry

    text = json.dumps(report, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(text + "\n")
        print(f"wrote {args.out}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
