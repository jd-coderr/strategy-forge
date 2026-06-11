from position_sizing import calculate_trade_size
from cmc_skill_hub import find_cmc_skill
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from twak_executor import run_twak_swap, run_twak_portfolio
from pathlib import Path
from pydantic import BaseModel
from backtest import run_backtest
from cmc_data import get_cmc_signal
from twak_config import get_twak_status
from trade_safety import validate_trade_request, mark_live_trade_executed
from trade_logger import log_trade, read_trade_log
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

BASE_DIR = Path(__file__).resolve().parent
STRATEGIES_DIR = BASE_DIR / "strategies"

STRATEGY_FILES = [
    "vwap_reversion.json",
    "smc_sequence.json",
    "stochastic_quad.json",
    "tdi_white_signal.json",
]


class StrategyRequest(BaseModel):
    coin: str
    timeframe: str
    risk: str
    initial_capital: float = 10000


class OptimizeRequest(BaseModel):
    coin: str
    initial_capital: float = 10000


class ExecuteTradeRequest(BaseModel):
    amount: str = "1"
    from_token: str = "USDT"
    to_token: str = "BNB"
    chain: str = "bsc"
    slippage: str = "1"
    quote_only: bool = True


class AgentCycleRequest(BaseModel):
    coin: str = "BNB"
    timeframe: str = "1H"
    risk: str = "low"
    initial_capital: float = 10000
    live_execution: bool = False
    selected_strategy: str | None = None


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

def find_strategy_by_name(strategy_name: str):
    if not strategy_name:
        return None

    for strategy in load_available_strategies():
        if strategy.get("name") == strategy_name:
            return strategy

    return None


def is_backtest_eligible(backtest):
    return (
        backtest.get("min_trade_gate") == "PASS"
        and backtest.get("drawdown_gate") == "PASS"
    )


def pick_best_strategy(
    coin: str,
    timeframe: str,
    risk: str,
    initial_capital: float,
):
    strategies = load_available_strategies()
    results = []

    for strategy in strategies:
        backtest = run_backtest(
            strategy=strategy,
            coin=coin,
            timeframe=timeframe,
            risk=risk,
            initial_capital=initial_capital,
        )

        results.append(
            {
                "strategy": strategy,
                "backtest": backtest,
                "risk_adjusted_score": backtest["risk_adjusted_score"],
            }
        )

    eligible_results = [
        item for item in results
        if is_backtest_eligible(item["backtest"])
    ]

    ranking_pool = eligible_results if eligible_results else results

    if not ranking_pool:
        return None, None, results

    best = max(ranking_pool, key=lambda item: item["risk_adjusted_score"])
    return best["strategy"], best["backtest"], results


@app.post("/generate-strategy")
def generate_strategy(request: StrategyRequest):
    cmc_signal = get_cmc_signal(request.coin)

if request.selected_strategy:
    strategy = find_strategy_by_name(request.selected_strategy)

    if strategy is not None:
        backtest = run_backtest(
            strategy=strategy,
            coin=request.coin,
            timeframe=request.timeframe,
            risk=request.risk,
            initial_capital=request.initial_capital,
        )
        compared_results = []
    else:
        strategy, backtest, compared_results = pick_best_strategy(
            coin=request.coin,
            timeframe=request.timeframe,
            risk=request.risk,
            initial_capital=request.initial_capital,
        )
