from __future__ import annotations

from datetime import datetime, timezone
import os
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
from .diagnostics import apply_scoring_diagnostics
from .market_data import ProviderMetadata, YFinanceProvider
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

BUY_FINAL_DECISIONS = {"ENTER", "BUY", "STRONG BUY", "STRONG_BUY"}
MIN_BUY_CONFIDENCE_SCORE = 70.0
SEVERE_VETO_CODES = {
    "STALE_DATA",
    "LOW_CONFIDENCE_DATA",
    "PROVIDER_ERROR",
    "EXTREME_VOLATILITY",
    "POOR_RISK_REWARD",
    "STOP_RISK",
    "RISK_OFF_MARKET",
    "BEAR_MARKET",
}


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
            fallback_df = _fallback_yfinance_frame(symbol, df, "alpaca_insufficient_history")
            if fallback_df is None or fallback_df.empty:
                continue
            df = fallback_df
            price_map[symbol] = df
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
            fallback_df = _fallback_yfinance_frame(symbol, df, "alpaca_low_liquidity_proxy")
            if fallback_df is None or fallback_df.empty or len(fallback_df) < 220:
                continue
            fallback_close = fallback_df["Close"].dropna()
            if fallback_close.empty:
                continue
            fallback_last_price = safe_float(fallback_close.iloc[-1], np.nan)
            fallback_previous_close = safe_float(fallback_close.iloc[-2], np.nan) if len(fallback_close) >= 2 else np.nan
            fallback_avg_dollar_volume = safe_float((fallback_df["Close"].iloc[-20:] * fallback_df["Volume"].iloc[-20:]).mean(), np.nan)
            if np.isnan(fallback_last_price) or fallback_last_price < min_price:
                continue
            if np.isnan(fallback_avg_dollar_volume) or fallback_avg_dollar_volume < min_avg_dollar_volume:
                continue
            df = fallback_df
            price_map[symbol] = df
            close = fallback_close
            last_price = fallback_last_price
            previous_close = fallback_previous_close
            one_day_return = (last_price / previous_close - 1.0) if not np.isnan(last_price) and not np.isnan(previous_close) and previous_close != 0 else np.nan
            avg_dollar_volume = fallback_avg_dollar_volume

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
    df_rank = attach_price_data_quality(df_rank, price_map)
    df_rank = apply_scoring_diagnostics(df_rank)
    df_rank = apply_regime_adjustments(df_rank, market_regime)
    market_structure = compute_market_structure(df_rank)
    df_rank = apply_recommendation_quality(df_rank, market_structure)
    df_rank = apply_final_trade_decision(df_rank)
    df_rank = apply_scoring_diagnostics(df_rank)
    df_rank = apply_decision_safety_gates(df_rank)
    df_rank = apply_scoring_diagnostics(df_rank)
    df_rank = df_rank.sort_values(by=["final_score", "technical_score", "macro_score"], ascending=[False, False, False]).reset_index(drop=True)
    df_rank.attrs["ranked_assets"] = ranked
    df_rank.attrs["price_map"] = price_map
    df_rank.attrs["info_cache"] = info_cache
    df_rank.attrs["news_cache"] = news_cache
    df_rank.attrs["requested_universe"] = symbols
    df_rank.attrs["scanned_count"] = scanned_count
    df_rank.attrs["scan_started_at"] = started_at
    df_rank.attrs["scan_completed_at"] = datetime.now(timezone.utc)
    df_rank.attrs["market_regime"] = market_regime
    df_rank.attrs["market_structure"] = market_structure

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


def _fallback_yfinance_frame(symbol: str, current_frame: pd.DataFrame | None, reason: str) -> pd.DataFrame | None:
    if os.getenv("MARKET_DATA_PROVIDER", "yfinance").strip().lower() != "alpaca":
        return None
    if os.getenv("MARKET_DATA_FALLBACK", "yfinance").strip().lower() != "yfinance":
        return None
    if current_frame is not None and _frame_provider(current_frame) != "alpaca":
        return None

    response = YFinanceProvider().get_daily_bars_many([symbol.upper()], period=DOWNLOAD_PERIOD)
    fallback = response.frames.get(symbol.upper())
    if fallback is None or fallback.empty:
        return None
    fallback_metadata = response.metadata.get(symbol.upper())
    fallback.attrs["provider_metadata"] = ProviderMetadata(
        data_provider="yfinance",
        data_provider_primary="alpaca",
        data_provider_fallback_used=True,
        fallback_reason=reason,
        alpaca_request_id=_frame_alpaca_request_id(current_frame),
        provider_latency_ms=fallback_metadata.provider_latency_ms if fallback_metadata is not None else None,
        provider_error="",
    ).to_dict()
    return fallback


