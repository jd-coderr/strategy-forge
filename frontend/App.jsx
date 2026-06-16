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
  const [tradeSize, setTradeSize] = useState(0.001);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [result, setResult] = useState(null);
  const [agentResult, setAgentResult] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [showOnlyRealTrades, setShowOnlyRealTrades] = useState(false);
  const [startingPortfolioValue, setStartingPortfolioValue] = useState(null);
  const [liveExecution, setLiveExecution] = useState(false);
  const [executionMode, setExecutionMode] = useState("decision_simulation");
  const [paperPortfolio, setPaperPortfolio] = useState(null);
  const [paperStartingBalance, setPaperStartingBalance] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState("");
  const [activeButton, setActiveButton] = useState("");
  const [autoOptimized, setAutoOptimized] = useState(false);
  const [agentStopConfirmed, setAgentStopConfirmed] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [bnbBalance, setBnbBalance] = useState(null);
  const [twakStatus, setTwakStatus] = useState("CONFIGURED");
  const [twakRegistration, setTwakRegistration] = useState("READY");
  const [twakAgentAddress, setTwakAgentAddress] = useState(null);
  const [viewMode, setViewMode] = useState("simple");
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [expandedSimpleQuadrant, setExpandedSimpleQuadrant] = useState(null);
  const [expandedDetailedQuadrant, setExpandedDetailedQuadrant] = useState(null);

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

    if (score >= 12) return "A+";
    if (score >= 9) return "A";
    if (score >= 6) return "B";
    if (score >= 3) return "C";

    return "F";
  }

  function getRatingExplanation() {
    const rating = getOverallRating();

    if (rating === "A+") return "EXCELLENT RISK-ADJUSTED SCORE";
    if (rating === "A") return "STRONG RISK-ADJUSTED SCORE";
    if (rating === "B") return "DECENT RISK-ADJUSTED SCORE";
    if (rating === "C") return "WEAK / PASSABLE RISK-ADJUSTED SCORE";

    return "FAILED / POOR RISK-ADJUSTED SCORE";
  }

  function formatDateTime(value) {
    if (!value) return "N/A";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString("de-DE");
  }

  function getExecutionModeLabel() {
    if (executionMode === "live_trading") return "LIVE TRADING";
    if (executionMode === "paper_trading") return "PAPER TRADING";

    return "DECISION SIMULATION";
  }

  function getButtonStyle(name) {
    const isPersistentActive =
      (name === "wallet" && walletAddress) ||
      (name === "optimize" && autoOptimized) ||
      (name === "run" && autonomousMode) ||
      (name === "stop" && agentStopConfirmed && !autonomousMode);

    return activeButton === name || isPersistentActive
      ? {
          background: "rgba(0, 255, 65, 0.16)",
          boxShadow: "0 0 18px rgba(0, 255, 65, 0.85)",
          borderColor: "#ffffff",
        }
      : {};
  }

  function pulseButton(name) {
    setActiveButton(name);
    setTimeout(() => {
      setActiveButton("");
    }, 900);
  }

  function isApproved() {
  return (
    result?.backtest?.drawdown_gate === "PASS" &&
    result?.backtest?.min_trade_gate === "PASS"
  );
}

async function startAutonomousMode() {
  pulseButton("run");

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
        live_execution: executionMode === "live_trading",
        execution_mode: executionMode,
        trade_size: tradeSize,
        selected_strategy: result?.selected_strategy || null,
        interval_minutes: autonomousInterval,
      }),
    });

    const data = await response.json();
    setAutonomousStatus(data);
    setAutonomousMode(true);
    setAgentStopConfirmed(false);
  } catch (err) {
    console.error(err);
    alert("AUTONOMOUS MODE START FAILED");
  }
}

async function stopAutonomousMode() {
  pulseButton("stop");

  try {
    const response = await fetch(`${API_BASE}/autonomous/stop`, {
      method: "POST",
    });

    const data = await response.json();
    setAutonomousStatus(data);
    setAutonomousMode(false);
    setAgentStopConfirmed(true);
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

    if (data.running === true) {
      setAgentStopConfirmed(false);
    }

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
  document.title = "I Know Quant Fu";

  loadAutonomousStatus();
  checkRegistration();
  loadTradeHistory();
  loadPaperPortfolio();
  
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

  function getExecutionAction() {
    return agentResult?.decision || autonomousStatus?.last_decision || "WAITING";
  }

  function getTradePlan() {
    return agentResult?.trade_plan || null;
  }

  function getExecutionResult() {
    return agentResult?.execution_result || null;
  }

  function didExecuteTrade() {
    const tradePlan = getTradePlan();
    const executionResult = getExecutionResult();

    if (!tradePlan || !executionResult) return false;
    if (executionResult.blocked === true) return false;
    if (executionResult.executed === false) return false;
    if (executionMode === "decision_simulation") return false;
    if (executionResult.success !== true) return false;

    return true;
  }

  function getExecutionStatus() {
    const tradePlan = getTradePlan();
    const executionResult = getExecutionResult();
    const action = getExecutionAction();

    if (!agentResult) {
      return {
        action: autonomousMode ? "MONITORING" : "WAITING",
        executed: "NO",
        status: autonomousMode ? "AGENT MONITORING" : "AGENT STOPPED",
        reason: autonomousStatus?.last_reason || "Run the agent to generate the next decision.",
        nextAction: autonomousMode ? "Continue scanning for the next setup." : "Start the agent when ready.",
      };
    }

    if (!tradePlan) {
      return {
        action,
        executed: "NO",
        status: action === "HOLD" ? "HOLD / NO EXECUTION" : "NO TRADE PLAN",
        reason: agentResult?.reason || autonomousStatus?.last_reason || "No approved trade plan was generated.",
        nextAction: "Continue monitoring until confidence, strategy quality, and risk controls align.",
      };
    }

    if (!executionResult) {
      return {
        action,
        executed: "NO",
        status: "TRADE PLAN GENERATED",
        reason: tradePlan.reason || "Trade plan exists, but execution has not returned a result yet.",
        nextAction: "Wait for execution result or rerun the agent cycle.",
      };
    }

    if (executionResult.blocked === true) {
      return {
        action,
        executed: "NO",
        status: "BLOCKED BY SAFETY",
        reason: executionResult.safety_message || tradePlan.reason || "Execution blocked by safety checks.",
        nextAction: "Fix the safety issue, balance, trade size, or risk status before attempting again.",
      };
    }

    if (executionMode === "decision_simulation" || executionResult.executed === false) {
      return {
        action,
        executed: "NO",
        status: "DECISION SIMULATION",
        reason: executionResult.message || tradePlan.reason || "Simulation mode logs the decision without opening a position.",
        nextAction: "Switch to Paper or Live mode to execute trades.",
      };
    }

    if (executionResult.success === true) {
      return {
        action,
        executed: "YES",
        status: executionMode === "paper_trading" ? "PAPER TRADE FILLED" : "LIVE EXECUTION CONFIRMED",
        reason: tradePlan.reason || executionResult.message || "Trade execution completed successfully.",
        nextAction: "Monitor PnL, risk status, and the next autonomous check.",
      };
    }

    return {
      action,
      executed: "NO",
      status: "EXECUTION FAILED",
      reason: executionResult.stderr || executionResult.error || executionResult.message || "Execution attempt failed.",
      nextAction: "Check TWAK output, wallet balance, network, and safety settings.",
    };
  }

  function getTradeSide() {
    const tradePlan = getTradePlan();
    if (!tradePlan?.from_token || !tradePlan?.to_token) return "N/A";

    if (tradePlan.from_token === "USDT" && tradePlan.to_token === "BNB") return "BUY BNB";
    if (tradePlan.from_token === "BNB" && tradePlan.to_token === "USDT") return "SELL / REDUCE BNB";

    return `${tradePlan.from_token} → ${tradePlan.to_token}`;
  }

  function getExecutionTxStatus() {
    const tradePlan = getTradePlan();
    const executionResult = getExecutionResult();

    if (!tradePlan) return "NO TRADE PLAN";
    if (!executionResult) return "WAITING";
    if (executionResult.blocked) return "BLOCKED";
    if (executionMode === "decision_simulation" || executionResult.executed === false) return "SIMULATED / NOT SENT";
    if (executionResult.success && executionMode === "paper_trading") return "PAPER FILLED";
    if (executionResult.success && tradePlan.quote_only === true) return "QUOTE ONLY";
    if (executionResult.success) return "CONFIRMED";

    return "FAILED";
  }

  function getExecutionTxHash() {
    const executionResult = getExecutionResult();
    const possibleText = [
      executionResult?.tx_hash,
      executionResult?.transaction_hash,
      executionResult?.transactionHash,
      executionResult?.hash,
      executionResult?.stdout,
      executionResult?.stderr,
      executionResult?.message,
    ]
      .filter(Boolean)
      .join(" ");

    const match = possibleText.match(/0x[a-fA-F0-9]{64}/);
    return match ? match[0] : null;
  }

  function getSignalAssetLabel() {
    return coin || result?.coin || "N/A";
  }

  function getExecutionRouteLabel() {
    const tradePlan = getTradePlan();
    if (!tradePlan?.from_token && !tradePlan?.to_token) return "N/A";
    return `${tradePlan.from_token || "N/A"} → ${tradePlan.to_token || "N/A"}`;
  }

  function getRegistrationLabel() {
    const value = String(twakRegistration || "READY").toUpperCase();

    if (value === "READY" || value === "READY_FOR_ONCHAIN_REGISTRATION") {
      return "READY FOR ON-CHAIN REGISTRATION";
    }

    return value.replaceAll("_", " ");
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
    pulseButton("wallet");

    if (!window.ethereum) {
      alert("NO WALLET FOUND. INSTALL TRUST WALLET OR METAMASK.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const address = accounts[0];
      setWalletAddress(address);

      try {
        await forceBnbChain();
      } catch (networkError) {
        console.error("NETWORK SWITCH FAILED:", networkError);
      }

      try {
        await updateWalletData(address);
      } catch (balanceError) {
        console.error("USER WALLET BALANCE LOAD FAILED:", balanceError);
      }

      await loadPortfolio();
    } catch (error) {
      console.error(error);
      alert("WALLET CONNECTION FAILED");
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
    pulseButton("generate");
    setAutoOptimized(false);
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
    pulseButton("optimize");
    setAutoOptimized(false);
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

      setAutoOptimized(true);

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
  pulseButton("run");

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
        trade_size: tradeSize,
        live_execution: executionMode === "live_trading",
        execution_mode: executionMode,
        selected_strategy: result?.selected_strategy || null,
      }),
    });

    const data = await response.json();
    setAgentResult(data);

    if (data.paper_portfolio) {
      setPaperPortfolio(data.paper_portfolio);
    } else if (executionMode === "paper_trading") {
      await loadPaperPortfolio();
    }

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
    setPortfolioLoading(true);

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
    } finally {
      setPortfolioLoading(false);
    }
  }

