#!/usr/bin/env python3
"""
Practical multi-asset market scanner entry point.

The heavy lifting lives in `scanner/` now so this file can stay focused on
CLI orchestration and output flow.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from alerts import evaluate_alert_rules, read_alert_input_files
from database import persist_scan_dataframe
from scanner.analysis import analyze_performance, compute_forward_returns
from scanner.config import DEFAULT_NEWS_LIMIT, DEFAULT_UNIVERSE, MIN_AVG_DOLLAR_VOL, MIN_MARKET_CAP, MIN_PRICE
from scanner.engine import load_universe_from_csv, scan_symbols
from scanner.outputs import print_top_table, save_snapshot
from scanner.regime import write_market_regime
from scanner.safety import atomic_write_dataframe_csv, check_data_freshness, ensure_action_column, scanner_run_lock, validate_ranking_schema


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
    parser.add_argument("--analysis-raw", action="store_true", help="Keep raw intraday observations instead of canonical daily sampling")
    parser.add_argument("--save-history", dest="save_history", action="store_true", help="Save a timestamped snapshot after each scan")
    parser.add_argument("--no-save-history", dest="save_history", action="store_false", help="Do not save a timestamped snapshot")
    parser.add_argument("--send-alerts", action="store_true", help="Evaluate enabled alert rules and send configured Telegram/email alerts")
    parser.add_argument("--alerts-only", action="store_true", help="Evaluate alerts from existing scanner_output CSVs without running a scan")
    parser.add_argument("--alert-rules-path", help="Optional path to alert_rules.json")
    parser.add_argument("--alert-state-path", help="Optional path to alert_state.json")
    parser.add_argument("--alert-rule-id", help="Evaluate only one alert rule id")
    parser.set_defaults(save_history=True)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    universe = load_universe_from_csv(args.universe_csv) if args.universe_csv else DEFAULT_UNIVERSE

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    with scanner_run_lock(outdir) as lock_acquired:
        if not lock_acquired:
            return
        run_with_lock(args, universe, outdir)


def run_with_lock(args: argparse.Namespace, universe: list[str], outdir: Path) -> None:
    if args.alerts_only:
        if args.send_alerts and check_data_freshness(outdir).status != "fresh":
            print("[alerts] skipped due to stale or missing data")
            return
        full_ranking, top_candidates = read_alert_input_files(outdir)
        if full_ranking.empty:
            print(f"[alerts] No existing ranking rows found at: {outdir / 'full_ranking.csv'}")
            return
        evaluate_alert_rules(
            full_ranking,
            top_candidates,
            outdir,
            alert_rules_path=args.alert_rules_path,
            alert_state_path=args.alert_state_path,
            only_rule_id=args.alert_rule_id,
            send=args.send_alerts,
        )
        return

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
        print("[scanner] No results. Try lowering filters or changing the universe.")
        return
    df_rank = ensure_action_column(df_rank)
    if not validate_ranking_schema(df_rank, "scan results"):
        print("[scanner] scan output schema invalid; skipping writes")
        return

    full_path = outdir / "full_ranking.csv"
    top_path = outdir / "top_candidates.csv"
    history_path = None

    atomic_write_dataframe_csv(df_rank, full_path, index=False)
    atomic_write_dataframe_csv(df_rank.head(args.top), top_path, index=False)

    if args.save_history:
        history_path = save_snapshot(df_rank, outdir)

    print_top_table(df_rank, args.top)

    print(f"\nSaved full ranking to: {full_path}")
    print(f"Saved top {args.top} to: {top_path}")
    if history_path is not None:
        print(f"Saved scan snapshot to: {history_path}")

    db_notes = f"skip_news={args.skip_news}; news_limit={args.news_limit}; outdir={outdir}"
    try:
        db_result = persist_scan_dataframe(df_rank, scanner_version="market-alpha-scanner", notes=db_notes)
        if db_result.get("enabled"):
            print(
                "Wrote database rows:"
                f" scan_runs={db_result['scan_runs']},"
                f" symbol_snapshots={db_result['symbol_snapshots']},"
                f" symbol_reasons={db_result['symbol_reasons']},"
                f" price_history={db_result['price_history']},"
                f" fundamental_snapshots={db_result['fundamental_snapshots']},"
                f" news_items={db_result['news_items']}"
            )
        else:
            print(f"Skipping database write: {db_result.get('reason', 'DATABASE_URL not configured')}")
    except Exception as exc:
        print(f"Warning: database write skipped due to error: {exc}")

    if args.send_alerts:
        if check_data_freshness(outdir).status != "fresh":
            print("[alerts] skipped due to stale or missing data")
        else:
            evaluate_alert_rules(
                df_rank,
                df_rank.head(args.top),
                outdir,
                alert_rules_path=args.alert_rules_path,
                alert_state_path=args.alert_state_path,
                only_rule_id=args.alert_rule_id,
                send=True,
            )

    if args.run_analysis:
        history_dir = outdir / "history"
        print("[analysis] starting forward-return analysis")
        write_market_regime(outdir)
        forward_df = compute_forward_returns(str(history_dir), analysis_raw=args.analysis_raw)
        if forward_df.empty:
            print("\n[analysis] No completed forward-return observations yet.")
        else:
            print(f"\n[analysis] Computed forward returns for {len(forward_df)} snapshot rows.")
        analyze_performance(forward_df)

    print("\nImportant:")
    print("- This is a ranking engine, not financial advice or a prediction guarantee.")
    print("- Headline and macro layers are intentionally simple and can be wrong.")
    print("- AVWAP uses objective anchors (YTD and recent swing low) rather than hand-picked discretionary anchors.")
    print("- VPVR is intentionally not included because Yahoo daily bars are not reliable enough for it.")
    print("- Historical evaluation is useful, but it is not survivorship-free or point-in-time perfect.")


if __name__ == "__main__":
    main()