def _frame_provider(frame: pd.DataFrame) -> str:
    raw = frame.attrs.get("provider_metadata")
    if not isinstance(raw, dict):
        return ""
    return safe_str(raw.get("data_provider"), "").lower()


def _frame_alpaca_request_id(frame: pd.DataFrame | None) -> str:
    if frame is None:
        return ""
    raw = frame.attrs.get("provider_metadata")
    if not isinstance(raw, dict):
        return ""
    return safe_str(raw.get("alpaca_request_id"), "")


def attach_price_data_quality(df_rank: pd.DataFrame, price_map: dict[str, pd.DataFrame]) -> pd.DataFrame:
    working = df_rank.copy()
    symbols = [safe_str(symbol, "").upper() for symbol in working["symbol"].tolist()]
    metadata = [_price_provider_metadata(price_map, symbol) for symbol in symbols]
    working["data_provider"] = [safe_str(item.get("data_provider"), "unknown") for item in metadata]
    working["data_provider_primary"] = [safe_str(item.get("data_provider_primary"), "unknown") for item in metadata]
    working["data_provider_fallback_used"] = [_bool_value(item.get("data_provider_fallback_used")) for item in metadata]
    working["fallback_reason"] = [safe_str(item.get("fallback_reason"), "") for item in metadata]
    working["alpaca_request_id"] = [safe_str(item.get("alpaca_request_id"), "") for item in metadata]
    working["provider_latency_ms"] = [_optional_float(item.get("provider_latency_ms")) for item in metadata]
    working["price_history_rows"] = [_price_history_rows(price_map, symbol) for symbol in symbols]
    working["history_days"] = [_price_history_days(price_map, symbol) for symbol in symbols]
    working["data_timestamp"] = [_price_data_timestamp(price_map, symbol) for symbol in symbols]
    working["data_age_minutes"] = [_price_data_age_minutes(price_map, symbol) for symbol in symbols]
    working["provider_error"] = [safe_str(item.get("provider_error"), "") for item in metadata]
    return working


def _price_history_rows(price_map: dict[str, pd.DataFrame], symbol: str) -> int | None:
    frame = price_map.get(symbol)
    if frame is None or frame.empty:
        return None
    return int(len(frame))


def _price_history_days(price_map: dict[str, pd.DataFrame], symbol: str) -> int | None:
    frame = price_map.get(symbol)
    if frame is None or frame.empty or len(frame.index) < 2:
        return None
    first = pd.Timestamp(frame.index[0])
    last = pd.Timestamp(frame.index[-1])
    return int(max(0, (last - first).days))


def _price_data_timestamp(price_map: dict[str, pd.DataFrame], symbol: str) -> str:
    frame = price_map.get(symbol)
    if frame is None or frame.empty:
        return ""
    return pd.Timestamp(frame.index[-1]).isoformat()


def _price_data_age_minutes(price_map: dict[str, pd.DataFrame], symbol: str) -> float | None:
    frame = price_map.get(symbol)
    if frame is None or frame.empty:
        return None
    timestamp = pd.Timestamp(frame.index[-1])
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize(timezone.utc)
    timestamp = timestamp.tz_convert(timezone.utc)
    age = datetime.now(timezone.utc) - timestamp.to_pydatetime()
    return round(max(0.0, age.total_seconds() / 60.0), 2)


def _price_provider_metadata(price_map: dict[str, pd.DataFrame], symbol: str) -> dict[str, object]:
    frame = price_map.get(symbol)
    if frame is None:
        return {
            "data_provider": "missing",
            "data_provider_primary": "unknown",
            "data_provider_fallback_used": False,
            "fallback_reason": "",
            "alpaca_request_id": "",
            "provider_latency_ms": None,
            "provider_error": "missing_price_history",
        }
    raw = frame.attrs.get("provider_metadata")
    if isinstance(raw, dict):
        return {str(key): value for key, value in raw.items()}
    return {
        "data_provider": "yfinance",
        "data_provider_primary": "yfinance",
        "data_provider_fallback_used": False,
        "fallback_reason": "",
        "alpaca_request_id": "",
        "provider_latency_ms": None,
        "provider_error": "",
    }