else:
    strategy, backtest, compared_results = pick_best_strategy(
        coin=request.coin,
        timeframe=request.timeframe,
        risk=request.risk,
        initial_capital=request.initial_capital,
    )    

    if strategy is None or backtest is None:
        return {
            "error": "No strategy results were generated.",
            "coin": request.coin,
            "timeframe": request.timeframe,
            "risk": request.risk,
            "cmc_signal": cmc_signal,
        }

    return {
        "coin": request.coin,
        "timeframe": request.timeframe,
        "risk": request.risk,
        "cmc_signal": cmc_signal,
        "selected_strategy": strategy["name"],
        "type": strategy["type"],
        "reason": (
            f"CMC market bias is {cmc_signal.get('market_bias', 'unknown')}. "
            f"The agent compared available private strategies and selected "
            f"{strategy['name']} for {request.coin} on the {request.timeframe} "
            f"timeframe using a {request.risk} risk profile."
        ),
        "entry": strategy["entry"],
        "confirmation": strategy["confirmation"],
        "take_profit": strategy["take_profit"],
        "stop_loss": strategy["stop_loss"],
        "risk_governor": strategy["risk_governor"],
        "backtest": backtest,
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
                    initial_capital=request.initial_capital,
                )

                results.append(
                    {
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
                        "risk_governor": strategy["risk_governor"],
                    }
                )

    eligible_results = [
        item for item in results
        if is_backtest_eligible(item["backtest"])
    ]

    ranking_pool = eligible_results if eligible_results else results

    if not ranking_pool:
        return {
            "coin": request.coin,
            "mode": "auto_optimization",
            "cmc_signal": cmc_signal,
            "tested_combinations": 0,
            "eligible_combinations": 0,
            "error": "No optimizer results were generated.",
            "all_results": [],
        }

    best_result = max(ranking_pool, key=lambda item: item["risk_adjusted_score"])

    return {
        "coin": request.coin,
        "mode": "auto_optimization",
        "cmc_signal": cmc_signal,
        "tested_combinations": len(results),
        "eligible_combinations": len(eligible_results),
        "best_setup": best_result,
        "all_results": results,
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
            "message": "TWAK agent address is missing.",
        }

    return {
        "success": True,
        "registration": "ready_for_onchain_registration",
        "agent_address": status["agent_address"],
        "chain": status["chain"],
        "message": (
            "TWAK agent address is configured. On-chain registration must be "
            "completed with TWAK CLI or MCP."
        ),
    }


@app.get("/cmc-skill-hub/find")
async def cmc_skill_hub_find(query: str = "btc price"):
    return await find_cmc_skill(query)


@app.get("/debug-strategies")
def debug_strategies():
    return {
        "base_dir": str(BASE_DIR),
        "strategies_dir": str(STRATEGIES_DIR),
        "exists": STRATEGIES_DIR.exists(),
        "files": [f.name for f in STRATEGIES_DIR.glob("*")]
        if STRATEGIES_DIR.exists()
        else [],
    }


@app.post("/agent-cycle")
def agent_cycle(request: AgentCycleRequest):
    cmc_signal = get_cmc_signal(request.coin)

    strategy, backtest, compared_results = pick_best_strategy(
        coin=request.coin,
        timeframe=request.timeframe,
        risk=request.risk,
        initial_capital=request.initial_capital,
    )

    if strategy is None or backtest is None:
        event = log_trade(
            {
                "status": "no_strategy",
                "coin": request.coin,
                "timeframe": request.timeframe,
                "risk": request.risk,
                "cmc_signal": cmc_signal,
            }
        )

        return {
            "success": False,
            "decision": "HOLD",
            "reason": "No valid strategy was generated.",
            "event": event,
        }

    market_bias = str(cmc_signal.get("market_bias", "unknown")).lower()
    risk_score = backtest.get("risk_adjusted_score", 0)
    portfolio_result = run_twak_portfolio()
    portfolio_items = portfolio_result.get("portfolio") or []
    position_size = None

    balances = {
        item.get("symbol"): float(item.get("balance", 0))
        for item in portfolio_items
    }

    bnb_balance = balances.get("BNB", 0)
    usdt_balance = balances.get("USDT", 0)

    decision = "HOLD"
    trade_plan = None

    if "bull" in market_bias and risk_score > 0:
        decision = "BUY_BNB"
        trade_plan = {
            "amount": "1",
            "from_token": "USDT",
            "to_token": "BNB",
            "quote_only": True,
            "reason": (
                "Bullish CMC bias and positive strategy score. "
                "USDT → BNB remains quote-only until ERC-20 approval issue is resolved."
            ),
        }

    elif "bear" in market_bias or "risk-off" in market_bias:
        decision = "REDUCE_RISK"

        allow_live_reduce_risk = (
            request.live_execution
            and risk_score > -5
        )

        trade_plan = {
            "amount": calculate_trade_size(portfolio_items, "BNB", request.risk)["amount"],
            "position_size": calculate_trade_size(portfolio_items, "BNB", request.risk),
            "from_token": "BNB",
            "to_token": "USDT",
            "quote_only": not allow_live_reduce_risk,
            "reason": (
                "Bearish/risk-off CMC bias. Convert small BNB amount to USDT. "
                f"Live execution allowed: {allow_live_reduce_risk}."
            ),
        }

    else:
        decision = "HOLD"

        execution_result = None

    if trade_plan is not None:
        if trade_plan["from_token"] == "BNB" and bnb_balance < float(trade_plan["amount"]):
            execution_result = {
                "success": False,
                "blocked": True,
                "safety_message": "Blocked: not enough BNB balance for planned trade.",
                "bnb_balance": bnb_balance,
            }

        elif trade_plan["from_token"] == "USDT" and usdt_balance < float(trade_plan["amount"]):
            execution_result = {
                "success": False,
                "blocked": True,
                "safety_message": "Blocked: not enough USDT balance for planned trade.",
                "usdt_balance": usdt_balance,
            }

        else:
            allowed, safety_message = validate_trade_request(
                amount=trade_plan["amount"],
                from_token=trade_plan["from_token"],
                to_token=trade_plan["to_token"],
                quote_only=trade_plan["quote_only"],
            )

            if allowed:
                execution_result = run_twak_swap(
                    amount=trade_plan["amount"],
                    from_token=trade_plan["from_token"],
                    to_token=trade_plan["to_token"],
                    chain="bsc",
                    slippage="1",
                    quote_only=trade_plan["quote_only"],
                )

                if execution_result["success"] and not trade_plan["quote_only"]:
                    mark_live_trade_executed()
            else:
                execution_result = {
                    "success": False,
                    "blocked": True,
                    "safety_message": safety_message,
                }

    event = log_trade(
        {
            "status": "agent_cycle",
            "decision": decision,
            "coin": request.coin,
            "timeframe": request.timeframe,
            "risk": request.risk,
            "live_execution": request.live_execution,
            "cmc_signal": cmc_signal,
            "selected_strategy": strategy["name"],
            "risk_adjusted_score": risk_score,
            "trade_plan": trade_plan,
            "execution_result": execution_result,
            "portfolio": portfolio_result,
        }
    )

    return {
        "success": True,
        "mode": "agent_cycle",
        "decision": decision,
        "portfolio": portfolio_result,
        "coin": request.coin,
        "cmc_signal": cmc_signal,
        "selected_strategy": strategy["name"],
        "risk_adjusted_score": risk_score,
        "trade_plan": trade_plan,
        "execution_result": execution_result,
        "event": event,
    }


