from cmc_skill_hub import find_cmc_skill
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path
from pydantic import BaseModel
from backtest import run_backtest
from cmc_data import get_cmc_signal
from twak_config import get_twak_status
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.bergmanntrading.com",
        "https://bergmanntrading.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://bergmanntrading.com",
    "https://www.bergmanntrading.com"
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
STRATEGIES_DIR = PROJECT_DIR / "strategies"

STRATEGY_FILES = [
    "vwap_reversion.json",
    "smc_sequence.json",
    "stochastic_quad.json",
    "tdi_white_signal.json"
]


class StrategyRequest(BaseModel):
    coin: str
    timeframe: str
    risk: str
    initial_capital: float = 10000


class OptimizeRequest(BaseModel):
    coin: str
    initial_capital: float = 10000


@app.get("/")
def home():
    return {"status": "running"}


def load_strategy(filename: str):
    strategy_file = STRATEGIES_DIR / filename

    with open(strategy_file, "r", encoding="utf-8") as file:
        strategy = json.load(file)

    strategy["source_file"] = filename
    return strategy


def load_available_strategies():
    strategies = []

    for filename in STRATEGY_FILES:
        strategy_file = STRATEGIES_DIR / filename

        if strategy_file.exists():
            strategies.append(load_strategy(filename))

    return strategies


def is_backtest_eligible(backtest):
    return (
        backtest.get("min_trade_gate") == "PASS"
        and backtest.get("drawdown_gate") == "PASS"
    )


def pick_best_strategy(
    coin: str,
    timeframe: str,
    risk: str,
    initial_capital: float
):
    strategies = load_available_strategies()
    results = []

    for strategy in strategies:
        backtest = run_backtest(
            strategy=strategy,
            coin=coin,
            timeframe=timeframe,
            risk=risk,
            initial_capital=initial_capital
        )

        results.append({
            "strategy": strategy,
            "backtest": backtest,
            "risk_adjusted_score": backtest["risk_adjusted_score"]
        })

    eligible_results = [
        item for item in results
        if is_backtest_eligible(item["backtest"])
    ]

    ranking_pool = eligible_results if eligible_results else results

    best = max(ranking_pool, key=lambda item: item["risk_adjusted_score"])
    return best["strategy"], best["backtest"], results


@app.post("/generate-strategy")
def generate_strategy(request: StrategyRequest):
    cmc_signal = get_cmc_signal(request.coin)

    strategy, backtest, compared_results = pick_best_strategy(
        coin=request.coin,
        timeframe=request.timeframe,
        risk=request.risk,
        initial_capital=request.initial_capital
    )

    return {
        "coin": request.coin,
        "timeframe": request.timeframe,
        "risk": request.risk,
        "cmc_signal": cmc_signal,
        "selected_strategy": strategy["name"],
        "type": strategy["type"],
        "reason": f"CMC market bias is {cmc_signal.get('market_bias', 'unknown')}. The agent compared available private strategies and selected {strategy['name']} for {request.coin} on the {request.timeframe} timeframe using a {request.risk} risk profile.",
        "entry": strategy["entry"],
        "confirmation": strategy["confirmation"],
        "take_profit": strategy["take_profit"],
        "stop_loss": strategy["stop_loss"],
        "risk_governor": strategy["risk_governor"],
        "backtest": backtest
    }


@app.post("/optimize-strategy")
def optimize_strategy(request: OptimizeRequest):
    timeframes = ["15M", "1H", "4H", "1D"]
    risk_levels = ["low", "medium", "high"]
    strategies = load_available_strategies()

    cmc_signal = get_cmc_signal(request.coin)

    results = []

    for strategy in strategies:
        for timeframe in timeframes:
            for risk in risk_levels:
                backtest = run_backtest(
                    strategy=strategy,
                    coin=request.coin,
                    timeframe=timeframe,
                    risk=risk,
                    initial_capital=request.initial_capital
                )

                results.append({
                    "coin": request.coin,
                    "timeframe": timeframe,
                    "risk": risk,
                    "cmc_signal": cmc_signal,
                    "selected_strategy": strategy["name"],
                    "type": strategy["type"],
                    "risk_adjusted_score": backtest["risk_adjusted_score"],
                    "backtest": backtest,
                    "entry": strategy["entry"],
                    "confirmation": strategy["confirmation"],
                    "take_profit": strategy["take_profit"],
                    "stop_loss": strategy["stop_loss"],
                    "risk_governor": strategy["risk_governor"]
                })

    eligible_results = [
        item for item in results
        if is_backtest_eligible(item["backtest"])
    ]

    ranking_pool = eligible_results if eligible_results else results
    best_result = max(ranking_pool, key=lambda item: item["risk_adjusted_score"])

    return {
        "coin": request.coin,
        "mode": "auto_optimization",
        "cmc_signal": cmc_signal,
        "tested_combinations": len(results),
        "eligible_combinations": len(eligible_results),
        "best_setup": best_result,
        "all_results": results
    }


@app.get("/twak-status")
def twak_status():
    return get_twak_status()


@app.post("/register-agent")
def register_agent():
    status = get_twak_status()

    if status["status"] != "configured":
        return {
            "success": False,
            "registration": "not_ready",
            "message": "TWAK agent address is missing."
        }

    return {
        "success": True,
        "registration": "ready_for_onchain_registration",
        "agent_address": status["agent_address"],
        "chain": status["chain"],
        "message": "TWAK agent address is configured. On-chain registration must be completed with TWAK CLI or MCP."
    }

@app.get("/cmc-skill-hub/find")
async def cmc_skill_hub_find(query: str = "btc price"):
    return await find_cmc_skill(query)