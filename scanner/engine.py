from __future__ import annotations

from datetime import datetime, timezone
import time
from dataclasses import asdict
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .artifacts import save_symbol_detail_outputs
from .cache import CacheStats, read_symbol_cache, write_symbol_cache
from .config import DEFAULT_NEWS_LIMIT, DOWNLOAD_PERIOD, MACRO_SYMBOLS, MIN_AVG_DOLLAR_VOL, MIN_MARKET_CAP, MIN_PRICE, TOP_N
from .data_fetch import batch_download, fetch_info, fetch_recent_news_items, fetch_recent_news_score
from .models import RankedAsset
from .final_decision import apply_final_trade_decision
from .perf import log_timing, timer_start
from .recommendation_quality import apply_recommendation_quality
from .regime import REGIME_PROXIES, apply_regime_adjustments, detect_market_regime, write_market_regime
from .scoring import (
    apply_horizon_recommendations,
    build_horizon_context,
    composite_score,
    compute_macro_regime,
    compute_risk_penalty,
    derive_confidence_level,
    derive_key_risk,
    derive_setup_type,
    derive_trade_plan,
    derive_upside_driver,
    fundamentals_scorecard,
    infer_asset_type,
    infer_sector,
    rating_from_score,
    score_macro_alignment,
    technical_scorecard,
)
from .structure import compute_market_structure
from .utils import ema, extract_company_name, macd_hist, parse_earnings_date, safe_float, safe_str, sma


def _object_dict(value: object) -> dict[str, object] | None:
    if not isinstance(value, dict):
        return None
    return {str(key): item for key, item in value.items()}


def _news_items_from_cache(value: object) -> list[dict[str, object]] | None:
    if not isinstance(value, list):
        return None
    items: list[dict[str, object]] = []
    for item in value:
        item_dict = _object_dict(item)
        if item_dict is not None:
            items.append(item_dict)
    return items


def _fetch_info_with_cache(symbol: str, cache_dir: Path | None, stats: CacheStats) -> tuple[dict[str, object], str]:
    cached = read_symbol_cache(cache_dir, "fundamentals", symbol)
    if cached is not None:
        info = _object_dict(cached.get("info"))
        if info is not None:
            stats.hits += 1
            cached_earnings_date = safe_str(cached.get("earnings_date"), "")
            return info, cached_earnings_date or parse_earnings_date(info)

    stats.misses += 1
    info = fetch_info(symbol)
    earnings_date = parse_earnings_date(info)
    write_symbol_cache(cache_dir, "fundamentals", symbol, {"info": info, "earnings_date": earnings_date})
    return info, earnings_date


def _fetch_news_with_cache(symbol: str, cache_dir: Path | None, stats: CacheStats) -> tuple[list[dict[str, object]], float, str, str, str]:
    cached = read_symbol_cache(cache_dir, "news", symbol)
    if cached is not None:
        items = _news_items_from_cache(cached.get("items"))
        if items is not None:
            stats.hits += 1
            return (
                items,
                safe_float(cached.get("news_score"), 50.0),
                safe_str(cached.get("headline_bias"), "no recent headline signal"),
                safe_str(cached.get("top_event"), ""),
                safe_str(cached.get("headline_risk"), ""),
            )

    stats.misses += 1
    items = fetch_recent_news_items(symbol)
    news_score, headline_bias, top_event, headline_risk = fetch_recent_news_score(symbol, items=items)
    write_symbol_cache(
        cache_dir,
        "news",
        symbol,
        {
            "items": items,
            "news_score": news_score,
            "headline_bias": headline_bias,
            "top_event": top_event,
            "headline_risk": headline_risk,
        },
    )
    return items, news_score, headline_bias, top_event, headline_risk


