"""IKQF v2 Market Scanner.

Scans Binance USDT spot tickers and returns liquid, tradeable candidates.
This module is deterministic and safe: it only produces rankings, never trades.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any
import json
import os
import time
from urllib.request import urlopen, Request


DEFAULT_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT",
    "DOGEUSDT", "LINKUSDT", "AVAXUSDT", "TRXUSDT", "DOTUSDT", "LTCUSDT",
    "BCHUSDT", "UNIUSDT", "NEARUSDT", "ATOMUSDT", "FILUSDT", "APTUSDT",
    "ARBUSDT", "OPUSDT", "INJUSDT", "SUIUSDT", "SEIUSDT", "CAKEUSDT",
]

STABLE_BASES = {"USDT", "USDC", "FDUSD", "TUSD", "DAI", "BUSD", "USD1", "EUR"}
CACHE_TTL_SECONDS = int(os.getenv("IKQF_MARKET_SCAN_CACHE_SECONDS", "45"))
_cache: dict[str, Any] = {"expires_at": 0, "data": []}


@dataclass
class MarketCandidate:
    symbol: str
    coin: str
    last_price: float
    quote_volume_usdt: float
    change_24h_pct: float
    high_24h: float
    low_24h: float
    range_24h_pct: float
    trade_count: int
    source: str = "binance_24hr_ticker"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _fetch_binance_24h() -> list[dict[str, Any]]:
    url = "https://api.binance.com/api/v3/ticker/24hr"
    request = Request(url, headers={"User-Agent": "IKQF-v2-market-scanner/1.0"})
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def _candidate_from_ticker(row: dict[str, Any]) -> MarketCandidate | None:
    symbol = str(row.get("symbol", "")).upper()
    if not symbol.endswith("USDT"):
        return None

    coin = symbol[:-4]
    if not coin or coin in STABLE_BASES:
        return None

    last_price = _safe_float(row.get("lastPrice"))
    quote_volume = _safe_float(row.get("quoteVolume"))
    high = _safe_float(row.get("highPrice"))
    low = _safe_float(row.get("lowPrice"))
    change_pct = _safe_float(row.get("priceChangePercent"))
    trade_count = _safe_int(row.get("count"))

    if last_price <= 0 or high <= 0 or low <= 0:
        return None

    range_pct = ((high - low) / last_price) * 100

    return MarketCandidate(
        symbol=symbol,
        coin=coin,
        last_price=last_price,
        quote_volume_usdt=quote_volume,
        change_24h_pct=change_pct,
        high_24h=high,
        low_24h=low,
        range_24h_pct=range_pct,
        trade_count=trade_count,
    )


def _fallback_candidates() -> list[dict[str, Any]]:
    # Conservative fallback if Binance is temporarily unavailable.
    # These are not live-ranked; the engine should treat them as low-confidence watchlist data.
    return [
        MarketCandidate(
            symbol=s,
            coin=s[:-4],
            last_price=0.0,
            quote_volume_usdt=0.0,
            change_24h_pct=0.0,
            high_24h=0.0,
            low_24h=0.0,
            range_24h_pct=0.0,
            trade_count=0,
            source="fallback_watchlist",
        ).to_dict()
        for s in DEFAULT_SYMBOLS
    ]


def scan_usdt_market(limit: int = 50, min_quote_volume_usdt: float = 20_000_000, min_range_pct: float = 1.0) -> list[dict[str, Any]]:
    now = time.time()
    if _cache["expires_at"] > now and _cache["data"]:
        return _cache["data"][:limit]

    try:
        raw = _fetch_binance_24h()
        candidates = []
        for row in raw:
            candidate = _candidate_from_ticker(row)
            if not candidate:
                continue
            if candidate.quote_volume_usdt < min_quote_volume_usdt:
                continue
            if candidate.range_24h_pct < min_range_pct:
                continue
            candidates.append(candidate.to_dict())

        candidates.sort(
            key=lambda item: (
                item["quote_volume_usdt"],
                item["range_24h_pct"],
                abs(item["change_24h_pct"]),
            ),
            reverse=True,
        )
        data = candidates[:limit]
    except Exception as exc:
        data = _fallback_candidates()
        for item in data:
            item["scanner_error"] = str(exc)

    _cache["expires_at"] = now + CACHE_TTL_SECONDS
    _cache["data"] = data
    return data[:limit]
