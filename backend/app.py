from position_sizing import calculate_trade_size
from cmc_skill_hub import find_cmc_skill
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from twak_executor import run_twak_swap, run_twak_portfolio
from pathlib import Path
from pydantic import BaseModel
from backtest import run_backtest
from cmc_data import get_cmc_signal
from twak_config import get_twak_status, get_configured_agent_address
from trade_safety import validate_trade_request, mark_live_trade_executed
from trade_logger import log_trade, read_trade_log
from datetime import datetime, timezone, timedelta
import json
import threading
import time
import shutil
import os
import re
import secrets

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.iknowquantfu.com",
        "https://iknowquantfu.com",
        "http://www.iknowquantfu.com",
        "http://iknowquantfu.com",
        "https://www.bergmanntrading.com",
        "https://bergmanntrading.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ADMIN_HEADER_NAME = "X-IKQF-ADMIN-KEY"


def get_admin_key():
    return os.getenv("IKQF_ADMIN_KEY") or os.getenv("ADMIN_KEY")


def require_operator_key(x_ikqf_admin_key: str | None = Header(default=None, alias=ADMIN_HEADER_NAME)):
    """Protect endpoints that can start/stop the live agent or trigger execution.

    The real key must live only in Railway environment variables.
    Do not hardcode it in GitHub or in the React frontend.
    """
    configured_key = get_admin_key()

    if not configured_key:
        raise HTTPException(
            status_code=500,
            detail="Operator key is not configured. Set IKQF_ADMIN_KEY in Railway variables.",
        )

    supplied_key = str(x_ikqf_admin_key or "")

    if not secrets.compare_digest(supplied_key, configured_key):
        raise HTTPException(
            status_code=401,
            detail="Operator mode locked. Invalid or missing admin key.",
        )

    return True


@app.get("/operator/status")
def operator_status():
    return {
        "success": True,
        "operator_auth_required": True,
        "operator_key_configured": bool(get_admin_key()),
        "public_mode": "read_only",
        "protected_actions": [
            "agent-cycle",
            "autonomous-start",
            "autonomous-stop",
            "execute-trade",
            "paper-portfolio-reset",
        ],
    }


@app.post("/operator/unlock")
def operator_unlock(_operator_ok: bool = Depends(require_operator_key)):
    return {
        "success": True,
        "operator_unlocked": True,
        "message": "Operator controls unlocked for this browser session.",
    }

BASE_DIR = Path(__file__).resolve().parent
STRATEGIES_DIR = BASE_DIR / "strategies"

STRATEGY_FILES = [
    "vwap_reversion.json",
    "smc_sequence.json",
    "stochastic_quad.json",
    "tdi_white_signal.json",
    "fvg_channel.json",
    "ichimoku_macd_ema_confluence.json",
]

AUTONOMOUS_STATE = {
    "running": False,
    "interval_minutes": 5,
    "last_run": None,
    "next_run": None,
    "last_decision": None,
    "last_reason": None,
    "last_result": None,
}

AUTONOMOUS_THREAD = None
AUTONOMOUS_CONFIG = None

AGENT_SETUP_STATE_FILE = BASE_DIR / "agent_setup_state.json"
SAVED_AGENT_SETUP = None


def get_default_agent_setup():
    return {
        "coin": "ETH",
        "timeframe": "5M",
        "risk": "medium",
        "initial_capital": 10000,
        "live_execution": False,
        "execution_mode": "decision_simulation",
        "trade_size": 0.001,
        "interval_minutes": 5,
        "selected_strategy": None,
        "result_snapshot": None,
        "optimization": None,
        "source": "default",
        "updated_at": None,
    }


def load_saved_agent_setup():
    global SAVED_AGENT_SETUP

    if SAVED_AGENT_SETUP is not None:
        return SAVED_AGENT_SETUP

    setup = get_default_agent_setup()

    if AGENT_SETUP_STATE_FILE.exists():
        try:
            saved = json.loads(AGENT_SETUP_STATE_FILE.read_text())
            if isinstance(saved, dict):
                setup.update(saved)
        except Exception:
            pass

    SAVED_AGENT_SETUP = setup
    return SAVED_AGENT_SETUP


def persist_saved_agent_setup():
    setup = load_saved_agent_setup()

    try:
        AGENT_SETUP_STATE_FILE.write_text(json.dumps(setup, indent=2, default=str))
    except Exception:
        pass

    return setup


def get_saved_agent_setup_snapshot():
    setup = load_saved_agent_setup()
    return json.loads(json.dumps(setup, default=str))


def update_saved_agent_setup(
    *,
    coin=None,
    timeframe=None,
    risk=None,
    initial_capital=None,
    live_execution=None,
    execution_mode=None,
    trade_size=None,
    selected_strategy=None,
    interval_minutes=None,
    result_snapshot=None,
    optimization=None,
    source="manual_selection",
):
    setup = load_saved_agent_setup()

    updates = {
        "coin": coin,
        "timeframe": timeframe,
        "risk": risk,
        "initial_capital": initial_capital,
        "live_execution": live_execution,
        "execution_mode": execution_mode,
        "trade_size": trade_size,
        "selected_strategy": selected_strategy,
        "interval_minutes": interval_minutes,
        "result_snapshot": result_snapshot,
        "optimization": optimization,
    }

    for key, value in updates.items():
        if value is not None:
            setup[key] = value

    setup["source"] = source or setup.get("source") or "manual_selection"
    setup["updated_at"] = datetime.now(timezone.utc).isoformat()

    return persist_saved_agent_setup()


def get_autonomous_config_snapshot():
    if AUTONOMOUS_CONFIG is None:
        return None

    return {
        "coin": AUTONOMOUS_CONFIG.coin,
        "timeframe": AUTONOMOUS_CONFIG.timeframe,
        "risk": AUTONOMOUS_CONFIG.risk,
        "initial_capital": AUTONOMOUS_CONFIG.initial_capital,
        "live_execution": AUTONOMOUS_CONFIG.live_execution,
        "execution_mode": AUTONOMOUS_CONFIG.execution_mode,
        "trade_size": AUTONOMOUS_CONFIG.trade_size,
        "selected_strategy": AUTONOMOUS_CONFIG.selected_strategy,
    }


RISK_STATE = {
    "baseline_portfolio_value_usd": None,
    "peak_portfolio_value_usd": None,
    "current_portfolio_value_usd": 0.0,
    "current_drawdown_pct": 0.0,
    "max_drawdown_limit_pct": 30.0,
    "daily_loss_limit_pct": 10.0,
    "status": "UNKNOWN",
}

DAILY_QUALIFICATION_STATE = {
    "enabled": True,
    "target_trades_per_day": 1,
    "forced_window_minutes": 60,
    "take_profit_pct": 2.0,
    "stop_loss_pct": 1.0,
    "time_exit_buffer_minutes": 5,
    "open_forced_trade": None,
    "last_status": "WAITING",
    "last_reason": "No daily guard check has run yet.",
    "last_attempt_at": None,
    "last_block_reason": None,
}

