#!/usr/bin/env python3
"""
Practical multi-asset market scanner entry point.

The heavy lifting lives in `scanner/` now so this file can stay focused on
CLI orchestration and output flow.
"""

from __future__ import annotations

import argparse
import os
from decimal import Decimal, InvalidOperation
from pathlib import Path

from alerts import evaluate_alert_rules, read_alert_input_files
from database import persist_analysis_data, persist_scan_dataframe
from scanner.analysis import analyze_performance, compute_forward_returns
from scanner.config import DEFAULT_NEWS_LIMIT, MIN_AVG_DOLLAR_VOL, MIN_MARKET_CAP, MIN_PRICE
from scanner.drop_reasons import ScannerAccounting, write_scanner_accounting_report
from scanner.engine import load_universe_from_csv, scan_symbols
from scanner.outputs import print_top_table, save_snapshot
from scanner.paper_trading import run_paper_trading
from scanner.perf import log_timing, timer_start
from scanner.regime import write_market_regime
from scanner.safety import atomic_write_dataframe_csv, check_data_freshness, ensure_action_column, scanner_run_lock, validate_ranking_schema
from scanner.structure import write_market_structure
from scanner.universe import UNIVERSE_SIZE_CHOICES, build_universe

DEFAULT_ANALYSIS_TIME_BUDGET_SECONDS = 900.0
DEFAULT_ANALYSIS_MAX_SNAPSHOTS = 1800
DEFAULT_ANALYSIS_MAX_SIGNAL_ROWS = 25000


def positive_decimal(value: str) -> Decimal:
    try:
        parsed = Decimal(value)
    except InvalidOperation as exc:
        raise argparse.ArgumentTypeError("must be a valid decimal number") from exc
    if parsed <= Decimal("0"):
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a valid integer") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def positive_float(value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a valid number") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return parsed


def env_positive_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def env_positive_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        parsed = float(raw)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def env_universe_size(name: str = "TRADEVETO_UNIVERSE_SIZE", default: str = "core") -> str:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    normalized = raw.strip().lower()
    return normalized if normalized in UNIVERSE_SIZE_CHOICES else default


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Practical multi-asset ranking scanner")
    parser.add_argument("--universe-csv", help="Optional CSV with symbol/ticker column")
    parser.add_argument(
        "--universe-size",
        choices=list(UNIVERSE_SIZE_CHOICES),
        default=env_universe_size(),
        help="Built-in universe size to scan when --symbols/--universe-csv are not provided",
    )
    parser.add_argument("--symbols", help="Optional comma-separated symbols for a constrained scan")
    parser.add_argument("--top", type=int, default=20, help="Number of top results to show")
    parser.add_argument("--outdir", default="scanner_output", help="Output directory")
    parser.add_argument("--min-price", type=float, default=MIN_PRICE)
    parser.add_argument("--min-dollar-volume", type=float, default=MIN_AVG_DOLLAR_VOL)
    parser.add_argument("--min-market-cap", type=float, default=MIN_MARKET_CAP)
    parser.add_argument("--news-limit", type=int, default=DEFAULT_NEWS_LIMIT, help="How many top names to enrich with recent headlines")
    parser.add_argument("--skip-news", action="store_true", help="Skip headline / event enrichment")
    parser.add_argument("--run-analysis", action="store_true", help="Compute forward returns and performance summaries from saved history")
    parser.add_argument("--skip-analysis", action="store_true", help="Skip forward-return, lifecycle, calibration, and auto-calibration outputs")
    parser.add_argument("--analysis-raw", action="store_true", help="Keep raw intraday observations instead of canonical daily sampling")
    parser.add_argument(
        "--analysis-time-budget-seconds",
        type=positive_float,
        default=env_positive_float("TRADEVETO_ANALYSIS_TIME_BUDGET_SECONDS", DEFAULT_ANALYSIS_TIME_BUDGET_SECONDS),
        help="Maximum seconds to spend on forward-return analysis before writing bounded partial output",
    )
    parser.add_argument(
        "--analysis-max-snapshots",
        type=positive_int,
        default=env_positive_int("TRADEVETO_ANALYSIS_MAX_SNAPSHOTS", DEFAULT_ANALYSIS_MAX_SNAPSHOTS),
        help="Maximum latest snapshot CSV files to load for scheduled analysis",
    )
    parser.add_argument(
        "--analysis-max-signal-rows",
        type=positive_int,
        default=env_positive_int("TRADEVETO_ANALYSIS_MAX_SIGNAL_ROWS", DEFAULT_ANALYSIS_MAX_SIGNAL_ROWS),
        help="Maximum latest signal rows to analyze after canonical signal sampling",
    )
    parser.add_argument("--fast", action="store_true", help="Fast monitoring mode: skip news enrichment and analysis outputs")
    parser.add_argument("--timing", action="store_true", help="Print phase timing logs")
    parser.add_argument("--save-history", dest="save_history", action="store_true", help="Save a timestamped snapshot after each scan")
    parser.add_argument("--no-save-history", dest="save_history", action="store_false", help="Do not save a timestamped snapshot")
    parser.add_argument("--send-alerts", action="store_true", help="Evaluate enabled alert rules and send configured Telegram/email alerts")
    parser.add_argument("--paper-trade", action="store_true", help="Run optional paper trading simulation after DB writeback")
    parser.add_argument(
        "--reset-paper-account",
        action="store_true",
        help="Reset paper trading account",
    )
    parser.add_argument(
        "--paper-starting-balance",
        type=positive_decimal,
        default=Decimal("10000"),
        help="Starting cash balance to use when resetting the default paper account",
    )
    parser.add_argument("--alerts-only", action="store_true", help="Evaluate alerts from existing scanner_output CSVs without running a scan")
    parser.add_argument("--alert-rules-path", help="Optional path to alert_rules.json")
    parser.add_argument("--alert-state-path", help="Optional path to alert_state.json")
    parser.add_argument("--alert-rule-id", help="Evaluate only one alert rule id")
    parser.set_defaults(save_history=True)
    return parser


