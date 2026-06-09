import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "https://strategy-forge-production-a3f6.up.railway.app";

function App() {
  const [cmcSkillHub, setCmcSkillHub] = useState(null);
  const [coin, setCoin] = useState("BNB");
  const [timeframe, setTimeframe] = useState("4H");
  const [risk, setRisk] = useState("medium");
  const [initialCapital, setInitialCapital] = useState(10000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showStrategySpec, setShowStrategySpec] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [loadingMode, setLoadingMode] = useState("");
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [bnbBalance, setBnbBalance] = useState(null);
  const [twakStatus, setTwakStatus] = useState("CONFIGURED");
  const [twakRegistration, setTwakRegistration] = useState("READY");
  const [twakAgentAddress, setTwakAgentAddress] = useState(
    "0xd076C7C098a2A1f02d5954e6731E7d5929f3Ec6a"
  );

  function formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) return "N/A";

    const number = Number(value);

    if (Math.abs(number) >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
    if (Math.abs(number) >= 1_000) return `$${(number / 1_000).toFixed(2)}K`;

    return `$${number.toFixed(2)}`;
  }

  function formatPrice(value) {
    if (value === null || value === undefined || isNaN(value)) return "N/A";

    return `$${Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    })}`;
  }

  function formatPercent(value) {
    if (value === null || value === undefined || isNaN(value)) return "N/A";

    const number = Number(value);
    const sign = number > 0 ? "+" : "";

    return `${sign}${number.toFixed(2)}%`;
  }

  function getEquityCurveData() {
    if (!result?.backtest?.equity_curve) return [];

    return result.backtest.equity_curve.map((value, index) => ({
      trade: index,
      equity: value
    }));
  }


  function getOverallRating() {
    const score = Number(result?.backtest?.risk_adjusted_score ?? 0);

    if (score >= 10) return "A";
    if (score >= 7) return "B+";
    if (score >= 5) return "B";
    if (score >= 3) return "C";

    return "D";
  }

  function isApproved() {
    return (
      result?.backtest?.drawdown_gate === "PASS" &&
      result?.backtest?.min_trade_gate === "PASS"
    );
  }

  function parsePercent(value) {
    return parseFloat(String(value).replace("%", ""));
  }

  function copyStrategySummary() {
    const text = `
STRATEGY: ${result.selected_strategy}

ENTRY RULE:
${result.entry?.condition}

CONFIRMATION:
${result.confirmation?.condition}

TAKE PROFIT:
${result.take_profit?.condition}

STOP LOSS:
${result.stop_loss?.condition}

RISK GOVERNOR:
MAX OPEN TRADES: ${result.risk_governor?.max_open_trades}
RISK PER TRADE: ${result.risk_governor?.risk_per_trade}
STOP AFTER LOSSES: ${result.risk_governor?.stop_after_consecutive_losses}

PERFORMANCE SUMMARY:
COIN: ${result.coin}
TIMEFRAME: ${result.timeframe}
RISK: ${String(result.risk).toUpperCase()}
TRADES: ${result.backtest.trades}
WIN RATE: ${result.backtest.win_rate}
NET RETURN: ${result.backtest.net_return}
MAX DRAWDOWN: ${result.backtest.max_drawdown}
PROFIT FACTOR: ${result.backtest.profit_factor}

OPTIMIZER SELECTION:
RISK-ADJUSTED SCORE: ${result.backtest.risk_adjusted_score}
SHARPE RATIO: ${result.backtest.sharpe_ratio}
SORTINO RATIO: ${result.backtest.sortino_ratio}
CALMAR RATIO: ${result.backtest.calmar_ratio}
RECOVERY FACTOR: ${result.backtest.recovery_factor}
EXPECTANCY: ${result.backtest.expectancy}

SELECTION REASON:
Best eligible risk-adjusted score among all tested combinations.
`;

    navigator.clipboard.writeText(text);
    alert("STRATEGY SUMMARY COPIED");
  }

  function getCmcTopSkill() {
    try {
      const rawText = cmcSkillHub?.result?.content?.[0]?.text;
      if (!rawText) return "N/A";

      const parsed = JSON.parse(rawText);
      return parsed?.candidates?.[0]?.uniqueName || "N/A";
    } catch (error) {
      return "N/A";
    }
  }

  async function updateWalletData(address) {
    const chainId = await window.ethereum.request({
      method: "eth_chainId"
    });

    setWalletChainId(chainId);

    const balanceHex = await window.ethereum.request({
      method: "eth_getBalance",
      params: [address, "latest"]
    });

    const balanceBNB = parseInt(balanceHex, 16) / 10 ** 18;
    setBnbBalance(balanceBNB.toFixed(4));
  }

  async function forceBnbChain() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x38",
              chainName: "BNB Smart Chain",
              nativeCurrency: {
                name: "BNB",
                symbol: "BNB",
                decimals: 18
              },
              rpcUrls: ["https://bsc-dataseed.binance.org/"],
              blockExplorerUrls: ["https://bscscan.com"]
            }
          ]
        });
      } else {
        throw switchError;
      }
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("NO WALLET FOUND. INSTALL TRUST WALLET OR METAMASK.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      setWalletAddress(accounts[0]);

      await forceBnbChain();

      setTimeout(async () => {
        await updateWalletData(accounts[0]);
      }, 500);
    } catch (error) {
      console.error(error);
      alert("WALLET CONNECTION OR NETWORK SWITCH FAILED");
    }
  }

  async function switchToBnbChain() {
    if (!window.ethereum) {
      alert("NO WALLET FOUND.");
      return;
    }

    try {
      await forceBnbChain();

      setTimeout(async () => {
        if (walletAddress) {
          await updateWalletData(walletAddress);
        }
      }, 500);
    } catch (error) {
      console.error(error);
      alert("FAILED TO SWITCH TO BNB SMART CHAIN");
    }
  }

  async function checkRegistration() {
    try {
      const response = await fetch(`${API_BASE}/register-agent`, {
        method: "POST"
      });

      const data = await response.json();

      setTwakStatus("CONFIGURED");
      setTwakRegistration(data.registration);
      setTwakAgentAddress(data.agent_address);
    } catch (error) {
      alert("REGISTRATION CHECK FAILED");
    }
  }

  async function generateStrategy() {
    setLoading(true);
    setLoadingMode("generate");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/generate-strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coin,
          timeframe,
          risk,
          initial_capital: initialCapital
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      alert("FAILED TO CONNECT TO BACKEND");
    }

    setLoading(false);
    setLoadingMode("");
  }

  async function optimizeStrategy() {
    setLoading(true);
    setLoadingMode("optimize");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/optimize-strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coin,
          initial_capital: initialCapital
        })
      });

      const data = await response.json();

      if (!response.ok || data.error || !data.best_setup) {
        throw new Error(data.error || "Optimizer returned no best setup.");
      }

      const best = data.best_setup;

      try {
        const skillQuery = `${best.coin || coin} strategy`;
        const skillResponse = await fetch(
          `${API_BASE}/cmc-skill-hub/find?query=${encodeURIComponent(skillQuery)}`
        );
        const skillData = await skillResponse.json();

        setCmcSkillHub({
          ...skillData,
          query: skillQuery
        });
      } catch (skillError) {
        setCmcSkillHub({
          ok: false,
          query: `${best.coin || coin} strategy`,
          error: "CMC Skill Hub unavailable"
        });
      }

      setTimeframe(best.timeframe);
      setRisk(best.risk);

      setResult({
        coin: best.coin,
        timeframe: best.timeframe,
        risk: best.risk,
        cmc_signal: best.cmc_signal || data.cmc_signal,
        selected_strategy: best.selected_strategy,
        type: best.type,
        reason: `AUTO-OPTIMIZER tested ${data.tested_combinations} combinations and selected ${best.selected_strategy} on ${best.timeframe} with ${best.risk.toUpperCase()} risk.`,
        entry: best.entry,
        confirmation: best.confirmation,
        take_profit: best.take_profit,
        stop_loss: best.stop_loss,
        risk_governor: best.risk_governor,
        backtest: best.backtest,
        optimization: {
          mode: data.mode,
          tested_combinations: data.tested_combinations,
          eligible_combinations: data.eligible_combinations,
          all_results: data.all_results
        }
      });
    } catch (error) {
      alert("FAILED TO CONNECT TO OPTIMIZER");
    }

    setLoading(false);
    setLoadingMode("");
  }

  return (
    <div className="terminal">
      <div className="topbar">
        <span>SF v0.1.0</span>
        <span>BERGMANN STRATEGY TERMINAL</span>
        <span>AI ONLINE</span>
      </div>

      <h1 className="title">
        STRATEGY FORGE<span className="blink">_</span>
      </h1>

      <p className="subtitle">AI-POWERED TRADING STRATEGY GENERATOR</p>

      <div className="panel">
        <div className="panel-title">INPUT PARAMETERS</div>

        <h2 className="strategy-library-title">STRATEGY LIBRARY</h2>

        <div className="metrics strategy-library-box">
          <p>VWAP EXTREME REVERSION</p>
          <p>SMC SEQUENCE CONTINUATION</p>
          <p>STOCHASTIC QUAD ROTATION</p>
          <p>TDI WHITE SIGNAL REVERSAL</p>
        </div>

        <h2 className="strategy-library-title">AGENT STATUS</h2>

        <div className="metrics strategy-library-box">
          <p>WALLET.............. {walletAddress ? "CONNECTED" : "NOT CONNECTED"}</p>
          <p>ADDRESS............. {walletAddress || "N/A"}</p>
          <p>
            NETWORK.............{" "}
            {walletChainId === "0x38"
              ? "BNB SMART CHAIN"
              : walletChainId
              ? `WRONG NETWORK (${walletChainId})`
              : "UNKNOWN"}
          </p>
          <p>BNB BALANCE......... {bnbBalance !== null ? `${bnbBalance} BNB` : "N/A"}</p>
          <p>TWAK................ {String(twakStatus).toUpperCase()}</p>
          <p>AGENT ADDRESS....... {twakAgentAddress || "N/A"}</p>
          <p>CHAIN............... BSC</p>
          <p>EXECUTION........... DISABLED</p>
          <p>REGISTRATION........ {String(twakRegistration).toUpperCase()}</p>

          <button onClick={connectWallet} disabled={loading} className="copy-btn">
            {walletAddress ? "WALLET CONNECTED" : "> CONNECT WALLET <"}
          </button>

          {walletAddress && walletChainId !== "0x38" && (
            <button onClick={switchToBnbChain} disabled={loading} className="copy-btn">
              {"> SWITCH TO BNB SMART CHAIN <"}
            </button>
          )}

          <button onClick={checkRegistration} disabled={loading} className="copy-btn">
            {"> CHECK REGISTRATION <"}
          </button>
        </div>

        <div className="input-row">
          <div>
            <label>ASSET</label>
            <select value={coin} disabled={loading} onChange={(e) => setCoin(e.target.value)}>
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="BNB">BNB (BNB)</option>
              <option value="SOL">Solana (SOL)</option>
              <option value="XRP">XRP (XRP)</option>
              <option value="DOGE">Dogecoin (DOGE)</option>
              <option value="LINK">Chainlink (LINK)</option>
              <option value="ADA">Cardano (ADA)</option>
              <option value="AVAX">Avalanche (AVAX)</option>
              <option value="UNI">Uniswap (UNI)</option>
              <option value="INJ">Injective (INJ)</option>
              <option value="CAKE">PancakeSwap (CAKE)</option>
              <option value="TWT">Trust Wallet Token (TWT)</option>
              <option value="AAVE">Aave (AAVE)</option>
              <option value="ATOM">Cosmos (ATOM)</option>
              <option value="LTC">Litecoin (LTC)</option>
              <option value="DOT">Polkadot (DOT)</option>
              <option value="SHIB">Shiba Inu (SHIB)</option>
            </select>
          </div>

          <div>
            <label>TIMEFRAME</label>
            <select value={timeframe} disabled={loading} onChange={(e) => setTimeframe(e.target.value)}>
              <option>15M</option>
              <option>1H</option>
              <option>4H</option>
              <option>1D</option>
            </select>
          </div>

          <div>
            <label>RISK LEVEL</label>
            <select value={risk} disabled={loading} onChange={(e) => setRisk(e.target.value)}>
              <option value="low">LOW</option>
              <option value="medium">MEDIUM</option>
              <option value="high">HIGH</option>
            </select>
          </div>
<div>
   <label>INITIAL CAPITAL</label>

  <div className="capital-input">
    <span>$</span>

    <input
      type="number"
      min="100"
      step="100"
      value={initialCapital}
      disabled={loading}
      onChange={(e) => setInitialCapital(Number(e.target.value))}
    />
  </div>
</div>

          <button onClick={generateStrategy} disabled={loading}>
            {loading && loadingMode === "generate" ? "GENERATING..." : "> GENERATE STRATEGY <"}
          </button>

          <div className="or-divider">OR</div>

          <button onClick={optimizeStrategy} disabled={loading}>
            {loading && loadingMode === "optimize" ? "OPTIMIZING..." : "> AUTO-OPTIMIZE SETUP <"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="panel loading-panel">
          <div className="panel-title">PROCESSING</div>

          <h2>{loadingMode === "optimize" ? "AUTO-OPTIMIZER RUNNING" : "STRATEGY ENGINE RUNNING"}</h2>

          <div className="loading-box">
            <div className="loading-line">
              <span className="loading-text">CONNECTING TO COINMARKETCAP DATA FEED</span>
              <span className="loading-dots"></span>
            </div>

            <div className="loading-line">
              <span className="loading-text">READING MARKET CONDITIONS</span>
              <span className="loading-dots"></span>
            </div>

            <div className="loading-line">
              <span className="loading-text">CALCULATING SENTIMENT AND REGIME</span>
              <span className="loading-dots"></span>
            </div>

            <div className="loading-line">
              <span className="loading-text">RUNNING HISTORICAL BACKTESTS</span>
              <span className="loading-dots"></span>
            </div>

            <div className="loading-line">
              <span className="loading-text">
                {loadingMode === "optimize"
                  ? "RANKING STRATEGY / TIMEFRAME / RISK COMBINATIONS"
                  : "GENERATING TRADING STRATEGY"}
              </span>
              <span className="loading-dots"></span>
            </div>

            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="panel">
          <div className="panel-title">RESULTS</div>

          <h2>EXECUTIVE SUMMARY</h2>

          <div className="metrics">
            <p>STRATEGY........... {result.selected_strategy}</p>
            <p>RETURN............. {result.backtest.net_return}</p>
            <p>MAX DRAWDOWN....... {result.backtest.max_drawdown}</p>
            <p>PROFIT FACTOR...... {result.backtest.profit_factor}</p>
            <p>WIN RATE........... {result.backtest.win_rate}</p>
            <p>RATING............. {getOverallRating()}</p>
          </div>

          <h2>CURRENT MARKET SIGNAL</h2>

          <div className="metrics">
            <p>STATUS............. {result.backtest.current_signal?.status}</p>
            <p>ACTION............. {result.backtest.current_signal?.action}</p>
            <p>LATEST CLOSE....... {result.backtest.current_signal?.latest_close}</p>
            <p>RSI................ {result.backtest.current_signal?.latest_rsi}</p>
            <p>DEVIATION.......... {result.backtest.current_signal?.latest_deviation}%</p>
            <p>MESSAGE............ {result.backtest.current_signal?.message}</p>
          </div>

          <h2>FINAL VERDICT</h2>

          <div className="metrics">
            <p>STATUS............. {isApproved() ? "APPROVED" : "REJECTED"}</p>
            <p>EDGE............... {parsePercent(result.backtest.expectancy) > 0 ? "POSITIVE" : "NEGATIVE"}</p>
            <p>EXPECTANCY......... {parsePercent(result.backtest.expectancy) > 0 ? "POSITIVE" : "NEGATIVE"}</p>
            <p>
              PROFIT FACTOR......
              {Number(result.backtest.profit_factor) >= 2
                ? " STRONG"
                : Number(result.backtest.profit_factor) >= 1
                ? " ACCEPTABLE"
                : " WEAK"}
            </p>
            <p>DRAWDOWN........... {parsePercent(result.backtest.max_drawdown) < 10 ? "CONTROLLED" : "ELEVATED"}</p>
            <p>BUY & HOLD......... {parsePercent(result.backtest.strategy_vs_buy_hold) > 0 ? "OUTPERFORMED" : "UNDERPERFORMED"}</p>
            <p>OVERALL RATING..... {getOverallRating()}</p>
          </div>

          {result.backtest.equity_curve && result.backtest.equity_curve.length > 1 && (
            <>
              <h2>EQUITY CURVE</h2>

              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
<LineChart
  data={getEquityCurveData()}
  margin={{
    top: 10,
    right: 20,
    left: 10,
    bottom: 50
  }}
>
  <XAxis
    dataKey="trade"
    label={{
      value: "TRADES",
      position: "insideBottom",
      offset: -15
    }}
  />
                    <YAxis domain={["auto", "auto"]} />
<Tooltip
  labelFormatter={(label) => `Trade ${label}`}
  formatter={(value) => [`$${Number(value).toFixed(2)}`, "Equity"]}
  contentStyle={{
    backgroundColor: "#001a08",
    border: "1px solid #00ff41",
    color: "#00ff41"
  }}
  labelStyle={{ color: "#00ff41" }}
  itemStyle={{ color: "#00ff41" }}
/>
                    <Line
                      type="monotone"
                      dataKey="equity"
                      dot={false}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

              {cmcSkillHub && (
  <>
    <h2>COINMARKETCAP SKILL HUB COMPARISON</h2>

    <div className="metrics">
      <p>STATUS.............. {cmcSkillHub?.ok ? "ACTIVE" : "UNAVAILABLE"}</p>
      <p>SELECTED ASSET...... {result.coin}</p>
      <p>QUERY............... {cmcSkillHub?.query || `${result.coin} strategy`}</p>
      <p>CURRENT STRATEGY.... {result.selected_strategy}</p>
      <p>SOURCE.............. CMC Skill Hub MCP</p>
      <p>TOP SKILL........... {getCmcTopSkill()}</p>
      <p>USE................. RESEARCH COMPARISON ONLY</p>
    </div>
  </>
)}

<h2>DETAILS</h2>

         {result.cmc_signal && (
  <details>
    <summary>MARKET INTELLIGENCE</summary>

              <div className="metrics">
                <p>SOURCE.............. CoinMarketCap.com API</p>
                <p>STATUS.............. {result.cmc_signal.status}</p>
                <p>SYMBOL.............. {result.cmc_signal.symbol}</p>
                <p>PRICE USD........... {formatPrice(result.cmc_signal.price_usd)}</p>
                <p>CHANGE 1H........... {formatPercent(result.cmc_signal.percent_change_1h)}</p>
                <p>CHANGE 24H.......... {formatPercent(result.cmc_signal.percent_change_24h)}</p>
                <p>CHANGE 7D........... {formatPercent(result.cmc_signal.percent_change_7d)}</p>
                <p>VOLUME 24H.......... {formatMoney(result.cmc_signal.volume_24h)}</p>
                <p>VOLUME CHANGE 24H... {formatPercent(result.cmc_signal.volume_change_24h)}</p>
                <p>MARKET CAP.......... {formatMoney(result.cmc_signal.market_cap)}</p>
                <p>MARKET BIAS......... {String(result.cmc_signal.market_bias).toUpperCase()}</p>
                <p>
                  FEAR & GREED........ {result.cmc_signal.fear_greed?.value ?? "N/A"} / 100{" "}
                  {String(result.cmc_signal.fear_greed?.label || "UNKNOWN").toUpperCase()}
                </p>
                <p>
                  ALTCOIN SEASON...... {result.cmc_signal.altcoin_season?.value ?? "N/A"} / 100{" "}
                  {String(result.cmc_signal.altcoin_season?.label || "UNKNOWN").toUpperCase()}
                </p>
              </div>
            </details>
          )}

          <details>
            <summary>PERFORMANCE SUMMARY</summary>

            <div className="metrics">
              <p>COIN................ {result.coin}</p>
              <p>TIMEFRAME........... {result.timeframe}</p>
              <p>TEST PERIOD......... {result.backtest.backtest_period}</p>
              <p>CANDLES TESTED...... {result.backtest.candles_tested}</p>
              <p>TX COST / TRADE..... {result.backtest.transaction_cost_per_trade}</p>
              <p>SLIPPAGE............ {result.backtest.slippage_per_trade}</p>
              <p>TOTAL COST.......... {result.backtest.total_cost_per_trade}</p>
              <p>RISK MODEL.......... {result.risk}</p>
              <p>TRADES.............. {result.backtest.trades}</p>
              <p>WINS................ {result.backtest.wins}</p>
              <p>LOSSES.............. {result.backtest.losses}</p>
              <p>WIN RATE............ {result.backtest.win_rate}</p>
              <p>INITIAL CAPITAL..... {result.backtest.initial_capital}</p>
              <p>FINAL EQUITY........ {result.backtest.final_equity}</p>
              <p>NET RETURN.......... {result.backtest.net_return}</p>
              <p>BUY & HOLD RETURN... {result.backtest.buy_hold_return}</p>
              <p>VS BUY & HOLD....... {result.backtest.strategy_vs_buy_hold}</p>
              <p>AVG PNL............. {result.backtest.avg_pnl}</p>
              <p>LARGEST PROFIT...... {result.backtest.largest_profit}</p>
              <p>LARGEST LOSS........ {result.backtest.largest_loss}</p>
              <p>AVG BARS IN TRADE... {result.backtest.avg_bars_in_trade}</p>
              <p>AVG DD DURATION..... {result.backtest.avg_drawdown_duration}</p>
              <p>DD / INIT CAPITAL... {result.backtest.max_drawdown_initial_capital}</p>
              <p>PROFIT FACTOR....... {result.backtest.profit_factor}</p>
              <p>MAX DRAWDOWN........ {result.backtest.max_drawdown}</p>
              <p>RECOVERY FACTOR..... {result.backtest.recovery_factor}</p>
              <p>RISK-ADJUSTED SCORE. {result.backtest.risk_adjusted_score}</p>
            </div>
          </details>

          <details>
            <summary>RISK ANALYTICS</summary>

            <div className="metrics">
              <p>
                SHARPE RATIO........ {result.backtest.sharpe_ratio}{" "}
                (
                {Number(result.backtest.sharpe_ratio) < 0.5
                  ? "POOR"
                  : Number(result.backtest.sharpe_ratio) < 1
                  ? "FAIR"
                  : Number(result.backtest.sharpe_ratio) < 2
                  ? "GOOD"
                  : "EXCELLENT"}
                )
              </p>
              <p>Return earned per unit of volatility.</p>
              <br />

              <p>
                SORTINO RATIO....... {result.backtest.sortino_ratio}{" "}
                (
                {Number(result.backtest.sortino_ratio) < 0.5
                  ? "POOR"
                  : Number(result.backtest.sortino_ratio) < 1
                  ? "FAIR"
                  : Number(result.backtest.sortino_ratio) < 2
                  ? "GOOD"
                  : "EXCELLENT"}
                )
              </p>
              <p>Return earned per unit of downside risk.</p>
              <br />

              <p>
                CALMAR RATIO........ {result.backtest.calmar_ratio}{" "}
                (
                {Number(result.backtest.calmar_ratio) < 1
                  ? "POOR"
                  : Number(result.backtest.calmar_ratio) < 2
                  ? "FAIR"
                  : Number(result.backtest.calmar_ratio) < 3
                  ? "GOOD"
                  : "EXCELLENT"}
                )
              </p>
              <p>Return achieved relative to maximum drawdown.</p>
              <br />

              <p>
                EXPECTANCY.......... {result.backtest.expectancy}{" "}
                (
                {parsePercent(result.backtest.expectancy) > 0
                  ? "POSITIVE EDGE"
                  : "NEGATIVE EDGE"}
                )
              </p>
              <p>Average expected profit or loss per trade.</p>
              <p>LONGEST WIN STREAK. {result.backtest.max_win_streak}</p>
              <p>LONGEST LOSS STREAK {result.backtest.max_loss_streak}</p>
              <p>AVERAGE WIN........ {result.backtest.avg_win}</p>
              <p>AVERAGE LOSS....... {result.backtest.avg_loss}</p>
              <p>PAYOFF RATIO....... {result.backtest.payoff_ratio}</p>
            </div>
          </details>

          <details>
            <summary>VALIDATION CHECKS</summary>

            <div className="metrics">
              <p>MIN TRADES REQUIRED. {result.backtest.min_trades_required}</p>
              <p>MIN TRADE GATE...... {result.backtest.min_trade_gate}</p>
              <p>DRAWDOWN LIMIT...... {result.backtest.drawdown_limit}</p>
              <p>DRAWDOWN GATE....... {result.backtest.drawdown_gate}</p>
              <p>
                {result.backtest.min_trade_gate === "PASS"
                  ? "✓ MINIMUM TRADES PASSED"
                  : "✗ MINIMUM TRADES FAILED"}
              </p>
              <p>
                {result.backtest.drawdown_gate === "PASS"
                  ? "✓ DRAWDOWN LIMIT PASSED"
                  : "✗ DRAWDOWN LIMIT FAILED"}
              </p>
              <p>
                {parsePercent(result.backtest.expectancy) > 0
                  ? "✓ POSITIVE EXPECTANCY"
                  : "✗ NEGATIVE EXPECTANCY"}
              </p>
              <p>
                {Number(result.backtest.profit_factor) > 1
                  ? "✓ PROFIT FACTOR ABOVE 1"
                  : "✗ PROFIT FACTOR BELOW 1"}
              </p>
              <p>
                {parsePercent(result.backtest.net_return) > 0
                  ? "✓ POSITIVE NET RETURN"
                  : "✗ NEGATIVE NET RETURN"}
              </p>
              <p>
                {parsePercent(result.backtest.strategy_vs_buy_hold) > 0
                  ? "✓ OUTPERFORMED BUY & HOLD"
                  : "✗ UNDERPERFORMED BUY & HOLD"}
              </p>
            </div>
          </details>

          <details>
            <summary>MARKET CONDITIONS</summary>

            <div className="metrics">
              <p>FIRST HALF MARKET.... {result.backtest.first_half_return}</p>
              <p>SECOND HALF MARKET... {result.backtest.second_half_return}</p>
              <p>MARKET TREND GATE.... {result.backtest.consistency_gate}</p>
            </div>
          </details>

          {result.optimization && (
            <details>
              <summary>OPTIMIZATION RESULTS</summary>

              <div className="metrics">
                <p>MODE................ {result.optimization.mode}</p>
                <p>COMBINATIONS TESTED. {result.optimization.tested_combinations}</p>
                <p>ELIGIBLE COMBOS..... {result.optimization.eligible_combinations}</p>
                <p>BEST TIMEFRAME...... {result.timeframe}</p>
                <p>BEST RISK MODEL..... {result.risk}</p>
                <p>BEST STRATEGY....... {result.selected_strategy}</p>
                <p>OBJECTIVE........... MAXIMIZE RETURN WHILE CONTROLLING DRAWDOWN</p>
              </div>

              <h2>SELECTED CONFIGURATION</h2>

              <div className="metrics">
                <p>WINNER............. {result.selected_strategy}</p>
                <p>TIMEFRAME.......... {result.timeframe}</p>
                <p>RISK PROFILE....... {String(result.risk).toUpperCase()}</p>
                <p>RETURN............. {result.backtest.net_return}</p>
                <p>MAX DRAWDOWN....... {result.backtest.max_drawdown}</p>
                <p>PROFIT FACTOR...... {result.backtest.profit_factor}</p>
                <p>CALMAR RATIO....... {result.backtest.calmar_ratio}</p>
                <p>SELECTION REASON... BEST ELIGIBLE RISK-ADJUSTED SCORE</p>
              </div>

              <h2>TOP RANKINGS</h2>

              <div className="optimizer-table">
                <div className="optimizer-row optimizer-header">
                  <span>RANK</span>
                  <span>TIMEFRAME</span>
                  <span>RISK</span>
                  <span>STRATEGY</span>
                  <span>RETURN</span>
                  <span>SHARPE</span>
                  <span>CALMAR</span>
                  <span>PF</span>
                  <span>MAX DD</span>
                  <span>SCORE</span>
                </div>

                {result.optimization.all_results
                  ?.filter((item) => item.backtest.min_trade_gate === "PASS" && item.backtest.drawdown_gate === "PASS")
                  .sort((a, b) => b.risk_adjusted_score - a.risk_adjusted_score)
                  .slice(0, 5)
                  .map((item, index) => (
                    <div className="optimizer-row" key={index}>
                      <span>#{index + 1}</span>
                      <span>{item.timeframe}</span>
                      <span>{item.risk.toUpperCase()}</span>
                      <span>{item.selected_strategy}</span>
                      <span>{item.backtest.net_return}</span>
                      <span>{item.backtest.sharpe_ratio}</span>
                      <span>{item.backtest.calmar_ratio}</span>
                      <span>{item.backtest.profit_factor}</span>
                      <span>{item.backtest.max_drawdown}</span>
                      <span>{item.risk_adjusted_score}</span>
                    </div>
                  ))}
              </div>
            </details>
          )}

          <details>
            <summary>RECENT TRADES</summary>

            <div className="trade-table">
              <div className="trade-row trade-header">
                <span>ENTRY TIME</span>
                <span>EXIT TIME</span>
                <span>ENTRY</span>
                <span>EXIT</span>
                <span>RESULT</span>
                <span>PNL</span>
                <span>DURATION</span>
              </div>

              {result.backtest.recent_trades &&
                result.backtest.recent_trades.map((trade, index) => (
                  <div className="trade-row" key={index}>
                    <span>{trade.entry_time}</span>
                    <span>{trade.exit_time}</span>
                    <span>{trade.entry_price}</span>
                    <span>{trade.exit_price}</span>
                    <span className={trade.result === "win" ? "trade-win" : "trade-loss"}>
                      {trade.result.toUpperCase()}
                    </span>
                    <span>{trade.pnl_pct}%</span>
                    <span>{trade.duration}</span>
                  </div>
                ))}
            </div>
          </details>

          <details>
            <summary>TRADING STRATEGY</summary>

            <div className="reason">
              <strong>STRATEGY:</strong> {result.selected_strategy}
              <br />
              <br />
              <strong>ENTRY RULE:</strong>
              <br />
              {result.entry?.condition}
              <br />
              <br />
              <strong>CONFIRMATION:</strong>
              <br />
              {result.confirmation?.condition}
              <br />
              <br />
              <strong>TAKE PROFIT:</strong>
              <br />
              {result.take_profit?.condition}
              <br />
              <br />
              <strong>STOP LOSS:</strong>
              <br />
              {result.stop_loss?.condition}
              <br />
              <br />
              <strong>RISK GOVERNOR:</strong>
              <br />
              MAX OPEN TRADES: {result.risk_governor?.max_open_trades}
              <br />
              RISK PER TRADE: {result.risk_governor?.risk_per_trade}
              <br />
              STOP AFTER LOSSES: {result.risk_governor?.stop_after_consecutive_losses}
            </div>

            <button className="copy-btn" onClick={copyStrategySummary}>
              COPY STRATEGY SUMMARY
            </button>
          </details>

          <details>
            <summary>WHY THIS WAS SELECTED</summary>
            <div className="reason">{result.reason}</div>
          </details>

          <details>
            <summary>SYSTEM HEALTH</summary>

            <div className="reason">
              CMC DATA..............ACTIVE
              <br />
              MARKET ANALYSIS........ACTIVE
              <br />
              STRATEGY ENGINE........ACTIVE
              <br />
              BACKTEST ENGINE........ACTIVE
              <br />
              RISK MODEL............ACTIVE
              <br />
              OPTIMIZER.............ACTIVE
              <br />
              <br />
              SIGNAL GENERATION LOGIC
              <br />
              CLASSIFIED
            </div>
          </details>

          <details>
            <summary>PERFORMANCE METRICS EXPLAINED</summary>

            <div className="metrics">
              <p><strong>PF / PROFIT FACTOR</strong></p>
              <p>Total winning trade profit divided by total losing trade loss. Above 1.0 is profitable.</p>

              <p><strong>SHARPE RATIO</strong></p>
              <p>Return earned per unit of total volatility. Higher is better.</p>

              <p><strong>SORTINO RATIO</strong></p>
              <p>Return earned per unit of downside risk only. Higher is better.</p>

              <p><strong>CALMAR RATIO</strong></p>
              <p>Net return divided by maximum drawdown. Higher is better.</p>

              <p><strong>EXPECTANCY</strong></p>
              <p>Average expected profit or loss per trade.</p>

              <p><strong>MAX DD / MAX DRAWDOWN</strong></p>
              <p>Largest peak-to-trough account decline during the test period.</p>

              <p><strong>RISK-ADJUSTED SCORE</strong></p>
              <p>Custom optimizer score. Rewards net return and penalizes drawdown.</p>

              <p><strong>BUY & HOLD RETURN</strong></p>
              <p>Return from simply buying the asset at the start of the test and holding until the end.</p>

              <p><strong>VS BUY & HOLD</strong></p>
              <p>How much the strategy outperformed or underperformed buy-and-hold.</p>

              <p><strong>EQUITY CURVE</strong></p>
              <p>Account value over time, starting from the selected initial capital and updating after each closed trade.</p>
            </div>
          </details>
        </div>
      )}
      <div className="footer">
        CMC: OK &nbsp;&nbsp; DATA: OK &nbsp;&nbsp; BACKTEST: OK &nbsp;&nbsp; OPTIMIZER: OK &nbsp;&nbsp; PRIVATE ENGINE: LOCKED
      </div>
    </div>
  );
}

export default App;