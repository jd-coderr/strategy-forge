"""IKQF v2 Opportunity Engine.

This sits above the old single-coin strategy selector:
1. scan market
2. detect regime
3. rank coins
4. run strategy tournament on top candidates
5. score confidence
6. return best opportunity or hold-USDT
"""
from __future__ import annotations
from typing import Any, Callable
import os

from market_scanner import scan_usdt_market
from coin_ranker import rank_candidates
from regime_detector import detect_regime
from confidence_engine import confidence_for_opportunity
from capital_allocator import allocation_plan


def build_v2_opportunity(
    *,
    cmc_signal: dict[str, Any] | None,
    strategies: list[dict[str, Any]],
    run_backtest_fn: Callable[..., dict[str, Any]],
    timeframe: str,
    risk: str,
    initial_capital: float,
    max_candidates: int | None = None,
) -> dict[str, Any]:
    max_candidates = max_candidates or int(os.getenv("IKQF_V2_MAX_CANDIDATES", "5"))
    scan = scan_usdt_market(limit=50)
    regime = detect_regime(cmc_signal=cmc_signal, market_scan=scan)
    ranked = rank_candidates(scan, regime=regime, limit=20)

    allowed_types = set(regime.get("allowed_strategies") or [])
    strategy_pool = [s for s in strategies if s.get("type") in allowed_types] or strategies

    opportunities: list[dict[str, Any]] = []

    for candidate in ranked[:max_candidates]:
        coin = candidate["coin"]
        for strategy in strategy_pool:
            try:
                backtest = run_backtest_fn(
                    strategy=strategy,
                    coin=coin,
                    timeframe=timeframe,
                    risk=risk,
                    initial_capital=initial_capital,
                )
            except Exception as exc:
                backtest = {
                    "risk_adjusted_score": 0,
                    "profit_factor": 0,
                    "win_rate": 0,
                    "max_drawdown": "999%",
                    "drawdown_gate": "FAIL",
                    "min_trade_gate": "FAIL",
                    "error": str(exc),
                }

            confidence = confidence_for_opportunity(candidate, strategy, backtest, regime)
            allocation = allocation_plan(confidence["confidence"], regime, risk)
            opportunities.append({
                "coin": coin,
                "symbol": candidate.get("symbol"),
                "candidate": candidate,
                "strategy": {
                    "name": strategy.get("name"),
                    "type": strategy.get("type"),
                    "source_file": strategy.get("source_file"),
                },
                "backtest": backtest,
                "confidence": confidence,
                "allocation": allocation,
                "score": confidence["confidence"],
            })

    opportunities.sort(key=lambda item: item.get("score", 0), reverse=True)
    best = opportunities[0] if opportunities else None

    decision = "HOLD_USDT"
    if best and best["confidence"]["action"] == "BUY_OR_HOLD_STRONGEST":
        decision = "TRADE_BEST_OPPORTUNITY"

    return {
        "success": bool(best),
        "mode": "v2_opportunity_engine",
        "decision": decision,
        "regime": regime,
        "scanner": {
            "scanned_count": len(scan),
            "ranked_count": len(ranked),
            "tested_candidates": min(len(ranked), max_candidates),
            "tested_strategies": len(strategy_pool),
        },
        "top_ranked_coins": ranked[:10],
        "top_opportunities": opportunities[:10],
        "best_opportunity": best,
        "reason": (
            "IKQF v2 selected the highest-confidence opportunity across coin ranking, market regime, strategy tournament, backtest quality, and risk allocation."
            if best else
            "IKQF v2 found no valid opportunity; stay in USDT."
        ),
    }