def load_universe_from_symbols(symbols_text: str) -> list[str]:
    symbols: list[str] = []
    seen: set[str] = set()
    for raw_symbol in symbols_text.split(","):
        symbol = raw_symbol.strip().upper()
        if not symbol or symbol in seen:
            continue
        symbols.append(symbol)
        seen.add(symbol)
    return symbols


def configure_execution_mode(args: argparse.Namespace) -> None:
    if args.fast:
        args.skip_news = True
        args.skip_analysis = True
        print("[mode] FAST mode enabled")
        print("[mode] skipping news enrichment")
        print("[mode] skipping analysis outputs")
        return
    print("[mode] FULL mode enabled")


def main() -> None:
    args = build_parser().parse_args()
    total_started = timer_start()
    try:
        if args.reset_paper_account:
            from scanner.paper_reset import reset_paper_account

            reset_paper_account(starting_balance=args.paper_starting_balance)
            return
        configure_execution_mode(args)
        if args.symbols:
            universe = load_universe_from_symbols(str(args.symbols))
        elif args.universe_csv:
            universe = load_universe_from_csv(args.universe_csv)
        else:
            universe = build_universe(str(args.universe_size))
        print(f"[universe] selected {len(universe)} symbols")

        outdir = Path(args.outdir)
        outdir.mkdir(parents=True, exist_ok=True)

        with scanner_run_lock(outdir) as lock_acquired:
            if not lock_acquired:
                return
            run_with_lock(args, universe, outdir)
    finally:
        log_timing(args.timing, "total_runtime", total_started)


