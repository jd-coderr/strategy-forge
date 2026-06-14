import { useState, useEffect } from "react";
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
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [autonomousStatus, setAutonomousStatus] = useState(null);
  const [autonomousInterval, setAutonomousInterval] = useState(5);
  const [cmcSkillHub, setCmcSkillHub] = useState(null);
  const [coin, setCoin] = useState("BNB");
  const [timeframe, setTimeframe] = useState("4H");
  const [risk, setRisk] = useState("medium");
  const [initialCapital, setInitialCapital] = useState(10000);
  const [result, setResult] = useState(null);
  const [agentResult, setAgentResult] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [showOnlyRealTrades, setShowOnlyRealTrades] = useState(false);
  const [startingPortfolioValue, setStartingPortfolioValue] = useState(null);
  const [liveExecution, setLiveExecution] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState("");
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [bnbBalance, setBnbBalance] = useState(null);
  const [twakStatus, setTwakStatus] = useState("CONFIGURED");
  const [twakRegistration, setTwakRegistration] = useState("READY");
  const [twakAgentAddress, setTwakAgentAddress] = useState(null);

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

async function startAutonomousMode() {
  try {
    const response = await fetch(`${API_BASE}/autonomous/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coin,
        timeframe,
        risk,
        initial_capital: initialCapital,
        live_execution: liveExecution,
        selected_strategy: result?.selected_strategy || null,
        interval_minutes: autonomousInterval,
      }),
    });

    const data = await response.json();
    setAutonomousStatus(data);
    setAutonomousMode(true);
  } catch (err) {
    console.error(err);
    alert("AUTONOMOUS MODE START FAILED");
  }
}

async function stopAutonomousMode() {
  try {
    const response = await fetch(`${API_BASE}/autonomous/stop`, {
      method: "POST",
    });

    const data = await response.json();
    setAutonomousStatus(data);
    setAutonomousMode(false);
  } catch (err) {
    console.error(err);
    alert("AUTONOMOUS MODE STOP FAILED");
  }
}

async function loadAutonomousStatus() {
  try {
    const response = await fetch(`${API_BASE}/autonomous/status`);
    const data = await response.json();

    setAutonomousStatus(data);
    setAutonomousMode(data.running === true);

    if (data.interval_minutes) {
      setAutonomousInterval(data.interval_minutes);
}

    if (data.last_result) {
      setAgentResult(data.last_result);
    }
  } catch (err) {
    console.error(err);
  }
}

useEffect(() => {
  loadAutonomousStatus();
  checkRegistration();
  loadTradeHistory();
  
  const timer = setInterval(() => {
    loadAutonomousStatus();
  }, 10000);

  return () => clearInterval(timer);
}, []);

  function parsePercent(value) {
    return parseFloat(String(value).replace("%", ""));
  }

  function getMarketRegime() {
    const fearValue = Number(result?.cmc_signal?.fear_greed?.value ?? 50);

    if (fearValue <= 25) return "RISK-OFF / EXTREME FEAR";
    if (fearValue >= 75) return "RISK-ON / HIGH GREED";

    return "NEUTRAL";
  }

  function getAgentDecision() {
    return agentResult?.decision || result?.backtest?.current_signal?.status || "N/A";
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
        await loadPortfolio();
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
    setAgentResult(null);

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
    setAgentResult(null);

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

async function runAgentCycle() {
  try {
    const response = await fetch(`${API_BASE}/agent-cycle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coin,
        timeframe,
        risk,
        live_execution: liveExecution,
        selected_strategy: result?.selected_strategy || null,
      }),
    });

    const data = await response.json();
    setAgentResult(data);
    await loadTradeHistory();

    if (!autonomousMode) {
      await startAutonomousMode();
    }
  } catch (err) {
    console.error(err);
    alert("AGENT CYCLE FAILED");
  }
}

  async function loadPortfolio() {
    try {
      const response = await fetch(`${API_BASE}/portfolio`);
      const data = await response.json();

    const rawPortfolio =
      data?.result?.portfolio ||
      data?.portfolio ||
      data?.event?.result?.portfolio ||
      [];

      const assets = Array.isArray(rawPortfolio)
        ? rawPortfolio.map((item) => ({
            symbol: item.symbol || item.token || "UNKNOWN",
            balance: item.balance,
            usdValue: Number(item.usdValue || 0),
            chain: item.chain,
            type: item.type,
            address: item.address,
            contract: item.contract,
          }))
        : [];

      const totalUsdValue = assets.reduce(
        (sum, asset) => sum + Number(asset.usdValue || 0),
        0
      );

const startingValue =
  startingPortfolioValue === null
    ? totalUsdValue
    : startingPortfolioValue;

if (startingPortfolioValue === null) {
  setStartingPortfolioValue(totalUsdValue);
}

setPortfolio({
  success: data?.success === true,
  assets,
  totalUsdValue,
  startingPortfolioValue: startingValue,
  tradingPnlUsd: totalUsdValue - startingValue,
});
    } catch (err) {
      console.error(err);
      alert("PORTFOLIO LOAD FAILED");
    }
  }

