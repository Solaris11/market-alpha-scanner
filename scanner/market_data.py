from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd
import yfinance as yf

from .config import DOWNLOAD_PERIOD
from .utils import safe_float, safe_str


ALPACA_DEFAULT_BASE_URL = "https://data.alpaca.markets"
ALPACA_DEFAULT_FEED = "iex"
ALPACA_CHUNK_SIZE = 50
ALPACA_PAGE_LIMIT = 10000
REQUEST_TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class ProviderMetadata:
    data_provider: str
    data_provider_primary: str
    data_provider_fallback_used: bool
    fallback_reason: str
    alpaca_request_id: str
    provider_latency_ms: float | None
    provider_error: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class ProviderResponse:
    frames: dict[str, pd.DataFrame]
    metadata: dict[str, ProviderMetadata]
    errors: dict[str, str]


@dataclass(frozen=True)
class ProviderHealth:
    ok: bool
    provider: str
    message: str


class AlpacaProvider:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        secret_key: str | None = None,
        base_url: str | None = None,
        feed: str | None = None,
    ) -> None:
        self.api_key = (api_key or os.getenv("ALPACA_API_KEY") or "").strip()
        self.secret_key = (secret_key or os.getenv("ALPACA_SECRET_KEY") or "").strip()
        self.base_url = (base_url or os.getenv("ALPACA_DATA_BASE_URL") or ALPACA_DEFAULT_BASE_URL).strip().rstrip("/")
        self.feed = (feed or os.getenv("ALPACA_DATA_FEED") or ALPACA_DEFAULT_FEED).strip() or ALPACA_DEFAULT_FEED

    def configured(self) -> bool:
        return bool(self.api_key and self.secret_key and self.base_url)

    def get_daily_bars(self, symbol: str, start: str | None = None, end: str | None = None) -> ProviderResponse:
        return self.get_daily_bars_many([symbol], start=start, end=end)

    def get_symbol_history(self, symbol: str, period: str = DOWNLOAD_PERIOD) -> pd.DataFrame:
        start, end = period_to_start_end(period)
        response = self.get_daily_bars(symbol, start=start, end=end)
        return response.frames.get(symbol.upper(), pd.DataFrame())

    def get_latest_price(self, symbol: str) -> float | None:
        frame = self.get_symbol_history(symbol, period="10d")
        if frame.empty or "Close" not in frame.columns:
            return None
        value = safe_float(frame["Close"].dropna().iloc[-1], float("nan")) if not frame["Close"].dropna().empty else float("nan")
        return None if value != value else value

    def health_check(self) -> ProviderHealth:
        if not self.configured():
            return ProviderHealth(ok=False, provider="alpaca", message="Alpaca credentials are not configured.")
        response = self.get_daily_bars("SPY", start=(datetime.now(timezone.utc) - timedelta(days=10)).date().isoformat(), end=datetime.now(timezone.utc).date().isoformat())
        ok = bool(response.frames.get("SPY") is not None and not response.frames["SPY"].empty)
        message = "Alpaca market data ok." if ok else "; ".join(response.errors.values()) or "No SPY bars returned."
        return ProviderHealth(ok=ok, provider="alpaca", message=message)

    def get_daily_bars_many(self, symbols: list[str], start: str | None = None, end: str | None = None) -> ProviderResponse:
        normalized_map: dict[str, str] = {}
        metadata: dict[str, ProviderMetadata] = {}
        errors: dict[str, str] = {}
        for symbol in symbols:
            original = symbol.upper()
            alpaca_symbol = alpaca_symbol_for(original)
            if alpaca_symbol is None:
                errors[original] = "alpaca_unsupported_symbol"
                continue
            normalized_map[alpaca_symbol] = original

        if not normalized_map:
            return ProviderResponse(frames={}, metadata=metadata, errors=errors)
        if not self.configured():
            for original in normalized_map.values():
                errors[original] = "alpaca_not_configured"
            return ProviderResponse(frames={}, metadata=metadata, errors=errors)

        frames: dict[str, pd.DataFrame] = {}
        for chunk_start in range(0, len(normalized_map), ALPACA_CHUNK_SIZE):
            chunk_symbols = list(normalized_map.keys())[chunk_start : chunk_start + ALPACA_CHUNK_SIZE]
            chunk_response = self._fetch_bars_chunk(chunk_symbols, start=start, end=end)
            for symbol, error in chunk_response.errors.items():
                original = normalized_map.get(symbol, symbol)
                errors[original] = error
            for symbol, frame in chunk_response.frames.items():
                original = normalized_map.get(symbol, symbol)
                frames[original] = frame
                item_metadata = chunk_response.metadata.get(symbol)
                metadata[original] = item_metadata if item_metadata is not None else ProviderMetadata(
                    data_provider="alpaca",
                    data_provider_primary="alpaca",
                    data_provider_fallback_used=False,
                    fallback_reason="",
                    alpaca_request_id="",
                    provider_latency_ms=None,
                    provider_error="",
                )

        for original in normalized_map.values():
            if original not in frames and original not in errors:
                errors[original] = "alpaca_missing_data"
        return ProviderResponse(frames=frames, metadata=metadata, errors=errors)

    def _fetch_bars_chunk(self, symbols: list[str], start: str | None = None, end: str | None = None) -> ProviderResponse:
        bars_by_symbol: dict[str, list[dict[str, object]]] = {symbol: [] for symbol in symbols}
        request_ids: list[str] = []
        total_latency_ms = 0.0
        page_token = ""
        errors: dict[str, str] = {}

        while True:
            params: dict[str, str | int] = {
                "symbols": ",".join(symbols),
                "timeframe": "1Day",
                "adjustment": "all",
                "feed": self.feed,
                "limit": ALPACA_PAGE_LIMIT,
            }
            if start:
                params["start"] = _alpaca_time(start, start_of_day=True)
            if end:
                params["end"] = _alpaca_time(end, start_of_day=False)
            if page_token:
                params["page_token"] = page_token

            try:
                payload, request_id, latency_ms = self._request_json("/v2/stocks/bars", params)
            except ProviderRequestError as exc:
                for symbol in symbols:
                    errors[symbol] = exc.public_reason
                return ProviderResponse(frames={}, metadata={}, errors=errors)

            total_latency_ms += latency_ms
            if request_id:
                request_ids.append(request_id)
            bars_payload = payload.get("bars")
            if isinstance(bars_payload, dict):
                for symbol, raw_items in bars_payload.items():
                    if symbol not in bars_by_symbol or not isinstance(raw_items, list):
                        continue
                    for raw_item in raw_items:
                        if isinstance(raw_item, dict):
                            bars_by_symbol[symbol].append({str(key): value for key, value in raw_item.items()})

            token_raw = payload.get("next_page_token")
            page_token = token_raw if isinstance(token_raw, str) else ""
            if not page_token:
                break

        frames: dict[str, pd.DataFrame] = {}
        metadata: dict[str, ProviderMetadata] = {}
        request_id_text = ",".join(dict.fromkeys(request_ids))
        for symbol, bars in bars_by_symbol.items():
            frame = alpaca_bars_to_frame(bars)
            if frame.empty:
                errors[symbol] = "alpaca_missing_data"
                continue
            frames[symbol] = frame
            metadata[symbol] = ProviderMetadata(
                data_provider="alpaca",
                data_provider_primary="alpaca",
                data_provider_fallback_used=False,
                fallback_reason="",
                alpaca_request_id=request_id_text,
                provider_latency_ms=round(total_latency_ms, 2),
                provider_error="",
            )
            frame.attrs["provider_metadata"] = metadata[symbol].to_dict()
        return ProviderResponse(frames=frames, metadata=metadata, errors=errors)

    def _request_json(self, path: str, params: dict[str, str | int]) -> tuple[dict[str, object], str, float]:
        url = f"{self.base_url}{path}?{urlencode(params)}"
        request = Request(
            url,
            headers={
                "APCA-API-KEY-ID": self.api_key,
                "APCA-API-SECRET-KEY": self.secret_key,
                "Accept": "application/json",
            },
            method="GET",
        )
        started = time.perf_counter()
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                body = response.read()
                request_id = response.headers.get("X-Request-ID", "")
                latency_ms = (time.perf_counter() - started) * 1000.0
                decoded = json.loads(body.decode("utf-8"))
        except HTTPError as exc:
            raise ProviderRequestError(status_to_reason(exc.code)) from exc
        except (URLError, TimeoutError) as exc:
            raise ProviderRequestError("alpaca_timeout_or_network_error") from exc
        except json.JSONDecodeError as exc:
            raise ProviderRequestError("alpaca_malformed_response") from exc
        if not isinstance(decoded, dict):
            raise ProviderRequestError("alpaca_malformed_response")
        return {str(key): value for key, value in decoded.items()}, request_id, latency_ms


