"""IKQF v2 Coin Ranking Engine."""
from __future__ import annotations
from typing import Any


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def score_candidate(candidate: dict[str, Any], regime: dict[str, Any] | None = None) -> dict[str, Any]:
    regime = regime or {}
    change = _safe_float(candidate.get("change_24h_pct"))
    range_pct = _safe_float(candidate.get("range_24h_pct"))
    volume = _safe_float(candidate.get("quote_volume_usdt"))
    trades = _safe_float(candidate.get("trade_count"))

    # Liquidity: $20m = acceptable, $250m+ = excellent.
    liquidity_score = _clamp((volume / 250_000_000) * 100)

    # Grid/scalping wants movement, but not insanity.
    volatility_score = _clamp((range_pct / 12.0) * 100)

    # Avoid falling knives; prefer strength or controlled pullbacks.
    if change >= 0:
        strength_score = _clamp(55 + change * 2.2)
    elif change >= -8:
        strength_score = _clamp(55 + change * 3.0)
    else:
        strength_score = _clamp(15 + change)  # heavy penalty below -8%

    activity_score = _clamp((trades / 1_000_000) * 100)

    risk_penalty = 0
    reasons = []
    if change <= -12:
        risk_penalty += 30
        reasons.append("24h change is below -12%; falling-knife risk.")
    if range_pct >= 25:
        risk_penalty += 20
        reasons.append("24h range is extremely wide; slippage/whipsaw risk.")
    if volume < 20_000_000:
        risk_penalty += 35
        reasons.append("Liquidity below the minimum target.")

    regime_label = str(regime.get("regime", "neutral")).lower()
    regime_bonus = 0
    if "bull" in regime_label and change > 0:
        regime_bonus += 8
        reasons.append("Bull regime supports relative strength.")
    if "bear" in regime_label and change < 0:
        risk_penalty += 12
        reasons.append("Bear regime makes weak coins more dangerous.")
    if "range" in regime_label and 2 <= range_pct <= 14:
        regime_bonus += 8
        reasons.append("Ranging regime supports oscillation strategies.")

    score = (
        liquidity_score * 0.25
        + volatility_score * 0.30
        + strength_score * 0.30
        + activity_score * 0.15
        + regime_bonus
        - risk_penalty
    )

    if not reasons:
        reasons.append("Liquid, active, and inside acceptable volatility/risk bounds.")

    output = dict(candidate)
    output.update({
        "score": round(_clamp(score), 2),
        "liquidity_score": round(liquidity_score, 2),
        "volatility_score": round(volatility_score, 2),
        "strength_score": round(strength_score, 2),
        "activity_score": round(activity_score, 2),
        "risk_penalty": round(risk_penalty, 2),
        "rank_reasons": reasons,
    })
    return output


def rank_candidates(candidates: list[dict[str, Any]], regime: dict[str, Any] | None = None, limit: int = 20) -> list[dict[str, Any]]:
    ranked = [score_candidate(candidate, regime) for candidate in candidates]
    ranked.sort(key=lambda item: item.get("score", 0), reverse=True)
    for index, item in enumerate(ranked, start=1):
        item["rank"] = index
    return ranked[:limit]