def run_with_lock(args: argparse.Namespace, universe: list[str], outdir: Path) -> None:
    if args.alerts_only:
        if args.send_alerts and check_data_freshness(outdir).status != "fresh":
            print("[alerts] skipped due to stale or missing data")
            return
        full_ranking, top_candidates = read_alert_input_files(outdir)
        if full_ranking.empty:
            print(f"[alerts] No existing ranking rows found at: {outdir / 'full_ranking.csv'}")
            return
        phase_started = timer_start()
        try:
            evaluate_alert_rules(
                full_ranking,
                top_candidates,
                outdir,
                alert_rules_path=args.alert_rules_path,
                alert_state_path=args.alert_state_path,
                only_rule_id=args.alert_rule_id,
                send=args.send_alerts,
            )
        finally:
            log_timing(args.timing, "alert_processing", phase_started)
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
        timing=args.timing,
        write_analysis_artifacts=not args.skip_analysis,
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

    phase_started = timer_start()
    atomic_write_dataframe_csv(df_rank, full_path, index=False)
    atomic_write_dataframe_csv(df_rank.head(args.top), top_path, index=False)
    if not args.skip_analysis:
        write_market_structure(outdir, df_rank)

    if args.save_history:
        history_path = save_snapshot(df_rank, outdir)
    log_timing(args.timing, "csv_writes", phase_started)

    print_top_table(df_rank, args.top)

    print(f"\nSaved full ranking to: {full_path}")
    print(f"Saved top {args.top} to: {top_path}")
    if history_path is not None:
        print(f"Saved scan snapshot to: {history_path}")

    db_notes = f"skip_news={args.skip_news}; news_limit={args.news_limit}; outdir={outdir}"
    scanner_accounting = df_rank.attrs.get("scanner_accounting")
    try:
        db_result = persist_scan_dataframe(df_rank, scanner_version="market-alpha-scanner", notes=db_notes)
        if db_result.get("enabled"):
            print(
                "Wrote database rows:"
                f" scan_runs={db_result['scan_runs']},"
                f" scanner_signals={db_result['scanner_signals']}"
            )
            if isinstance(scanner_accounting, ScannerAccounting):
                persisted_signals = _int_value(db_result.get("scanner_signals"))
                ranked_rows = int(len(df_rank))
                if persisted_signals is not None and persisted_signals < ranked_rows:
                    scanner_accounting.mark_ranked_writeback_failed(
                        f"database persisted {persisted_signals} scanner_signals for {ranked_rows} ranked rows"
                    )
                write_scanner_accounting_report(scanner_accounting, outdir)
        else:
            print(f"Skipping database write: {db_result.get('reason', 'DATABASE_URL not configured')}")
    except Exception as exc:
        print(f"Warning: database write skipped due to error: {exc}")
        if isinstance(scanner_accounting, ScannerAccounting):
            scanner_accounting.mark_ranked_writeback_failed(f"database write failed: {type(exc).__name__}: {exc}")
            write_scanner_accounting_report(scanner_accounting, outdir)

    if args.paper_trade:
        run_paper_trading()

    if args.send_alerts:
        phase_started = timer_start()
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
        log_timing(args.timing, "alert_processing", phase_started)

    if args.run_analysis and not args.skip_analysis:
        phase_started = timer_start()
        history_dir = outdir / "history"
        print("[analysis] starting forward-return analysis")
        write_market_regime(outdir)
        write_market_structure(outdir)
        forward_df = compute_forward_returns(
            str(history_dir),
            analysis_raw=args.analysis_raw,
            max_snapshots=args.analysis_max_snapshots,
            max_signal_rows=args.analysis_max_signal_rows,
            time_budget_seconds=args.analysis_time_budget_seconds,
        )
        if forward_df.empty:
            print("\n[analysis] No completed forward-return observations yet.")
        else:
            print(f"\n[analysis] Computed forward returns for {len(forward_df)} snapshot rows.")
        try:
            summary_df = analyze_performance(forward_df)
            db_result = persist_analysis_data(forward_df, summary_df)
            if db_result.get("enabled"):
                print(
                    "Wrote analysis database rows:"
                    f" performance_summary={db_result['performance_summary']},"
                    f" forward_returns={db_result['forward_returns']}"
                )
            else:
                print(f"Skipping analysis database write: {db_result.get('reason', 'DATABASE_URL not configured')}")
        except Exception as exc:
            print(f"Warning: analysis database write skipped due to error: {exc}")
        log_timing(args.timing, "analysis", phase_started)
    elif args.run_analysis and args.skip_analysis:
        print("[analysis] skipped by --skip-analysis")

    print("\nImportant:")
    print("- This is a ranking engine, not financial advice or a prediction guarantee.")
    print("- Headline and macro layers are intentionally simple and can be wrong.")
    print("- AVWAP uses objective anchors (YTD and recent swing low) rather than hand-picked discretionary anchors.")
    print("- VPVR is intentionally not included because Yahoo daily bars are not reliable enough for it.")
    print("- Historical evaluation is useful, but it is not survivorship-free or point-in-time perfect.")


def _int_value(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    main()
