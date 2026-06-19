def generate_pine_script(strategy):
    strategy_name = strategy.get("name", "Generated Strategy")

    if strategy.get("type") == "mean_reversion":
        return f"""//@version=6
strategy("{strategy_name}", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=1)

// VWAP Extreme Reversion Strategy
len = input.int(21, "Deviation Smoothing Length")
level5 = input.float(4.0, "Level 5")
entry_buffer_pct = input.float(0.20, "Entry Buffer")
win_revert_level = input.float(2.0, "Take Profit Deviation")
stop_buffer_pct = input.float(2.0, "Stop Buffer")
smooth_gate_lvl = input.float(3.6, "Smoothed Gate")

src = hl2
vwap_value = ta.vwap(src)

deviation = math.abs(src - vwap_value) * 100 / src
smoothed_deviation = ta.sma(deviation, len)

entry_level = level5 + entry_buffer_pct

long_condition = deviation >= entry_level and smoothed_deviation >= smooth_gate_lvl and strategy.position_size == 0
take_profit_condition = deviation <= win_revert_level and strategy.position_size > 0
stop_condition = deviation >= entry_level + stop_buffer_pct and strategy.position_size > 0

if long_condition
    strategy.entry("VWAP Reversion Long", strategy.long)

if take_profit_condition
    strategy.close("VWAP Reversion Long", comment="Deviation Reverted")

if stop_condition
    strategy.close("VWAP Reversion Long", comment="Deviation Extended")

plot(vwap_value, "VWAP", color=color.yellow, linewidth=2)
plotshape(long_condition, title="Entry", style=shape.circle, color=color.yellow, size=size.small, location=location.belowbar)
"""

    if strategy.get("type") == "trend_continuation":
        return f"""//@version=6
strategy("{strategy_name}", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=1)

// SMC Sequence Continuation Strategy - simplified export
pivot_len = input.int(3, "Pivot Lookback")
risk_reward = input.float(3.0, "Risk Reward Target")

swing_high = ta.pivothigh(high, pivot_len, pivot_len)
swing_low = ta.pivotlow(low, pivot_len, pivot_len)

var float last_high = na
var float last_low = na

if not na(swing_high)
    last_high := swing_high

if not na(swing_low)
    last_low := swing_low

bullish_bos = not na(last_high) and close > last_high
protected_low = last_low

long_condition = bullish_bos and strategy.position_size == 0

if long_condition
    strategy.entry("SMC Long", strategy.long)

if strategy.position_size > 0 and not na(protected_low)
    stop_price = protected_low
    target_price = strategy.position_avg_price + ((strategy.position_avg_price - stop_price) * risk_reward)
    strategy.exit("SMC Exit", "SMC Long", stop=stop_price, limit=target_price)

plot(last_high, "Last Swing High", color=color.green)
plot(last_low, "Last Swing Low", color=color.red)
plotshape(long_condition, title="Bullish BOS Entry", style=shape.triangleup, color=color.lime, size=size.small, location=location.belowbar)
"""

    return "// No Pine export available for this strategy yet."