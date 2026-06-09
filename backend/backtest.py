from market_data import fetch_binance_klines
import pandas as pd


DRAWDOWN_LIMIT = 30.0
INITIAL_EQUITY = 10000
MIN_TRADES_REQUIRED = 7


def normalize_symbol(coin: str):
    coin = coin.upper().replace("/", "").replace("-", "")

    if coin.endswith("USDT"):
        return coin

    return coin + "USDT"


def timeframe_to_binance(timeframe: str):
    mapping = {
        "15M": "15m",
        "1H": "1h",
        "4H": "4h",
        "1D": "1d"
    }

    return mapping.get(timeframe.upper(), "4h")


def get_risk_settings(risk: str):
    risk = risk.lower()

    if risk == "low":
        return {
            "entry_level": 4.8,
            "smoothed_gate": 4.0,
            "take_profit_level": 2.0,
            "stop_extension": 1.5,
            "win_pnl": 1.5,
            "loss_pnl": -0.75,
            "fee_per_trade": 0.10,
            "slippage_per_trade": 0.05
        }

    if risk == "high":
        return {
            "entry_level": 3.6,
            "smoothed_gate": 3.0,
            "take_profit_level": 2.3,
            "stop_extension": 2.5,
            "win_pnl": 3.0,
            "loss_pnl": -1.5,
            "fee_per_trade": 0.10,
            "slippage_per_trade": 0.05
        }

    return {
        "entry_level": 4.2,
        "smoothed_gate": 3.6,
        "take_profit_level": 2.0,
        "stop_extension": 2.0,
        "win_pnl": 2.0,
        "loss_pnl": -1.0,
        "fee_per_trade": 0.10,
        "slippage_per_trade": 0.05
    }


def calculate_rsi(series, length=13):
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.rolling(length).mean()
    avg_loss = loss.rolling(length).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    return rsi.fillna(50)


def build_indicators(df):
    df["typical_price"] = (df["high"] + df["low"]) / 2
    df["pv"] = df["typical_price"] * df["volume"]
    df["cum_pv"] = df["pv"].cumsum()
    df["cum_volume"] = df["volume"].cumsum()
    df["vwap"] = df["cum_pv"] / df["cum_volume"]

    df["deviation"] = abs(df["typical_price"] - df["vwap"]) * 100 / df["typical_price"]
    df["smoothed_deviation"] = df["deviation"].rolling(21).mean()

    df["rsi"] = calculate_rsi(df["close"], 13)
    df["tdi_fast"] = df["rsi"].rolling(2).mean()
    df["tdi_slow"] = df["rsi"].rolling(7).mean()

    low_14 = df["low"].rolling(14).min()
    high_14 = df["high"].rolling(14).max()
    df["stoch_fast"] = ((df["close"] - low_14) / (high_14 - low_14)) * 100
    df["stoch_medium"] = df["stoch_fast"].rolling(5).mean()
    df["stoch_slow"] = df["stoch_fast"].rolling(14).mean()

    df = df.bfill().ffill()

    return df


def get_signal(strategy_type, df, index, settings):
    row = df.iloc[index]
    prev_1 = df.iloc[index - 1] if index >= 1 else row
    prev_2 = df.iloc[index - 2] if index >= 2 else row

    if strategy_type == "mean_reversion":
        entry = (
            row["deviation"] >= settings["entry_level"] and
            row["smoothed_deviation"] >= settings["smoothed_gate"]
        )

        return "long" if entry else None

    if strategy_type == "trend_continuation":
        recent_high = df["high"].iloc[max(0, index - 20):index].max()
        volume_avg = df["volume"].iloc[max(0, index - 20):index].mean()

        bullish_break = row["close"] > recent_high
        volume_confirm = row["volume"] > volume_avg * 1.2

        return "long" if bullish_break and volume_confirm else None

    if strategy_type == "momentum_rotation":
        fast_turning_up = row["stoch_fast"] > prev_1["stoch_fast"] > prev_2["stoch_fast"]
        medium_up = row["stoch_medium"] > prev_1["stoch_medium"]
        slow_confirm = row["stoch_slow"] > 45

        return "long" if fast_turning_up and medium_up and slow_confirm else None

    if strategy_type == "tdi_signal_reversal":
        buy_signal = (
            prev_2["tdi_fast"] < 32 and
            prev_1["tdi_fast"] > prev_2["tdi_fast"] and
            row["tdi_fast"] > prev_1["tdi_fast"] and
            row["tdi_fast"] < 32
        )

        sell_signal = (
            prev_2["tdi_fast"] > 68 and
            prev_1["tdi_fast"] < prev_2["tdi_fast"] and
            row["tdi_fast"] < prev_1["tdi_fast"] and
            row["tdi_fast"] > 68
        )

        if buy_signal:
            return "long"

        if sell_signal:
            return "short"

        return None

    return None