class YFinanceProvider:
    def get_daily_bars(self, symbol: str, start: str | None = None, end: str | None = None) -> ProviderResponse:
        return self.get_daily_bars_many([symbol], period=DOWNLOAD_PERIOD, start=start, end=end)

    def get_symbol_history(self, symbol: str, period: str = DOWNLOAD_PERIOD) -> pd.DataFrame:
        response = self.get_daily_bars_many([symbol], period=period)
        return response.frames.get(symbol.upper(), pd.DataFrame())

    def get_latest_price(self, symbol: str) -> float | None:
        frame = self.get_symbol_history(symbol, period="10d")
        if frame.empty or "Close" not in frame.columns:
            return None
        close = frame["Close"].dropna()
        if close.empty:
            return None
        value = safe_float(close.iloc[-1], float("nan"))
        return None if value != value else value

    def health_check(self) -> ProviderHealth:
        response = self.get_daily_bars_many(["SPY"], period="10d")
        ok = "SPY" in response.frames and not response.frames["SPY"].empty
        return ProviderHealth(ok=ok, provider="yfinance", message="yfinance ok." if ok else "No SPY data returned.")

    def get_daily_bars_many(
        self,
        symbols: list[str],
        *,
        period: str = DOWNLOAD_PERIOD,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> ProviderResponse:
        out: dict[str, pd.DataFrame] = {}
        metadata: dict[str, ProviderMetadata] = {}
        errors: dict[str, str] = {}
        if not symbols:
            return ProviderResponse(frames=out, metadata=metadata, errors=errors)

        started = time.perf_counter()
        joined = " ".join(normalize_symbol_for_yfinance(s) for s in symbols)
        try:
            if start or end:
                raw = yf.download(
                    tickers=joined,
                    interval="1d",
                    auto_adjust=True,
                    progress=False,
                    group_by="ticker",
                    threads=True,
                    start=start,
                    end=end,
                )
            else:
                raw = yf.download(
                    tickers=joined,
                    interval="1d",
                    auto_adjust=True,
                    progress=False,
                    group_by="ticker",
                    threads=True,
                    period=period,
                )
        except Exception:
            for symbol in symbols:
                errors[symbol.upper()] = "yfinance_request_failed"
            return ProviderResponse(frames=out, metadata=metadata, errors=errors)
        latency_ms = (time.perf_counter() - started) * 1000.0
        if raw is None:
            for symbol in symbols:
                errors[symbol.upper()] = "yfinance_missing_data"
            return ProviderResponse(frames=out, metadata=metadata, errors=errors)

        raw_df = pd.DataFrame(raw)
        if raw_df.empty:
            for symbol in symbols:
                errors[symbol.upper()] = "yfinance_missing_data"
            return ProviderResponse(frames=out, metadata=metadata, errors=errors)

        if isinstance(raw_df.columns, pd.MultiIndex):
            for symbol in symbols:
                normalized = normalize_symbol_for_yfinance(symbol)
                original = symbol.upper()
                try:
                    symbol_df = pd.DataFrame(raw_df[normalized]).dropna(how="all").copy()
                except Exception:
                    errors[original] = "yfinance_missing_data"
                    continue
                if symbol_df.empty:
                    errors[original] = "yfinance_missing_data"
                    continue
                out[original] = symbol_df
                metadata[original] = yfinance_metadata(latency_ms=latency_ms)
                symbol_df.attrs["provider_metadata"] = metadata[original].to_dict()
        elif len(symbols) == 1:
            single_df = raw_df.dropna(how="all").copy()
            original = symbols[0].upper()
            if single_df.empty:
                errors[original] = "yfinance_missing_data"
            else:
                out[original] = single_df
                metadata[original] = yfinance_metadata(latency_ms=latency_ms)
                single_df.attrs["provider_metadata"] = metadata[original].to_dict()

        for symbol in symbols:
            original = symbol.upper()
            if original not in out and original not in errors:
                errors[original] = "yfinance_missing_data"
        return ProviderResponse(frames=out, metadata=metadata, errors=errors)


class ProviderRouter:
    def __init__(self, *, primary: str, fallback: str, alpaca: AlpacaProvider | None = None, yfinance_provider: YFinanceProvider | None = None) -> None:
        self.primary = primary.lower().strip() or "yfinance"
        self.fallback = fallback.lower().strip() or "yfinance"
        self.alpaca = alpaca or AlpacaProvider()
        self.yfinance = yfinance_provider or YFinanceProvider()

    @classmethod
    def from_env(cls) -> ProviderRouter:
        return cls(
            primary=os.getenv("MARKET_DATA_PROVIDER", "yfinance"),
            fallback=os.getenv("MARKET_DATA_FALLBACK", "yfinance"),
        )

    def get_daily_bars(self, symbol: str, start: str | None = None, end: str | None = None) -> dict[str, pd.DataFrame]:
        return self.get_daily_bars_many([symbol], period=DOWNLOAD_PERIOD, start=start, end=end)

    def get_symbol_history(self, symbol: str, period: str = DOWNLOAD_PERIOD) -> pd.DataFrame:
        response = self.get_daily_bars_many([symbol], period=period)
        return response.get(symbol.upper(), pd.DataFrame())

    def get_latest_price(self, symbol: str) -> float | None:
        frame = self.get_symbol_history(symbol, period="10d")
        if frame.empty or "Close" not in frame.columns:
            return None
        close = frame["Close"].dropna()
        if close.empty:
            return None
        value = safe_float(close.iloc[-1], float("nan"))
        return None if value != value else value

    def health_check(self) -> ProviderHealth:
        if self.primary == "alpaca":
            return self.alpaca.health_check()
        return self.yfinance.health_check()

    def get_daily_bars_many(
        self,
        symbols: list[str],
        *,
        period: str = DOWNLOAD_PERIOD,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> dict[str, pd.DataFrame]:
        normalized_symbols = [symbol.upper() for symbol in symbols]
        if self.primary != "alpaca":
            return self.yfinance.get_daily_bars_many(normalized_symbols, period=period, start=start, end=end).frames

        effective_start, effective_end = (start, end) if (start or end) else period_to_start_end(period)
        primary_response = self.alpaca.get_daily_bars_many(normalized_symbols, start=effective_start, end=effective_end)
        frames = dict(primary_response.frames)
        fallback_reasons = {symbol: reason for symbol, reason in primary_response.errors.items() if symbol not in frames}
        fallback_symbols = [symbol for symbol in normalized_symbols if symbol not in frames]

        if fallback_symbols and self.fallback == "yfinance":
            fallback_response = self.yfinance.get_daily_bars_many(fallback_symbols, period=period, start=start, end=end)
            for symbol, frame in fallback_response.frames.items():
                reason = fallback_reasons.get(symbol) or "alpaca_failed"
                metadata = ProviderMetadata(
                    data_provider="yfinance",
                    data_provider_primary="alpaca",
                    data_provider_fallback_used=True,
                    fallback_reason=reason,
                    alpaca_request_id="",
                    provider_latency_ms=_metadata_latency(frame),
                    provider_error="",
                )
                frame.attrs["provider_metadata"] = metadata.to_dict()
                frames[symbol] = frame
            for symbol, reason in fallback_response.errors.items():
                if symbol in frames:
                    continue
                metadata = ProviderMetadata(
                    data_provider="",
                    data_provider_primary="alpaca",
                    data_provider_fallback_used=True,
                    fallback_reason=fallback_reasons.get(symbol) or "alpaca_failed",
                    alpaca_request_id="",
                    provider_latency_ms=None,
                    provider_error=f"{fallback_reasons.get(symbol) or 'alpaca_failed'};{reason}",
                )
                empty = pd.DataFrame()
                empty.attrs["provider_metadata"] = metadata.to_dict()

        return frames


class ProviderRequestError(Exception):
    def __init__(self, public_reason: str) -> None:
        super().__init__(public_reason)
        self.public_reason = public_reason


def normalize_symbol_for_yfinance(symbol: str) -> str:
    return symbol


def alpaca_symbol_for(symbol: str) -> str | None:
    cleaned = symbol.upper().strip()
    if not cleaned or cleaned.startswith("^"):
        return None
    if cleaned in {"BTC-USD", "ETH-USD"}:
        return None
    if "-" in cleaned:
        if cleaned in {"BRK-B", "BRK-A"}:
            return cleaned.replace("-", ".")
        return None
    return cleaned


def alpaca_bars_to_frame(bars: list[dict[str, object]]) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    index_values: list[pd.Timestamp] = []
    for item in bars:
        timestamp_raw = safe_str(item.get("t"), "")
        timestamp = pd.to_datetime(timestamp_raw, utc=True, errors="coerce")
        if pd.isna(timestamp):
            continue
        close_value = safe_float(item.get("c"), float("nan"))
        row: dict[str, object] = {
            "Open": safe_float(item.get("o"), float("nan")),
            "High": safe_float(item.get("h"), float("nan")),
            "Low": safe_float(item.get("l"), float("nan")),
            "Close": close_value,
            "Adj Close": close_value,
            "Volume": safe_float(item.get("v"), float("nan")),
        }
        rows.append(row)
        index_values.append(pd.Timestamp(timestamp))
    if not rows:
        return pd.DataFrame()
    frame = pd.DataFrame(rows, index=pd.DatetimeIndex(index_values, name="Date")).sort_index()
    return frame.dropna(how="all").copy()


def period_to_start_end(period: str) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    lowered = period.strip().lower()
    days = 730
    if lowered.endswith("d"):
        days = max(1, int(safe_float(lowered[:-1], 730.0)))
    elif lowered.endswith("mo"):
        days = max(1, int(safe_float(lowered[:-2], 24.0) * 31))
    elif lowered.endswith("y"):
        days = max(1, int(safe_float(lowered[:-1], 2.0) * 365))
    start = now - timedelta(days=days + 7)
    return start.date().isoformat(), now.date().isoformat()


def status_to_reason(status_code: int) -> str:
    if status_code in {401, 403}:
        return "alpaca_auth_failed"
    if status_code == 429:
        return "alpaca_rate_limited"
    if 500 <= status_code <= 599:
        return "alpaca_server_error"
    return f"alpaca_http_{status_code}"


def yfinance_metadata(*, latency_ms: float) -> ProviderMetadata:
    return ProviderMetadata(
        data_provider="yfinance",
        data_provider_primary="yfinance",
        data_provider_fallback_used=False,
        fallback_reason="",
        alpaca_request_id="",
        provider_latency_ms=round(latency_ms, 2),
        provider_error="",
    )


def _metadata_latency(frame: pd.DataFrame) -> float | None:
    raw = frame.attrs.get("provider_metadata") if isinstance(frame.attrs, dict) else None
    if not isinstance(raw, dict):
        return None
    value = raw.get("provider_latency_ms")
    numeric = safe_float(value, float("nan"))
    return None if numeric != numeric else round(numeric, 2)


def _alpaca_time(value: str, *, start_of_day: bool) -> str:
    try:
        parsed = pd.Timestamp(value)
    except Exception:
        parsed = pd.Timestamp(datetime.now(timezone.utc))
    if parsed.tzinfo is None:
        parsed = parsed.tz_localize(timezone.utc)
    parsed = parsed.tz_convert(timezone.utc)
    if start_of_day:
        parsed = parsed.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=0)
    return parsed.isoformat().replace("+00:00", "Z")