function resetPnlBaseline() {
  if (!portfolio) {
    alert("LOAD PORTFOLIO FIRST");
    return;
  }

  setStartingPortfolioValue(portfolio.totalUsdValue);

  setPortfolio({
    ...portfolio,
    startingPortfolioValue: portfolio.totalUsdValue,
    tradingPnlUsd: 0,
  });
}

async function loadTradeHistory() {
  try {
    const response = await fetch(`${API_BASE}/trade-log?limit=20`);
    const data = await response.json();

    setTradeHistory(data.records || []);
  } catch (err) {
    console.error(err);
  }
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
        <div className="panel-title">QUICK START ACTIONS</div>

<div className="agent-control-panel">
  <button onClick={optimizeStrategy} disabled={loading} className="copy-btn">
    {loading && loadingMode === "optimize" ? "OPTIMIZING..." : "> AUTO-OPTIMIZE SETUP <"}
  </button>

  <button onClick={connectWallet} disabled={loading} className="copy-btn">
    {walletAddress ? "WALLET CONNECTED" : "> CONNECT WALLET <"}
  </button>
</div>

<div className="button-row">
  <button
    onClick={runAgentCycle}
    disabled={loading}
    className="copy-btn"
  >
    {"> RUN AGENT <"}
  </button>

  <button
    onClick={stopAutonomousMode}
    disabled={loading}
    className="copy-btn"
  >
    {"> STOP AGENT <"}
  </button>
</div>

{walletAddress ? (
  <div className="panel portfolio-panel">
    <div className="panel-title">AGENT PORTFOLIO</div>

    <div className="metrics autonomous-section">
      {portfolio?.assets?.length > 0 ? (
        portfolio.assets.map((asset, index) => (
          <p key={index}>
            {asset.symbol}................... {asset.balance ?? "N/A"} ({formatMoney(asset.usdValue)})
          </p>
        ))
      ) : (
        <p>LOADING AGENT WALLET ASSETS...</p>
      )}

      <br />

      <p>TOTAL VALUE........... {formatMoney(portfolio?.totalUsdValue || 0)}</p>
      <p>START VALUE........... {formatMoney(portfolio?.startingPortfolioValue || 0)}</p>

      <p>
        TRADING P/L...........{" "}
        {Number(portfolio?.tradingPnlUsd || 0) >= 0 ? "+" : "-"}$
        {Math.abs(Number(portfolio?.tradingPnlUsd || 0)).toFixed(2)}
      </p>

      <button
        onClick={resetPnlBaseline}
        className="copy-btn"
        style={{ marginTop: "12px" }}
      >
        {"> RESET PNL BASELINE <"}
      </button>
    </div>
  </div>
) : null}

        <h2 className="strategy-library-title">TRADE SETUP</h2>

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
            <label>BACKTEST CAPITAL</label>

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
        </div>

       

        <h2 className="strategy-library-title">CUSTOM SETUP</h2>

        <div className="agent-control-panel">
          <button onClick={generateStrategy} disabled={loading} className="copy-btn">
            {loading && loadingMode === "generate" ? "GENERATING..." : "> GENERATE STRATEGY <"}
          </button>

        <button
          type="button"
          className={`terminal-toggle ${liveExecution ? "active" : ""}`}
          onClick={() => setLiveExecution(!liveExecution)}
        >
          <span>
  {liveExecution
    ? "TEST MODE OFF / LIVE TRADE ON"
    : "TEST MODE ON / LIVE TRADE OFF"}
</span>
        </button>

          <select
            value={autonomousInterval}
            disabled={autonomousMode}
            onChange={(e) => setAutonomousInterval(Number(e.target.value))}
          >
            <option value={1}>1 MINUTE</option>
            <option value={5}>5 MINUTES</option>
            <option value={15}>15 MINUTES</option>
            <option value={30}>30 MINUTES</option>
          </select>

         
        </div>

        <h2 className="strategy-library-title">AGENT STATUS</h2>

<div className="metrics strategy-library-box">
  <p>USER WALLET......... {walletAddress ? "CONNECTED" : "NOT CONNECTED"}</p>

  <p>USER ADDRESS........ {walletAddress || "N/A"}</p>

  <p>
    NETWORK.............{" "}
    {walletChainId === "0x38"
      ? "BNB SMART CHAIN"
      : walletChainId
      ? `WRONG NETWORK (${walletChainId})`
      : "UNKNOWN"}
  </p>

  <p>
    AGENT BNB BALANCE....{" "}
    {portfolio?.assets?.find((asset) => asset.symbol === "BNB")?.balance
      ? `${portfolio.assets.find((asset) => asset.symbol === "BNB").balance} BNB`
      : "N/A"}
  </p>

  <p>
    AGENT TOTAL VALUE.... {formatMoney(portfolio?.totalUsdValue || 0)}
  </p>

  <p>TWAK............... CONFIGURED</p>
  <p>AGENT ADDRESS...... {twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C"}</p>
  <p>CHAIN.............. BSC</p>
  <p>EXECUTION.......... {liveExecution ? "LIVE ENABLED" : "DISABLED"}</p>
  <p>AGENT STATUS....... {autonomousMode ? "LIVE TRADING READY" : "STOPPED"}</p>
</div>

<div className="autonomous-container">
  <div className="autonomous-status-box">
    <p>AUTONOMOUS MODE..... {autonomousMode ? "RUNNING" : "STOPPED"}</p>
    <p>CHECK INTERVAL...... {autonomousInterval} MINUTES</p>
    <p>LAST DECISION....... {autonomousStatus?.last_decision || "N/A"}</p>
    <p>LAST REASON......... {autonomousStatus?.last_reason || "N/A"}</p>
    <p>NEXT CHECK.......... {autonomousStatus?.next_run || "N/A"}</p>
  </div>
</div>

  
{tradeHistory.length > 0 && (
  <div className="panel">
    <div className="panel-title">LIVE AGENT ACTIVITY</div>

    <div className="metrics">

<button
  onClick={() => setShowOnlyRealTrades(!showOnlyRealTrades)}
  className="copy-btn"
  style={{ marginBottom: "24px" }}
>
  {showOnlyRealTrades ? "> SHOW ALL AGENT ACTIVITY <" : "> SHOW REAL TRADES ONLY <"}
</button>
{tradeHistory
  .filter((trade) => {
    const status = String(trade.status || "").toLowerCase();
    const decision = String(trade.decision || "").toUpperCase();

const isRealTrade =
  status === "success" ||
  status === "failed" ||
  status === "blocked" ||
  trade.from_token ||
  trade.to_token;

    if (status === "portfolio_check") return false;
    if (showOnlyRealTrades && !isRealTrade) return false;

    return true;
  })
  .slice()
  .reverse()
  .map((trade, index) => {
const isRealTrade =
  trade.status === "success" ||
  trade.status === "failed" ||
  trade.status === "blocked" ||
  trade.from_token ||
  trade.to_token;
    const timestamp = trade.timestamp
      ? new Date(trade.timestamp).toLocaleString("de-DE")
      : "N/A";

    const tradeSize =
      trade.amount ||
      trade.trade_plan?.amount ||
      "N/A";

    return (
      <div
        key={index}
        style={{
          marginBottom: "20px",
          paddingBottom: "20px",
          borderBottom: "1px solid rgba(0,255,65,0.25)",
        }}
      >
        <p style={{ color: isRealTrade ? "#00ff41" : "#808080" }}>
  {timestamp}
</p>

<p style={{ color: isRealTrade ? "#00ff41" : "#808080" }}>
  EVENT:{" "}
  {(trade.status || "UNKNOWN")
    .replaceAll("_", " ")
    .toUpperCase()}
</p>

<p style={{ color: "#00ff41" }}>
  TYPE:{" "}
  {isRealTrade
    ? "REAL TRADE / EXECUTION"
    : "DECISION ONLY"}
</p>
       

{trade.decision && (
  <p style={{ color: isRealTrade ? "#00ff41" : "#808080" }}>
    DECISION: {trade.decision}
  </p>
)}

{(trade.coin || trade.from_token) && (
  <p style={{ color: isRealTrade ? "#00ff41" : "#808080" }}>
    ASSET:{" "}
    {trade.coin ||
      `${trade.from_token} → ${trade.to_token}`}
  </p>
)}

<p style={{ color: isRealTrade ? "#00ff41" : "#808080" }}>
  TRADE SIZE: {tradeSize}
</p>
      </div>
    );
  })}
    </div>
  </div>
)}
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

          <h2>STRATEGY ASSESSMENT</h2>

          <div className="metrics">
            <p>STRATEGY............ {result.selected_strategy}</p>
            <p>STATUS.............. {isApproved() ? "APPROVED" : "REJECTED"}</p>
            <p>RATING.............. {getOverallRating()}</p>
            <p>RETURN.............. {result.backtest.net_return}</p>
            <p>MAX DRAWDOWN........ {result.backtest.max_drawdown}</p>
            <p>WIN RATE............ {result.backtest.win_rate}</p>
            <p>PROFIT FACTOR....... {result.backtest.profit_factor}</p>
            <p>EXPECTANCY.......... {result.backtest.expectancy}</p>
            <p>EDGE................ {parsePercent(result.backtest.expectancy) > 0 ? "POSITIVE" : "NEGATIVE"}</p>
            <p>BUY & HOLD.......... {parsePercent(result.backtest.strategy_vs_buy_hold) > 0 ? "OUTPERFORMED" : "UNDERPERFORMED"}</p>
          </div>

          <h2>MARKET REGIME</h2>

          <div className="metrics">
            <p>ASSET............... {result.coin}</p>
            <p>PRICE............... {formatPrice(result.cmc_signal?.price_usd)}</p>
            <p>MARKET BIAS......... {String(result.cmc_signal?.market_bias || "UNKNOWN").toUpperCase()}</p>
            <p>FEAR & GREED........ {result.cmc_signal?.fear_greed?.value ?? "N/A"} / 100 {String(result.cmc_signal?.fear_greed?.label || "").toUpperCase()}</p>
            <p>ALTCOIN ROTATION.... {result.cmc_signal?.altcoin_season?.value ?? "N/A"} / 100 {String(result.cmc_signal?.altcoin_season?.label || "").toUpperCase()}</p>
            <p>CHANGE 24H.......... {formatPercent(result.cmc_signal?.percent_change_24h)}</p>
            <p>VOLUME 24H.......... {formatMoney(result.cmc_signal?.volume_24h)}</p>
            <p>SIGNAL.............. {result.backtest.current_signal?.status}</p>
            <p>ACTION.............. {result.backtest.current_signal?.action}</p>
            <p>RSI................. {result.backtest.current_signal?.latest_rsi}</p>
            <p>DEVIATION........... {result.backtest.current_signal?.latest_deviation}%</p>
            <p>MESSAGE............. {result.backtest.current_signal?.message}</p>
          </div>

          <h2>AGENT DECISION ENGINE</h2>

          <div className="metrics">
            <p>DATA SOURCE......... CoinMarketCap Agent Hub</p>
            <p>EXECUTION LAYER..... Trust Wallet Agent Kit</p>
            <p>VENUE............... BNB Chain / BSC</p>

            <br />

            <p>MARKET REGIME....... {getMarketRegime()}</p>
            <p>STRATEGY MODE....... AUTO-SELECT BEST BACKTESTED STRATEGY</p>
            <p>SELECTED STRATEGY... {result.selected_strategy}</p>
            <p>RISK PROFILE........ {String(result.risk).toUpperCase()}</p>
            <p>LAST DECISION....... {getAgentDecision()}</p>
            <p>TRADE PLAN.......... {agentResult?.trade_plan ? "GENERATED" : "NONE"}</p>
            <p>ACTION TAKEN........ {agentResult?.execution_result ? "EXECUTION ATTEMPTED" : "NONE"}</p>

            <br />

            <p>AGENT FLOW.......... CMC → STRATEGY MODEL → RISK GOVERNOR → TWAK → BSC</p>
            <p>RULE ADHERENCE...... USER RISK LIMITS ENFORCED</p>
            <p>EXECUTION MODE...... {liveExecution ? "LIVE" : "SAFE / QUOTE ONLY"}</p>
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

          <details>
            <summary>OPTIMIZER REPORT</summary>

            <div className="metrics">
              <p>WHY SELECTED........ {result.reason}</p>
              <p>MODE................ {result.optimization?.mode || "SINGLE RUN"}</p>
              <p>COMBINATIONS TESTED. {result.optimization?.tested_combinations || "N/A"}</p>
              <p>ELIGIBLE COMBOS..... {result.optimization?.eligible_combinations || "N/A"}</p>
              <p>BEST TIMEFRAME...... {result.timeframe}</p>
              <p>BEST RISK MODEL..... {String(result.risk).toUpperCase()}</p>
              <p>BEST STRATEGY....... {result.selected_strategy}</p>
              <p>OBJECTIVE........... MAXIMIZE RETURN WHILE CONTROLLING DRAWDOWN</p>
            </div>

            {result.optimization?.all_results && (
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
            )}
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
            <summary>PERFORMANCE ANALYTICS</summary>

            <div className="metrics">
              <p>TEST PERIOD......... {result.backtest.backtest_period}</p>
              <p>CANDLES TESTED...... {result.backtest.candles_tested}</p>
              <p>TRADES.............. {result.backtest.trades}</p>
              <p>WINS................ {result.backtest.wins}</p>
              <p>LOSSES.............. {result.backtest.losses}</p>
              <p>AVG WIN............. {result.backtest.avg_win}</p>
              <p>AVG LOSS............ {result.backtest.avg_loss}</p>
              <p>PAYOFF RATIO........ {result.backtest.payoff_ratio}</p>
              <p>SHARPE RATIO........ {result.backtest.sharpe_ratio}</p>
              <p>SORTINO RATIO....... {result.backtest.sortino_ratio}</p>
              <p>CALMAR RATIO........ {result.backtest.calmar_ratio}</p>
              <p>RECOVERY FACTOR..... {result.backtest.recovery_factor}</p>
              <p>AVG PNL............. {result.backtest.avg_pnl}</p>
              <p>LARGEST PROFIT...... {result.backtest.largest_profit}</p>
              <p>LARGEST LOSS........ {result.backtest.largest_loss}</p>
              <p>BUY & HOLD RETURN... {result.backtest.buy_hold_return}</p>
              <p>VS BUY & HOLD....... {result.backtest.strategy_vs_buy_hold}</p>
              <p>RISK-ADJUSTED SCORE. {result.backtest.risk_adjusted_score}</p>
              <p>EARLY PERIOD RETURN... {result.backtest.first_half_return}</p>
              <p>LATE PERIOD RETURN.. {result.backtest.second_half_return}</p>
            </div>
          </details>

          <details>
            <summary>STRATEGY BACKTEST HISTORY</summary>

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
            <summary>PERFORMANCE METRICS EXPLAINED</summary>

            <div className="metrics">
              <p><strong>AVAILABLE STRATEGIES</strong></p>
              <p>VWAP EXTREME REVERSION</p>
              <p>SMC SEQUENCE CONTINUATION</p>
              <p>STOCHASTIC QUAD ROTATION</p>
              <p>TDI WHITE SIGNAL REVERSAL</p>

              <br />

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
        CMC AGENT HUB: OK &nbsp;&nbsp; TWAK: OK &nbsp;&nbsp; BNB CHAIN: OK &nbsp;&nbsp; BACKTEST ENGINE: OK &nbsp;&nbsp; OPTIMIZER: OK
      </div>
    </div>
  );
}

export default App;