PAPER_PORTFOLIO = {
    "starting_balance_usdt": 1000.0,
    "cash_usdt": 1000.0,
    "bnb_balance": 0.0,
    "realized_pnl_usdt": 0.0,
    "unrealized_pnl_usdt": 0.0,
    "peak_value_usdt": 1000.0,
    "open_positions": [],
    "closed_trades": [],
}

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


class PaperResetRequest(BaseModel):
    starting_balance_usdt: float = 1000


class AgentCycleRequest(BaseModel):
    coin: str = "ETH"
    timeframe: str = "5M"
    risk: str = "medium"
    initial_capital: float = 10000
    live_execution: bool = False
    execution_mode: str = "decision_simulation"
    trade_size: float = 0.001
    interval_minutes: int = 5
    selected_strategy: str | None = None

class AutonomousRequest(BaseModel):
    coin: str = "ETH"
    timeframe: str = "5M"
    risk: str = "medium"
    initial_capital: float = 10000
    live_execution: bool = False
    execution_mode: str = "decision_simulation"
    trade_size: float = 0.001
    selected_strategy: str | None = None
    interval_minutes: int = 5
    result_snapshot: dict | None = None
    optimization: dict | None = None
    setup_source: str | None = None


class AgentSetupRequest(BaseModel):
    coin: str | None = None
    timeframe: str | None = None
    risk: str | None = None
    initial_capital: float | None = None
    live_execution: bool | None = None
    execution_mode: str | None = None
    trade_size: float | None = None
    interval_minutes: int | None = None
    selected_strategy: str | None = None
    result_snapshot: dict | None = None
    optimization: dict | None = None
    source: str | None = "manual_selection"


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


def metric_to_float(value, default=0.0):
    if isinstance(value, (int, float)):
        return float(value)

    if value is None:
        return default

    cleaned = (
        str(value)
        .replace("%", "")
        .replace("$", "")
        .replace(",", "")
        .replace("days", "")
        .replace("day", "")
        .replace("hours", "")
        .replace("hour", "")
        .replace("trades", "")
        .replace("trade", "")
        .strip()
    )

    try:
        return float(cleaned)
    except (TypeError, ValueError):
        return default


