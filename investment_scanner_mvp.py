#!/usr/bin/env python3
"""
Practical multi-asset market scanner entry point.

The heavy lifting lives in `scanner/` now so this file can stay focused on
CLI orchestration and output flow.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from alerts import process_telegram_alerts
from scanner.analysis import analyze_performance, compute_forward_returns
from scanner.config import DEFAULT_NEWS_LIMIT, DEFAULT_UNIVERSE, MIN_AVG_DOLLAR_VOL, MIN_MARKET_CAP, MIN_PRICE
from scanner.engine import load_universe_from_csv, scan_symbols
from scanner.outputs import print_top_table, save_snapshot


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Practical multi-asset ranking scanner")
    parser.add_argument("--universe-csv", help="Optional CSV with symbol/ticker column")
    parser.add_argument("--top", type=int, default=20, help="Number of top results to show")
    parser.add_argument("--outdir", default="scanner_output", help="Output directory")
    parser.add_argument("--min-price", type=float, default=MIN_PRICE)
    parser.add_argument("--min-dollar-volume", type=float, default=MIN_AVG_DOLLAR_VOL)
    parser.add_argument("--min-market-cap", type=float, default=MIN_MARKET_CAP)
    parser.add_argument("--news-limit", type=int, default=DEFAULT_NEWS_LIMIT, help="How many top names to enrich with recent headlines")
    parser.add_argument("--skip-news", action="store_true", help="Skip headline / event enrichment")
    parser.add_argument("--run-analysis", action="store_true", help="Compute forward returns and performance summaries from saved history")
    parser.add_argument("--save-history", dest="save_history", action="store_true", help="Save a timestamped snapshot after each scan")
    parser.add_argument("--no-save-history", dest="save_history", action="store_false", help="Do not save a timestamped snapshot")
    parser.add_argument("--send-alerts", action="store_true", help="Send Telegram alerts for new high-conviction signals")
    parser.set_defaults(save_history=True)
    return parser


def main():
    args = build_parser().parse_args()
    universe = load_universe_from_csv(args.universe_csv) if args.universe_csv else DEFAULT_UNIVERSE

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    df_rank = scan_symbols(
        universe,
        top_n=args.top,
        news_limit=args.news_limit,
        skip_news=args.skip_news,
        outdir=outdir,
        min_price=args.min_price,
        min_avg_dollar_volume=args.min_dollar_volume,
        min_market_cap=args.min_market_cap,
    )
    if df_rank.empty:
        print("No results. Try lowering filters or changing the universe.")
        sys.exit(1)

    full_path = outdir / "full_ranking.csv"
    top_path = outdir / "top_candidates.csv"
    history_path = None

    df_rank.to_csv(full_path, index=False)
    df_rank.head(args.top).to_csv(top_path, index=False)

    if args.save_history:
        history_path = save_snapshot(df_rank, outdir)

    print_top_table(df_rank, args.top)

    print(f"\nSaved full ranking to: {full_path}")
    print(f"Saved top {args.top} to: {top_path}")
    if history_path is not None:
        print(f"Saved scan snapshot to: {history_path}")

    if args.send_alerts:
        process_telegram_alerts(df_rank, outdir)

    if args.run_analysis:
        history_dir = outdir / "history"
        forward_df = compute_forward_returns(str(history_dir))
        if forward_df.empty:
            print("\nNo completed forward-return observations yet.")
        else:
            print(f"\nComputed forward returns for {len(forward_df)} snapshot rows.")
        analyze_performance(forward_df)

    print("\nImportant:")
    print("- This is a ranking engine, not financial advice or a prediction guarantee.")
    print("- Headline and macro layers are intentionally simple and can be wrong.")
    print("- AVWAP uses objective anchors (YTD and recent swing low) rather than hand-picked discretionary anchors.")
    print("- VPVR is intentionally not included because Yahoo daily bars are not reliable enough for it.")
    print("- Historical evaluation is useful, but it is not survivorship-free or point-in-time perfect.")


if __name__ == "__main__":
    main()
