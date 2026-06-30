"""IKQF v2 Market Regime Detector."""
from __future__ import annotations
from typing import Any


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def detect_regime(cmc_signal: dict[str, Any] | None = None, market_scan: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    cmc_signal = cmc_signal or {}
    market_scan = market_scan or []

    fear = _safe_float((cmc_signal.get("fear_greed") or {}).get("value"), 50)
    cmc_bias = str(cmc_signal.get("market_bias", "unknown")).lower()

    changes = [_safe_float(item.get("change_24h_pct")) for item in market_scan if item.get("source") != "fallback_watchlist"]
    ranges = [_safe_float(item.get("range_24h_pct")) for item in market_scan if item.get("source") != "fallback_watchlist"]

    avg_change = sum(changes) / len(changes) if changes else 0.0
    avg_range = sum(ranges) / len(ranges) if ranges else 0.0
    positive_ratio = (sum(1 for value in changes if value > 0) / len(changes)) if changes else 0.5

    if "bear" in cmc_bias or "risk-off" in cmc_bias or fear <= 25 or (avg_change < -3 and positive_ratio < 0.35):
        regime = "bear_defensive"
        allowed_strategies = ["mean_reversion", "tdi_signal_reversal", "adaptive_grid_plus"]
        exposure_multiplier = 0.25
        min_confidence_to_buy = 88
    elif fear >= 70 or (avg_change > 2 and positive_ratio > 0.60):
        regime = "bull_momentum"
        allowed_strategies = ["trend_continuation", "momentum_rotation", "trend_confluence", "momentum_breakout", "relative_strength_rotation"]
        exposure_multiplier = 0.85
        min_confidence_to_buy = 72
    elif avg_range >= 5:
        regime = "volatile_range"
        allowed_strategies = ["adaptive_grid", "adaptive_grid_plus", "mean_reversion", "top_loser_reversal", "vwap_reversion"]
        exposure_multiplier = 0.55
        min_confidence_to_buy = 78
    else:
        regime = "neutral_wait"
        allowed_strategies = ["trend_confluence", "mean_reversion", "tdi_signal_reversal"]
        exposure_multiplier = 0.40
        min_confidence_to_buy = 82

    return {
        "regime": regime,
        "fear_greed": fear,
        "cmc_bias": cmc_bias,
        "avg_24h_change_pct": round(avg_change, 4),
        "avg_24h_range_pct": round(avg_range, 4),
        "positive_ratio": round(positive_ratio, 4),
        "allowed_strategies": allowed_strategies,
        "exposure_multiplier": exposure_multiplier,
        "min_confidence_to_buy": min_confidence_to_buy,
    }