@app.post("/execute-trade")
def execute_trade(request: ExecuteTradeRequest):
    allowed, safety_message = validate_trade_request(
        amount=request.amount,
        from_token=request.from_token,
        to_token=request.to_token,
        quote_only=request.quote_only,
    )

    if not allowed:
        event = log_trade(
            {
                "status": "blocked",
                "reason": safety_message,
                "amount": request.amount,
                "from_token": request.from_token,
                "to_token": request.to_token,
                "chain": request.chain,
                "quote_only": request.quote_only,
            }
        )

        return {
            "success": False,
            "mode": "blocked",
            "safety_message": safety_message,
            "event": event,
        }

    result = run_twak_swap(
        amount=request.amount,
        from_token=request.from_token,
        to_token=request.to_token,
        chain=request.chain,
        slippage=request.slippage,
        quote_only=request.quote_only,
    )

    if result["success"] and not request.quote_only:
        mark_live_trade_executed()

    event = log_trade(
        {
            "status": "success" if result["success"] else "failed",
            "safety_message": safety_message,
            "execution_layer": "TWAK CLI",
            "amount": request.amount,
            "from_token": request.from_token,
            "to_token": request.to_token,
            "chain": request.chain,
            "quote_only": request.quote_only,
            "result": result,
        }
    )

    return {
        "success": result["success"],
        "mode": "quote_only" if request.quote_only else "live_execution",
        "execution_layer": "TWAK CLI",
        "chain": request.chain,
        "from_token": request.from_token,
        "to_token": request.to_token,
        "amount": request.amount,
        "safety_message": safety_message,
        "result": result,
        "event": event,
    }

from fastapi import FastAPI
import shutil

@app.get("/debug-node")
def debug_node():
    return {
        "node": shutil.which("node"),
        "npm": shutil.which("npm"),
        "npx": shutil.which("npx"),
    }

@app.get("/portfolio")
def portfolio():
    result = run_twak_portfolio()

    event = log_trade({
        "status": "portfolio_check",
        "result": result,
    })

    return {
        "success": result["success"],
        "execution_layer": "TWAK CLI",
        "result": result,
        "event": event,
    }

@app.get("/trade-log")
def trade_log(limit: int = 50):
    return {
        "success": True,
        "limit": limit,
        "records": read_trade_log(limit),
    }

@app.get("/agent-status")
def agent_status():
    status = get_twak_status()

    if status["status"] != "configured":
        return {
            "ready": False,
            "status": "NOT READY",
            "reason": "TWAK not configured"
        }

    return {
        "ready": True,
        "status": "READY FOR REGISTRATION",
        "agent_address": status["agent_address"],
        "chain": status["chain"],
    }