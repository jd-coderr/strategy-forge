"""IKQF v2 Confidence Engine."""
from __future__ import annotations
from typing import Any


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(str(value).replace("%", "").replace(",", ""))
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def confidence_for_opportunity(candidate: dict[str, Any], strategy: dict[str, Any], backtest: dict[str, Any], regime: dict[str, Any]) -> dict[str, Any]:
    coin_score = _safe_float(candidate.get("score"))
    risk_adjusted = _safe_float(backtest.get("risk_adjusted_score"))
    profit_factor = _safe_float(backtest.get("profit_factor"))
    win_rate = _safe_float(backtest.get("win_rate"))
    drawdown = abs(_safe_float(backtest.get("max_drawdown")))
    signals_per_day = _safe_float(backtest.get("signals_per_day_value", backtest.get("signals_per_day")))

    backtest_score = _clamp(risk_adjusted * 6.5)
    pf_score = _clamp(profit_factor * 25)
    win_score = _clamp(win_rate)
    drawdown_score = _clamp(100 - drawdown * 3.0)
    activity_score = _clamp(signals_per_day * 18)

    strategy_type = str(strategy.get("type", ""))
    allowed = strategy_type in set(regime.get("allowed_strategies", []))
    regime_score = 100 if allowed else 55

    confidence = (
        coin_score * 0.26
        + backtest_score * 0.22
        + pf_score * 0.16
        + win_score * 0.12
        + drawdown_score * 0.12
        + activity_score * 0.05
        + regime_score * 0.07
    )

    penalties = []
    if backtest.get("drawdown_gate") != "PASS":
        confidence -= 20
        penalties.append("Backtest drawdown gate did not pass.")
    if backtest.get("min_trade_gate") != "PASS":
        confidence -= 12
        penalties.append("Minimum-trade gate did not pass.")
    if not allowed:
        confidence -= 10
        penalties.append("Strategy is not ideal for the detected market regime.")
    if candidate.get("source") == "fallback_watchlist":
        confidence = min(confidence, 55)
        penalties.append("Live market scanner unavailable; fallback watchlist used.")

    confidence = round(_clamp(confidence), 2)
    min_required = _safe_float(regime.get("min_confidence_to_buy"), 80)

    if confidence >= min_required:
        action = "BUY_OR_HOLD_STRONGEST"
    elif confidence >= min_required - 10:
        action = "WATCH"
    else:
        action = "HOLD_USDT"

    return {
        "confidence": confidence,
        "min_required": min_required,
        "action": action,
        "breakdown": {
            "coin_score": round(coin_score, 2),
            "backtest_score": round(backtest_score, 2),
            "profit_factor_score": round(pf_score, 2),
            "win_rate_score": round(win_score, 2),
            "drawdown_score": round(drawdown_score, 2),
            "activity_score": round(activity_score, 2),
            "regime_score": round(regime_score, 2),
        },
        "penalties": penalties,
    }