def _optional_float(value: object) -> float | None:
    numeric = safe_float(value, np.nan)
    return None if np.isnan(numeric) else float(numeric)


def apply_decision_safety_gates(df_rank: pd.DataFrame) -> pd.DataFrame:
    working = df_rank.copy()
    for index, row in working.iterrows():
        decision = safe_str(row.get("final_decision"), "").upper()
        if decision not in BUY_FINAL_DECISIONS:
            continue

        vetoes = _veto_codes(row.get("vetoes"))
        trade_permitted = _bool_value(row.get("trade_permitted"))
        confidence_score = safe_float(row.get("confidence_score"), np.nan)
        confidence_threshold = _threshold_value(row.get("adjusted_thresholds"), "confidence", MIN_BUY_CONFIDENCE_SCORE)
        buy_score_threshold = _threshold_value(row.get("adjusted_thresholds"), "buy_score", 80.0)
        score_value = safe_float(row.get("final_score"), np.nan)

        if not trade_permitted:
            next_decision = "AVOID" if _has_severe_veto(vetoes) or _has_regime_hard_veto(row, vetoes) else "WAIT_PULLBACK"
            working.at[index, "final_decision"] = next_decision
            working.at[index, "decision_reason"] = _veto_decision_reason(vetoes, next_decision)
            if next_decision == "AVOID":
                working.at[index, "suggested_entry"] = np.nan
                working.at[index, "entry_distance_pct"] = np.nan
            continue

        if _has_regime_hard_veto(row, vetoes):
            working.at[index, "final_decision"] = "AVOID"
            working.at[index, "decision_reason"] = _veto_decision_reason(vetoes, "AVOID")
            working.at[index, "suggested_entry"] = np.nan
            working.at[index, "entry_distance_pct"] = np.nan
            continue

        if not np.isnan(score_value) and score_value < buy_score_threshold:
            working.at[index, "final_decision"] = "WATCH"
            working.at[index, "decision_reason"] = f"Regime-adjusted score below {buy_score_threshold:.0f}; monitor until conditions improve"
            working.at[index, "suggested_entry"] = np.nan
            working.at[index, "entry_distance_pct"] = np.nan
            continue

        if not np.isnan(confidence_score) and confidence_score < confidence_threshold:
            working.at[index, "final_decision"] = "WATCH"
            working.at[index, "decision_reason"] = f"Confidence score below {confidence_threshold:.0f}; monitor until confirmation improves"
            working.at[index, "suggested_entry"] = np.nan
            working.at[index, "entry_distance_pct"] = np.nan
    return working


def _veto_codes(value: object) -> list[str]:
    if isinstance(value, list):
        return [safe_str(item, "").upper() for item in value if safe_str(item, "")]
    if isinstance(value, tuple):
        return [safe_str(item, "").upper() for item in value if safe_str(item, "")]
    text = safe_str(value, "")
    if not text:
        return []
    return [part.strip().upper() for part in text.strip("[]").replace('"', "").replace("'", "").split(",") if part.strip()]


def _bool_value(value: object) -> bool:
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    normalized = safe_str(value, "").lower()
    return normalized in {"true", "1", "yes", "y"}


def _has_severe_veto(vetoes: list[str]) -> bool:
    return any(code in SEVERE_VETO_CODES for code in vetoes)


def _has_regime_hard_veto(row: pd.Series, vetoes: list[str]) -> bool:
    market_regime = safe_str(row.get("market_regime"), "").upper()
    setup_type = safe_str(row.get("setup_type"), "").lower()
    if market_regime == "OVERHEATED" and "OVEREXTENDED_ENTRY" in vetoes:
        return True
    if market_regime == "BEAR" and "breakout" in setup_type:
        return True
    return False


def _threshold_value(value: object, key: str, default: float) -> float:
    if isinstance(value, dict):
        return safe_float(value.get(key), default)
    text = safe_str(value, "")
    if not text:
        return default
    normalized = text.strip().strip("{}")
    for part in normalized.split(","):
        if ":" not in part:
            continue
        raw_key, raw_value = part.split(":", 1)
        if raw_key.strip().strip("'\"") == key:
            return safe_float(raw_value.strip().strip("'\""), default)
    return default


def _veto_decision_reason(vetoes: list[str], decision: str) -> str:
    joined = ", ".join(vetoes) if vetoes else "risk gate"
    if decision == "AVOID":
        return f"Hard veto blocked entry: {joined}"
    return f"Entry blocked by veto; wait for confirmation: {joined}"