def calculate_drawdown_durations(equity_curve):
    durations = []
    current_duration = 0
    peak = INITIAL_EQUITY

    for value in equity_curve:
        if value >= peak:
            if current_duration > 0:
                durations.append(current_duration)
                current_duration = 0
            peak = value
        else:
            current_duration += 1

    if current_duration > 0:
        durations.append(current_duration)

    if not durations:
        return 0

    return sum(durations) / len(durations)


def calculate_sharpe_ratio(trade_returns):
    if len(trade_returns) < 2:
        return 0

    series = pd.Series(trade_returns)
    std = series.std()

    if std == 0:
        return 0

    return series.mean() / std


def calculate_sortino_ratio(trade_returns):
    if len(trade_returns) < 2:
        return 0

    series = pd.Series(trade_returns)
    downside = series[series < 0]

    if len(downside) < 2:
        return 0

    downside_deviation = ((downside ** 2).mean()) ** 0.5

    if downside_deviation == 0:
        return 0

    return series.mean() / downside_deviation

def get_current_signal_summary(strategy_type, df, settings):
    last_index = len(df) - 1
    signal = get_signal(strategy_type, df, last_index, settings)
    row = df.iloc[last_index]

    if signal:
        return {
            "status": signal.upper(),
            "action": f"{signal.upper()} SIGNAL ACTIVE",
            "latest_close": round(row["close"], 4),
            "latest_rsi": round(row["rsi"], 2),
            "latest_deviation": round(row["deviation"], 2),
            "message": f"{signal.upper()} setup detected on latest closed candle."
        }

    return {
        "status": "HOLD",
        "action": "NO ACTIVE ENTRY",
        "latest_close": round(row["close"], 4),
        "latest_rsi": round(row["rsi"], 2),
        "latest_deviation": round(row["deviation"], 2),
        "message": "No valid entry signal on latest closed candle."
    }