def scan_symbols(
    symbols: list[str],
    top_n: int = TOP_N,
    news_limit: int = DEFAULT_NEWS_LIMIT,
    skip_news: bool = False,
    outdir: Optional[Path] = None,
    min_price: float = MIN_PRICE,
    min_avg_dollar_volume: float = MIN_AVG_DOLLAR_VOL,
    min_market_cap: float = MIN_MARKET_CAP,
    timing: bool = False,
    write_analysis_artifacts: bool = True,
) -> pd.DataFrame:
    started_at = datetime.now(timezone.utc)
    cache_dir = outdir / "cache" if outdir is not None else None
    fundamentals_cache_stats = CacheStats()
    news_cache_stats = CacheStats()

    print(f"[1/5] Downloading price history for {len(symbols)} symbols...")
    phase_started = timer_start()
    price_map = batch_download(symbols, DOWNLOAD_PERIOD)
    log_timing(timing, "price_history_download", phase_started)

    print("[2/5] Downloading macro proxies...")
    phase_started = timer_start()
    macro_price_map = batch_download(list(dict.fromkeys(MACRO_SYMBOLS.values())), DOWNLOAD_PERIOD)
    macro_closes: dict[str, pd.Series] = {}
    for name, sym in MACRO_SYMBOLS.items():
        df = macro_price_map.get(sym)
        if df is not None and not df.empty:
            macro_closes[name] = df["Close"]
    macro_regime = compute_macro_regime(macro_closes)
    regime_price_map = dict(macro_price_map)
    missing_regime_symbols = [symbol for symbol in REGIME_PROXIES.values() if symbol not in regime_price_map]
    if missing_regime_symbols:
        regime_price_map.update(batch_download(missing_regime_symbols, DOWNLOAD_PERIOD))
    market_regime = detect_market_regime(regime_price_map)
    if outdir is not None and write_analysis_artifacts:
        write_market_regime(outdir, market_regime)
    log_timing(timing, "macro_download", phase_started)

    ranked: list[RankedAsset] = []
    info_cache: dict[str, dict[str, object]] = {}
    horizon_context_cache: dict[str, dict[str, float | bool]] = {}
    macd_cache: dict[str, tuple[float, float]] = {}
    news_cache: dict[str, list[dict[str, object]]] = {}
    one_day_return_cache: dict[str, float] = {}
    scanned_count = 0

    print("[3/5] Scoring symbols...")
    phase_started = timer_start()
    for i, symbol in enumerate(symbols, start=1):
        df = price_map.get(symbol)
        if df is None or df.empty or len(df) < 220:
            continue

        close = df["Close"].dropna()
        if close.empty:
            continue

        last_price = safe_float(close.iloc[-1], np.nan)
        previous_close = safe_float(close.iloc[-2], np.nan) if len(close) >= 2 else np.nan
        one_day_return = (last_price / previous_close - 1.0) if not np.isnan(last_price) and not np.isnan(previous_close) and previous_close != 0 else np.nan
        avg_dollar_volume = safe_float((df["Close"].iloc[-20:] * df["Volume"].iloc[-20:]).mean(), np.nan)
        if np.isnan(last_price) or last_price < min_price:
            continue
        if np.isnan(avg_dollar_volume) or avg_dollar_volume < min_avg_dollar_volume:
            continue

        info, earnings_date = _fetch_info_with_cache(symbol, cache_dir, fundamentals_cache_stats)
        info_cache[symbol] = info
        one_day_return_cache[symbol] = round(one_day_return, 6) if not np.isnan(one_day_return) else np.nan
        scanned_count += 1
        asset_type = infer_asset_type(symbol, info)
        sector = infer_sector(symbol, asset_type, info)
        industry = safe_str(info.get("industry"))
        market_cap = safe_float(info.get("marketCap"), np.nan)
        if asset_type == "EQUITY" and (np.isnan(market_cap) or market_cap < min_market_cap):
            continue

        technical = technical_scorecard(df)
        fundamentals = fundamentals_scorecard(info, asset_type)
        macro_score, macro_sensitivity, macro_note = score_macro_alignment(symbol, asset_type, sector, macro_regime)

        macd_series = macd_hist(close)
        current_macd = safe_float(macd_series.iloc[-1], np.nan)
        previous_macd = safe_float(macd_series.iloc[-2], np.nan) if len(macd_series) >= 2 else np.nan
        risk_penalty, ann_vol, atr_pct, dd_pct = compute_risk_penalty(df, technical["current_rsi"], current_macd, previous_macd, earnings_date, asset_type)

        news_score = 50.0
        headline_bias = "not yet enriched"
        upside_driver = derive_upside_driver(technical["technical_score"], safe_float(fundamentals["fundamental_score"]), news_score, macro_score)
        key_risk = derive_key_risk(asset_type, technical["current_rsi"], current_macd, previous_macd, risk_penalty, earnings_date, "")
        final_score = composite_score(asset_type, technical["technical_score"], safe_float(fundamentals["fundamental_score"]), news_score, macro_score, risk_penalty)
        rating = rating_from_score(final_score)

        ema20_value = safe_float(ema(close, 20).iloc[-1])
        sma50_value = safe_float(sma(close, 50).iloc[-1])
        setup_type = derive_setup_type(technical, last_price, technical["avwap_swing"], technical["supertrend_line"])
        trade_plan = derive_trade_plan(
            df,
            last_price,
            setup_type,
            ema20_value,
            sma50_value,
            technical["avwap_ytd"],
            technical["avwap_swing"],
            technical["supertrend_line"],
        )
        macd_cache[symbol] = (current_macd, previous_macd)
        horizon_context = build_horizon_context(df, technical, dd_pct)
        horizon_context_cache[symbol] = horizon_context

        asset = RankedAsset(
            symbol=symbol,
            company_name=extract_company_name(info),
            asset_type=asset_type,
            sector=sector,
            industry=industry,
            price=round(last_price, 4),
            market_cap=round(market_cap, 2) if not np.isnan(market_cap) else np.nan,
            avg_dollar_volume=round(avg_dollar_volume, 2),
            dividend_yield=round(safe_float(info.get("dividendYield")), 2) if not np.isnan(safe_float(info.get("dividendYield"))) else np.nan,
            earnings_date=earnings_date,
            technical_score=round(technical["technical_score"], 2),
            trend_score=technical["trend_score"],
            supertrend_score=technical["supertrend_score"],
            momentum_score=technical["momentum_score"],
            breakout_score=technical["breakout_score"],
            relative_volume_score=technical["relative_volume_score"],
            avwap_score=technical["avwap_score"],
            fundamental_score=safe_float(fundamentals["fundamental_score"]),
            quality_score=safe_float(fundamentals["quality_score"]),
            growth_score=safe_float(fundamentals["growth_score"]),
            valuation_score=safe_float(fundamentals["valuation_score"]),
            news_score=round(news_score, 2),
            macro_score=round(macro_score, 2),
            risk_penalty=round(risk_penalty, 2),
            final_score=round(final_score, 2),
            short_score=np.nan,
            mid_score=np.nan,
            long_score=np.nan,
            rating=rating,
            setup_type=setup_type,
            short_action="WAIT / HOLD",
            mid_action="WAIT / HOLD",
            long_action="WAIT / HOLD",
            composite_action="WAIT / HOLD",
            short_reason="",
            mid_reason="",
            long_reason="",
            selection_reason="",
            entry_zone=str(trade_plan["buy_zone"]),
            invalidation_level=str(trade_plan["stop_loss"]),
            buy_zone=str(trade_plan["buy_zone"]),
            stop_loss=str(trade_plan["stop_loss"]),
            take_profit_zone=str(trade_plan["take_profit_zone"]),
            buy_zone_reason=str(trade_plan["buy_zone_reason"]),
            stop_loss_reason=str(trade_plan["stop_loss_reason"]),
            take_profit_reason=str(trade_plan["take_profit_reason"]),
            risk_reward_reason=str(trade_plan["risk_reward_reason"]),
            take_profit_low=safe_float(trade_plan["take_profit_low"], np.nan),
            take_profit_high=safe_float(trade_plan["take_profit_high"], np.nan),
            conservative_target=str(trade_plan["conservative_target"]),
            balanced_target=str(trade_plan["balanced_target"]),
            aggressive_target=str(trade_plan["aggressive_target"]),
            conservative_target_reason=str(trade_plan["conservative_target_reason"]),
            balanced_target_reason=str(trade_plan["balanced_target_reason"]),
            aggressive_target_reason=str(trade_plan["aggressive_target_reason"]),
            risk_reward=safe_float(trade_plan["risk_reward"], np.nan),
            risk_reward_low=safe_float(trade_plan["risk_reward_low"], np.nan),
            risk_reward_high=safe_float(trade_plan["risk_reward_high"], np.nan),
            risk_reward_label=str(trade_plan["risk_reward_label"]),
            conservative_risk_reward=safe_float(trade_plan["conservative_risk_reward"], np.nan),
            balanced_risk_reward_low=safe_float(trade_plan["balanced_risk_reward_low"], np.nan),
            balanced_risk_reward_high=safe_float(trade_plan["balanced_risk_reward_high"], np.nan),
            aggressive_risk_reward_low=safe_float(trade_plan["aggressive_risk_reward_low"], np.nan),
            aggressive_risk_reward_high=safe_float(trade_plan["aggressive_risk_reward_high"], np.nan),
            target_risk_reward_label=str(trade_plan["target_risk_reward_label"]),
            trade_quality=str(trade_plan["trade_quality"]),
            trade_quality_note=str(trade_plan["trade_quality_note"]),
            target_warning=str(trade_plan["target_warning"]),
            upside_driver=upside_driver,
            key_risk=key_risk,
            profitability_status=safe_str(fundamentals["profitability_status"]),
            valuation_flag=safe_str(fundamentals["valuation_flag"]),
            trailing_pe=safe_float(info.get("trailingPE"), np.nan),
            forward_pe=safe_float(info.get("forwardPE"), np.nan),
            revenue_growth=safe_float(info.get("revenueGrowth"), np.nan),
            earnings_growth=safe_float(info.get("earningsGrowth"), np.nan),
            gross_margin=safe_float(info.get("grossMargins"), np.nan),
            operating_margin=safe_float(info.get("operatingMargins"), np.nan),
            profit_margin=safe_float(info.get("profitMargins"), np.nan),
            debt_to_equity=safe_float(info.get("debtToEquity"), np.nan),
            return_on_equity=safe_float(info.get("returnOnEquity"), np.nan),
            macro_sensitivity=macro_sensitivity,
            confidence_level=derive_confidence_level(asset_type, technical["technical_score"], safe_float(fundamentals["fundamental_score"]), macro_score, news_score, risk_penalty),
            macro_note=macro_note,
            headline_bias=headline_bias,
            current_rsi=technical["current_rsi"],
            current_macd_hist=technical["current_macd_hist"],
            atr_pct=atr_pct,
            annualized_volatility=ann_vol,
            max_drawdown=dd_pct,
        )
        apply_horizon_recommendations(asset, horizon_context)
        ranked.append(asset)

        if i % 15 == 0:
            print(f"    scored {i}/{len(symbols)}...")
        time.sleep(0.03)
    print(f"[cache] fundamentals hits={fundamentals_cache_stats.hits} misses={fundamentals_cache_stats.misses}")
    log_timing(timing, "scoring", phase_started)

    if not ranked:
        return pd.DataFrame()

    print("[4/5] Enriching top names with headline / event context...")
    phase_started = timer_start()
    ranked.sort(key=lambda asset: asset.final_score, reverse=True)
    if not skip_news and news_limit > 0:
        for asset in ranked[: min(news_limit, len(ranked))]:
            if asset.asset_type not in {"EQUITY", "CRYPTO", "CRYPTO_PROXY"}:
                asset.headline_bias = "skipped for asset type"
                continue
            news_items, news_score, headline_bias, top_event, headline_risk = _fetch_news_with_cache(asset.symbol, cache_dir, news_cache_stats)
            news_cache[asset.symbol] = news_items
            current_macd, previous_macd = macd_cache.get(asset.symbol, (np.nan, np.nan))
            asset.news_score = round(news_score, 2)
            asset.headline_bias = headline_bias
            asset.upside_driver = top_event or derive_upside_driver(asset.technical_score, asset.fundamental_score, asset.news_score, asset.macro_score)
            asset.key_risk = derive_key_risk(asset.asset_type, asset.current_rsi, current_macd, previous_macd, asset.risk_penalty, asset.earnings_date, headline_risk)
            asset.final_score = round(composite_score(asset.asset_type, asset.technical_score, asset.fundamental_score, asset.news_score, asset.macro_score, asset.risk_penalty), 2)
            asset.rating = rating_from_score(asset.final_score)
            asset.confidence_level = derive_confidence_level(asset.asset_type, asset.technical_score, asset.fundamental_score, asset.macro_score, asset.news_score, asset.risk_penalty)
            apply_horizon_recommendations(asset, horizon_context_cache.get(asset.symbol, {}))
    print(f"[cache] news hits={news_cache_stats.hits} misses={news_cache_stats.misses}")
    log_timing(timing, "headline_news_enrichment", phase_started)

    print("[5/5] Building ranking table...")
    phase_started = timer_start()
    df_rank = pd.DataFrame([asdict(x) for x in ranked])
    if df_rank.empty:
        return df_rank
    df_rank["return_1d"] = df_rank["symbol"].map(one_day_return_cache)
    df_rank = apply_regime_adjustments(df_rank, market_regime)
    market_structure = compute_market_structure(df_rank)
    df_rank = apply_recommendation_quality(df_rank, market_structure)
    df_rank = apply_final_trade_decision(df_rank)
    df_rank = df_rank.sort_values(by=["final_score", "technical_score", "macro_score"], ascending=[False, False, False]).reset_index(drop=True)
    df_rank.attrs["ranked_assets"] = ranked
    df_rank.attrs["price_map"] = price_map
    df_rank.attrs["info_cache"] = info_cache
    df_rank.attrs["news_cache"] = news_cache
    df_rank.attrs["requested_universe"] = symbols
    df_rank.attrs["scanned_count"] = scanned_count
    df_rank.attrs["scan_started_at"] = started_at
    df_rank.attrs["scan_completed_at"] = datetime.now(timezone.utc)

    if outdir is not None:
        save_symbol_detail_outputs(ranked, price_map, info_cache, outdir)
    log_timing(timing, "ranking_table_build", phase_started)
    return df_rank


def load_universe_from_csv(path: str) -> list[str]:
    df = pd.read_csv(path)
    for col in ["symbol", "ticker", "Symbol", "Ticker"]:
        if col in df.columns:
            values = [str(x).strip().upper() for x in df[col].dropna().tolist()]
            return list(dict.fromkeys(values))
    raise ValueError("CSV must include one of these columns: symbol, ticker, Symbol, Ticker")