async function loadPaperPortfolio() {
  try {
    const response = await fetch(`${API_BASE}/paper-portfolio`);
    const data = await response.json();

    setPaperPortfolio(data.paper_portfolio || null);
  } catch (err) {
    console.error(err);
  }
}

async function resetPaperPortfolio() {
  pulseButton("resetPaper");

  try {
    const response = await fetch(`${API_BASE}/paper-portfolio/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        starting_balance_usdt: paperStartingBalance,
      }),
    });

    const data = await response.json();
    setPaperPortfolio(data.paper_portfolio || null);
    alert("PAPER PORTFOLIO RESET");
  } catch (err) {
    console.error(err);
    alert("PAPER PORTFOLIO RESET FAILED");
  }
}

function resetPnlBaseline() {
  pulseButton("resetPnl");

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

  function renderVersionMenu() {
    return (
      <div className="version-menu-wrap">
        <button
          type="button"
          className="version-menu-button"
          onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
          aria-label="Open version options"
          aria-expanded={optionsMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {optionsMenuOpen && (
          <div className="version-menu-panel">
            <div className="version-menu-title">OPTIONS MENU</div>
            <button
              type="button"
              className={viewMode === "simple" ? "version-menu-option active" : "version-menu-option"}
              onClick={() => {
                setViewMode("simple");
                setOptionsMenuOpen(false);
              }}
            >
              SIMPLE VERSION
            </button>
            <button
              type="button"
              className={viewMode === "detailed" ? "version-menu-option active" : "version-menu-option"}
              onClick={() => {
                setViewMode("detailed");
                setOptionsMenuOpen(false);
              }}
            >
              DETAILED VERSION
            </button>
          </div>
        )}
      </div>
    );
  }

  function getSimpleQuadrantClass(name, baseClass) {
    const isExpanded = expandedSimpleQuadrant === name;
    const isHidden = expandedSimpleQuadrant && !isExpanded;

    return `${baseClass} ${isExpanded ? "simple-expanded" : ""} ${isHidden ? "simple-hidden-behind-expanded" : ""}`;
  }

  function renderSimpleExpandButton(name) {
    const isExpanded = expandedSimpleQuadrant === name;

    return (
      <button
        type="button"
        className="simple-expand-button"
        aria-label={isExpanded ? "Collapse section" : "Expand section"}
        onClick={() => setExpandedSimpleQuadrant(isExpanded ? null : name)}
      >
        {isExpanded ? "−" : "+"}
      </button>
    );
  }

  function getDetailedQuadrantClass(name, baseClass) {
    const isExpanded = expandedDetailedQuadrant === name;
    const isHidden = expandedDetailedQuadrant && !isExpanded;

    return `${baseClass} ${isExpanded ? "retro-expanded" : ""} ${isHidden ? "retro-hidden-behind-expanded" : ""}`;
  }

  function renderDetailedExpandButton(name) {
    const isExpanded = expandedDetailedQuadrant === name;

    return (
      <button
        type="button"
        className="retro-expand-button"
        aria-label={isExpanded ? "Collapse section" : "Expand section"}
        onClick={() => setExpandedDetailedQuadrant(isExpanded ? null : name)}
      >
        {isExpanded ? "−" : "+"}
      </button>
    );
  }

  function renderSimpleVersion() {
    const executionStatus = getExecutionStatus();
    const tradePlan = getTradePlan();
    const txHash = getExecutionTxHash();
    const latestRealTrade = tradeHistory.find((entry) => {
      const execution = entry?.execution_result || entry?.event?.execution_result || entry?.result;
      return execution?.success === true || execution?.executed === true;
    });
    const selectedStrategy = result?.selected_strategy || "not optimized yet";
    const marketRegime = result ? getMarketRegime() : "waiting for CoinMarketCap data";
    const confidenceLabel = agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "not scored yet";
    const riskStatus = agentResult?.risk_control?.status || "not checked yet";
    const portfolioValue = formatMoney(portfolio?.totalUsdValue || paperPortfolio?.total_value_usdt || 0);
    const executionSource = executionMode === "paper_trading"
      ? "Paper Trading Engine"
      : executionMode === "live_trading"
      ? "TWAK → PancakeSwap"
      : "Decision Simulation";

    return (
      <div className="retro-page">
        <div className={`simple-square ${expandedSimpleQuadrant ? "simple-has-expanded" : ""}`}>
          <section className={getSimpleQuadrantClass("intro", "simple-quadrant simple-q-intro")}>
            <div className="simple-quadrant-header">
              <span>I KNOW QUANT FU</span>
              {renderSimpleExpandButton("intro")}
            </div>
            <div className="simple-quadrant-body">
              <div className="simple-brand-block">
                <p className="simple-kicker">BNB HACK // AI TRADING AGENT EDITION</p>
                <h1 className="simple-square-title">
                  I KNOW QUANT FU<span className="blink">_</span>
                </h1>
                <p className="simple-brand-slogan">Roundhouse kick dumb trades.</p>
                <p className="simple-brand-subline">Backtest the signal. Lock the risk. Automate the move.</p>
                <p className="simple-speech-text">
                  I am an autonomous crypto trading agent. I read CoinMarketCap market intelligence,
                  compare strategy options, check risk, and only then decide whether I should wait,
                  simulate, paper trade, or execute through TWAK → PancakeSwap → BNB Smart Chain.
                </p>
              </div>

              <div className="simple-status-grid">
                <div className="simple-status-box">
                  <span>MODE</span>
                  <strong>{getExecutionModeLabel()}</strong>
                </div>
                <div className="simple-status-box">
                  <span>STATUS</span>
                  <strong>{autonomousMode ? "I AM RUNNING" : "I AM STOPPED"}</strong>
                </div>
                <div className="simple-status-box simple-status-box-full">
                  <span>WALLET</span>
                  <strong>{walletAddress ? "YOUR WALLET IS CONNECTED" : "YOUR WALLET IS NOT CONNECTED"}</strong>
                </div>
              </div>

              <div className="simple-message-box">
                <strong>MY JOB</strong>
                <p>
                  I explain myself logically. First I read the market. Then I choose a strategy.
                  Then I check my guardrails. Only after that do I act or wait.
                </p>
              </div>

              <div className="simple-message-box">
                <strong>MY FULL ROUTE</strong>
                <p>
                  COINMARKETCAP → MARKET ANALYSIS → STRATEGY ENGINE → CONFIDENCE MODEL → RISK GOVERNOR → TWAK → PANCAKESWAP → BINANCE SMART CHAIN
                </p>
              </div>
            </div>
          </section>

          <section className={getSimpleQuadrantClass("market", "simple-quadrant simple-q-market")}>
            <div className="simple-quadrant-header">
              <span>I READ THE MARKET</span>
              {renderSimpleExpandButton("market")}
            </div>
            <div className="simple-quadrant-body">
              <p className="simple-speech-text">
                Right now I am watching the selected market, checking the current regime, and looking at the strategy I would use if conditions line up.
              </p>

              <div className="simple-metric-row"><span>SIGNAL ASSET</span><strong>{getSignalAssetLabel()}</strong></div>
              <div className="simple-metric-row"><span>TIMEFRAME</span><strong>{result?.timeframe || timeframe}</strong></div>
              <div className="simple-metric-row"><span>MARKET REGIME</span><strong>{marketRegime}</strong></div>
              <div className="simple-metric-row"><span>SELECTED STRATEGY</span><strong>{selectedStrategy}</strong></div>
              <div className="simple-metric-row"><span>AUTO STATUS</span><strong>{autoOptimized ? "optimizer selected a setup" : "optimizer not run yet"}</strong></div>
              <div className="simple-metric-row"><span>CMC SKILL</span><strong>{getCmcTopSkill()}</strong></div>
              <div className="simple-metric-row"><span>CONFIDENCE</span><strong>{confidenceLabel}</strong></div>

              <div className="simple-message-box">
                <strong>WHAT I AM THINKING</strong>
                <p>
                  My first question is simple: is this market clear enough, strong enough, and safe enough for me to continue toward execution?
                </p>
              </div>
            </div>
          </section>

          <section className={getSimpleQuadrantClass("controls", "simple-quadrant simple-q-controls")}>
            <div className="simple-quadrant-header">
              <span>WE PREPARE THE TRADE</span>
              {renderSimpleExpandButton("controls")}
            </div>
            <div className="simple-quadrant-body">
              <p className="simple-speech-text">
                This is where you tell me what to watch and how to behave. I also show the guardrails that stop me from forcing a bad trade.
              </p>

              <div className="simple-action-grid">
                <button onClick={optimizeStrategy} disabled={loading} style={getButtonStyle("optimize")}>
                  {loading && loadingMode === "optimize" ? "I AM OPTIMIZING..." : autoOptimized ? "AUTO-OPTIMIZED" : "> AUTO-OPTIMIZE <"}
                </button>
                <button onClick={connectWallet} disabled={loading} style={getButtonStyle("wallet")}>
                  {walletAddress ? "WALLET CONNECTED" : "> CONNECT WALLET <"}
                </button>
                <button onClick={runAgentCycle} disabled={loading} style={getButtonStyle("run")}>
                  {autonomousMode ? "I AM RUNNING" : "> RUN AGENT <"}
                </button>
                <button onClick={stopAutonomousMode} disabled={loading} style={getButtonStyle("stop")}>
                  {agentStopConfirmed && !autonomousMode ? "I AM STOPPED" : "> STOP AGENT <"}
                </button>
              </div>

              <div className="simple-control-grid">
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
                  <label>MODE</label>
                  <select
                    value={executionMode}
                    disabled={autonomousMode || loading}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setExecutionMode(mode);
                      setLiveExecution(mode === "live_trading");
                    }}
                  >
                    <option value="decision_simulation">DECISION SIMULATION</option>
                    <option value="paper_trading">PAPER TRADING</option>
                    <option value="live_trading">LIVE TRADING</option>
                  </select>
                </div>
                <div>
                  <label>INTERVAL</label>
                  <select value={autonomousInterval} disabled={autonomousMode} onChange={(e) => setAutonomousInterval(Number(e.target.value))}>
                    <option value={1}>1 MINUTE</option>
                    <option value={5}>5 MINUTES</option>
                    <option value={15}>15 MINUTES</option>
                    <option value={30}>30 MINUTES</option>
                  </select>
                </div>
                <div>
                  <label>TRADE SIZE ({coin})</label>
                  <input type="number" min="0" step="0.001" value={tradeSize} disabled={loading} onChange={(e) => setTradeSize(Number(e.target.value))} />
                </div>
              </div>

              <div className="simple-metric-row"><span>RISK STATUS</span><strong>{riskStatus}</strong></div>
              <div className="simple-metric-row"><span>CURRENT DRAWDOWN</span><strong>{agentResult?.risk_control?.current_drawdown_pct !== undefined ? `${agentResult.risk_control.current_drawdown_pct}%` : "N/A"}</strong></div>
              <div className="simple-metric-row"><span>MAX DRAWDOWN LIMIT</span><strong>{agentResult?.risk_control?.max_drawdown_limit_pct !== undefined ? `${agentResult.risk_control.max_drawdown_limit_pct}%` : "N/A"}</strong></div>
              <div className="simple-metric-row"><span>PORTFOLIO VALUE</span><strong>{portfolioValue}</strong></div>
              <div className="simple-metric-row"><span>DAILY QUALIFICATION</span><strong>{agentResult?.daily_qualification?.status || "N/A"}</strong></div>
              <div className="simple-metric-row"><span>TRADES TODAY</span><strong>{agentResult?.daily_qualification ? `${agentResult.daily_qualification.trades_today ?? "N/A"} / ${agentResult.daily_qualification.target_trades_per_day ?? "N/A"}` : "N/A"}</strong></div>
            </div>
          </section>

          <section className={getSimpleQuadrantClass("proof", "simple-quadrant simple-q-proof")}>
            <div className="simple-quadrant-header">
              <span>ACT OR I WAIT</span>
              {renderSimpleExpandButton("proof")}
            </div>
            <div className="simple-quadrant-body">
              <p className="simple-speech-text">
                This is my final answer. If I wait, I explain why. If I act, I show the route, the status, and the proof.
              </p>

              <div className="simple-metric-row"><span>MY ACTION</span><strong>{executionStatus.action}</strong></div>
              <div className="simple-metric-row"><span>DID I TRADE?</span><strong>{executionStatus.executed}</strong></div>
              <div className="simple-metric-row"><span>STATUS</span><strong>{executionStatus.status}</strong></div>
              <div className="simple-metric-row"><span>TX STATUS</span><strong>{getExecutionTxStatus()}</strong></div>
              <div className="simple-metric-row"><span>SIGNAL ASSET</span><strong>{getSignalAssetLabel()}</strong></div>
              <div className="simple-metric-row"><span>EXECUTION ROUTE</span><strong>{getExecutionRouteLabel()}</strong></div>
              <div className="simple-metric-row"><span>SOURCE</span><strong>{executionSource}</strong></div>
              <div className="simple-metric-row"><span>CHAIN</span><strong>BNB SMART CHAIN / BSC</strong></div>
              <div className="simple-metric-row"><span>REGISTRATION</span><strong>{getRegistrationLabel()}</strong></div>
              <div className="simple-metric-row"><span>AGENT ADDRESS</span><strong>{twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C"}</strong></div>
              <div className="simple-metric-row"><span>TX HASH</span><strong>{txHash || "N/A"}</strong></div>
              {tradePlan && (
                <div className="simple-metric-row"><span>REQUESTED SIZE</span><strong>{tradePlan.requested_trade_size ?? tradeSize} {tradePlan.requested_trade_size_token || coin}</strong></div>
              )}

              <div className="simple-message-box">
                <strong>MY LAST EXPLANATION</strong>
                <p>{agentResult?.reason || autonomousStatus?.last_reason || executionStatus.reason}</p>
              </div>

              <div className="simple-message-box">
                <strong>MY LAST REAL TRADE</strong>
                <p>{latestRealTrade ? `${formatDateTime(latestRealTrade.timestamp)} // ${latestRealTrade.decision || latestRealTrade.event || "TRADE LOGGED"}` : "I have not loaded a real trade yet."}</p>
              </div>

              {txHash && (
                <a className="simple-proof-link" href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noreferrer">
                  OPEN BSCSCAN PROOF
                </a>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const renderDetailedVersion = () => (
    <div className="retro-page">
      <div className={`retro-square ${expandedDetailedQuadrant ? "retro-has-expanded" : ""}`}>
        <section className={getDetailedQuadrantClass("who", "retro-quadrant retro-who")}>
          <div className="retro-quadrant-header">
            <span>WHO AM I?</span>
            <span>IKQF v0.1.0</span>
            {renderDetailedExpandButton("who")}
          </div>

          <div className="retro-quadrant-body">
            <div className="retro-brand-card">
              <div className="topbar retro-topbar">
                <span>IKQF v0.1.0</span>
                <span>I KNOW QUANT FU PRESENTS</span>
                <span>AI ONLINE</span>
              </div>

              <h1 className="title retro-title">
                I KNOW QUANT FU<span className="blink">_</span>
              </h1>

              <p className="subtitle retro-subtitle">ROUNDHOUSE KICK DUMB TRADES.</p>

              <div className="hero-description retro-hero-description">
                I Know Quant Fu is an autonomous cryptocurrency trading platform powered by CoinMarketCap market intelligence,
                Trust Wallet Agent Kit (TWAK), PancakeSwap execution routing,
                and Binance Smart Chain infrastructure.
              </div>

              <div className="metrics retro-mini-window">
                <p><strong>SLOGAN</strong></p>
                <p>Roundhouse kick dumb trades.</p>
                <p>Backtest the signal. Lock the risk. Automate the move.</p>
                <p>Conceptually: I Know Quant Fu turns noisy crypto market data into explainable autonomous trading decisions.</p>
              </div>
            </div>

            <details className="retro-window" open>
              <summary>IDENTITY / PURPOSE</summary>
              <div className="metrics">
                <p>NAME............... I KNOW QUANT FU</p>
                <p>TRACK.............. AUTONOMOUS TRADING AGENT</p>
                <p>DATA SOURCE........ COINMARKETCAP AGENT HUB</p>
                <p>EXECUTION LAYER.... TRUST WALLET AGENT KIT</p>
                <p>ROUTING VENUE...... PANCAKESWAP</p>
                <p>SETTLEMENT CHAIN... BNB SMART CHAIN / BSC</p>
                <p>MODE............... {getExecutionModeLabel()}</p>
              </div>
            </details>

            {agentResult?.daily_qualification && (
              <details className="retro-window">
                <summary>HACKATHON / ON-CHAIN VERIFICATION</summary>
                <div className="metrics strategy-library-box verification-panel">
                  <p><strong>HACKATHON / ON-CHAIN VERIFICATION</strong></p>
                  <p>TRACK.............. AUTONOMOUS TRADING AGENT</p>
                  <p>CHAIN.............. BNB SMART CHAIN / BSC</p>
                  <p>CMC AGENT HUB...... CONNECTED</p>
                  <p>TWAK EXECUTION..... {twakStatus || "CONFIGURED"}</p>
                  <p>REGISTRATION....... {getRegistrationLabel()}</p>
                  <p>AGENT ADDRESS...... {twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C"}</p>
                  <p>SELECTED TOKEN..... {coin}</p>
                  <p>ELIGIBLE TOKEN..... BSC / CMC-LISTED TOKEN</p>
                  <p>LAST TX HASH....... {getExecutionTxHash() || "N/A"}</p>
                  {getExecutionTxHash() && (
                    <p>BSCSCAN............ https://bscscan.com/tx/{getExecutionTxHash()}</p>
                  )}
                </div>
              </details>
            )}
          </div>
        </section>

        <section className={getDetailedQuadrantClass("what", "retro-quadrant retro-what")}>
          <div className="retro-quadrant-header">
            <span>WHAT DO I DO?</span>
            {renderDetailedExpandButton("what")}
          </div>

          <div className="retro-quadrant-body">
            <details className="retro-window" open>
              <summary>WHAT I KNOW QUANT FU DOES</summary>
              <div className="metrics">
                <p>I Know Quant Fu continuously analyzes market conditions, compares strategy performance, backtests multiple approaches, evaluates portfolio risk, generates explainable AI trade decisions, and can operate in Decision Simulation, Paper Trading, or Live Trading Mode.</p>
                <p>Every decision passes through market regime analysis, confidence scoring, strategy validation, drawdown protection, portfolio risk controls, and execution safety checks before a trade is approved.</p>
              </div>
            </details>

            <details className="retro-window">
              <summary>AGENT ARCHITECTURE</summary>
              <div className="metrics strategy-library-box">
                <p><strong>AGENT ARCHITECTURE</strong></p>
                <div className="agent-flow-visual">
                  <div>COINMARKETCAP</div>
                  <span>↓</span>
                  <div>MARKET ANALYSIS</div>
                  <span>↓</span>
                  <div>STRATEGY ENGINE</div>
                  <span>↓</span>
                  <div>CONFIDENCE MODEL</div>
                  <span>↓</span>
                  <div>RISK GOVERNOR</div>
                  <span>↓</span>
                  <div>TWAK</div>
                  <span>↓</span>
                  <div>PANCAKESWAP</div>
                  <span>↓</span>
                  <div>BINANCE SMART CHAIN</div>
                </div>
              </div>
            </details>

            <details className="retro-window">
              <summary>AGENT STATUS</summary>
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
                <p>AGENT TOTAL VALUE.... {formatMoney(portfolio?.totalUsdValue || 0)}</p>
                <p>TWAK............... CONFIGURED</p>
                <p>AGENT ADDRESS...... {twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C"}</p>
                <p>CHAIN.............. BSC</p>
                <p>EXECUTION MODE..... {getExecutionModeLabel()}</p>
                <p>SELECTED TIMEFRAME.. {timeframe}</p>
                <p>SIGNAL ASSET........ {getSignalAssetLabel()}</p>
                <p>TRADE SIZE.......... {tradeSize} BNB TARGET</p>
                <p>TRADE CONFIDENCE.... {agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "N/A"}</p>
                <p>DRAWDOWN............ {agentResult?.risk_control?.current_drawdown_pct !== undefined ? `${agentResult.risk_control.current_drawdown_pct}%` : "N/A"}</p>
                <p>RISK STATUS......... {agentResult?.risk_control?.status || "N/A"}</p>
                <p>PAPER VALUE........ {paperPortfolio ? formatMoney(paperPortfolio.total_value_usdt) : "N/A"}</p>
                <p>DAILY TRADE STATUS.. {agentResult?.daily_qualification?.status || "N/A"}</p>
                <p>TRADES TODAY........ {agentResult?.daily_qualification?.trades_today ?? "N/A"} / {agentResult?.daily_qualification?.target_trades_per_day ?? "N/A"}</p>
                <p>AGENT STATUS....... {autonomousMode ? "LIVE TRADING READY" : "STOPPED"}</p>
              </div>
            </details>

            <details className="retro-window">
              <summary>PORTFOLIO</summary>
              <div className="metrics autonomous-section">
                {portfolio?.assets?.length > 0 ? (
                  portfolio.assets.map((asset, index) => (
                    <p key={index}>
                      {asset.symbol}................... {asset.balance ?? "N/A"} ({formatMoney(asset.usdValue)})
                    </p>
                  ))
                ) : portfolioLoading ? (
                  <p>LOADING AGENT WALLET ASSETS...</p>
                ) : (
                  <p>NO AGENT WALLET ASSETS LOADED</p>
                )}

                <br />

                <p>TOTAL VALUE........... {formatMoney(portfolio?.totalUsdValue || 0)}</p>
                <p>START VALUE........... {formatMoney(portfolio?.startingPortfolioValue || 0)}</p>
                <p>
                  TRADING P/L...........{" "}
                  {Number(portfolio?.tradingPnlUsd || 0) >= 0 ? "+" : "-"}$
                  {Math.abs(Number(portfolio?.tradingPnlUsd || 0)).toFixed(2)}
                </p>
                <button onClick={resetPnlBaseline} className="copy-btn" style={{ marginTop: "12px", ...getButtonStyle("resetPnl") }}>
                  {"> RESET PNL BASELINE <"}
                </button>
              </div>
            </details>

            {executionMode === "paper_trading" && (
              <details className="retro-window">
                <summary>PAPER PORTFOLIO</summary>
                <div className="metrics autonomous-section">
                  <p>STARTING VALUE..... {formatMoney(paperPortfolio?.starting_balance_usdt || paperStartingBalance)}</p>
                  <p>CURRENT VALUE...... {formatMoney(paperPortfolio?.total_value_usdt || paperStartingBalance)}</p>
                  <p>CASH USDT.......... {formatMoney(paperPortfolio?.cash_usdt || 0)}</p>
                  <p>BNB HOLDINGS....... {paperPortfolio?.bnb_balance ?? 0} BNB</p>
                  <br />
                  <p>REALIZED P/L....... {formatMoney(paperPortfolio?.realized_pnl_usdt || 0)}</p>
                  <p>UNREALIZED P/L..... {formatMoney(paperPortfolio?.unrealized_pnl_usdt || 0)}</p>
                  <p>TOTAL P/L.......... {formatMoney(paperPortfolio?.total_pnl_usdt || 0)}</p>
                  <p>RETURN............. {paperPortfolio?.return_pct ?? 0}%</p>
                  <p>DRAWDOWN........... {paperPortfolio?.drawdown_pct ?? 0}%</p>
                  <br />
                  <p>OPEN POSITIONS..... {paperPortfolio?.open_position_count ?? 0}</p>
                  <p>CLOSED TRADES...... {paperPortfolio?.closed_trade_count ?? 0}</p>
                  <br />
                  <label>PAPER STARTING BALANCE</label>
                  <div className="capital-input">
                    <span>$</span>
                    <input
                      type="number"
                      min="10"
                      step="10"
                      value={paperStartingBalance}
                      disabled={autonomousMode || loading}
                      onChange={(e) => setPaperStartingBalance(Number(e.target.value))}
                    />
                  </div>
                  <button onClick={resetPaperPortfolio} disabled={autonomousMode || loading} className="copy-btn" style={{ marginTop: "12px", ...getButtonStyle("resetPaper") }}>
                    {"> RESET PAPER PORTFOLIO <"}
                  </button>
                </div>
              </details>
            )}
          </div>
        </section>

        <section className={getDetailedQuadrantClass("when", "retro-quadrant retro-when")}>
          <div className="retro-quadrant-header">
            <span>WHEN?</span>
            <span>OPERATOR FLOW</span>
            {renderDetailedExpandButton("when")}
          </div>

          <div className="retro-quadrant-body">
            <details className="retro-window" open>
              <summary>QUICK START ACTIONS</summary>
              <div className="agent-control-panel">
                <button onClick={optimizeStrategy} disabled={loading} className="copy-btn" style={getButtonStyle("optimize")}>
                  {loading && loadingMode === "optimize" ? (
                    <>
                      OPTIMIZING<span className="loading-dots"></span>
                    </>
                  ) : autoOptimized ? (
                    "AUTO-OPTIMIZED"
                  ) : (
                    "> AUTO-OPTIMIZE SETUP <"
                  )}
                </button>

                <button onClick={connectWallet} disabled={loading} className="copy-btn" style={getButtonStyle("wallet")}>
                  {walletAddress ? "WALLET CONNECTED" : "> CONNECT WALLET <"}
                </button>
              </div>

              <div className="button-row">
                <button onClick={runAgentCycle} disabled={loading} className="copy-btn" style={getButtonStyle("run")}>
                  {autonomousMode ? "AGENT RUNNING" : activeButton === "run" ? "> RUNNING... <" : "> RUN AGENT <"}
                </button>

                <button onClick={stopAutonomousMode} disabled={loading} className="copy-btn" style={getButtonStyle("stop")}>
                  {agentStopConfirmed && !autonomousMode
                    ? "AGENT STOPPED"
                    : activeButton === "stop"
                    ? "> STOPPING... <"
                    : "> STOP AGENT <"}
                </button>
              </div>
            </details>

            <details className="retro-window">
              <summary>TRADE SETUP / OPERATOR CONTROLS</summary>
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
                    <input type="number" min="100" step="100" value={initialCapital} disabled={loading} onChange={(e) => setInitialCapital(Number(e.target.value))} />
                  </div>
                </div>

                <div>
                  <label>TRADE SIZE ({coin})</label>
                  <div className="capital-input trade-size-input">
                    <input type="number" min="0" step="0.001" value={tradeSize} disabled={loading} onChange={(e) => setTradeSize(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {result && (
                <div className="metrics strategy-library-box" style={{ marginTop: "26px" }}>
                  <p>AUTO-OPTIMIZER SELECTED TIMEFRAME..... {result.timeframe || timeframe}</p>
                  <p>AUTO-OPTIMIZER SELECTED STRATEGY...... {result.selected_strategy || "N/A"}</p>
                  <p>AUTO-OPTIMIZER SELECTED RISK.......... {String(result.risk || risk).toUpperCase()}</p>
                </div>
              )}

              <h2 className="strategy-library-title">CUSTOM SETUP</h2>
              <div className="agent-control-panel">
                <button onClick={generateStrategy} disabled={loading} className="copy-btn" style={getButtonStyle("generate")}>
                  {loading && loadingMode === "generate" ? "GENERATING..." : "> GENERATE STRATEGY <"}
                </button>

                <div>
                  <select
                    value={executionMode}
                    disabled={autonomousMode || loading}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setExecutionMode(mode);
                      setLiveExecution(mode === "live_trading");
                    }}
                  >
                    <option value="decision_simulation">EXECUTION MODE - SIMULATION</option>
                    <option value="paper_trading">EXECUTION MODE - PAPER</option>
                    <option value="live_trading">EXECUTION MODE - LIVE</option>
                  </select>
                </div>

                <label style={{ gridColumn: "1 / -1", textAlign: "center", marginTop: "10px" }}>
                  AUTO CHECK FOR NEW TRADE OPPORTUNITY EVERY
                </label>

                <select value={autonomousInterval} disabled={autonomousMode} onChange={(e) => setAutonomousInterval(Number(e.target.value))}>
                  <option value={1}>1 MINUTE</option>
                  <option value={5}>5 MINUTES</option>
                  <option value={15}>15 MINUTES</option>
                  <option value={30}>30 MINUTES</option>
                </select>
              </div>
            </details>

            <details className="retro-window">
              <summary>AUTONOMOUS STATUS</summary>
              <div className="autonomous-container">
                <div className="autonomous-status-box">
                  <p>AUTONOMOUS MODE..... {autonomousMode ? "RUNNING" : "STOPPED"}</p>
                  <p>CHECK INTERVAL...... {autonomousInterval} MINUTES</p>
                  <p>LAST DECISION....... {autonomousStatus?.last_decision || "N/A"}</p>
                  <p>LAST REASON......... {autonomousStatus?.last_reason || "N/A"}</p>
                  <p>NEXT CHECK.......... {formatDateTime(autonomousStatus?.next_run)}</p>
                </div>
              </div>
            </details>

            {loading && (
              <details className="retro-window" open>
                <summary>PROCESSING</summary>
                <div className="loading-box">
                  <div className="loading-line"><span className="loading-text">CONNECTING TO COINMARKETCAP DATA FEED</span><span className="loading-dots"></span></div>
                  <div className="loading-line"><span className="loading-text">READING MARKET CONDITIONS</span><span className="loading-dots"></span></div>
                  <div className="loading-line"><span className="loading-text">CALCULATING SENTIMENT AND REGIME</span><span className="loading-dots"></span></div>
                  <div className="loading-line"><span className="loading-text">RUNNING HISTORICAL BACKTESTS</span><span className="loading-dots"></span></div>
                  <div className="loading-line"><span className="loading-text">{loadingMode === "optimize" ? "RANKING STRATEGY / TIMEFRAME / RISK COMBINATIONS" : "GENERATING TRADING STRATEGY"}</span><span className="loading-dots"></span></div>
                  <div className="progress-bar"><div className="progress-fill"></div></div>
                </div>
              </details>
            )}
          </div>
        </section>

        <section className={getDetailedQuadrantClass("how", "retro-quadrant retro-how")}>
          <div className="retro-quadrant-header">
            <span>HOW? LOGIC + PROOF</span>
            {renderDetailedExpandButton("how")}
          </div>

          <div className="retro-quadrant-body">
            <details className="retro-window" open>
              <summary>EXECUTION STATUS</summary>
              {(() => {
                const executionStatus = getExecutionStatus();
                const tradePlan = getTradePlan();

                return (
                  <div className="metrics strategy-library-box execution-status-panel">
                    <p><strong>EXECUTION STATUS</strong></p>
                    <p>MODE................ {getExecutionModeLabel()}</p>
                    <p>ACTION.............. {executionStatus.action}</p>
                    <p>TRADE EXECUTED...... {executionStatus.executed}</p>
                    <p>STATUS.............. {executionStatus.status}</p>
                    <p>REASON.............. {executionStatus.reason}</p>
                    <p>NEXT ACTION......... {executionStatus.nextAction}</p>
                    {tradePlan && (
                      <>
                        <br />
                        <p>TRADE PLAN.......... GENERATED</p>
                        <p>ROUTE............... {tradePlan.from_token || "N/A"} → {tradePlan.to_token || "N/A"}</p>
                        <p>AMOUNT.............. {tradePlan.amount || "N/A"}</p>
                      </>
                    )}
                  </div>
                );
              })()}
            </details>

            <details className="retro-window trade-log-window" open>
              <summary>LIVE AGENT ACTIVITY</summary>
              <div className="metrics trade-log-panel">
                <div className="trade-log-controls">
                  <button onClick={loadTradeHistory} className="copy-btn">
                    {"> REFRESH TRADE LOGS <"}
                  </button>

                  <button onClick={() => setShowOnlyRealTrades(!showOnlyRealTrades)} className="copy-btn">
                    {showOnlyRealTrades ? "> SHOW ALL AGENT ACTIVITY <" : "> SHOW REAL TRADES ONLY <"}
                  </button>
                </div>

                {tradeHistory.length === 0 && (
                  <p className="trade-log-empty">NO TRADE LOGS LOADED YET. RUN THE AGENT OR LOAD TRADE HISTORY TO SHOW EXECUTION ACTIVITY HERE.</p>
                )}

                {tradeHistory.length > 0 && tradeHistory
                    .filter((trade) => {
                      const status = String(trade.status || "").toLowerCase();
                      const executionResult = trade.execution_result || trade.result || {};
                      const tradePlan = trade.trade_plan || {};
                      const isRealTrade =
                        status === "success" ||
                        status === "failed" ||
                        status === "blocked" ||
                        executionResult.success === true ||
                        executionResult.executed === true ||
                        tradePlan.from_token ||
                        tradePlan.to_token ||
                        trade.from_token ||
                        trade.to_token;

                      if (status === "portfolio_check") return false;
                      if (showOnlyRealTrades && !isRealTrade) return false;
                      return true;
                    })
                    .slice()
                    .reverse()
                    .map((trade, index) => {
                      const executionResult = trade.execution_result || trade.result || {};
                      const tradePlan = trade.trade_plan || {};
                      const isRealTrade =
                        trade.status === "success" ||
                        trade.status === "failed" ||
                        trade.status === "blocked" ||
                        executionResult.success === true ||
                        executionResult.executed === true ||
                        tradePlan.from_token ||
                        tradePlan.to_token ||
                        trade.from_token ||
                        trade.to_token;
                      const timestamp = formatDateTime(trade.timestamp);
                      const txText = [
                        executionResult.tx_hash,
                        executionResult.transaction_hash,
                        executionResult.transactionHash,
                        executionResult.hash,
                        executionResult.stdout,
                        executionResult.stderr,
                        executionResult.message,
                      ].filter(Boolean).join(" ");
                      const txMatch = txText.match(/0x[a-fA-F0-9]{64}/);
                      const txHash = txMatch ? txMatch[0] : null;
                      const executionRoute =
                        tradePlan.from_token || trade.from_token
                          ? `${tradePlan.from_token || trade.from_token} → ${tradePlan.to_token || trade.to_token}`
                          : null;
                      const tradeSizeValue = trade.amount || trade.trade_plan?.amount || "N/A";

                      return (
                        <div key={index} className="retro-log-entry">
                          <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>{timestamp}</p>
                          <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>EVENT: {(trade.status || "UNKNOWN").replaceAll("_", " ").toUpperCase()}</p>
                          <p style={{ color: "#9cff8f" }}>TYPE: {isRealTrade ? "REAL TRADE / EXECUTION" : "DECISION ONLY"}</p>
                          {trade.confidence_score !== undefined && <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>TRADE CONFIDENCE: {trade.confidence_score} / 100</p>}
                          {trade.risk_control?.current_drawdown_pct !== undefined && <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>DRAWDOWN: {trade.risk_control.current_drawdown_pct}% / LIMIT {trade.risk_control.max_drawdown_limit_pct}%</p>}
                          {trade.daily_qualification && <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>DAILY QUALIFICATION: {trade.daily_qualification.trades_today} / {trade.daily_qualification.target_trades_per_day} — {trade.daily_qualification.status}</p>}
                          {trade.why?.length > 0 && (
                            <div style={{ color: isRealTrade ? "#9cff8f" : "#808080", marginTop: "8px" }}>
                              <p>WHY:</p>
                              {trade.why.slice(0, 5).map((reason, reasonIndex) => (
                                <p key={reasonIndex}>- {reason}</p>
                              ))}
                            </div>
                          )}
                          {trade.decision && <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>DECISION: {trade.decision}</p>}
                          {(trade.coin || executionRoute) && (
                            <>
                              <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>SIGNAL ASSET: {trade.coin || "N/A"}</p>
                              <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>EXECUTION ROUTE: {executionRoute || "N/A"}</p>
                            </>
                          )}
                          {txHash && (
                            <>
                              <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>TX HASH: {txHash}</p>
                              <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>BSCSCAN: https://bscscan.com/tx/{txHash}</p>
                            </>
                          )}
                          <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>TRADE SIZE: {tradeSizeValue}</p>
                        </div>
                      );
                    })}
              </div>
            </details>

            <details className="retro-window trade-history-window" open>
              <summary>STRATEGY BACKTEST HISTORY</summary>
              {!result && (
                <div className="metrics">
                  <p className="trade-log-empty">NO STRATEGY BACKTEST HISTORY LOADED YET. RUN AUTO-OPTIMIZE OR GENERATE STRATEGY TO FILL THIS TABLE.</p>
                </div>
              )}

              {result && (!result.backtest?.recent_trades || result.backtest.recent_trades.length === 0) && (
                <div className="metrics">
                  <p className="trade-log-empty">STRATEGY LOADED, BUT NO RECENT BACKTEST TRADES WERE RETURNED.</p>
                </div>
              )}

              {result?.backtest?.recent_trades?.length > 0 && (
                <>
                  <div className="table-scroll-hint" aria-label="This table scrolls left to right">
                    <span>{"<"}</span>
                    <span>THIS TABLE SCROLLS LEFT TO RIGHT</span>
                    <span>{">"}</span>
                  </div>

                  <div className="trade-table">
                  <div className="trade-row trade-header">
                    <span>ENTRY TIME</span><span>EXIT TIME</span><span>ENTRY</span><span>EXIT</span><span>RESULT</span><span>PNL</span><span>DURATION</span>
                  </div>
                  {result.backtest.recent_trades && result.backtest.recent_trades.map((trade, index) => (
                    <div className="trade-row" key={index}>
                      <span>{trade.entry_time}</span>
                      <span>{trade.exit_time}</span>
                      <span>{trade.entry_price}</span>
                      <span>{trade.exit_price}</span>
                      <span className={trade.result === "win" ? "trade-win" : "trade-loss"}>{trade.result.toUpperCase()}</span>
                      <span>{trade.pnl_pct}%</span>
                      <span>{trade.duration}</span>
                    </div>
                  ))}
                </div>
                </>
              )}
            </details>

            {getTradePlan() && (
              <details className="retro-window" open>
                <summary>LAST EXECUTION / PROOF OF TRADE</summary>
                <div className="metrics strategy-library-box last-execution-panel">
                  <p><strong>LAST EXECUTION</strong></p>
                  <p>SIGNAL ASSET........ {getSignalAssetLabel()}</p>
                  <p>EXECUTION ROUTE..... {getExecutionRouteLabel()}</p>
                  <p>SIDE................ {getTradeSide()}</p>
                  <p>SIZE................ {getTradePlan()?.amount || "N/A"} {getTradePlan()?.from_token || ""}</p>
                  <p>REQUESTED SIZE...... {getTradePlan()?.requested_trade_size ?? tradeSize} {getTradePlan()?.requested_trade_size_token || coin}</p>
                  <p>TX STATUS........... {getExecutionTxStatus()}</p>
                  <p>TX HASH............. {getExecutionTxHash() || "N/A"}</p>
                  {getExecutionTxHash() && (
                    <p>BSCSCAN............. https://bscscan.com/tx/{getExecutionTxHash()}</p>
                  )}
                  <p>CHAIN............... BSC</p>
                  <p>SOURCE.............. {executionMode === "paper_trading" ? "PAPER TRADING ENGINE" : executionMode === "live_trading" ? "TWAK → PANCAKESWAP" : "DECISION SIMULATION"}</p>
                </div>
              </details>
            )}

            {agentResult?.confidence_score !== undefined && (
              <details className="retro-window" open>
                <summary>TRADE CONFIDENCE / WHY</summary>
                <div className="metrics strategy-library-box">
                  <p><strong>{getTradePlan()?.to_token === "BNB" || getTradePlan()?.from_token === "BNB" ? "BNB EXECUTION CONFIDENCE" : `${coin} TRADE CONFIDENCE`}</strong></p>
                  <p>OVERALL CONFIDENCE.... {agentResult.confidence_score} / 100</p>
                  <p>RECOMMENDATION........ {agentResult.decision || "N/A"}</p>
                  <br />
                  <p><strong>CONFIDENCE BREAKDOWN</strong></p>
                  <p>MARKET TREND.......... {agentResult.signal_breakdown?.cmc_bias ?? "N/A"} / 30</p>
                  <p>FEAR & GREED.......... {agentResult.signal_breakdown?.fear_greed ?? "N/A"} / 20</p>
                  <p>ALTCOIN ROTATION...... {agentResult.signal_breakdown?.altcoin_season ?? "N/A"} / 10</p>
                  <p>STRATEGY QUALITY...... {agentResult.signal_breakdown?.backtest_score ?? "N/A"} / 25</p>
                  <p>RISK CONDITIONS....... {agentResult.signal_breakdown?.drawdown_safety ?? "N/A"} / 15</p>
                  <br />
                  <p>
                    INTERPRETATION.......{" "}
                    {agentResult.confidence_score < 60
                      ? "WAIT / HOLD"
                      : agentResult.confidence_score < 75
                      ? "WEAK TRADE"
                      : agentResult.confidence_score < 90
                      ? "STRONG TRADE"
                      : "HIGH CONVICTION"}
                  </p>
                  <p>SCALE................ 0 = NO CONFIDENCE / 100 = MAX CONFIDENCE</p>
                </div>

                {agentResult?.why?.length > 0 && (
                  <div className="metrics strategy-library-box">
                    <p><strong>WHY THE AGENT DECIDED</strong></p>
                    {agentResult.why.map((reason, index) => (
                      <p key={index}>- {reason}</p>
                    ))}
                  </div>
                )}
              </details>
            )}

            {agentResult?.risk_control && (
              <details className="retro-window">
                <summary>RISK CONTROL</summary>
                <div className="metrics strategy-library-box">
                  <p><strong>RISK CONTROL</strong></p>
                  <p>CURRENT VALUE....... {formatMoney(agentResult.risk_control.current_portfolio_value_usd || 0)}</p>
                  <p>BASELINE VALUE...... {formatMoney(agentResult.risk_control.baseline_portfolio_value_usd || 0)}</p>
                  <p>PEAK VALUE.......... {formatMoney(agentResult.risk_control.peak_portfolio_value_usd || 0)}</p>
                  <p>CURRENT DRAWDOWN.... {agentResult.risk_control.current_drawdown_pct ?? "N/A"}%</p>
                  <p>MAX DRAWDOWN LIMIT.. {agentResult.risk_control.max_drawdown_limit_pct ?? "N/A"}%</p>
                  <p>DAILY LOSS LIMIT.... {agentResult.risk_control.daily_loss_limit_pct ?? "N/A"}%</p>
                  <p>STATUS.............. {agentResult.risk_control.status || "N/A"}</p>
                </div>
              </details>
            )}



            {result && (
              <details className="retro-window" open>
                <summary>RESULTS / OVERALL PERFORMANCE</summary>
                <h2 style={{ marginTop: "8px" }}>STRATEGY ASSESSMENT</h2>
                <div className="metrics">
                  <p>STRATEGY............ {result.selected_strategy}</p>
                  <p>STATUS.............. {isApproved() ? "APPROVED" : "REJECTED"}</p>
                  <p>RATING.............. {getOverallRating()}</p>
                  <p>RATING BASIS........ {getRatingExplanation()}</p>
                  <p>RATING SCALE........ A+ / A / B / C / F</p>
                  <p>RETURN.............. {result.backtest.net_return}</p>
                  <p>MAX DRAWDOWN........ {result.backtest.max_drawdown}</p>
                  <p>WIN RATE............ {result.backtest.win_rate}</p>
                  <p>PROFIT FACTOR....... {result.backtest.profit_factor}</p>
                  <p>EXPECTANCY.......... {result.backtest.expectancy}</p>
                  <p>EDGE................ {parsePercent(result.backtest.expectancy) > 0 ? "POSITIVE" : "NEGATIVE"}</p>
                  <p>BUY & HOLD.......... {parsePercent(result.backtest.strategy_vs_buy_hold) > 0 ? "OUTPERFORMED" : "UNDERPERFORMED"}</p>
                </div>

                <details className="retro-sub-window">
                  <summary>MARKET REGIME</summary>
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
                </details>

                <details className="retro-sub-window">
                  <summary>AGENT DECISION ENGINE</summary>
                  <div className="metrics">
                    <p>DATA SOURCE......... CoinMarketCap Agent Hub</p>
                    <p>EXECUTION LAYER..... Trust Wallet Agent Kit</p>
                    <p>ROUTING VENUE....... PancakeSwap</p>
                    <p>SETTLEMENT CHAIN.... BNB Chain / BSC</p>
                    <br />
                    <p>MARKET REGIME....... {getMarketRegime()}</p>
                    <p>STRATEGY MODE....... AUTO-SELECT BEST BACKTESTED STRATEGY</p>
                    <p>SELECTED STRATEGY... {result.selected_strategy}</p>
                    <p>RISK PROFILE........ {String(result.risk).toUpperCase()}</p>
                    <p>LAST DECISION....... {getAgentDecision()}</p>
                    <p>TRADE CONFIDENCE.... {agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "N/A"}</p>
                    <p>RISK STATUS......... {agentResult?.risk_control?.status || "N/A"}</p>
                    <p>TRADE PLAN.......... {agentResult?.trade_plan ? "GENERATED" : "NONE"}</p>
                    <p>ACTION TAKEN........ {agentResult?.execution_result ? "EXECUTION ATTEMPTED" : "NONE"}</p>
                    <br />
                    <p>AGENT FLOW.......... COINMARKETCAP → MARKET ANALYSIS → STRATEGY ENGINE → CONFIDENCE MODEL → RISK GOVERNOR → TWAK → PANCAKESWAP → BINANCE SMART CHAIN</p>
                    <p>RULE ADHERENCE...... USER RISK LIMITS ENFORCED</p>
                    <p>EXECUTION MODE...... {getExecutionModeLabel()}</p>
                  </div>
                </details>

                {result.backtest.equity_curve && result.backtest.equity_curve.length > 1 && (
                  <details className="retro-sub-window equity-curve-window">
                    <summary>EQUITY CURVE</summary>
                    <div className="chart-box">
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={getEquityCurveData()} margin={{ top: 8, right: 16, left: 4, bottom: 46 }}>
                          <XAxis
                            dataKey="trade"
                            height={46}
                            tick={{ fontSize: 8, fill: "#9cff8f" }}
                            tickMargin={12}
                            tickLine={{ stroke: "#9cff8f" }}
                            axisLine={{ stroke: "#9cff8f" }}
                            label={{
                              value: "TRADES",
                              position: "insideBottom",
                              offset: -20,
                              style: { fontSize: 9, fill: "#9cff8f", letterSpacing: 1 }
                            }}
                          />
                          <YAxis
                            domain={["auto", "auto"]}
                            width={44}
                            tick={{ fontSize: 8, fill: "#9cff8f" }}
                            tickLine={{ stroke: "#9cff8f" }}
                            axisLine={{ stroke: "#9cff8f" }}
                          />
                          <Tooltip
                            labelFormatter={(label) => `Trade ${label}`}
                            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Equity"]}
                            contentStyle={{
                              backgroundColor: "#001a08",
                              border: "1px solid #9cff8f",
                              color: "#9cff8f",
                              fontSize: "8px",
                              lineHeight: "1.25",
                              padding: "4px 6px"
                            }}
                            labelStyle={{ color: "#9cff8f", fontSize: "8px", marginBottom: "2px" }}
                            itemStyle={{ color: "#9cff8f", fontSize: "8px", padding: 0 }}
                          />
                          <Line type="monotone" dataKey="equity" dot={false} stroke="#ffffff" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </details>
                )}

                <details className="retro-sub-window">
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
                    <>
                      <div className="table-scroll-hint" aria-label="This table scrolls left to right">
                        <span>{"<"}</span>
                        <span>THIS TABLE SCROLLS LEFT TO RIGHT</span>
                        <span>{">"}</span>
                      </div>

                      <div className="optimizer-table">
                      <div className="optimizer-row optimizer-header">
                        <span>RANK</span><span>TIMEFRAME</span><span>RISK</span><span>STRATEGY</span><span>RETURN</span><span>SHARPE</span><span>CALMAR</span><span>PF</span><span>MAX DD</span><span>SCORE</span>
                      </div>
                      {result.optimization.all_results
                        ?.filter((item) => item.backtest.min_trade_gate === "PASS" && item.backtest.drawdown_gate === "PASS")
                        .sort((a, b) => b.risk_adjusted_score - a.risk_adjusted_score)
                        .slice(0, 5)
                        .map((item, index) => (
                          <div className="optimizer-row" key={index}>
                            <span>#{index + 1}</span><span>{item.timeframe}</span><span>{item.risk.toUpperCase()}</span><span>{item.selected_strategy}</span><span>{item.backtest.net_return}</span><span>{item.backtest.sharpe_ratio}</span><span>{item.backtest.calmar_ratio}</span><span>{item.backtest.profit_factor}</span><span>{item.backtest.max_drawdown}</span><span>{item.risk_adjusted_score}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </details>

                <details className="retro-sub-window">
                  <summary>TRADING STRATEGY</summary>
                  <div className="reason">
                    <strong>STRATEGY:</strong> {result.selected_strategy}
                    <br /><br />
                    <strong>ENTRY RULE:</strong><br />{result.entry?.condition}
                    <br /><br />
                    <strong>CONFIRMATION:</strong><br />{result.confirmation?.condition}
                    <br /><br />
                    <strong>TAKE PROFIT:</strong><br />{result.take_profit?.condition}
                    <br /><br />
                    <strong>STOP LOSS:</strong><br />{result.stop_loss?.condition}
                    <br /><br />
                    <strong>RISK GOVERNOR:</strong><br />
                    MAX OPEN TRADES: {result.risk_governor?.max_open_trades}<br />
                    RISK PER TRADE: {result.risk_governor?.risk_per_trade}<br />
                    STOP AFTER LOSSES: {result.risk_governor?.stop_after_consecutive_losses}
                  </div>
                  <button className="copy-btn" onClick={copyStrategySummary}>COPY STRATEGY SUMMARY</button>
                </details>

                <details className="retro-sub-window">
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



                <details className="retro-sub-window">
                  <summary>METRICS / AGENT LOGIC EXPLAINED</summary>
                  <div className="metrics">
                    <p><strong>WHAT I KNOW QUANT FU DOES</strong></p>
                    <p>I Know Quant Fu combines CoinMarketCap market intelligence, proprietary strategy testing, portfolio risk management, Trust Wallet Agent Kit (TWAK), PancakeSwap routing, and Binance Smart Chain settlement into a single autonomous trading platform.</p>
                    <p>The system continuously scans market conditions, compares multiple strategies, scores trade quality, evaluates risk, generates explainable AI decisions, and can operate in Simulation, Paper Trading, or Live Trading mode.</p>
                    <br />
                    <p><strong>EXECUTION MODES</strong></p>
                    <p>Decision Simulation: the agent generates and logs decisions only. No live trade and no virtual position is opened.</p>
                    <p>Paper Trading: the agent opens and closes virtual positions, tracks paper PnL, and can be reset without touching the live wallet.</p>
                    <p>Live Trading: the agent attempts real TWAK execution, routes swaps through PancakeSwap, and settles transactions on BNB Smart Chain.</p>
                    <br />
                    <p><strong>AGENT DECISION HIERARCHY</strong></p>
                    <p>1. Risk Protection: drawdown limits, portfolio safety, daily loss control.</p>
                    <p>2. Strategy Quality: backtest performance, risk-adjusted score, robustness.</p>
                    <p>3. Market Trend: bullish, bearish, or neutral market bias.</p>
                    <p>4. Market Context: Fear & Greed and Altcoin Rotation support confidence, but should not act as hard blockers by themselves.</p>
                    <p>5. Execution Rules: mode, trade size, balances, and safety checks.</p>
                    <br />
                    <p><strong>TRADE CONFIDENCE</strong></p>
                    <p>A 0-100 score showing how strongly the agent supports the current trade decision.</p>
                    <p>0-44: very weak setup. 45-59: weak trade. 60-74: normal setup. 75-89: strong setup. 90-100: high conviction.</p>
                    <p><strong>CONFIDENCE BREAKDOWN</strong></p>
                    <p>Market Trend: directional support for the trade.</p>
                    <p>Fear & Greed: broad market sentiment input.</p>
                    <p>Altcoin Rotation: whether capital is generally flowing toward altcoins.</p>
                    <p>Strategy Quality: backtest strength, return, drawdown, and risk-adjusted score.</p>
                    <p>Risk Conditions: whether drawdown and safety limits are acceptable.</p>
                    <br />
                    <p><strong>DAILY QUALIFICATION GUARD</strong></p>
                    <p>Competition rule helper. If no live trade happened during the UTC day, the agent may attempt a small qualifying trade in the final UTC hour.</p>
                    <p>The forced trade uses the configured trade size, aims for +2%, limits downside to -1%, and exits before UTC day end.</p>
                    <br />
                    <p><strong>PORTFOLIO PERFORMANCE</strong></p>
                    <p>Starting Value: portfolio value when tracking began or after reset.</p>
                    <p>Current Value: current estimated portfolio value.</p>
                    <p>Best Value: highest portfolio value reached since tracking began.</p>
                    <p>Profit / Loss: difference between current value and starting value.</p>
                    <p>Current Drawdown: percentage decline from the best value.</p>
                    <br />
                    <p><strong>BACKTEST METRICS</strong></p>
                    <p>Profit Factor: winning trade profit divided by losing trade loss. Above 1.0 is profitable.</p>
                    <p>Sharpe Ratio: return earned per unit of volatility.</p>
                    <p>Sortino Ratio: return earned per unit of downside volatility.</p>
                    <p>Calmar Ratio: net return divided by maximum drawdown.</p>
                    <p>Expectancy: average expected profit or loss per trade.</p>
                    <p>Risk-Adjusted Score: custom optimizer score that rewards return and penalizes drawdown.</p>
                  </div>
                </details>
              </details>
            )}

            {agentResult?.daily_qualification && (
              <details className="retro-window">
                <summary>DAILY QUALIFICATION GUARD</summary>
                <div className="metrics strategy-library-box">
                  <p><strong>DAILY QUALIFICATION GUARD</strong></p>
                  <p>STATUS.............. {agentResult.daily_qualification.status || "N/A"}</p>
                  <p>TRADES TODAY........ {agentResult.daily_qualification.trades_today ?? "N/A"} / {agentResult.daily_qualification.target_trades_per_day ?? "N/A"}</p>
                  <p>FORCED WINDOW....... LAST {agentResult.daily_qualification.forced_window_minutes ?? "N/A"} MINUTES OF UTC DAY</p>
                  <p>MINUTES LEFT TODAY.. {agentResult.daily_qualification.minutes_until_utc_day_end ?? "N/A"}</p>
                  <p>FORCED TP TARGET.... +{agentResult.daily_qualification.take_profit_pct ?? "N/A"}%</p>
                  <p>FORCED MAX DOWNSIDE. -{agentResult.daily_qualification.stop_loss_pct ?? "N/A"}%</p>
                  <p>TIME EXIT BUFFER.... {agentResult.daily_qualification.time_exit_buffer_minutes ?? "N/A"} MINUTES BEFORE UTC DAY END</p>
                </div>
              </details>
            )}
          </div>
        </section>

        <div className="footer retro-footer">
          CMC AGENT HUB: OK &nbsp;&nbsp; TWAK: OK &nbsp;&nbsp; PANCAKESWAP: OK &nbsp;&nbsp; BNB CHAIN: OK &nbsp;&nbsp; BACKTEST ENGINE: OK &nbsp;&nbsp; OPTIMIZER: OK
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderVersionMenu()}
      {viewMode === "simple" ? renderSimpleVersion() : renderDetailedVersion()}
    </>
  );

}

export default App;