def run_backtest(
    strategy,
    coin,
    timeframe,
    risk,
    initial_capital=10000
):
    symbol = normalize_symbol(coin)
    interval = timeframe_to_binance(timeframe)
    settings = get_risk_settings(risk)
    strategy_type = strategy.get("type", "")
    total_cost_pct = settings["fee_per_trade"] + settings["slippage_per_trade"]

    df = fetch_binance_klines(
        symbol=symbol,
        interval=interval,
        limit=500
    )

    df = build_indicators(df)

    midpoint = len(df) // 2

    first_half_return = (
        (df["close"].iloc[midpoint] - df["close"].iloc[0])
        / df["close"].iloc[0]
    ) * 100

    second_half_return = (
        (df["close"].iloc[-1] - df["close"].iloc[midpoint])
        / df["close"].iloc[midpoint]
    ) * 100

    consistency_pass = (
        first_half_return > 0 and
        second_half_return > 0
    )

    current_signal = get_current_signal_summary(
        strategy_type,
        df,
        settings
    )

    buy_hold_return = (
        (df["close"].iloc[-1] - df["close"].iloc[0])
        / df["close"].iloc[0]
    ) * 100

    in_trade = False
    trade_dir = None
    entry_price = None
    entry_time = None
    entry_dev = None
    entry_index = None

    trades = []
    equity = initial_capital
    peak_equity = equity
    max_drawdown = 0
    max_drawdown_initial_capital = 0
    equity_curve = [equity]
    buy_hold_curve = [initial_capital]

    for index in range(2, len(df)):
        row = df.iloc[index]
        close = row["close"]

        if not in_trade:
            signal = get_signal(strategy_type, df, index, settings)

            if signal:
                in_trade = True
                trade_dir = signal
                entry_price = close
                entry_time = row["open_time"]
                entry_dev = row["deviation"]
                entry_index = index

        else:
            if strategy_type == "mean_reversion":
                win = row["deviation"] <= settings["take_profit_level"]
                loss = row["deviation"] >= entry_dev + settings["stop_extension"]
            else:
                if trade_dir == "long":
                    win = close >= entry_price * (1 + settings["win_pnl"] / 100)
                    loss = close <= entry_price * (1 + settings["loss_pnl"] / 100)
                else:
                    win = close <= entry_price * (1 - settings["win_pnl"] / 100)
                    loss = close >= entry_price * (1 - settings["loss_pnl"] / 100)

            if win or loss:
                raw_pnl_pct = settings["win_pnl"] if win else settings["loss_pnl"]
                pnl_pct = raw_pnl_pct - total_cost_pct
                bars_in_trade = index - entry_index

                equity = equity * (1 + pnl_pct / 100)
                equity_curve.append(equity)
                peak_equity = max(peak_equity, equity)

                buy_hold_equity = initial_capital * (close / df["close"].iloc[0])
                buy_hold_curve.append(round(buy_hold_equity, 2))

                
                drawdown = ((peak_equity - equity) / peak_equity) * 100
                max_drawdown = max(max_drawdown, drawdown)

                drawdown_initial = ((peak_equity - equity) / initial_capital) * 100
                max_drawdown_initial_capital = max(max_drawdown_initial_capital, drawdown_initial)

                trades.append({
                    "entry_time": entry_time.strftime("%Y-%m-%d %H:%M"),
                    "exit_time": row["open_time"].strftime("%Y-%m-%d %H:%M"),
                    "entry_price": round(entry_price, 4),
                    "exit_price": round(close, 4),
                    "result": "win" if win else "loss",
                    "pnl_pct": round(pnl_pct, 2),
                    "raw_pnl_pct": round(raw_pnl_pct, 2),
                    "fee_pct": settings["fee_per_trade"],
                    "slippage_pct": settings["slippage_per_trade"],
                    "total_cost_pct": round(total_cost_pct, 2),
                    "bars_in_trade": bars_in_trade,
"duration": f"{bars_in_trade} bars"
                })

                in_trade = False
                trade_dir = None
                entry_price = None
                entry_time = None
                entry_dev = None
                entry_index = None

    wins = len([t for t in trades if t["result"] == "win"])
    losses = len([t for t in trades if t["result"] == "loss"])
    total = wins + losses
    win_rate = (wins / total * 100) if total > 0 else 0

    trade_returns = [t["pnl_pct"] for t in trades]

    gross_profit = sum(t["pnl_pct"] for t in trades if t["result"] == "win")
    gross_loss = abs(sum(t["pnl_pct"] for t in trades if t["result"] == "loss"))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else gross_profit

    net_return = ((equity - initial_capital) / initial_capital) * 100
    strategy_vs_buy_hold = net_return - buy_hold_return
    risk_adjusted_score = net_return - max_drawdown

    drawdown_gate = "PASS" if max_drawdown <= DRAWDOWN_LIMIT else "FAIL"
    min_trade_gate = "PASS" if total >= MIN_TRADES_REQUIRED else "FAIL"

    winning_returns = [t["pnl_pct"] for t in trades if t["result"] == "win"]
    losing_returns = [t["pnl_pct"] for t in trades if t["result"] == "loss"]

    avg_win = sum(winning_returns) / len(winning_returns) if winning_returns else 0
    avg_loss = sum(losing_returns) / len(losing_returns) if losing_returns else 0
    payoff_ratio = avg_win / abs(avg_loss) if avg_loss != 0 else avg_win
    avg_pnl = sum(t["pnl_pct"] for t in trades) / total if total > 0 else 0
    largest_profit = max([t["pnl_pct"] for t in trades], default=0)
    largest_loss = min([t["pnl_pct"] for t in trades], default=0)
    avg_bars_in_trade = sum(t["bars_in_trade"] for t in trades) / total if total > 0 else 0
    avg_drawdown_duration = calculate_drawdown_durations(equity_curve)

    sharpe_ratio = calculate_sharpe_ratio(trade_returns)
    sortino_ratio = calculate_sortino_ratio(trade_returns)
    calmar_ratio = net_return / max_drawdown if max_drawdown > 0 else 0
    expectancy = avg_pnl

    sharpe_ratio = calculate_sharpe_ratio(trade_returns)
    sortino_ratio = calculate_sortino_ratio(trade_returns)
    calmar_ratio = net_return / max_drawdown if max_drawdown > 0 else 0
    expectancy = avg_pnl
    recovery_factor = net_return / max_drawdown if max_drawdown > 0 else net_return

    max_win_streak = 0
    max_loss_streak = 0

    current_win_streak = 0
    current_loss_streak = 0

    for trade in trades:
        if trade["result"] == "win":
            current_win_streak += 1
            current_loss_streak = 0
            max_win_streak = max(max_win_streak, current_win_streak)

        else:
            current_loss_streak += 1
            current_win_streak = 0
            max_loss_streak = max(max_loss_streak, current_loss_streak)

    return {
        "mode": "real_binance_backtest",
        "symbol": symbol,
        "timeframe": interval,
        "strategy_type": strategy_type,
        "risk_model": risk.lower(),
        "settings_used": settings,
        "transaction_cost_per_trade": f"{settings['fee_per_trade']:.2f}%",
        "slippage_per_trade": f"{settings['slippage_per_trade']:.2f}%",
        "total_cost_per_trade": f"{total_cost_pct:.2f}%",
        "drawdown_limit": f"{DRAWDOWN_LIMIT:.2f}%",
        "drawdown_gate": drawdown_gate,
        "min_trades_required": MIN_TRADES_REQUIRED,
        "min_trade_gate": min_trade_gate,
        "candles_tested": len(df),
        "backtest_start": df["open_time"].iloc[0].strftime("%Y-%m-%d"),
        "backtest_end": df["open_time"].iloc[-1].strftime("%Y-%m-%d"),
        "backtest_period": f"{df['open_time'].iloc[0].strftime('%Y-%m-%d')} to {df['open_time'].iloc[-1].strftime('%Y-%m-%d')}",
        "trades": total,
        "wins": wins,
        "losses": losses,
        "win_rate": f"{win_rate:.2f}%",
        "net_return": f"{net_return:.2f}%",
        "current_signal": current_signal,
        "first_half_return": f"{first_half_return:.2f}%",
        "second_half_return": f"{second_half_return:.2f}%",
        "consistency_gate": "PASS" if consistency_pass else "FAIL",
        "buy_hold_return": f"{buy_hold_return:.2f}%",
        "strategy_vs_buy_hold": f"{strategy_vs_buy_hold:.2f}%",
        "max_drawdown": f"{max_drawdown:.2f}%",
        "max_drawdown_initial_capital": f"{max_drawdown_initial_capital:.2f}%",
        "avg_drawdown_duration": f"{avg_drawdown_duration:.2f} trades",
        "avg_pnl": f"{avg_pnl:.2f}%",
        "avg_win": f"{avg_win:.2f}%",
        "avg_loss": f"{avg_loss:.2f}%",
        "payoff_ratio": round(payoff_ratio, 2),
        "largest_profit": f"{largest_profit:.2f}%",
        "largest_loss": f"{largest_loss:.2f}%",
        "avg_bars_in_trade": f"{avg_bars_in_trade:.2f}",
        "expectancy": f"{expectancy:.2f}%",
        "max_win_streak": max_win_streak,
        "max_loss_streak": max_loss_streak,
        "sharpe_ratio": round(sharpe_ratio, 2),
        "sortino_ratio": round(sortino_ratio, 2),
        "calmar_ratio": round(calmar_ratio, 2),
        "recovery_factor": round(recovery_factor, 2),
        "profit_factor": round(profit_factor, 2),
        "risk_adjusted_score": round(risk_adjusted_score, 2),
        "initial_capital": f"${initial_capital:,.2f}",
        "final_equity": f"${equity:,.2f}",
        "equity_curve": [round(x, 2) for x in equity_curve],
        "buy_hold_curve": buy_hold_curve,
        "recent_trades": trades[-20:]
    }