def frequency_ranking_key(item):
    backtest = item.get("backtest", {})
    win_rate = metric_to_float(backtest.get("win_rate"), 0.0)
    profit_factor = metric_to_float(backtest.get("profit_factor"), 0.0)
    max_drawdown = metric_to_float(backtest.get("max_drawdown"), 999.0)
    signals_per_day = metric_to_float(
        backtest.get("signals_per_day_value", backtest.get("signals_per_day")),
        0.0,
    )

    win_rate_floor_pass = win_rate >= 30.0

    return (
        win_rate_floor_pass,
        profit_factor,
        -max_drawdown,
        signals_per_day,
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

def get_hold_reason(cmc_signal):
    market_bias = str(cmc_signal.get("market_bias", "unknown")).lower()

    if market_bias == "neutral":
        return "Neutral market conditions. Agent is waiting for bullish or bearish confirmation."

    if market_bias == "unknown":
        return "Market bias unavailable. Agent is holding until signal quality improves."

    return "No valid trade setup from current market conditions."


def safe_float(value, default=0.0):
    try:
        return float(value or default)
    except (TypeError, ValueError):
        return default


def extract_tx_hash_from_text(value):
    text = "" if value is None else str(value)
    match = re.search(r"0x[a-fA-F0-9]{64}", text)
    return match.group(0) if match else None


def attach_tx_hash(execution_result):
    if not isinstance(execution_result, dict):
        return execution_result

    existing_hash = (
        execution_result.get("tx_hash")
        or execution_result.get("transaction_hash")
        or execution_result.get("transactionHash")
        or execution_result.get("hash")
    )

    tx_hash = extract_tx_hash_from_text(existing_hash)

    if not tx_hash:
        tx_hash = extract_tx_hash_from_text(
            " ".join(
                str(part)
                for part in (
                    execution_result.get("stdout"),
                    execution_result.get("stderr"),
                    execution_result.get("message"),
                )
                if part
            )
        )

    if tx_hash:
        execution_result["tx_hash"] = tx_hash
        execution_result["bscscan_url"] = f"https://bscscan.com/tx/{tx_hash}"
    elif execution_result.get("success") is True:
        execution_result["tx_hash_status"] = "TWAK did not return a transaction hash in stdout/stderr."

    return execution_result


def get_portfolio_value_usd_from_items(portfolio_items):
    return sum(safe_float(item.get("usdValue", 0)) for item in portfolio_items)


def get_token_price_usd(portfolio_items, symbol):
    symbol = symbol.upper()

    for item in portfolio_items:
        if str(item.get("symbol", "")).upper() == symbol:
            balance = safe_float(item.get("balance", 0))
            usd_value = safe_float(item.get("usdValue", 0))

            if balance > 0 and usd_value > 0:
                return usd_value / balance

    if symbol == "USDT":
        return 1.0

    return 0.0


def update_risk_state(portfolio_items):
    portfolio_value = get_portfolio_value_usd_from_items(portfolio_items)

    if portfolio_value > 0:
        if RISK_STATE["baseline_portfolio_value_usd"] is None:
            RISK_STATE["baseline_portfolio_value_usd"] = portfolio_value

        if RISK_STATE["peak_portfolio_value_usd"] is None:
            RISK_STATE["peak_portfolio_value_usd"] = portfolio_value

        RISK_STATE["peak_portfolio_value_usd"] = max(
            safe_float(RISK_STATE["peak_portfolio_value_usd"]),
            portfolio_value,
        )

    peak_value = safe_float(RISK_STATE["peak_portfolio_value_usd"])
    current_drawdown = 0.0

    if peak_value > 0:
        current_drawdown = max(0.0, ((peak_value - portfolio_value) / peak_value) * 100)

    RISK_STATE["current_portfolio_value_usd"] = portfolio_value
    RISK_STATE["current_drawdown_pct"] = round(current_drawdown, 2)

    if current_drawdown >= RISK_STATE["max_drawdown_limit_pct"]:
        RISK_STATE["status"] = "DRAWDOWN LIMIT BREACHED"
    elif current_drawdown >= RISK_STATE["daily_loss_limit_pct"]:
        RISK_STATE["status"] = "WARNING"
    else:
        RISK_STATE["status"] = "SAFE"

    return dict(RISK_STATE)


def build_agent_analysis(cmc_signal, backtest, portfolio_items, decision):
    market_bias = str(cmc_signal.get("market_bias", "unknown")).lower()
    fear_greed = cmc_signal.get("fear_greed") or {}
    altcoin_season = cmc_signal.get("altcoin_season") or {}
    risk_score = safe_float(backtest.get("risk_adjusted_score", 0))
    max_drawdown_text = str(backtest.get("max_drawdown", "0")).replace("%", "")
    backtest_drawdown_pct = abs(safe_float(max_drawdown_text, 0))

    signal_breakdown = {
        "cmc_bias": 0,
        "fear_greed": 0,
        "altcoin_season": 0,
        "backtest_score": 0,
        "drawdown_safety": 0,
    }

    why = []

    if "bull" in market_bias:
        signal_breakdown["cmc_bias"] = 30
        why.append("CMC market bias is bullish.")
    elif "bear" in market_bias or "risk-off" in market_bias:
        signal_breakdown["cmc_bias"] = 20
        why.append("CMC market bias is bearish/risk-off, so the agent considers reducing risk.")
    elif market_bias == "neutral":
        signal_breakdown["cmc_bias"] = 8
        why.append("CMC market bias is neutral, so the agent waits for better confirmation.")
    else:
        why.append("CMC market bias is unavailable or unknown.")

    fg_value = safe_float(fear_greed.get("value"), 50)

    if fg_value >= 60:
        signal_breakdown["fear_greed"] = 20
        why.append(f"Fear & Greed is supportive at {int(fg_value)}/100.")
    elif fg_value <= 25:
        signal_breakdown["fear_greed"] = 12
        why.append(f"Fear & Greed is defensive at {int(fg_value)}/100.")
    else:
        signal_breakdown["fear_greed"] = 8
        why.append(f"Fear & Greed is neutral at {int(fg_value)}/100.")

    alt_value = safe_float(altcoin_season.get("value"), 50)

    if alt_value >= 60:
        signal_breakdown["altcoin_season"] = 10
        why.append(f"Altcoin rotation is supportive at {int(alt_value)}/100.")
    elif alt_value <= 25:
        signal_breakdown["altcoin_season"] = 4
        why.append(f"Altcoin rotation is weak at {int(alt_value)}/100.")
    else:
        signal_breakdown["altcoin_season"] = 6
        why.append(f"Altcoin rotation is neutral at {int(alt_value)}/100.")

    if risk_score >= 12:
        signal_breakdown["backtest_score"] = 25
        why.append("Backtest risk-adjusted score is excellent.")
    elif risk_score >= 9:
        signal_breakdown["backtest_score"] = 20
        why.append("Backtest risk-adjusted score is strong.")
    elif risk_score >= 6:
        signal_breakdown["backtest_score"] = 15
        why.append("Backtest risk-adjusted score is decent.")
    elif risk_score >= 3:
        signal_breakdown["backtest_score"] = 8
        why.append("Backtest risk-adjusted score is weak/passable.")
    else:
        signal_breakdown["backtest_score"] = 0
        why.append("Backtest risk-adjusted score is poor.")

    risk_control = update_risk_state(portfolio_items)

    if risk_control["status"] == "SAFE":
        signal_breakdown["drawdown_safety"] = 15
        why.append("Drawdown monitor is safe.")
    elif risk_control["status"] == "WARNING":
        signal_breakdown["drawdown_safety"] = 5
        why.append("Drawdown monitor is warning; agent should reduce risk.")
    else:
        signal_breakdown["drawdown_safety"] = 0
        why.append("Drawdown limit breached; live trading should be blocked.")

    confidence_score = min(100, max(0, int(sum(signal_breakdown.values()))))

    if decision == "HOLD":
        confidence_score = min(confidence_score, 55)

    if decision == "DAILY_QUALIFICATION_TRADE":
        why.append("Daily qualification guard is active because no live trade was recorded today.")
        why.append("This trade uses the smallest configured size and aims to satisfy the competition minimum trade requirement.")

    if decision == "DAILY_QUALIFICATION_CLOSE":
        why.append("Daily qualification trade is being closed by take-profit, stop-loss, or time-exit rule.")

    return {
        "confidence_score": confidence_score,
        "signal_breakdown": signal_breakdown,
        "why": why,
        "risk_control": risk_control,
    }


def get_user_trade_amount(requested_trade_size, from_token, to_token, portfolio_items):
    requested_trade_size = max(0.0, safe_float(requested_trade_size, 0.0))
    from_token = from_token.upper()
    to_token = to_token.upper()

    if requested_trade_size <= 0:
        return "0"

    if from_token == "USDT" and to_token == "BNB":
        bnb_price = get_token_price_usd(portfolio_items, "BNB")

        if bnb_price <= 0:
            return "0"

        usdt_amount = requested_trade_size * bnb_price
        return str(round(usdt_amount, 6))

    if from_token == "BNB" and to_token == "USDT":
        return str(round(requested_trade_size, 6))

    return str(round(requested_trade_size, 6))


def utc_day_bounds(now=None):
    now = now or datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def minutes_until_utc_day_end(now=None):
    now = now or datetime.now(timezone.utc)
    _, end = utc_day_bounds(now)
    return max(0.0, (end - now).total_seconds() / 60)


def is_in_forced_daily_trade_window(now=None):
    return minutes_until_utc_day_end(now) <= DAILY_QUALIFICATION_STATE["forced_window_minutes"]


def is_live_execution_result(record, execution_result, trade_plan):
    """Return True only for real live/on-chain executions, not simulations, quotes, or paper trades."""
    execution_result = execution_result or {}
    trade_plan = trade_plan or {}

    if trade_plan.get("quote_only") is True or record.get("quote_only") is True:
        return False

    mode = str(
        execution_result.get("mode")
        or record.get("execution_mode")
        or record.get("mode")
        or ""
    ).lower()

    if mode in {"decision_simulation", "paper_trading", "quote_only"}:
        return False

    if execution_result.get("executed") is False:
        return False

    if execution_result.get("blocked") is True:
        return False

    return execution_result.get("success") is True


def count_live_trades_today():
    """Count real live trades during the current UTC competition day."""
    start, end = utc_day_bounds()
    live_trade_count = 0
    seen_records = set()

    for record in read_trade_log(500):
        try:
            timestamp = datetime.fromisoformat(str(record.get("timestamp")).replace("Z", "+00:00"))
        except Exception:
            continue

        if not (start <= timestamp < end):
            continue

        trade_plan = record.get("trade_plan") or {}
        execution_result = record.get("execution_result") or record.get("result") or {}
        record_key = record.get("id") or record.get("timestamp") or str(record)

        if record_key in seen_records:
            continue

        if is_live_execution_result(record, execution_result, trade_plan):
            live_trade_count += 1
            seen_records.add(record_key)

    return live_trade_count


def get_daily_qualification_status():
    trades_today = count_live_trades_today()
    minutes_left = round(minutes_until_utc_day_end(), 2)
    in_forced_window = is_in_forced_daily_trade_window()

    if trades_today >= DAILY_QUALIFICATION_STATE["target_trades_per_day"]:
        status = "QUALIFIED"
        reason = "A real live trade has already been recorded during the current UTC competition day."
    elif in_forced_window:
        status = "FORCED TRADE WINDOW ACTIVE"
        reason = "No live trade has been recorded today and the final UTC hour is active."
    else:
        status = "WAITING"
        reason = "No live trade has been recorded today, but the final UTC qualification window is not active yet."

    DAILY_QUALIFICATION_STATE["last_status"] = status
    DAILY_QUALIFICATION_STATE["last_reason"] = reason

    return {
        "enabled": DAILY_QUALIFICATION_STATE["enabled"],
        "status": status,
        "reason": reason,
        "trades_today": trades_today,
        "target_trades_per_day": DAILY_QUALIFICATION_STATE["target_trades_per_day"],
        "forced_window_minutes": DAILY_QUALIFICATION_STATE["forced_window_minutes"],
        "minutes_until_utc_day_end": minutes_left,
        "take_profit_pct": DAILY_QUALIFICATION_STATE["take_profit_pct"],
        "stop_loss_pct": DAILY_QUALIFICATION_STATE["stop_loss_pct"],
        "time_exit_buffer_minutes": DAILY_QUALIFICATION_STATE["time_exit_buffer_minutes"],
        "open_forced_trade": DAILY_QUALIFICATION_STATE["open_forced_trade"],
        "last_attempt_at": DAILY_QUALIFICATION_STATE.get("last_attempt_at"),
        "last_block_reason": DAILY_QUALIFICATION_STATE.get("last_block_reason"),
    }


def should_force_daily_qualification_trade(live_execution_enabled=False):
    if not DAILY_QUALIFICATION_STATE["enabled"]:
        return False, "DAILY GUARD DISABLED"

    if count_live_trades_today() >= DAILY_QUALIFICATION_STATE["target_trades_per_day"]:
        return False, "DAILY GUARD SKIPPED: LIVE TRADE ALREADY RECORDED TODAY"

    if not is_in_forced_daily_trade_window():
        return False, "DAILY GUARD WAITING: OUTSIDE FINAL UTC HOUR"

    if not live_execution_enabled:
        return False, "DAILY GUARD SKIPPED: AGENT NOT IN LIVE MODE"

    return True, "DAILY GUARD WINDOW ACTIVE: FORCED LIVE TRADE REQUIRED"


def build_forced_daily_trade_plan(request, portfolio_items, cmc_signal, live_execution_enabled=False):
    requested_trade_size = max(0.0, safe_float(request.trade_size, 0.0))
    market_bias = str(cmc_signal.get("market_bias", "unknown")).lower()

    # Prefer the lowest-risk direction based on available assets.
    balances = {
        str(item.get("symbol", "")).upper(): safe_float(item.get("balance", 0))
        for item in portfolio_items
    }

    bnb_balance = balances.get("BNB", 0.0)
    usdt_balance = balances.get("USDT", 0.0)

    if "bear" in market_bias and bnb_balance > 0:
        from_token = "BNB"
        to_token = "USDT"
        amount = str(round(min(requested_trade_size, bnb_balance), 6))
    else:
        from_token = "USDT"
        to_token = "BNB"
        amount = get_user_trade_amount(
            requested_trade_size=requested_trade_size,
            from_token="USDT",
            to_token="BNB",
            portfolio_items=portfolio_items,
        )

        if safe_float(amount) <= 0 and bnb_balance > 0:
            from_token = "BNB"
            to_token = "USDT"
            amount = str(round(min(requested_trade_size, bnb_balance), 6))

    if safe_float(amount) <= 0:
        DAILY_QUALIFICATION_STATE["last_block_reason"] = (
            "DAILY GUARD BLOCKED: no usable BNB or USDT balance was available for the forced trade."
        )

    now = datetime.now(timezone.utc)
    _, day_end = utc_day_bounds(now)
    time_exit_at = day_end - timedelta(minutes=DAILY_QUALIFICATION_STATE["time_exit_buffer_minutes"])

    return {
        "amount": amount,
        "requested_trade_size": requested_trade_size,
        "requested_trade_size_token": "BNB",
        "from_token": from_token,
        "to_token": to_token,
        "quote_only": not live_execution_enabled,
        "type": "daily_qualification_trade",
        "take_profit_pct": DAILY_QUALIFICATION_STATE["take_profit_pct"],
        "stop_loss_pct": DAILY_QUALIFICATION_STATE["stop_loss_pct"],
        "time_exit_at": time_exit_at.isoformat(),
        "reason": (
            "Daily qualification guard activated. No live trade has been recorded today. "
            "The agent is attempting the smallest safe qualifying trade during the final UTC hour. "
            f"Target: +{DAILY_QUALIFICATION_STATE['take_profit_pct']}%. "
            f"Max downside guard: -{DAILY_QUALIFICATION_STATE['stop_loss_pct']}%. "
            "Time exit before UTC day end."
        ),
    }


def maybe_build_forced_trade_close_plan(request, cmc_signal, live_execution_enabled=False):
    open_trade = DAILY_QUALIFICATION_STATE.get("open_forced_trade")

    if not open_trade:
        return None

    current_price = safe_float(cmc_signal.get("price_usd"), 0)
    entry_price = safe_float(open_trade.get("entry_price_usd"), 0)

    if current_price <= 0 or entry_price <= 0:
        return None

    opened_direction = open_trade.get("direction")
    pnl_pct = 0.0

    if opened_direction == "long_bnb":
        pnl_pct = ((current_price - entry_price) / entry_price) * 100
        from_token = "BNB"
        to_token = "USDT"
        amount = str(open_trade.get("bnb_amount", request.trade_size))
    else:
        # Defensive reduce-risk trade was already BNB -> USDT. No reverse close needed for qualification.
        return None

    now = datetime.now(timezone.utc)
    time_exit_at = datetime.fromisoformat(open_trade["time_exit_at"])

    should_close = (
        pnl_pct >= DAILY_QUALIFICATION_STATE["take_profit_pct"]
        or pnl_pct <= -DAILY_QUALIFICATION_STATE["stop_loss_pct"]
        or now >= time_exit_at
    )

    if not should_close:
        return None

    if pnl_pct >= DAILY_QUALIFICATION_STATE["take_profit_pct"]:
        exit_reason = "Take-profit target reached."
    elif pnl_pct <= -DAILY_QUALIFICATION_STATE["stop_loss_pct"]:
        exit_reason = "Stop-loss guard reached."
    else:
        exit_reason = "Time exit before UTC day end."

    return {
        "amount": amount,
        "from_token": from_token,
        "to_token": to_token,
        "quote_only": not live_execution_enabled,
        "type": "daily_qualification_close",
        "pnl_pct": round(pnl_pct, 4),
        "reason": exit_reason,
    }




def reset_paper_portfolio(starting_balance_usdt=1000.0):
    starting_balance_usdt = max(0.0, safe_float(starting_balance_usdt, 1000.0))

    PAPER_PORTFOLIO["starting_balance_usdt"] = starting_balance_usdt
    PAPER_PORTFOLIO["cash_usdt"] = starting_balance_usdt
    PAPER_PORTFOLIO["bnb_balance"] = 0.0
    PAPER_PORTFOLIO["realized_pnl_usdt"] = 0.0
    PAPER_PORTFOLIO["unrealized_pnl_usdt"] = 0.0
    PAPER_PORTFOLIO["peak_value_usdt"] = starting_balance_usdt
    PAPER_PORTFOLIO["open_positions"] = []
    PAPER_PORTFOLIO["closed_trades"] = []

    return get_paper_portfolio_status()


def get_paper_portfolio_status(price_usd=None):
    price_usd = safe_float(price_usd, 0.0)

    bnb_value = PAPER_PORTFOLIO["bnb_balance"] * price_usd if price_usd > 0 else 0.0
    total_value = PAPER_PORTFOLIO["cash_usdt"] + bnb_value

    unrealized = 0.0

    if price_usd > 0:
        for position in PAPER_PORTFOLIO["open_positions"]:
            entry_price = safe_float(position.get("entry_price_usd"), 0.0)
            amount_bnb = safe_float(position.get("amount_bnb"), 0.0)

            if entry_price > 0 and amount_bnb > 0:
                unrealized += (price_usd - entry_price) * amount_bnb

    PAPER_PORTFOLIO["unrealized_pnl_usdt"] = round(unrealized, 6)
    PAPER_PORTFOLIO["peak_value_usdt"] = max(PAPER_PORTFOLIO["peak_value_usdt"], total_value)

    total_pnl = total_value - PAPER_PORTFOLIO["starting_balance_usdt"]
    return_pct = 0.0

    if PAPER_PORTFOLIO["starting_balance_usdt"] > 0:
        return_pct = (total_pnl / PAPER_PORTFOLIO["starting_balance_usdt"]) * 100

    drawdown_pct = 0.0
    if PAPER_PORTFOLIO["peak_value_usdt"] > 0:
        drawdown_pct = max(
            0.0,
            ((PAPER_PORTFOLIO["peak_value_usdt"] - total_value) / PAPER_PORTFOLIO["peak_value_usdt"]) * 100,
        )

    return {
        "starting_balance_usdt": round(PAPER_PORTFOLIO["starting_balance_usdt"], 6),
        "cash_usdt": round(PAPER_PORTFOLIO["cash_usdt"], 6),
        "bnb_balance": round(PAPER_PORTFOLIO["bnb_balance"], 8),
        "bnb_value_usdt": round(bnb_value, 6),
        "total_value_usdt": round(total_value, 6),
        "realized_pnl_usdt": round(PAPER_PORTFOLIO["realized_pnl_usdt"], 6),
        "unrealized_pnl_usdt": round(PAPER_PORTFOLIO["unrealized_pnl_usdt"], 6),
        "total_pnl_usdt": round(total_pnl, 6),
        "return_pct": round(return_pct, 4),
        "drawdown_pct": round(drawdown_pct, 4),
        "peak_value_usdt": round(PAPER_PORTFOLIO["peak_value_usdt"], 6),
        "open_positions": PAPER_PORTFOLIO["open_positions"],
        "closed_trades": PAPER_PORTFOLIO["closed_trades"],
        "open_position_count": len(PAPER_PORTFOLIO["open_positions"]),
        "closed_trade_count": len(PAPER_PORTFOLIO["closed_trades"]),
        "price_usd": price_usd,
    }


def paper_portfolio_items(price_usd):
    status = get_paper_portfolio_status(price_usd)

    return [
        {
            "chain": "paper",
            "type": "virtual_cash",
            "symbol": "USDT",
            "balance": str(status["cash_usdt"]),
            "usdValue": status["cash_usdt"],
        },
        {
            "chain": "paper",
            "type": "virtual_asset",
            "symbol": "BNB",
            "balance": str(status["bnb_balance"]),
            "usdValue": status["bnb_value_usdt"],
        },
    ]


def execute_paper_trade(trade_plan, price_usd):
    price_usd = safe_float(price_usd, 0.0)

    if price_usd <= 0:
        return {
            "success": False,
            "mode": "paper_trading",
            "blocked": True,
            "safety_message": "Paper trade blocked: missing market price.",
        }

    amount = safe_float(trade_plan.get("amount"), 0.0)
    from_token = str(trade_plan.get("from_token", "")).upper()
    to_token = str(trade_plan.get("to_token", "")).upper()
    now = datetime.now(timezone.utc).isoformat()

    if amount <= 0:
        return {
            "success": False,
            "mode": "paper_trading",
            "blocked": True,
            "safety_message": "Paper trade blocked: amount is zero.",
        }

    if from_token == "USDT" and to_token == "BNB":
        if PAPER_PORTFOLIO["cash_usdt"] < amount:
            return {
                "success": False,
                "mode": "paper_trading",
                "blocked": True,
                "safety_message": "Paper trade blocked: not enough paper USDT.",
                "paper_portfolio": get_paper_portfolio_status(price_usd),
            }

        amount_bnb = amount / price_usd
        PAPER_PORTFOLIO["cash_usdt"] -= amount
        PAPER_PORTFOLIO["bnb_balance"] += amount_bnb

        position = {
            "opened_at": now,
            "entry_price_usd": price_usd,
            "amount_bnb": amount_bnb,
            "entry_value_usdt": amount,
            "from_token": from_token,
            "to_token": to_token,
            "type": trade_plan.get("type", "paper_trade"),
        }
        PAPER_PORTFOLIO["open_positions"].append(position)

        return {
            "success": True,
            "mode": "paper_trading",
            "action": "paper_buy_bnb",
            "amount_usdt": round(amount, 6),
            "amount_bnb": round(amount_bnb, 8),
            "price_usd": price_usd,
            "paper_portfolio": get_paper_portfolio_status(price_usd),
        }

    if from_token == "BNB" and to_token == "USDT":
        sell_bnb = min(amount, PAPER_PORTFOLIO["bnb_balance"])

        if sell_bnb <= 0:
            return {
                "success": False,
                "mode": "paper_trading",
                "blocked": True,
                "safety_message": "Paper trade blocked: not enough paper BNB.",
                "paper_portfolio": get_paper_portfolio_status(price_usd),
            }

        proceeds = sell_bnb * price_usd
        remaining_to_close = sell_bnb
        realized_pnl = 0.0
        closed_parts = []

        while remaining_to_close > 0 and PAPER_PORTFOLIO["open_positions"]:
            position = PAPER_PORTFOLIO["open_positions"][0]
            position_amount = safe_float(position.get("amount_bnb"), 0.0)
            close_amount = min(position_amount, remaining_to_close)
            entry_price = safe_float(position.get("entry_price_usd"), price_usd)
            part_pnl = (price_usd - entry_price) * close_amount

            realized_pnl += part_pnl
            remaining_to_close -= close_amount
            position["amount_bnb"] = position_amount - close_amount

            closed_parts.append({
                "opened_at": position.get("opened_at"),
                "closed_at": now,
                "amount_bnb": round(close_amount, 8),
                "entry_price_usd": entry_price,
                "exit_price_usd": price_usd,
                "pnl_usdt": round(part_pnl, 6),
                "pnl_pct": round(((price_usd - entry_price) / entry_price) * 100, 4) if entry_price > 0 else 0.0,
            })

            if position["amount_bnb"] <= 0.00000001:
                PAPER_PORTFOLIO["open_positions"].pop(0)

        PAPER_PORTFOLIO["bnb_balance"] -= sell_bnb
        PAPER_PORTFOLIO["cash_usdt"] += proceeds
        PAPER_PORTFOLIO["realized_pnl_usdt"] += realized_pnl
        PAPER_PORTFOLIO["closed_trades"].extend(closed_parts)

        return {
            "success": True,
            "mode": "paper_trading",
            "action": "paper_sell_bnb",
            "amount_bnb": round(sell_bnb, 8),
            "proceeds_usdt": round(proceeds, 6),
            "realized_pnl_usdt": round(realized_pnl, 6),
            "price_usd": price_usd,
            "paper_portfolio": get_paper_portfolio_status(price_usd),
        }

    return {
        "success": False,
        "mode": "paper_trading",
        "blocked": True,
        "safety_message": f"Paper trade blocked: unsupported pair {from_token}->{to_token}.",
    }


@app.post("/generate-strategy")
def generate_strategy(request: StrategyRequest):
    cmc_signal = get_cmc_signal(request.coin)

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
    timeframes = ["5M", "15M", "1H", "4H", "1D"]
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

    frequency_ranked_results = sorted(
        results,
        key=frequency_ranking_key,
        reverse=True,
    )

    return {
        "coin": request.coin,
        "mode": "auto_optimization",
        "cmc_signal": cmc_signal,
        "tested_combinations": len(results),
        "eligible_combinations": len(eligible_results),
        "best_setup": best_result,
        "all_results": results,
        "frequency_ranked_results": frequency_ranked_results,
    }


@app.get("/twak-status")
def twak_status():
    return get_twak_status()


@app.get("/agent-config")
def agent_config():
    return {
        "success": True,
        "mode": "agent_config",
        "setup": get_saved_agent_setup_snapshot(),
        "active_config": get_autonomous_config_snapshot(),
        "autonomous_running": AUTONOMOUS_STATE["running"],
    }


@app.post("/agent-config")
def save_agent_config(request: AgentSetupRequest, _operator_ok: bool = Depends(require_operator_key)):
    setup = update_saved_agent_setup(
        coin=request.coin,
        timeframe=request.timeframe,
        risk=request.risk,
        initial_capital=request.initial_capital,
        live_execution=request.live_execution,
        execution_mode=request.execution_mode,
        trade_size=request.trade_size,
        interval_minutes=request.interval_minutes,
        selected_strategy=request.selected_strategy,
        result_snapshot=request.result_snapshot,
        optimization=request.optimization,
        source=request.source or "manual_selection",
    )

    return {
        "success": True,
        "mode": "agent_config",
        "setup": setup,
        "message": "Agent setup saved on the backend.",
    }


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
def agent_cycle(request: AgentCycleRequest, _operator_ok: bool = Depends(require_operator_key)):
    cmc_signal = get_cmc_signal(request.coin)
    execution_mode = str(getattr(request, "execution_mode", "decision_simulation") or "decision_simulation").lower()
    live_execution_enabled = execution_mode == "live_trading" or request.live_execution is True
    paper_trading_enabled = execution_mode == "paper_trading"

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
    if paper_trading_enabled:
        paper_status = get_paper_portfolio_status(cmc_signal.get("price_usd"))
        portfolio_result = {
            "success": True,
            "execution_layer": "Paper Trading Engine",
            "portfolio": paper_portfolio_items(cmc_signal.get("price_usd")),
            "paper_portfolio": paper_status,
        }
    else:
        paper_status = None
        portfolio_result = run_twak_portfolio(address=get_configured_agent_address())

    raw_portfolio_items = portfolio_result.get("portfolio") or []
    portfolio_items = []

    if isinstance(raw_portfolio_items, list):
        portfolio_items = [
            item for item in raw_portfolio_items
            if isinstance(item, dict)
    ]

    position_size = None

    balances = {
        item.get("symbol"): float(item.get("balance", 0) or 0)
        for item in portfolio_items
}

    bnb_balance = balances.get("BNB", 0)
    usdt_balance = balances.get("USDT", 0)
    requested_trade_size = max(0.0, safe_float(request.trade_size, 0.0))
    risk_control = update_risk_state(portfolio_items)

    decision = "HOLD"
    trade_plan = None
    execution_result = None
    daily_qualification = get_daily_qualification_status()
    daily_guard_should_trade, daily_guard_reason = should_force_daily_qualification_trade(
        live_execution_enabled=live_execution_enabled
    )

    forced_close_plan = maybe_build_forced_trade_close_plan(request, cmc_signal, live_execution_enabled=live_execution_enabled)

    if forced_close_plan is not None:
        decision = "DAILY_QUALIFICATION_CLOSE"
        trade_plan = forced_close_plan
        daily_guard_reason = "DAILY GUARD CLOSE: forced trade exit rule is active."

    elif daily_guard_should_trade:
        decision = "DAILY_QUALIFICATION_TRADE"
        DAILY_QUALIFICATION_STATE["last_attempt_at"] = datetime.now(timezone.utc).isoformat()
        trade_plan = build_forced_daily_trade_plan(
            request=request,
            portfolio_items=portfolio_items,
            cmc_signal=cmc_signal,
            live_execution_enabled=live_execution_enabled,
        )

    elif "bull" in market_bias and risk_score > 0:
        decision = "BUY_BNB"
        trade_amount = get_user_trade_amount(
            requested_trade_size=requested_trade_size,
            from_token="USDT",
            to_token="BNB",
            portfolio_items=portfolio_items,
        )

        trade_plan = {
            "amount": trade_amount,
            "requested_trade_size": requested_trade_size,
            "requested_trade_size_token": "BNB",
            "from_token": "USDT",
            "to_token": "BNB",
            "quote_only": not live_execution_enabled,
            "reason": (
                "Bullish CMC bias and positive strategy score. "
                f"User trade size target: {requested_trade_size} BNB. "
                f"USDT → BNB live execution allowed: {live_execution_enabled}."
            ),
        }

    elif "bear" in market_bias or "risk-off" in market_bias:
        decision = "REDUCE_RISK"

        allow_live_reduce_risk = (
            live_execution_enabled
            and risk_score > -5
        )

        calculated_position_size = calculate_trade_size(portfolio_items, "BNB", request.risk)
        user_amount = get_user_trade_amount(
            requested_trade_size=requested_trade_size,
            from_token="BNB",
            to_token="USDT",
            portfolio_items=portfolio_items,
        )

        trade_plan = {
            "amount": user_amount if safe_float(user_amount) > 0 else calculated_position_size["amount"],
            "requested_trade_size": requested_trade_size,
            "requested_trade_size_token": "BNB",
            "position_size": calculated_position_size,
            "from_token": "BNB",
            "to_token": "USDT",
            "quote_only": not allow_live_reduce_risk,
            "reason": (
                "Bearish/risk-off CMC bias. Convert selected BNB amount to USDT. "
                f"User trade size target: {requested_trade_size} BNB. "
                f"Live execution allowed: {allow_live_reduce_risk}."
            ),
        }

    else:
        decision = "HOLD"

    if trade_plan is not None:
        if request.live_execution and risk_control["status"] == "DRAWDOWN LIMIT BREACHED":
            execution_result = {
                "success": False,
                "blocked": True,
                "safety_message": "Blocked: max drawdown limit breached.",
                "risk_control": risk_control,
            }
            DAILY_QUALIFICATION_STATE["last_block_reason"] = execution_result["safety_message"]

        elif execution_mode != "decision_simulation" and trade_plan["from_token"] == "BNB" and bnb_balance < float(trade_plan["amount"]):
            execution_result = {
                "success": False,
                "blocked": True,
                "safety_message": "Blocked: not enough BNB balance for planned trade.",
                "bnb_balance": bnb_balance,
            }
            DAILY_QUALIFICATION_STATE["last_block_reason"] = execution_result["safety_message"]

        elif execution_mode != "decision_simulation" and trade_plan["from_token"] == "USDT" and usdt_balance < float(trade_plan["amount"]):
            execution_result = {
                "success": False,
                "blocked": True,
                "safety_message": "Blocked: not enough USDT balance for planned trade.",
                "usdt_balance": usdt_balance,
            }
            DAILY_QUALIFICATION_STATE["last_block_reason"] = execution_result["safety_message"]

        else:
            if paper_trading_enabled:
                execution_result = execute_paper_trade(
                    trade_plan=trade_plan,
                    price_usd=cmc_signal.get("price_usd"),
                )

                if execution_result.get("success") is True:
                    if trade_plan.get("type") == "daily_qualification_trade":
                        current_price = safe_float(cmc_signal.get("price_usd"), 0)
                        DAILY_QUALIFICATION_STATE["open_forced_trade"] = {
                            "opened_at": datetime.now(timezone.utc).isoformat(),
                            "entry_price_usd": current_price,
                            "direction": "long_bnb" if trade_plan["to_token"] == "BNB" else "reduce_risk",
                            "bnb_amount": request.trade_size,
                            "from_token": trade_plan["from_token"],
                            "to_token": trade_plan["to_token"],
                            "amount": trade_plan["amount"],
                            "time_exit_at": trade_plan["time_exit_at"],
                            "take_profit_pct": trade_plan["take_profit_pct"],
                            "stop_loss_pct": trade_plan["stop_loss_pct"],
                        }

                    if trade_plan.get("type") == "daily_qualification_close":
                        DAILY_QUALIFICATION_STATE["open_forced_trade"] = None

            elif execution_mode == "decision_simulation":
                execution_result = {
                    "success": True,
                    "mode": "decision_simulation",
                    "executed": False,
                    "message": "Decision Simulation Mode: trade plan generated and logged, but no paper or live position was opened.",
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
                    execution_result = attach_tx_hash(execution_result)

                    if execution_result["success"] and not trade_plan["quote_only"]:
                        mark_live_trade_executed()
                        DAILY_QUALIFICATION_STATE["last_block_reason"] = None

                        if trade_plan.get("type") == "daily_qualification_trade":
                            current_price = safe_float(cmc_signal.get("price_usd"), 0)
                            DAILY_QUALIFICATION_STATE["open_forced_trade"] = {
                                "opened_at": datetime.now(timezone.utc).isoformat(),
                                "entry_price_usd": current_price,
                                "direction": "long_bnb" if trade_plan["to_token"] == "BNB" else "reduce_risk",
                                "bnb_amount": request.trade_size,
                                "from_token": trade_plan["from_token"],
                                "to_token": trade_plan["to_token"],
                                "amount": trade_plan["amount"],
                                "time_exit_at": trade_plan["time_exit_at"],
                                "take_profit_pct": trade_plan["take_profit_pct"],
                                "stop_loss_pct": trade_plan["stop_loss_pct"],
                            }

                        if trade_plan.get("type") == "daily_qualification_close":
                            DAILY_QUALIFICATION_STATE["open_forced_trade"] = None
                else:
                    execution_result = {
                        "success": False,
                        "blocked": True,
                        "safety_message": safety_message,
                    }

    agent_analysis = build_agent_analysis(
        cmc_signal=cmc_signal,
        backtest=backtest,
        portfolio_items=portfolio_items,
        decision=decision,
    )

    event = log_trade(
        {
            "status": "agent_cycle",
            "decision": decision,
            "coin": request.coin,
            "timeframe": request.timeframe,
            "risk": request.risk,
            "live_execution": live_execution_enabled,
            "execution_mode": execution_mode,
            "selected_strategy_requested": request.selected_strategy,
            "cmc_signal": cmc_signal,
            "selected_strategy": strategy["name"],
            "risk_adjusted_score": risk_score,
            "backtest": backtest,
            "confidence_score": agent_analysis["confidence_score"],
            "signal_breakdown": agent_analysis["signal_breakdown"],
            "why": agent_analysis["why"],
            "risk_control": agent_analysis["risk_control"],
            "daily_qualification": get_daily_qualification_status(),
            "daily_guard_reason": daily_guard_reason,
            "trade_size": request.trade_size,
            "trade_plan": trade_plan,
            "execution_result": execution_result,
            "portfolio": portfolio_result,
            "paper_portfolio": get_paper_portfolio_status(cmc_signal.get("price_usd")) if paper_trading_enabled else None,
        }
    )

    return {
        "success": True,
        "mode": "agent_cycle",
        "decision": decision,
        "portfolio": portfolio_result,
        "paper_portfolio": get_paper_portfolio_status(cmc_signal.get("price_usd")) if paper_trading_enabled else None,
        "execution_mode": execution_mode,
        "coin": request.coin,
        "cmc_signal": cmc_signal,
        "selected_strategy_requested": request.selected_strategy,
        "selected_strategy": strategy["name"],
        "risk_adjusted_score": risk_score,
        "backtest": backtest,
        "confidence_score": agent_analysis["confidence_score"],
        "signal_breakdown": agent_analysis["signal_breakdown"],
        "why": agent_analysis["why"],
        "risk_control": agent_analysis["risk_control"],
        "daily_qualification": get_daily_qualification_status(),
        "trade_size": request.trade_size,
        "trade_plan": trade_plan,
        "execution_result": execution_result,
        "event": event,
    }


@app.post("/execute-trade")
def execute_trade(request: ExecuteTradeRequest, _operator_ok: bool = Depends(require_operator_key)):
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

def update_autonomous_state_from_result(result):
    now = datetime.now(timezone.utc)
    next_run = now + timedelta(minutes=AUTONOMOUS_STATE["interval_minutes"])

    if result.get("daily_guard_reason"):
        reason = result.get("daily_guard_reason")
    elif result.get("decision") == "HOLD":
        reason = get_hold_reason(result.get("cmc_signal", {}))
    elif result.get("trade_plan") is None:
        reason = "No trade plan was produced by the strategy and risk engine."
    elif result.get("execution_result") is None:
        reason = "Trade plan was not executed."
    else:
        reason = "Agent cycle completed."

    AUTONOMOUS_STATE["last_run"] = now.isoformat()
    AUTONOMOUS_STATE["next_run"] = next_run.isoformat()
    AUTONOMOUS_STATE["last_decision"] = result.get("decision")
    AUTONOMOUS_STATE["last_reason"] = reason
    AUTONOMOUS_STATE["last_result"] = result


def autonomous_loop():
    while AUTONOMOUS_STATE["running"]:
        try:
            result = agent_cycle(AUTONOMOUS_CONFIG, True)
            update_autonomous_state_from_result(result)
        except Exception as error:
            AUTONOMOUS_STATE["last_reason"] = f"Autonomous cycle error: {str(error)}"

        time.sleep(AUTONOMOUS_STATE["interval_minutes"] * 60)

@app.post("/autonomous/start")
def autonomous_start(request: AutonomousRequest, _operator_ok: bool = Depends(require_operator_key)):
    global AUTONOMOUS_THREAD
    global AUTONOMOUS_CONFIG

    now = datetime.now(timezone.utc)

    AUTONOMOUS_CONFIG = AgentCycleRequest(
        coin=request.coin,
        timeframe=request.timeframe,
        risk=request.risk,
        initial_capital=request.initial_capital,
        live_execution=request.live_execution,
        execution_mode=request.execution_mode,
        trade_size=request.trade_size,
        interval_minutes=request.interval_minutes,
        selected_strategy=request.selected_strategy,
    )

    AUTONOMOUS_STATE["running"] = True
    AUTONOMOUS_STATE["interval_minutes"] = request.interval_minutes
    AUTONOMOUS_STATE["last_run"] = None
    AUTONOMOUS_STATE["next_run"] = now.isoformat()
    AUTONOMOUS_STATE["last_decision"] = None
    AUTONOMOUS_STATE["last_reason"] = "Autonomous mode started. Backend loop is running."
    AUTONOMOUS_STATE["last_result"] = None

    update_saved_agent_setup(
        coin=request.coin,
        timeframe=request.timeframe,
        risk=request.risk,
        initial_capital=request.initial_capital,
        live_execution=request.live_execution,
        execution_mode=request.execution_mode,
        trade_size=request.trade_size,
        interval_minutes=request.interval_minutes,
        selected_strategy=request.selected_strategy,
        result_snapshot=request.result_snapshot,
        optimization=request.optimization,
        source=request.setup_source or "autonomous_start",
    )

    if AUTONOMOUS_THREAD is None or not AUTONOMOUS_THREAD.is_alive():
        AUTONOMOUS_THREAD = threading.Thread(
            target=autonomous_loop,
            daemon=True,
        )
        AUTONOMOUS_THREAD.start()

    return {
        "success": True,
        "mode": "autonomous",
        "status": "running",
        "interval_minutes": request.interval_minutes,
        "trade_size": request.trade_size,
        "execution_mode": request.execution_mode,
        "active_config": get_autonomous_config_snapshot(),
        "saved_agent_setup": get_saved_agent_setup_snapshot(),
        "next_run": AUTONOMOUS_STATE["next_run"],
        "message": "Autonomous backend loop started.",
    }
    
@app.post("/autonomous/stop")
def autonomous_stop(_operator_ok: bool = Depends(require_operator_key)):
    AUTONOMOUS_STATE["running"] = False
    AUTONOMOUS_STATE["next_run"] = None
    AUTONOMOUS_STATE["last_decision"] = None
    AUTONOMOUS_STATE["last_result"] = None
    AUTONOMOUS_STATE["last_reason"] = "Autonomous mode stopped by user."

    return {
        "success": True,
        "mode": "autonomous",
        "status": "stopped",
    }


@app.get("/autonomous/status")
def autonomous_status():
    return {
        "success": True,
        "mode": "autonomous",
        "agent_address": get_configured_agent_address(),
        "agent_chain": "bsc",
        "chain": "bsc",
        "network": "BNB Smart Chain / BSC",
        "active_config": get_autonomous_config_snapshot(),
        "saved_agent_setup": get_saved_agent_setup_snapshot(),
        **AUTONOMOUS_STATE,
    }

@app.get("/debug-node")
def debug_node():
    return {
        "node": shutil.which("node"),
        "npm": shutil.which("npm"),
        "npx": shutil.which("npx"),
    }

@app.get("/paper-portfolio")
def paper_portfolio(price_usd: float | None = None):
    return {
        "success": True,
        "mode": "paper_trading",
        "paper_portfolio": get_paper_portfolio_status(price_usd),
    }


@app.post("/paper-portfolio/reset")
def paper_portfolio_reset(request: PaperResetRequest, _operator_ok: bool = Depends(require_operator_key)):
    return {
        "success": True,
        "mode": "paper_trading",
        "paper_portfolio": reset_paper_portfolio(request.starting_balance_usdt),
        "message": "Paper portfolio reset. Live wallet and TWAK history were not touched.",
    }


@app.get("/portfolio")
def portfolio():
    agent_address = get_configured_agent_address()
    result = run_twak_portfolio(address=agent_address)

    event = log_trade({
        "status": "portfolio_check",
        "agent_address": agent_address,
        "result": result,
    })

    return {
        "success": result["success"],
        "execution_layer": "TWAK CLI",
        "agent_address": agent_address,
        "agent_chain": "bsc",
        "chain": "bsc",
        "network": "BNB Smart Chain / BSC",
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

@app.get("/risk-status")
def risk_status():
    return {
        "success": True,
        "risk_control": RISK_STATE,
    }


@app.get("/daily-qualification-status")
def daily_qualification_status():
    return {
        "success": True,
        "daily_qualification": get_daily_qualification_status(),
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