"""IKQF v2 Capital Allocator."""
from __future__ import annotations
from typing import Any


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def allocation_plan(confidence: float, regime: dict[str, Any], risk: str = "medium") -> dict[str, Any]:
    risk = str(risk or "medium").lower()
    base_by_risk = {
        "low": 0.20,
        "medium": 0.35,
        "high": 0.50,
    }.get(risk, 0.35)

    exposure_multiplier = _safe_float(regime.get("exposure_multiplier"), 0.4)

    if confidence < _safe_float(regime.get("min_confidence_to_buy"), 80):
        deployed_fraction = 0.0
    else:
        confidence_boost = min(1.25, max(0.75, confidence / 85.0))
        deployed_fraction = base_by_risk * exposure_multiplier * confidence_boost

    deployed_fraction = max(0.0, min(0.75, deployed_fraction))

    return {
        "risk_profile": risk,
        "deployed_fraction": round(deployed_fraction, 4),
        "keep_usdt_fraction": round(1 - deployed_fraction, 4),
        "max_single_trade_fraction": round(min(deployed_fraction, 0.25), 4),
        "rule": "Deploy only when confidence clears the regime threshold; otherwise stay in USDT.",
    }
