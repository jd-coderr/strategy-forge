import { useState, useEffect, useRef } from "react";
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

const MANUAL_STRATEGY_OPTIONS = [
  "VWAP Extreme Reversion",
  "SMC Sequence Continuation",
  "Stochastic Quad Rotation",
  "TDI Sharkfin Reversal",
  "FVG Channel",
  "Ichimoku MACD EMA Confluence",
];

function App() {
  function getSavedSetting(key, fallback) {
    if (typeof window === "undefined") return fallback;

    const saved = window.localStorage.getItem(key);
    return saved !== null && saved !== "" ? saved : fallback;
  }

  function getSavedNumberSetting(key, fallback) {
    const saved = Number(getSavedSetting(key, fallback));
    return Number.isFinite(saved) ? saved : fallback;
  }

  function getSavedNullableNumberSetting(key) {
    if (typeof window === "undefined") return null;

    const saved = window.localStorage.getItem(key);
    if (saved === null || saved === "") return null;

    const number = Number(saved);
    return Number.isFinite(number) ? number : null;
  }

  const [autonomousMode, setAutonomousMode] = useState(false);
  const [autonomousStatus, setAutonomousStatus] = useState(null);
  const [autonomousInterval, setAutonomousInterval] = useState(() => getSavedNumberSetting("ikqf_autonomous_interval", 5));
  const [cmcSkillHub, setCmcSkillHub] = useState(null);
  const [coin, setCoin] = useState(() => getSavedSetting("ikqf_coin", "ETH"));
  const [timeframe, setTimeframe] = useState(() => getSavedSetting("ikqf_timeframe", "5M"));
  const [risk, setRisk] = useState(() => getSavedSetting("ikqf_risk", "medium"));
  const [tradeSize, setTradeSize] = useState(() => getSavedNumberSetting("ikqf_trade_size", 0.001));
  const [initialCapital, setInitialCapital] = useState(() => getSavedNumberSetting("ikqf_initial_capital", 10000));
  const [result, setResult] = useState(null);
  const [agentResult, setAgentResult] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [showOnlyRealTrades, setShowOnlyRealTrades] = useState(false);
  const [startingPortfolioValue, setStartingPortfolioValue] = useState(() =>
    getSavedNullableNumberSetting("ikqf_starting_portfolio_value")
  );
  const [startingPortfolioTimestamp, setStartingPortfolioTimestamp] = useState(() =>
    getSavedSetting("ikqf_starting_portfolio_timestamp", "")
  );
  const [liveExecution, setLiveExecution] = useState(false);
  const [executionMode, setExecutionMode] = useState(() => getSavedSetting("ikqf_execution_mode", ""));
  const [paperPortfolio, setPaperPortfolio] = useState(null);
  const [paperStartingBalance, setPaperStartingBalance] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState("");
  const [activeButton, setActiveButton] = useState("");
  const [operatorKey, setOperatorKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("ikqf_operator_key") || "";
  });
  const [operatorUnlocked, setOperatorUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("ikqf_operator_unlocked") === "true";
  });
  const [autoOptimized, setAutoOptimized] = useState(false);
  const [setupSource, setSetupSource] = useState("");
  const [manualStrategy, setManualStrategy] = useState(() => getSavedSetting("ikqf_manual_strategy", ""));
  const [agentStopConfirmed, setAgentStopConfirmed] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [bnbBalance, setBnbBalance] = useState(null);
  const [twakStatus, setTwakStatus] = useState("CONFIGURED");
  const [twakRegistration, setTwakRegistration] = useState("READY");
  const [twakAgentAddress, setTwakAgentAddress] = useState(null);
  const [twakAgentChain, setTwakAgentChain] = useState("bsc");
  const [viewMode, setViewMode] = useState("simple");
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [expandedSimpleQuadrant, setExpandedSimpleQuadrant] = useState(null);
  const [expandedDetailedQuadrant, setExpandedDetailedQuadrant] = useState(null);
  const simpleProofRef = useRef(null);
  const agentStatusRef = useRef(null);
  const liveAgentActivityRef = useRef(null);
  const executionModeRef = useRef(executionMode || "decision_simulation");
  const remoteSetupSyncedRef = useRef(false);

  function focusAgentActivitySections() {
    if (viewMode === "detailed") {
      setExpandedDetailedQuadrant(null);
    }

    const focusAfterRender = () => {
      if (viewMode === "simple") {
        const proofPanel = simpleProofRef.current;

        if (proofPanel) {
          const proofBody = proofPanel.querySelector(".simple-quadrant-body");

          if (proofBody) {
            proofBody.scrollTop = 0;
          }

          proofPanel.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      if (viewMode === "detailed") {
        const statusPanel = agentStatusRef.current;
        const activityPanel = liveAgentActivityRef.current;

        if (statusPanel) {
          statusPanel.open = true;
          statusPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        if (activityPanel) {
          activityPanel.open = true;
          activityPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(focusAfterRender);
    } else {
      setTimeout(focusAfterRender, 0);
    }
  }

  function formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) return "N/A";

    const number = Number(value);

    if (Math.abs(number) >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
    if (Math.abs(number) >= 1_000) return `$${(number / 1_000).toFixed(2)}K`;

    return `$${number.toFixed(2)}`;
  }



  function formatSignedMoney(value) {
    if (value === null || value === undefined || isNaN(value)) return "N/A";

    const number = Number(value);
    const sign = number > 0 ? "+" : number < 0 ? "-" : "";

    return `${sign}$${Math.abs(number).toFixed(2)}`;
  }


  function formatTokenBalance(value, decimals = 5) {
    if (value === null || value === undefined || isNaN(Number(value))) return "N/A";

    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  function getRiskProfileLabel(value) {
    const profile = String(value || risk || "medium").toLowerCase();

    if (profile === "high") return "AGGRESSIVE / GOVERNED RISK";
    if (profile === "medium") return "BALANCED";
    if (profile === "low") return "CONSERVATIVE";

    return profile.toUpperCase();
  }

  function getFullTerminalComment() {
    const executionStatus = getExecutionStatus();
    const decision = String(getExecutionAction() || "").toUpperCase();
    const riskStatus = String(agentResult?.risk_control?.status || executionStatus.status || "").toUpperCase();

    if (riskStatus.includes("BLOCK") || riskStatus.includes("REJECT") || riskStatus.includes("FAILED")) {
      return "GREED BLOCKED AT THE DOOR.";
    }

    if (didExecuteTrade()) {
      return "ROUNDHOUSE LANDED. PROOF BELONGS ON-CHAIN.";
    }

    if (decision === "HOLD" || executionStatus.status?.includes("HOLD")) {
      return "THE CANDLE IS NOT WORTHY.";
    }

    if (autonomousMode && !didExecuteTrade()) {
      return "PATIENCE IS ALSO A STRATEGY.";
    }

    return "AWAITING THE NEXT WORTHY CANDLE.";
  }

  function getTradeLogEventLabel(trade) {
    const status = String(trade?.status || trade?.event || "UNKNOWN").toLowerCase();

    if (isQuoteOnlyTradeLogEntry(trade)) return "QUOTE GENERATED";
    if (isBlockedTradeLogEntry(trade)) return "BLOCKED BY SAFETY";
    if (isExecutedLiveTradeLogEntry(trade)) return "EXECUTION CONFIRMED";
    if (status === "success") return "ROUTE CHECK PASSED";
    if (status === "agent_cycle") return "AGENT CYCLE";
    if (status === "decision") return "DECISION LOGGED";
    if (status === "failed") return "EXECUTION FAILED";

    return status.replaceAll("_", " ").toUpperCase();
  }

  function getTradeLogNonExecutionLabel(trade) {
    const typeLabel = getTradeLogTypeLabel(trade);

    if (typeLabel === "QUOTE ONLY / NOT EXECUTED") return "ROUTE CHECKED / NO LIVE TRADE";
    if (typeLabel === "BLOCKED / NOT EXECUTED") return "BLOCKED / NO LIVE TRADE";
    if (typeLabel === "FAILED / NOT EXECUTED") return "FAILED / NO LIVE TRADE";
    if (typeLabel === "TRADE PLAN / NOT EXECUTED") return "TRADE PLAN ONLY";

    return "NO LIVE TRADE";
  }

  function parseAmountToken(value) {
    const text = String(value || "").trim();
    const match = text.match(/(-?\d+(?:\.\d+)?)\s*([A-Za-z0-9]+)/);

    if (!match) {
      return {
        amount: null,
        token: null,
      };
    }

    return {
      amount: Number(match[1]),
      token: match[2].toUpperCase(),
    };
  }

  function getTradeLogExecution(trade) {
    return trade?.execution_result || trade?.event?.execution_result || trade?.result || {};
  }

  function isQuoteOnlyTradeLogEntry(trade) {
    const execution = getTradeLogExecution(trade);
    const tradePlan = trade?.trade_plan || {};

    return trade?.quote_only === true || tradePlan?.quote_only === true || execution?.quote_only === true;
  }

  function isBlockedTradeLogEntry(trade) {
    const execution = getTradeLogExecution(trade);
    const status = String(trade?.status || trade?.event || "").toLowerCase();

    return status === "blocked" || execution?.blocked === true;
  }

  function getTradeLogSwapSummary(trade) {
    const execution = getTradeLogExecution(trade);
    const tradePlan = trade?.trade_plan || {};
    let parsedStdout = null;

    if (execution?.stdout) {
      try {
        parsedStdout = JSON.parse(execution.stdout);
      } catch (error) {
        parsedStdout = null;
      }
    }

    const input = parseAmountToken(parsedStdout?.input);
    const output = parseAmountToken(parsedStdout?.output);
    const fromToken = (input.token || tradePlan?.from_token || trade?.from_token || "").toUpperCase() || null;
    const toToken = (output.token || tradePlan?.to_token || trade?.to_token || "").toUpperCase() || null;
    const inputAmount = input.amount ?? parseMetricNumber(trade?.amount || tradePlan?.amount, null);
    const outputAmount = output.amount;

    return {
      fromToken,
      toToken,
      inputAmount,
      outputAmount,
      minReceived: parsedStdout?.minReceived || null,
      provider: parsedStdout?.provider || null,
    };
  }

  function isExecutedLiveTradeLogEntry(trade) {
    const execution = getTradeLogExecution(trade);
    const status = String(trade?.status || trade?.event || "").toLowerCase();
    const decision = String(trade?.decision || execution?.decision || "").toUpperCase();
    const mode = String(
      trade?.execution_mode ||
      trade?.mode ||
      execution?.execution_mode ||
      execution?.mode ||
      ""
    ).toLowerCase();

    if (decision === "HOLD") return false;
    if (status.includes("decision")) return false;
    if (isQuoteOnlyTradeLogEntry(trade)) return false;
    if (isBlockedTradeLogEntry(trade)) return false;
    if (execution?.executed === false) return false;

    const success = execution?.success === true || execution?.executed === true || status === "success";
    const liveMode = mode === "live_trading" || trade?.live_execution === true || status === "success";

    return success && liveMode;
  }

  function getTradeLogTypeLabel(trade) {
    const execution = getTradeLogExecution(trade);
    const tradePlan = trade?.trade_plan || {};
    const hasRoute = Boolean(
      tradePlan?.from_token ||
      tradePlan?.to_token ||
      trade?.from_token ||
      trade?.to_token
    );

    if (isBlockedTradeLogEntry(trade)) return "BLOCKED / NOT EXECUTED";
    if (isQuoteOnlyTradeLogEntry(trade)) return "QUOTE ONLY / NOT EXECUTED";
    if (isExecutedLiveTradeLogEntry(trade)) return "REAL TRADE / EXECUTION";
    if (execution?.success === false) return "FAILED / NOT EXECUTED";
    if (hasRoute) return "TRADE PLAN / NOT EXECUTED";

    return "DECISION ONLY";
  }

  function calculateRealizedPnlForTrade(targetTrade) {
    const positions = {};

    for (const entry of tradeHistory) {
      const isTarget = entry === targetTrade;

      if (!isExecutedLiveTradeLogEntry(entry)) {
        if (isTarget) return null;
        continue;
      }

      const summary = getTradeLogSwapSummary(entry);
      const fromToken = summary.fromToken;
      const toToken = summary.toToken;
      const inputAmount = Number(summary.inputAmount || 0);
      const outputAmount = Number(summary.outputAmount || 0);

      if (isTarget) {
        if (fromToken === "USDT" && toToken && toToken !== "USDT") {
          return {
            type: "open",
            pnl: 0,
          };
        }

        if (toToken === "USDT" && fromToken && fromToken !== "USDT") {
          const position = positions[fromToken];

          if (!position || position.quantity <= 0 || inputAmount <= 0 || outputAmount <= 0) {
            return {
              type: "unknown_cost_basis",
              pnl: null,
            };
          }

          const sellQuantity = Math.min(inputAmount, position.quantity);
          const averageCost = position.costUsd / position.quantity;
          const costBasis = averageCost * sellQuantity;

          return {
            type: "realized",
            pnl: outputAmount - costBasis,
          };
        }

        return {
          type: "recorded",
          pnl: 0,
        };
      }

      if (fromToken === "USDT" && toToken && toToken !== "USDT" && inputAmount > 0 && outputAmount > 0) {
        positions[toToken] = positions[toToken] || { quantity: 0, costUsd: 0 };
        positions[toToken].quantity += outputAmount;
        positions[toToken].costUsd += inputAmount;
      } else if (toToken === "USDT" && fromToken && fromToken !== "USDT" && inputAmount > 0 && outputAmount > 0) {
        const position = positions[fromToken];

        if (position && position.quantity > 0) {
          const sellQuantity = Math.min(inputAmount, position.quantity);
          const averageCost = position.costUsd / position.quantity;
          const costBasis = averageCost * sellQuantity;

          position.quantity -= sellQuantity;
          position.costUsd = Math.max(0, position.costUsd - costBasis);
        }
      }
    }

    return null;
  }

  function getTradeLogPnlLabel(trade) {
    const typeLabel = getTradeLogTypeLabel(trade);

    if (typeLabel === "BLOCKED / NOT EXECUTED") return "$0.00 — BLOCKED";
    if (typeLabel === "QUOTE ONLY / NOT EXECUTED") return "$0.00 — QUOTE ONLY";
    if (typeLabel === "FAILED / NOT EXECUTED") return "$0.00 — FAILED";
    if (typeLabel === "TRADE PLAN / NOT EXECUTED") return "$0.00 — NOT EXECUTED";
    if (typeLabel === "DECISION ONLY") return "$0.00 — DECISION ONLY";

    const pnl = calculateRealizedPnlForTrade(trade);

    if (!pnl) return "ENTRY COST NOT FOUND";
    if (pnl.type === "open") return "$0.00 — OPEN POSITION";
    if (pnl.type === "unknown_cost_basis") return "ENTRY COST NOT FOUND";
    if (pnl.type === "realized") return `${formatSignedMoney(pnl.pnl)} REALIZED`;

    return "$0.00 — RECORDED";
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
    const curvePoints = result?.backtest?.equity_curve_points;

    if (Array.isArray(curvePoints) && curvePoints.length > 0) {
      return curvePoints.map((point, index) => ({
        trade: Number(point.trade ?? index),
        equity: Number(point.equity ?? 0),
        date: point.date || point.exit_time || point.timestamp || null,
      }));
    }

    if (!result?.backtest?.equity_curve) return [];

    const recentTrades = result?.backtest?.recent_trades || [];

    return result.backtest.equity_curve.map((value, index) => {
      const relatedTrade = index > 0 ? recentTrades[index - 1] : null;

      return {
        trade: index,
        equity: Number(value),
        date: index === 0
          ? result?.backtest?.backtest_start || null
          : relatedTrade?.exit_time || relatedTrade?.exit_timestamp || null,
      };
    });
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

  function formatPortfolioBaselineDate(value) {
    if (!value) return "SINCE NOT SET";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "SINCE NOT SET";

    return `SINCE ${date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function formatPortfolioBaselineDateOnly(value) {
    if (!value) return "NOT SET";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "NOT SET";

    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getPortfolioStartValueLabel() {
    if (!portfolio) return "N/A";

    return `${formatMoney(portfolio.startingPortfolioValue || 0)} (${formatPortfolioBaselineDate(portfolio.startingPortfolioTimestamp)})`;
  }

  function getPortfolioStartValueOnlyLabel() {
    if (!portfolio) return "N/A";

    return formatMoney(portfolio.startingPortfolioValue || 0);
  }

  function shortenAddress(address) {
    if (!address) return "N/A";

    const text = String(address);
    if (text.length <= 14) return text;

    return `${text.slice(0, 6)}...${text.slice(-5)}`;
  }

  function shortenHash(hash) {
    if (!hash) return "N/A";

    const text = String(hash);
    if (text.length <= 20) return text;

    return `${text.slice(0, 10)}...${text.slice(-8)}`;
  }

  function formatAssetBalance(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "N/A";

    if (Math.abs(number) >= 1) return number.toFixed(5).replace(/\.?0+$/, "");
    return number.toFixed(8).replace(/\.?0+$/, "");
  }

  function getBnbBalanceLabel() {
    const bnbAsset = portfolio?.assets?.find((asset) => asset.symbol === "BNB");
    if (!bnbAsset?.balance) return "N/A";

    return `${formatAssetBalance(bnbAsset.balance)} BNB`;
  }

  function formatEquityTooltipLabel(label, payload) {
    const point = payload?.[0]?.payload;
    const tradeLabel = `Trade ${point?.trade ?? label}`;

    if (!point?.date) return tradeLabel;

    return `${tradeLabel} // ${point.date}`;
  }

  function getCurrentExecutionMode() {
    const activeMode = autonomousStatus?.active_config?.execution_mode;
    const savedMode = autonomousStatus?.saved_agent_setup?.execution_mode;

    // When the backend agent is running, the backend active config is the source of truth.
    // This prevents old browser state or an old last_result from showing DECISION SIMULATION
    // while the real agent was started in LIVE TRADING mode.
    if (autonomousMode && activeMode) return activeMode;

    if (executionMode) return executionMode;
    if (agentResult?.execution_mode) return agentResult.execution_mode;
    if (savedMode) return savedMode;

    return "decision_simulation";
  }

  function getExecutionModeLabel(modeOverride) {
    const mode = String(modeOverride || getCurrentExecutionMode() || "decision_simulation").toLowerCase();

    if (mode === "live_trading") return "LIVE TRADING";
    if (mode === "paper_trading") return "PAPER TRADING";

    return "DECISION SIMULATION";
  }

  function getExecutionModeForPayload(modeOverride) {
    return modeOverride || executionModeRef.current || executionMode || "decision_simulation";
  }

  function getAgentRuntimeStatusLabel() {
    if (!autonomousMode) return "STOPPED";

    const mode = String(getCurrentExecutionMode() || "decision_simulation").toLowerCase();

    if (mode === "live_trading") return "LIVE TRADING ACTIVE";
    if (mode === "paper_trading") return "PAPER TRADING ACTIVE";

    return "SIMULATION ACTIVE";
  }

  function getExecutionSourceLabel() {
    const mode = String(getCurrentExecutionMode() || "decision_simulation").toLowerCase();

    if (mode === "paper_trading") return "PAPER TRADING ENGINE";
    if (mode === "live_trading") return "TWAK → PANCAKESWAP";

    return "DECISION SIMULATION";
  }

  function getUserNetworkLabel() {
    if (!walletAddress) return "NOT CONNECTED";
    if (walletChainId === "0x38") return "BNB SMART CHAIN";
    if (walletChainId) return `WRONG NETWORK (${walletChainId})`;

    return "UNKNOWN";
  }

  function getAgentNetworkLabel() {
    const chain = String(twakAgentChain || "bsc").toLowerCase();

    if (chain === "bsc" || chain.includes("bnb") || chain.includes("bsc")) {
      return "BNB SMART CHAIN / BSC";
    }

    return String(twakAgentChain || "BSC").toUpperCase();
  }

  function getButtonStyle(name) {
    const isPersistentActive =
      (name === "wallet" && walletAddress) ||
      (name === "optimize" && autoOptimized) ||
      (name === "run" && autonomousMode) ||
      (name === "stop" && agentStopConfirmed && !autonomousMode);

    return activeButton === name || isPersistentActive
      ? {
          background: "rgba(156, 255, 143, 0.16)",
          boxShadow: "0 0 18px rgba(156, 255, 143, 0.85)",
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

  function getOperatorHeaders(baseHeaders = {}) {
    return operatorKey
      ? {
          ...baseHeaders,
          "X-IKQF-ADMIN-KEY": operatorKey,
        }
      : baseHeaders;
  }

  function lockOperatorMode() {
    setOperatorUnlocked(false);
    setOperatorKey("");

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("ikqf_operator_key");
      window.sessionStorage.removeItem("ikqf_operator_unlocked");
    }
  }

  function requireOperatorMode(actionLabel = "THIS ACTION") {
    if (!operatorUnlocked || !operatorKey.trim()) {
      alert(`${actionLabel} IS LOCKED. OPEN THE OPTIONS MENU AND UNLOCK OPERATOR MODE FIRST.`);
      return false;
    }

    return true;
  }

  async function unlockOperatorMode() {
    const key = operatorKey.trim();

    if (!key) {
      alert("ENTER OPERATOR PASSWORD FIRST");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/operator/unlock`, {
        method: "POST",
        headers: {
          "X-IKQF-ADMIN-KEY": key,
        },
      });

      if (!response.ok) {
        throw new Error("Operator unlock rejected");
      }

      setOperatorUnlocked(true);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("ikqf_operator_key", key);
        window.sessionStorage.setItem("ikqf_operator_unlocked", "true");
      }

      alert("OPERATOR MODE UNLOCKED FOR THIS BROWSER SESSION");
    } catch (error) {
      console.error(error);
      lockOperatorMode();
      alert("OPERATOR PASSWORD WRONG OR BACKEND ADMIN KEY NOT CONFIGURED");
    }
  }

  async function handleLockedResponse(response) {
    if (response.status === 401 || response.status === 403) {
      lockOperatorMode();
      alert("OPERATOR MODE LOCKED. ENTER THE PASSWORD AGAIN.");
      return true;
    }

    if (response.status === 500) {
      const data = await response.json().catch(() => null);
      const message = data?.detail || "BACKEND ADMIN KEY IS NOT CONFIGURED";
      alert(message);
      return true;
    }

    return false;
  }

  function applyRemoteAgentSetup(setup, restoreResult = true) {
    if (!setup) return;

    if (setup.coin) setCoin(setup.coin);
    if (setup.timeframe) setTimeframe(setup.timeframe);
    if (setup.risk) setRisk(setup.risk);

    if (setup.trade_size !== undefined && setup.trade_size !== null) {
      setTradeSize(Number(setup.trade_size));
    }

    if (setup.initial_capital !== undefined && setup.initial_capital !== null) {
      setInitialCapital(Number(setup.initial_capital));
    }

    if (setup.interval_minutes !== undefined && setup.interval_minutes !== null) {
      setAutonomousInterval(Number(setup.interval_minutes));
    }

    if (setup.execution_mode) {
      executionModeRef.current = setup.execution_mode;
      setExecutionMode(setup.execution_mode);
      setLiveExecution(setup.execution_mode === "live_trading");
    }

    if (setup.selected_strategy) {
      setManualStrategy(setup.selected_strategy);
    }

    if (setup.source) {
      setSetupSource(setup.source);
    }

    if (restoreResult && setup.result_snapshot) {
      setResult(setup.result_snapshot);
      setAutoOptimized(Boolean(setup.result_snapshot?.optimization || setup.optimization));
    }
  }

  function buildAgentSetupPayload(patch = {}) {
    const snapshot = patch.result_snapshot !== undefined ? patch.result_snapshot : result || null;
    const optimizationSnapshot = patch.optimization !== undefined ? patch.optimization : snapshot?.optimization || null;

    return {
      coin: patch.coin !== undefined ? patch.coin : coin,
      timeframe: patch.timeframe !== undefined ? patch.timeframe : timeframe,
      risk: patch.risk !== undefined ? patch.risk : risk,
      initial_capital: patch.initial_capital !== undefined ? patch.initial_capital : initialCapital,
      live_execution: patch.live_execution !== undefined ? patch.live_execution : getExecutionModeForPayload() === "live_trading",
      execution_mode: patch.execution_mode !== undefined ? (patch.execution_mode || "decision_simulation") : getExecutionModeForPayload(),
      trade_size: patch.trade_size !== undefined ? patch.trade_size : tradeSize,
      interval_minutes: patch.interval_minutes !== undefined ? patch.interval_minutes : autonomousInterval,
      selected_strategy: patch.selected_strategy !== undefined ? patch.selected_strategy : manualStrategy || snapshot?.selected_strategy || null,
      result_snapshot: snapshot,
      optimization: optimizationSnapshot,
      source: patch.source || "manual_selection",
    };
  }

  async function saveAgentSetupToBackend(patch = {}) {
    if (!operatorUnlocked || !operatorKey.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/agent-config`, {
        method: "POST",
        headers: getOperatorHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(buildAgentSetupPayload(patch)),
      });

      if (await handleLockedResponse(response)) return;

      const data = await response.json().catch(() => null);

      if (data?.setup) {
        remoteSetupSyncedRef.current = true;
      }
    } catch (error) {
      console.error("AGENT SETUP SAVE FAILED:", error);
    }
  }

  function handleManualSetupChange(patch, resetStrategy = false) {
    if (patch.coin !== undefined) setCoin(patch.coin);
    if (patch.timeframe !== undefined) setTimeframe(patch.timeframe);
    if (patch.risk !== undefined) setRisk(patch.risk);
    if (patch.initial_capital !== undefined) setInitialCapital(Number(patch.initial_capital));
    if (patch.trade_size !== undefined) setTradeSize(Number(patch.trade_size));
    if (patch.interval_minutes !== undefined) setAutonomousInterval(Number(patch.interval_minutes));
    if (patch.selected_strategy !== undefined) setManualStrategy(patch.selected_strategy || "");

    if (patch.execution_mode !== undefined) {
      const nextExecutionMode = patch.execution_mode || "decision_simulation";
      executionModeRef.current = nextExecutionMode;
      setExecutionMode(nextExecutionMode);
      setLiveExecution(nextExecutionMode === "live_trading");
    } else if (patch.live_execution !== undefined) {
      setLiveExecution(Boolean(patch.live_execution));
      if (patch.live_execution === true) {
        executionModeRef.current = "live_trading";
        setExecutionMode("live_trading");
      }
    }

    const savePatch = { ...patch, source: patch.source || "manual_selection" };

    if (resetStrategy) {
      setAutoOptimized(false);
      setResult(null);
      setAgentResult(null);
      setManualStrategy("");
      savePatch.selected_strategy = null;
      savePatch.result_snapshot = null;
      savePatch.optimization = null;
    }

    setSetupSource(savePatch.source);
    saveAgentSetupToBackend(savePatch);
  }

  function isApproved() {
  return (
    result?.backtest?.drawdown_gate === "PASS" &&
    result?.backtest?.min_trade_gate === "PASS"
  );
}

async function startAutonomousMode() {
  if (!requireOperatorMode("START AGENT")) return;

  pulseButton("run");
  focusAgentActivitySections();

  try {
    const selectedExecutionMode = getExecutionModeForPayload();

    const response = await fetch(`${API_BASE}/autonomous/start`, {
      method: "POST",
      headers: getOperatorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        coin,
        timeframe,
        risk,
        initial_capital: initialCapital,
        live_execution: selectedExecutionMode === "live_trading",
        execution_mode: selectedExecutionMode,
        trade_size: tradeSize,
        selected_strategy: manualStrategy || result?.selected_strategy || null,
        interval_minutes: autonomousInterval,
        result_snapshot: result || null,
        optimization: result?.optimization || null,
        setup_source: autoOptimized ? "auto_optimized_start" : "manual_start",
      }),
    });

    if (await handleLockedResponse(response)) return;

    const data = await response.json();
    setAutonomousStatus(data);
    setAgentResult(null);
    if (data.saved_agent_setup) {
      applyRemoteAgentSetup(data.saved_agent_setup, false);
    }
    setAutonomousMode(true);
    setAgentStopConfirmed(false);
  } catch (err) {
    console.error(err);
    alert("AUTONOMOUS MODE START FAILED");
  }
}

async function stopAutonomousMode() {
  if (!requireOperatorMode("STOP AGENT")) return;

  pulseButton("stop");

  try {
    const response = await fetch(`${API_BASE}/autonomous/stop`, {
      method: "POST",
      headers: getOperatorHeaders(),
    });

    if (await handleLockedResponse(response)) return;

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

    if (data.chain || data.agent_chain) {
      setTwakAgentChain(data.chain || data.agent_chain);
    }

    if (data.running === true) {
      setAgentStopConfirmed(false);
    }

    // Do not let the backend's stopped/default interval overwrite the user's dropdown choice.
    // Only sync it back into the UI while autonomous mode is actually running.
    if (data.running === true && data.interval_minutes) {
      setAutonomousInterval(Number(data.interval_minutes));
    }

    // If the backend is already running, the UI must show the active backend setup,
    // not the React default dropdown value after a page refresh. If the backend is not
    // running, sync the last saved operator setup once so another browser sees the same
    // manual asset/timeframe/risk and the last optimizer comparison.
    const activeConfig = data.active_config || data.config || data.last_result?.active_config || null;
    const savedAgentSetup = data.saved_agent_setup || data.agent_setup || null;

    if (data.running === true && activeConfig) {
      applyRemoteAgentSetup(
        {
          ...savedAgentSetup,
          ...activeConfig,
        },
        Boolean(savedAgentSetup?.result_snapshot)
      );
      remoteSetupSyncedRef.current = true;
    } else if (!remoteSetupSyncedRef.current && savedAgentSetup) {
      applyRemoteAgentSetup(savedAgentSetup, true);
      remoteSetupSyncedRef.current = true;
    }

    if (data.last_result) {
      setAgentResult(data.last_result);
    } else if (data.running === true) {
      // Starting or restarting the backend clears last_result. Clear the browser copy too,
      // otherwise an old simulation result can remain visible under a live-running agent.
      setAgentResult(null);
    }
  } catch (err) {
    console.error(err);
  }
}

useEffect(() => {
  document.title = "I KNOW QUANT FU";

  loadAutonomousStatus();
  checkRegistration();
  loadPortfolio();
  loadTradeHistory();
  loadPaperPortfolio();
  
  const timer = setInterval(() => {
    loadAutonomousStatus();
  }, 10000);

  return () => clearInterval(timer);
}, []);

useEffect(() => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem("ikqf_coin", coin);
  window.localStorage.setItem("ikqf_timeframe", timeframe);
  window.localStorage.setItem("ikqf_risk", risk);
  window.localStorage.setItem("ikqf_trade_size", String(tradeSize));
  window.localStorage.setItem("ikqf_initial_capital", String(initialCapital));
  if (executionMode) {
    window.localStorage.setItem("ikqf_execution_mode", executionMode);
  }
  window.localStorage.setItem("ikqf_autonomous_interval", String(autonomousInterval));
  window.localStorage.setItem("ikqf_manual_strategy", manualStrategy || "");
}, [coin, timeframe, risk, tradeSize, initialCapital, executionMode, autonomousInterval, manualStrategy]);

useEffect(() => {
  if (executionMode) {
    executionModeRef.current = executionMode;
  }
}, [executionMode]);

useEffect(() => {
  if (autonomousMode) {
    focusAgentActivitySections();
  }
}, [autonomousMode, viewMode]);

  function parsePercent(value) {
    return parseFloat(String(value).replace("%", ""));
  }

  function parseMetricNumber(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : fallback;
    }

    const cleaned = String(value)
      .replace(/[$,%]/g, "")
      .replace(/days|day|hours|hour|trades|trade/gi, "")
      .replace(/,/g, "")
      .trim();

    const number = Number(cleaned);
    return Number.isFinite(number) ? number : fallback;
  }

  function getFrequencyRankedResults() {
    const rawResults =
      result?.optimization?.frequency_ranked_results ||
      result?.optimization?.all_results ||
      [];

    const winRateFloor = 30;

    return rawResults
      .slice()
      .sort((a, b) => {
        const aWinRate = parseMetricNumber(a.backtest?.win_rate, 0);
        const bWinRate = parseMetricNumber(b.backtest?.win_rate, 0);
        const aPassesWinFloor = aWinRate >= winRateFloor;
        const bPassesWinFloor = bWinRate >= winRateFloor;

        if (aPassesWinFloor !== bPassesWinFloor) {
          return bPassesWinFloor - aPassesWinFloor;
        }

        const aProfitFactor = parseMetricNumber(a.backtest?.profit_factor, 0);
        const bProfitFactor = parseMetricNumber(b.backtest?.profit_factor, 0);
        if (aProfitFactor !== bProfitFactor) {
          return bProfitFactor - aProfitFactor;
        }

        const aDrawdown = parseMetricNumber(a.backtest?.max_drawdown, 999);
        const bDrawdown = parseMetricNumber(b.backtest?.max_drawdown, 999);
        if (aDrawdown !== bDrawdown) {
          return aDrawdown - bDrawdown;
        }

        const aSignals = parseMetricNumber(
          a.backtest?.signals_per_day_value ?? a.backtest?.signals_per_day,
          0
        );
        const bSignals = parseMetricNumber(
          b.backtest?.signals_per_day_value ?? b.backtest?.signals_per_day,
          0
        );

        return bSignals - aSignals;
      });
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
    if (getCurrentExecutionMode() === "decision_simulation") return false;
    if (executionResult.success !== true) return false;

    return true;
  }

  function getExecutionStatus() {
    const tradePlan = getTradePlan();
    const executionResult = getExecutionResult();
    const action = getExecutionAction();
    const currentExecutionMode = String(getCurrentExecutionMode() || "decision_simulation").toLowerCase();

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

    if (currentExecutionMode === "decision_simulation") {
      return {
        action,
        executed: "NO",
        status: "DECISION SIMULATION",
        reason: executionResult.message || tradePlan.reason || "Simulation mode logs the decision without opening a position.",
        nextAction: "Switch to Paper or Live mode to execute trades.",
      };
    }

    if (executionResult.executed === false) {
      return {
        action,
        executed: "NO",
        status: currentExecutionMode === "paper_trading" ? "PAPER MODE / NO FILL" : "LIVE MODE / NO EXECUTION",
        reason: executionResult.message || tradePlan.reason || "The agent is not in simulation mode, but this cycle did not send an execution.",
        nextAction: "Continue monitoring until confidence, strategy quality, and risk controls produce an executable trade.",
      };
    }

    if (executionResult.success === true) {
      return {
        action,
        executed: "YES",
        status: currentExecutionMode === "paper_trading" ? "PAPER TRADE FILLED" : "LIVE EXECUTION CONFIRMED",
        reason: tradePlan.reason || executionResult.message || "Trade execution completed successfully.",
        nextAction: "Monitor realized profit/loss, risk status, and the next autonomous check.",
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
    const currentExecutionMode = String(getCurrentExecutionMode() || "decision_simulation").toLowerCase();

    if (currentExecutionMode === "decision_simulation") return "SIMULATED / NOT SENT";
    if (executionResult.executed === false) return currentExecutionMode === "paper_trading" ? "PAPER MODE / NOT FILLED" : "LIVE MODE / NOT SENT";
    if (executionResult.success && currentExecutionMode === "paper_trading") return "PAPER FILLED";
    if (executionResult.success && tradePlan.quote_only === true) return "QUOTE ONLY";
    if (executionResult.success) return "CONFIRMED";

    return "FAILED";
  }

  function extractTxHashFromTextParts(parts = []) {
    const possibleText = parts.filter(Boolean).join(" ");
    const match = possibleText.match(/0x[a-fA-F0-9]{64}/);
    return match ? match[0] : null;
  }

  function getExecutionTxHash() {
    const executionResult = getExecutionResult();

    return extractTxHashFromTextParts([
      executionResult?.tx_hash,
      executionResult?.transaction_hash,
      executionResult?.transactionHash,
      executionResult?.hash,
      executionResult?.stdout,
      executionResult?.stderr,
      executionResult?.message,
    ]);
  }

  function extractTxHashFromTradeLogEntry(entry) {
    const execution = entry?.execution_result || entry?.event?.execution_result || entry?.result || {};

    return extractTxHashFromTextParts([
      entry?.tx_hash,
      entry?.transaction_hash,
      entry?.transactionHash,
      entry?.hash,
      entry?.stdout,
      entry?.stderr,
      entry?.message,
      execution?.tx_hash,
      execution?.transaction_hash,
      execution?.transactionHash,
      execution?.hash,
      execution?.stdout,
      execution?.stderr,
      execution?.message,
    ]);
  }

  function isLiveTradeLogEntry(entry) {
    const execution = entry?.execution_result || entry?.event?.execution_result || entry?.result || {};
    const mode = String(
      entry?.execution_mode ||
      entry?.mode ||
      execution?.execution_mode ||
      execution?.mode ||
      ""
    ).toLowerCase();
    const status = String(entry?.status || entry?.event || "").toLowerCase();
    const decision = String(entry?.decision || execution?.decision || "").toUpperCase();

    if (mode && mode !== "live_trading") return false;
    if (decision === "HOLD") return false;
    if (status.includes("decision")) return false;
    if (entry?.quote_only === true || execution?.quote_only === true) return false;
    if (execution?.blocked === true || execution?.executed === false) return false;

    return (
      execution?.success === true ||
      execution?.executed === true ||
      status === "success" ||
      status === "real_trade" ||
      status.includes("live")
    );
  }

  function getLatestLiveTradeLogEntry() {
    return tradeHistory.find(isLiveTradeLogEntry) || null;
  }

  function getLatestLiveTxHash() {
    const currentTxHash = getExecutionTxHash();
    if (currentTxHash) return currentTxHash;

    const latestLiveTrade = getLatestLiveTradeLogEntry();
    return latestLiveTrade ? extractTxHashFromTradeLogEntry(latestLiveTrade) : null;
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

  function getSimpleMarketRegimeLabel() {
    const signal = result?.cmc_signal || agentResult?.cmc_signal || autonomousStatus?.last_result?.cmc_signal || null;

    if (!signal) return "MARKET SCAN NOT RUN YET";

    const fearValue = Number(signal?.fear_greed?.value ?? 50);

    if (fearValue <= 25) return "RISK-OFF / EXTREME FEAR";
    if (fearValue >= 75) return "RISK-ON / HIGH GREED";

    return "NEUTRAL";
  }

  function getSimpleSelectedStrategyLabel() {
    const chosenStrategy =
      manualStrategy ||
      result?.selected_strategy ||
      agentResult?.selected_strategy ||
      autonomousStatus?.last_result?.selected_strategy ||
      autonomousStatus?.active_config?.selected_strategy ||
      autonomousStatus?.saved_agent_setup?.selected_strategy ||
      null;

    if (chosenStrategy) return chosenStrategy;
    if (loading && loadingMode === "optimize") return "OPTIMIZER RUNNING";
    if (loading && loadingMode === "agent") return "AGENT SELECTING BEST STRATEGY";
    if (setupSource === "manual_selection" || setupSource === "manual_start") {
      return "MANUAL SETUP ACTIVE — BEST STRATEGY AUTO-SELECTS ON RUN";
    }

    return "NO STRATEGY SELECTED YET";
  }

  function getActiveStrategyLabel() {
    const chosenStrategy =
      manualStrategy ||
      result?.selected_strategy ||
      agentResult?.selected_strategy ||
      autonomousStatus?.last_result?.selected_strategy ||
      autonomousStatus?.active_config?.selected_strategy ||
      autonomousStatus?.saved_agent_setup?.selected_strategy ||
      null;

    if (chosenStrategy) return chosenStrategy;
    if (loading && loadingMode === "optimize") return "OPTIMIZER RUNNING";
    if (loading && loadingMode === "agent") return "AGENT SELECTING BEST STRATEGY";
    if (setupSource === "manual_selection" || setupSource === "manual_start" || setupSource === "generated_strategy") {
      return "MANUAL SETUP ACTIVE — STRATEGY AUTO-SELECTS ON RUN";
    }

    return "NO STRATEGY SELECTED YET";
  }

  function getSimpleSetupStatusLabel() {
    if (loading && loadingMode === "optimize") return "OPTIMIZER RUNNING";
    if (autoOptimized || result?.optimization || setupSource === "auto_optimization" || setupSource === "auto_optimized_start") {
      return "OPTIMIZER SELECTED SETUP";
    }

    const chosenStrategy =
      manualStrategy ||
      result?.selected_strategy ||
      agentResult?.selected_strategy ||
      autonomousStatus?.last_result?.selected_strategy ||
      autonomousStatus?.active_config?.selected_strategy ||
      autonomousStatus?.saved_agent_setup?.selected_strategy ||
      null;

    if (setupSource === "manual_selection" || setupSource === "manual_start" || setupSource === "generated_strategy") {
      return chosenStrategy ? "MANUAL SETUP ACTIVE — STRATEGY AUTO-SELECTED" : "MANUAL SETUP ACTIVE";
    }

    return "OPTIMIZER NOT RUN YET";
  }

  function getSimplePortfolioDrawdownLabel() {
    const drawdown = agentResult?.risk_control?.current_drawdown_pct;

    if (drawdown === undefined || drawdown === null || drawdown === "") return "N/A";

    const number = parseMetricNumber(drawdown, null);
    const formattedDrawdown = number === null ? String(drawdown).replace("%", "") : number.toFixed(2);

    return `${formattedDrawdown}% FROM TRACKED PORTFOLIO PEAK`;
  }

  function getSimpleAgentWalletLabel() {
    const value = String(twakRegistration || "").toUpperCase();

    if (!value) return "CHECK NOT LOADED";
    if (value === "READY" || value === "READY_FOR_ONCHAIN_REGISTRATION") return "READY";
    if (value === "NOT_READY") return "NOT CONFIGURED";

    return value.replaceAll("_", " ");
  }

  function getDetailedStrategyQualityScore() {
    const directScore = agentResult?.signal_breakdown?.backtest_score;

    if (directScore !== undefined && directScore !== null && directScore !== "") {
      return directScore;
    }

    const riskScore = parseMetricNumber(
      agentResult?.risk_adjusted_score ??
      agentResult?.backtest?.risk_adjusted_score ??
      result?.backtest?.risk_adjusted_score,
      null
    );

    if (riskScore === null) return "N/A";
    if (riskScore >= 12) return 25;
    if (riskScore >= 9) return 20;
    if (riskScore >= 6) return 15;
    if (riskScore >= 3) return 8;

    return 0;
  }

  function getDetailedRiskConditionsScore() {
    const directScore = agentResult?.signal_breakdown?.drawdown_safety;

    if (directScore !== undefined && directScore !== null && directScore !== "") {
      return directScore;
    }

    const status = String(agentResult?.risk_control?.status || "").toUpperCase();

    if (status === "SAFE") return 15;
    if (status === "WARNING") return 5;
    if (status) return 0;

    return "N/A";
  }

  function getDetailedStrategyQualityLabel() {
    const score = getDetailedStrategyQualityScore();

    if (score === "N/A") return "NOT SCORED YET";
    if (Number(score) <= 0) return "0 / 25 — POOR BACKTEST SCORE";

    return `${score} / 25 FROM CURRENT SETUP BACKTEST`;
  }

  function getDetailedRiskConditionsLabel() {
    const score = getDetailedRiskConditionsScore();

    if (score === "N/A") return "N/A";

    return `${score} / 15 FROM CURRENT PORTFOLIO RISK`;
  }

  function getCurrentStopLossPctValue() {
    const tradePlan = getTradePlan();

    const rawValue =
      tradePlan?.stop_loss_pct ??
      tradePlan?.position_size?.stop_loss_pct ??
      agentResult?.backtest?.avg_loss ??
      result?.backtest?.avg_loss ??
      agentResult?.backtest?.largest_loss ??
      result?.backtest?.largest_loss;

    const parsed = Math.abs(parseMetricNumber(rawValue, NaN));

    return Number.isFinite(parsed) ? parsed : null;
  }

  function getCurrentTakeProfitPctValue() {
    const tradePlan = getTradePlan();

    const rawValue =
      tradePlan?.take_profit_pct ??
      tradePlan?.position_size?.take_profit_pct ??
      agentResult?.backtest?.avg_win ??
      result?.backtest?.avg_win ??
      agentResult?.backtest?.largest_profit ??
      result?.backtest?.largest_profit;

    const parsed = Math.abs(parseMetricNumber(rawValue, NaN));

    return Number.isFinite(parsed) ? parsed : null;
  }

  function getCurrentStopLossPctLabel() {
    const stopLossPct = getCurrentStopLossPctValue();

    return stopLossPct === null ? "N/A" : `${stopLossPct.toFixed(2)}%`;
  }

  function getAveragePossibleLossLabel() {
    const stopLossPct = getCurrentStopLossPctValue();
    const price = parseMetricNumber(
      agentResult?.cmc_signal?.price_usd ?? result?.cmc_signal?.price_usd,
      NaN
    );
    const requestedSize = parseMetricNumber(
      getTradePlan()?.requested_trade_size ?? getTradePlan()?.amount ?? tradeSize,
      NaN
    );

    if (stopLossPct === null || !Number.isFinite(price) || !Number.isFinite(requestedSize) || price <= 0 || requestedSize <= 0) {
      return "N/A";
    }

    const estimatedNotional = price * requestedSize;
    const estimatedLoss = estimatedNotional * ((stopLossPct + 0.1) / 100);

    return `${formatMoney(estimatedLoss)} EST. ON ${formatMoney(estimatedNotional)} TRADE SIZE`;
  }

  function getCurrentRiskRewardRatioLabel() {
    const stopLossPct = getCurrentStopLossPctValue();
    const takeProfitPct = getCurrentTakeProfitPctValue();

    if (stopLossPct === null || takeProfitPct === null || stopLossPct <= 0) return "N/A";

    return `1:${(takeProfitPct / stopLossPct).toFixed(2)}`;
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
RISK: ${getRiskProfileLabel(result.risk)}
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
      setTwakAgentChain(data.chain || "bsc");
    } catch (error) {
      alert("REGISTRATION CHECK FAILED");
    }
  }

  async function generateStrategy() {
    pulseButton("generate");
    setAutoOptimized(false);
    setSetupSource("generating_strategy");
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
      setAutoOptimized(false);
      setSetupSource("generated_strategy");
      saveAgentSetupToBackend({
        coin: data.coin || coin,
        timeframe: data.timeframe || timeframe,
        risk: data.risk || risk,
        selected_strategy: data.selected_strategy || null,
        result_snapshot: data,
        optimization: null,
        source: "generated_strategy",
      });
    } catch (error) {
      alert("FAILED TO CONNECT TO BACKEND");
    }

    setLoading(false);
    setLoadingMode("");
  }

  async function optimizeStrategy() {
    pulseButton("optimize");
    setAutoOptimized(false);
    setSetupSource("optimizer_running");
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
      setSetupSource("auto_optimization");

      const optimizedResult = {
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
          all_results: data.all_results,
          frequency_ranked_results: data.frequency_ranked_results
        }
      };

      setResult(optimizedResult);
      saveAgentSetupToBackend({
        coin: best.coin || coin,
        timeframe: best.timeframe,
        risk: best.risk,
        selected_strategy: best.selected_strategy,
        result_snapshot: optimizedResult,
        optimization: optimizedResult.optimization,
        source: "auto_optimization",
      });
    } catch (error) {
      alert("FAILED TO CONNECT TO OPTIMIZER");
    }

    setLoading(false);
    setLoadingMode("");
  }

async function runAgentCycle() {
  if (!requireOperatorMode("RUN AGENT")) return;

  pulseButton("run");
  focusAgentActivitySections();
  setLoading(true);
  setLoadingMode("agent");

  try {
    const selectedExecutionMode = getExecutionModeForPayload();

    const response = await fetch(`${API_BASE}/agent-cycle`, {
      method: "POST",
      headers: getOperatorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        coin,
        timeframe,
        risk,
        trade_size: tradeSize,
        live_execution: selectedExecutionMode === "live_trading",
        execution_mode: selectedExecutionMode,
        selected_strategy: manualStrategy || result?.selected_strategy || null,
      }),
    });

    if (await handleLockedResponse(response)) return;

    const data = await response.json();
    setAgentResult(data);

    if (data.paper_portfolio) {
      setPaperPortfolio(data.paper_portfolio);
    } else if (getCurrentExecutionMode() === "paper_trading") {
      await loadPaperPortfolio();
    }

    await loadPortfolio();
    await loadTradeHistory();

    if (!autonomousMode) {
      await startAutonomousMode();
    }
  } catch (err) {
    console.error(err);
    alert("AGENT CYCLE FAILED");
  } finally {
    setLoading(false);
    setLoadingMode("");
  }
}

  async function loadPortfolio() {
    setPortfolioLoading(true);

    try {
      const response = await fetch(`${API_BASE}/portfolio`);
      const data = await response.json();

      if (data?.agent_address) {
        setTwakAgentAddress(data.agent_address);
      }

      if (data?.chain || data?.agent_chain || data?.result?.chain) {
        setTwakAgentChain(data.chain || data.agent_chain || data.result.chain);
      }

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

let startingValue = startingPortfolioValue;
let baselineTimestamp = startingPortfolioTimestamp;

if (startingValue === null) {
  startingValue = totalUsdValue;
  baselineTimestamp = new Date().toISOString();

  setStartingPortfolioValue(startingValue);
  setStartingPortfolioTimestamp(baselineTimestamp);

  if (typeof window !== "undefined") {
    window.localStorage.setItem("ikqf_starting_portfolio_value", String(startingValue));
    window.localStorage.setItem("ikqf_starting_portfolio_timestamp", baselineTimestamp);
  }
}

setPortfolio({
  success: data?.success === true,
  assets,
  totalUsdValue,
  startingPortfolioValue: startingValue,
  startingPortfolioTimestamp: baselineTimestamp,
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
  if (!requireOperatorMode("RESET PAPER PORTFOLIO")) return;

  pulseButton("resetPaper");

  try {
    const response = await fetch(`${API_BASE}/paper-portfolio/reset`, {
      method: "POST",
      headers: getOperatorHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        starting_balance_usdt: paperStartingBalance,
      }),
    });

    if (await handleLockedResponse(response)) return;

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

  const baselineTimestamp = new Date().toISOString();

  setStartingPortfolioValue(portfolio.totalUsdValue);
  setStartingPortfolioTimestamp(baselineTimestamp);

  if (typeof window !== "undefined") {
    window.localStorage.setItem("ikqf_starting_portfolio_value", String(portfolio.totalUsdValue));
    window.localStorage.setItem("ikqf_starting_portfolio_timestamp", baselineTimestamp);
  }

  setPortfolio({
    ...portfolio,
    startingPortfolioValue: portfolio.totalUsdValue,
    startingPortfolioTimestamp: baselineTimestamp,
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
            <div
              className="operator-lock-panel"
              style={{
                marginTop: "10px",
                padding: "10px",
                border: operatorUnlocked ? "1px solid #9cff8f" : "1px solid #ffffff",
                boxShadow: operatorUnlocked ? "0 0 12px rgba(156, 255, 143, 0.45)" : "none",
              }}
            >
              <div className="version-menu-title">
                {operatorUnlocked ? "OPERATOR MODE: UNLOCKED" : "OPERATOR MODE: LOCKED"}
              </div>
              <input
                type="password"
                value={operatorKey}
                disabled={operatorUnlocked}
                placeholder="OPERATOR PASSWORD"
                onChange={(e) => setOperatorKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !operatorUnlocked) unlockOperatorMode();
                }}
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "9px",
                  background: "#020502",
                  color: "#9cff8f",
                  border: "1px solid #9cff8f",
                  fontFamily: "Courier New, monospace",
                  fontSize: "12px",
                }}
              />
              <button
                type="button"
                className={operatorUnlocked ? "version-menu-option active" : "version-menu-option"}
                onClick={operatorUnlocked ? lockOperatorMode : unlockOperatorMode}
              >
                {operatorUnlocked ? "LOCK CONTROLS" : "UNLOCK CONTROLS"}
              </button>
              <p style={{ marginTop: "8px", fontSize: "10px", lineHeight: "1.35" }}>
                PUBLIC VISITORS CAN WATCH. ONLY THE OPERATOR CAN START, STOP, OR EXECUTE.
              </p>
            </div>
            <button
              type="button"
              className={viewMode === "simple" ? "version-menu-option active" : "version-menu-option"}
              onClick={() => {
                setViewMode("simple");
                setExpandedDetailedQuadrant(null);
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
                setExpandedSimpleQuadrant(null);
                setOptionsMenuOpen(false);
              }}
            >
              DETAILED VERSION
            </button>
            <button
              type="button"
              className={viewMode === "full" ? "version-menu-option active" : "version-menu-option"}
              onClick={() => {
                setViewMode("full");
                setExpandedSimpleQuadrant(null);
                setExpandedDetailedQuadrant(null);
                setOptionsMenuOpen(false);
              }}
            >
              FULL SIZE VERSION
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
    const txHash = getLatestLiveTxHash();
    const latestRealTrade = getLatestLiveTradeLogEntry();
    const selectedStrategy = getSimpleSelectedStrategyLabel();
    const marketRegime = getSimpleMarketRegimeLabel();
    const confidenceLabel = agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "not scored yet";
    const riskStatus = agentResult?.risk_control?.status || "not checked yet";
    const portfolioValue = formatMoney(portfolio?.totalUsdValue || paperPortfolio?.total_value_usdt || 0);
    const executionSource = getExecutionSourceLabel();
    const simpleTxStatus = tradePlan ? getExecutionTxStatus() : "WAITING FOR APPROVED TRADE";
    const simpleExecutionRoute = tradePlan ? getExecutionRouteLabel() : "ROUTE APPEARS AFTER TRADE PLAN";
    const simpleTxHash = txHash ? shortenHash(txHash) : (latestRealTrade ? "LIVE TRADE LOGGED - TX HASH NOT RETURNED BY TWAK" : "ONLY AFTER LIVE ON-CHAIN EXECUTION");

    return (
      <div className="retro-page">
        <div className={`simple-square ${expandedSimpleQuadrant ? "simple-has-expanded" : ""}`}>
          <section className={getSimpleQuadrantClass("intro", "simple-quadrant simple-q-intro")}>
            <div className="simple-quadrant-header">
              <span>WHO?</span>
              {renderSimpleExpandButton("intro")}
            </div>
            <div className="simple-quadrant-body">
              <div className="simple-brand-block">
                <p className="simple-kicker">IKQF v0.1.0 — AI ONLINE</p>
                <h1 className="simple-square-title">
                  I KNOW QUANT FU<span className="blink">_</span>
                </h1>
                <p className="simple-brand-slogan">ROUNDHOUSE KICK DUMB TRADES.</p>
                <p className="simple-brand-subline">Backtest the signal. Lock the risk. Automate the move.</p>
                <p className="simple-speech-text">
                  I Know Quant Fu is an autonomous AI trading agent for crypto. I read live market conditions,
                  test strategy logic, check portfolio risk, explain my decision, and only then decide whether
                  to wait, simulate, paper trade, or execute.
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
                <div className="simple-status-box">
                  <span>USER WALLET</span>
                  <strong>{walletAddress ? "IS CONNECTED" : "IS NOT CONNECTED"}</strong>
                </div>

                <div className="simple-status-box">
                  <span>OPERATOR</span>
                  <strong>{operatorUnlocked ? "UNLOCKED" : "LOCKED"}</strong>
                </div>
              </div>

              <div className="simple-message-box">
                <strong>TRANSLATION FOR HUMANS</strong>
                <p>
                  I do not chase candles. I do not panic-click green buttons. I check the math before entering the dojo.
                </p>
              </div>

              <div className="simple-message-box">
                <strong>POWERED BY</strong>
                <p>
                  CoinMarketCap market intelligence → Trust Wallet Agent Kit → PancakeSwap execution routing → BNB Smart Chain infrastructure.
                </p>
              </div>
            </div>
          </section>

          <section className={getSimpleQuadrantClass("market", "simple-quadrant simple-q-market")}>
            <div className="simple-quadrant-header">
              <span>WHAT?</span>
              {renderSimpleExpandButton("market")}
            </div>
            <div className="simple-quadrant-body">
              <p className="simple-speech-text">
                I continuously scan the market, compare strategy performance, backtest trade ideas, evaluate portfolio risk, and generate explainable AI trade decisions.
              </p>

              <div className="simple-metric-row"><span>SIGNAL ASSET</span><strong>{getSignalAssetLabel()}</strong></div>
              <div className="simple-metric-row"><span>TIMEFRAME</span><strong>{result?.timeframe || timeframe}</strong></div>
              <div className="simple-metric-row"><span>MARKET REGIME</span><strong>{marketRegime}</strong></div>
              <div className="simple-metric-row"><span>SELECTED STRATEGY</span><strong>{selectedStrategy}</strong></div>
              <div className="simple-metric-row"><span>SETUP STATUS</span><strong>{getSimpleSetupStatusLabel()}</strong></div>
              <div className="simple-metric-row"><span>CONFIDENCE</span><strong>{confidenceLabel}</strong></div>

              <div className="simple-message-box">
                <strong>MY LOOP</strong>
                <p>
                  I read the market, choose the strongest available strategy, score the confidence, check drawdown, then decide: wait, simulate, paper trade, or execute.
                </p>
              </div>

              <div className="simple-message-box">
                <strong>TERMINAL RULE</strong>
                <p>No confidence. No trade. No logic. No trade. The candle must earn the roundhouse.</p>
              </div>
            </div>
          </section>

          <section className={getSimpleQuadrantClass("controls", "simple-quadrant simple-q-controls")}>
            <div className="simple-quadrant-header">
              <span>WHEN?</span>
              {renderSimpleExpandButton("controls")}
            </div>
            <div className="simple-quadrant-body">
              <p className="simple-speech-text">
                You set the mission. I scan on schedule, but I only act after a closed candle, a valid signal, and risk approval.
              </p>

              <div className="simple-message-box simple-operator-brief">
                <strong>OPERATOR FLOW</strong>
                <p>Choose the asset, mode, interval, and size. Then optimize, connect, and run the agent.</p>
              </div>

              <div className="simple-metric-row"><span>SETUP</span><strong>{coin} / {timeframe} / {getExecutionModeLabel()}</strong></div>
              <div className="simple-metric-row"><span>OPTIMIZER</span><strong>{autoOptimized ? "SETUP AUTO-OPTIMIZED" : "READY TO RANK STRATEGIES"}</strong></div>
              <div className="simple-metric-row"><span>CHECKS</span><strong>EVERY {autonomousInterval} MINUTES</strong></div>
              <div className="simple-metric-row"><span>TRIGGER</span><strong>CLOSED {timeframe} CANDLE + VALID SIGNAL</strong></div>
              <div className="simple-metric-row"><span>RISK</span><strong>{getRiskProfileLabel(risk)}</strong></div>

              <div className="simple-action-grid simple-terminal-actions">
                <button onClick={optimizeStrategy} disabled={loading} style={getButtonStyle("optimize")}>
                  {loading && loadingMode === "optimize" ? "OPTIMIZING..." : autoOptimized ? "OPTIMIZED" : "> OPTIMIZE <"}
                </button>
                <button onClick={connectWallet} disabled={loading} style={getButtonStyle("wallet")}>
                  {walletAddress ? "WALLET OK" : "> WALLET <"}
                </button>
                <button onClick={runAgentCycle} disabled={loading} style={getButtonStyle("run")}>
                  {loading && loadingMode === "agent" ? (
                    <>
                      RUNNING<span className="loading-dots"></span>
                    </>
                  ) : autonomousMode ? (
                    "RUNNING"
                  ) : (
                    "> RUN <"
                  )}
                </button>
                <button onClick={stopAutonomousMode} disabled={loading} style={getButtonStyle("stop")}>
                  {agentStopConfirmed && !autonomousMode ? "STOPPED" : "> STOP <"}
                </button>
              </div>

              <details className="simple-control-drawer">
                <summary>OPERATOR CONTROLS</summary>
                <div className="simple-control-grid simple-terminal-controls">
                  <div>
                    <label>ASSET</label>
                    <select value={coin} disabled={loading} onChange={(e) => handleManualSetupChange({ coin: e.target.value }, true)} onWheel={(e) => e.currentTarget.blur()}>
                      <option value="ETH">Ethereum (ETH)</option>
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
                      <option value="FIL">Filecoin (FIL)</option>
                      <option value="FET">Fetch.ai (FET)</option>
                      <option value="PENDLE">Pendle (PENDLE)</option>
                      <option value="FLOKI">Floki (FLOKI)</option>
                      <option value="1INCH">1inch (1INCH)</option>
                    </select>
                  </div>
                  <div>
                    <label>MODE</label>
                    <select
                      value={executionMode || ""}
                      disabled={autonomousMode || loading}
                      onChange={(e) => {
                        const mode = e.target.value;
                        handleManualSetupChange({
                          execution_mode: mode,
                          live_execution: mode === "live_trading",
                        }, false);
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                    >
                      <option value="" disabled>Execution Mode</option>
                      <option value="decision_simulation">Simulation Mode</option>
                      <option value="paper_trading">Paper Mode</option>
                      <option value="live_trading">Live Mode</option>
                    </select>
                  </div>
                  <div>
                    <label>INTERVAL</label>
                    <select
                      value={autonomousInterval}
                      disabled={autonomousMode}
                      onChange={(e) => handleManualSetupChange({ interval_minutes: Number(e.target.value) }, false)}
                      onWheel={(e) => e.currentTarget.blur()}
                    >
                      <option value={1}>1 MINUTE</option>
                      <option value={5}>5 MINUTES</option>
                      <option value={15}>15 MINUTES</option>
                      <option value={30}>30 MINUTES</option>
                    </select>
                  </div>
                  <div>
                    <label>SIZE ({coin})</label>
                    <input type="number" min="0" step="0.001" value={tradeSize} disabled={loading} onChange={(e) => handleManualSetupChange({ trade_size: Number(e.target.value) }, false)} />
                  </div>
                </div>
              </details>

              <div className="simple-message-box simple-rule-box">
                <strong>TIMING RULE</strong>
                <p>I can check often. I still wait for confirmation. Signal tested. Ego rejected.</p>
              </div>

              <div className="simple-metric-row"><span>RISK STATUS</span><strong>{riskStatus}</strong></div>
              <div className="simple-metric-row"><span>DRAWDOWN</span><strong>{getSimplePortfolioDrawdownLabel()}</strong></div>
              <div className="simple-metric-row"><span>PORTFOLIO</span><strong>{portfolioValue}</strong></div>
            </div>
          </section>

          <section
            ref={simpleProofRef}
            className={`${getSimpleQuadrantClass("proof", "simple-quadrant simple-q-proof")} ${autonomousMode ? "agent-active-glow" : ""}`}
          >
            <div className="simple-quadrant-header">
              <span>HOW?</span>
              {renderSimpleExpandButton("proof")}
            </div>
            <div className="simple-quadrant-body">
              <p className="simple-speech-text">
                I show the proof before the punchline. Strategy first. Risk second. Execution last.
              </p>

              <div className="simple-message-box simple-proof-snapshot">
                <strong>STRATEGY PROOF</strong>
                {result ? (
                  <div className="simple-proof-grid">
                    <div><span>STRATEGY</span><strong>{result.selected_strategy || selectedStrategy}</strong></div>
                    <div><span>STATUS</span><strong>{isApproved() ? "APPROVED" : "REJECTED"}</strong></div>
                    <div><span>RATING</span><strong>{getOverallRating()}</strong></div>
                    <div><span>RETURN</span><strong>{result.backtest?.net_return || "N/A"}</strong></div>
                    <div><span>MAX DD</span><strong>{result.backtest?.max_drawdown || "N/A"}</strong></div>
                    <div><span>WIN RATE</span><strong>{result.backtest?.win_rate || "N/A"}</strong></div>
                    <div><span>PROFIT FACTOR</span><strong>{result.backtest?.profit_factor || "N/A"}</strong></div>
                    <div><span>EDGE</span><strong>{parsePercent(result.backtest?.expectancy) > 0 ? "POSITIVE" : "NEGATIVE"}</strong></div>
                  </div>
                ) : (
                  <p className="simple-proof-empty">Run auto-optimize to see rating, return, drawdown, win rate, and profit factor.</p>
                )}
              </div>

              <div className="simple-micro-copy">No proof. No roundhouse.</div>

              <div className="simple-metric-row simple-agent-current-state"><span>I AM</span><strong>{autonomousMode ? "RUNNING" : "STOPPED"}</strong></div>
              <div className="simple-metric-row"><span>DECISION</span><strong>{executionStatus.status}</strong></div>
              <div className="simple-metric-row"><span>DID I TRADE?</span><strong>{executionStatus.executed}</strong></div>
              <div className="simple-metric-row"><span>TX STATUS</span><strong>{simpleTxStatus}</strong></div>
              <div className="simple-metric-row"><span>SIGNAL</span><strong>{getSignalAssetLabel()}</strong></div>
              <div className="simple-metric-row"><span>ROUTE</span><strong>{simpleExecutionRoute}</strong></div>
              <div className="simple-metric-row"><span>LAYER</span><strong>{executionSource}</strong></div>
              <div className="simple-metric-row"><span>WALLET</span><strong>{getSimpleAgentWalletLabel()}</strong></div>
              <div className="simple-metric-row"><span>ADDRESS</span><strong>{shortenAddress(twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C")}</strong></div>
              <div className="simple-metric-row"><span>TX HASH</span><strong>{simpleTxHash}</strong></div>
              {tradePlan && (
                <div className="simple-metric-row"><span>SIZE</span><strong>{tradePlan.requested_trade_size ?? tradeSize} {tradePlan.requested_trade_size_token || coin}</strong></div>
              )}

              <div className="simple-message-box simple-rule-box">
                <strong>LAST EXPLANATION</strong>
                <p>{agentResult?.reason || autonomousStatus?.last_reason || executionStatus.reason}</p>
              </div>

              <div className="simple-message-box">
                <strong>LAST LIVE TRADE</strong>
                <p>{latestRealTrade ? `${formatDateTime(latestRealTrade.timestamp)} // ${latestRealTrade.decision || latestRealTrade.event || "TRADE LOGGED"}` : "No real trade loaded yet."}</p>
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
            <span>v0.1.0</span>
            {renderDetailedExpandButton("who")}
          </div>

          <div className="retro-quadrant-body">
            <div className="retro-brand-card">
              <div className="topbar retro-topbar">
                <span>IKQF v0.1.0 — AI ONLINE</span>
              </div>

              <h1 className="title retro-title ikqf-terminal-title">
                I KNOW QUANT FU<span className="blink">_</span>
              </h1>

              <p className="subtitle retro-subtitle">ROUNDHOUSE KICK DUMB TRADES.</p>
              <p className="retro-brand-subline"><strong>Backtest the signal. Lock the risk. Automate the move.</strong></p>

              <div className="hero-description retro-hero-description">
                I Know Quant Fu is an AI trading agent powered by CoinMarketCap market intelligence,
                Trust Wallet Agent Kit, PancakeSwap execution routing,
                and BNB Smart Chain infrastructure.
              </div>

              <div className="metrics retro-mini-window detailed-human-translation">
                <p>I Know Quant Fu turns noisy crypto market data into explainable autonomous trading decisions.</p>
                <br />
                <p><strong>Translation for humans:</strong></p>
                <p>I do not chase candles.</p>
                <p>I do not panic-click green buttons.</p>
                <p>I test the signal before I enter the dojo.</p>
              </div>
            </div>

            {agentResult && (
              <details className="retro-window">
                <summary>ON-CHAIN VERIFICATION</summary>
                <div className="metrics strategy-library-box verification-panel">
                  <p><strong>ON-CHAIN VERIFICATION</strong></p>
                  <p>AGENT ADDRESS........ {shortenAddress(twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C")}</p>
                  <p>SELECTED ASSET..... {coin}</p>
                  <p>TOKEN STATUS....... {coin} / CMC-LISTED ASSET</p>
                  <p>NETWORK............ BNB SMART CHAIN</p>
                  <p>LAST TX HASH....... {getLatestLiveTxHash() || "NO LIVE TX HASH STORED YET"}</p>
                  {getLatestLiveTxHash() && (
                    <p>BSCSCAN............ https://bscscan.com/tx/{getLatestLiveTxHash()}</p>
                  )}
                </div>
              </details>
            )}
          </div>
        </section>

        <section className={getDetailedQuadrantClass("what", "retro-quadrant retro-what")}>
          <div className="retro-quadrant-header">
            <span>WHAT?</span>
            {renderDetailedExpandButton("what")}
          </div>

          <div className="retro-quadrant-body">
            <details className="retro-window" open>
              <summary>WHAT DO I DO?</summary>
              <div className="metrics detailed-copy-block">
                <p>I continuously analyze market conditions, compare strategy performance, backtest multiple approaches, evaluate portfolio risk, and generate explainable AI trade decisions.</p>
                <br />
                <p><strong>I can operate in:</strong></p>
                <p>DECISION SIMULATION</p>
                <p>PAPER TRADING</p>
                <p>LIVE TRADING MODE</p>
                <br />
                <p><strong>Before any trade is approved, every decision passes through:</strong></p>
                <p>MARKET REGIME ANALYSIS</p>
                <p>STRATEGY VALIDATION</p>
                <p>CONFIDENCE SCORING</p>
                <p>DRAWDOWN PROTECTION</p>
                <p>PORTFOLIO RISK CONTROLS</p>
                <p>EXECUTION SAFETY CHECKS</p>
                <br />
                <p>No confidence. No trade.</p>
                <p>No logic. No trade.</p>
                <p>No dojo. No roundhouse.</p>
              </div>
            </details>

            <details className="retro-window detailed-proof-banner" open>
              <summary>JUDGE SNAPSHOT / PROOF FIRST</summary>
              <div className="metrics detailed-proof-grid">
                <p><strong>WHAT AM I DOING NOW?</strong></p>
                <p>AGENT STATUS........ {getAgentRuntimeStatusLabel()}</p>
                <p>MODE................ {getExecutionModeLabel()}</p>
                <p>LAST DECISION....... {getExecutionAction()}</p>
                <p>ACTIVE STRATEGY..... {getActiveStrategyLabel()}</p>
                <p>STRATEGY RATING..... {result ? `${getOverallRating()} — ${getRatingExplanation()}` : "WAITING FOR BACKTEST"}</p>
                <p>BACKTEST RETURN..... {result?.backtest?.net_return || "N/A"}</p>
                <p>MAX DRAWDOWN........ {result?.backtest?.max_drawdown || "N/A"}</p>
                <p>WIN RATE............ {result?.backtest?.win_rate || "N/A"}</p>
                <p>PROFIT FACTOR....... {result?.backtest?.profit_factor || "N/A"}</p>
                <p>RISK PROFILE........ {getRiskProfileLabel(result?.risk || risk)}</p>
                <p>RISK STATUS......... {agentResult?.risk_control?.status || "WAITING"}</p>
                <p>TERMINAL COMMENT.... {getFullTerminalComment()}</p>
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
                  <div>BNB SMART CHAIN</div>
                </div>
              </div>
            </details>

            <details
              ref={agentStatusRef}
              className="retro-window"
            >
              <summary><span className={autonomousMode ? "detailed-agent-text-glow" : ""}>AGENT STATUS</span></summary>
              <div className="metrics strategy-library-box">
                <p>AGENT STATUS....... {getAgentRuntimeStatusLabel()}</p>
                <p>ACTIVE STRATEGY.... {getActiveStrategyLabel()}</p>
                <p>BROWSER WALLET....... {walletAddress ? `CONNECTED: ${shortenAddress(walletAddress)}` : "NOT CONNECTED"}</p>
                <p>BROWSER NETWORK.... {getUserNetworkLabel()}</p>
                <p>AGENT NETWORK...... {getAgentNetworkLabel()}</p>
                <p>AGENT BNB BALANCE.... {getBnbBalanceLabel()}</p>
                <p>AGENT TOTAL VALUE.... {formatMoney(portfolio?.totalUsdValue || 0)}</p>
                <p>AGENT ADDRESS........ {shortenAddress(twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C")}</p>
                <p>SELECTED TIMEFRAME.. {timeframe}</p>
                <p>SIGNAL ASSET........ {getSignalAssetLabel()}</p>
                <p>TRADE SIZE.......... {tradeSize} {getSignalAssetLabel()} TARGET</p>
                <p>TRADE CONFIDENCE..... {agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "WAITING"}</p>
                <p>DRAWDOWN............. {agentResult?.risk_control?.current_drawdown_pct !== undefined ? `${agentResult.risk_control.current_drawdown_pct}%` : "WAITING"}</p>
                <p>RISK STATUS.......... {agentResult?.risk_control?.status || "WAITING"}</p>
                <p>PAPER VALUE.......... {paperPortfolio ? formatMoney(paperPortfolio.total_value_usdt) : "N/A"}</p>
                <p>TWAK................. {twakStatus || "CONFIGURED"}</p>
              </div>
            </details>

            <details className="retro-window">
              <summary>PORTFOLIO</summary>
              <div className="metrics autonomous-section detailed-portfolio-panel">
                {portfolio?.assets?.length > 0 ? (
                  portfolio.assets.map((asset, index) => (
                    <p key={index}>
                      {asset.symbol}.................. {formatAssetBalance(asset.balance)}      {formatMoney(asset.usdValue)}
                    </p>
                  ))
                ) : portfolioLoading ? (
                  <p>LOADING AGENT WALLET ASSETS...</p>
                ) : (
                  <p>NO AGENT WALLET ASSETS LOADED</p>
                )}

                <br />

                <p>TOTAL VALUE.......... {formatMoney(portfolio?.totalUsdValue || 0)}</p>
                <p>START VALUE.......... {getPortfolioStartValueOnlyLabel()}</p>
                <p>BASELINE DATE........ {formatPortfolioBaselineDateOnly(portfolio?.startingPortfolioTimestamp)}</p>
                <p>
                  PORTFOLIO CHANGE.....{" "}
                  {Number(portfolio?.tradingPnlUsd || 0) >= 0 ? "+" : "-"}$
                  {Math.abs(Number(portfolio?.tradingPnlUsd || 0)).toFixed(2)}
                </p>
                <button onClick={resetPnlBaseline} className="copy-btn" style={{ marginTop: "12px", ...getButtonStyle("resetPnl") }}>
                  {"> RESET PORTFOLIO BASELINE <"}
                </button>
              </div>
            </details>

            {getCurrentExecutionMode() === "paper_trading" && (
              <details className="retro-window">
                <summary>PAPER PORTFOLIO</summary>
                <div className="metrics autonomous-section">
                  <p>STARTING VALUE..... {formatMoney(paperPortfolio?.starting_balance_usdt || paperStartingBalance)}</p>
                  <p>CURRENT VALUE...... {formatMoney(paperPortfolio?.total_value_usdt || paperStartingBalance)}</p>
                  <p>CASH USDT.......... {formatMoney(paperPortfolio?.cash_usdt || 0)}</p>
                  <p>BNB HOLDINGS....... {paperPortfolio?.bnb_balance ?? 0} BNB</p>
                  <br />
                  <p>PAPER REALIZED..... {formatMoney(paperPortfolio?.realized_pnl_usdt || 0)}</p>
                  <p>PAPER UNREALIZED... {formatMoney(paperPortfolio?.unrealized_pnl_usdt || 0)}</p>
                  <p>PAPER CHANGE....... {formatMoney(paperPortfolio?.total_pnl_usdt || 0)}</p>
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
                  {loading && loadingMode === "agent" ? (
      <>
        RUNNING AGENT<span className="loading-dots"></span>
      </>
    ) : autonomousMode ? (
      "AGENT RUNNING"
    ) : activeButton === "run" ? (
      "> RUNNING... <"
    ) : (
      "> RUN AGENT <"
    )}
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
                  <select value={coin} disabled={loading} onChange={(e) => handleManualSetupChange({ coin: e.target.value }, true)} onWheel={(e) => e.currentTarget.blur()}>
                    <option value="ETH">Ethereum (ETH)</option>
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
                    <option value="FIL">Filecoin (FIL)</option>
                    <option value="FET">Fetch.ai (FET)</option>
                    <option value="PENDLE">Pendle (PENDLE)</option>
                    <option value="FLOKI">Floki (FLOKI)</option>
                    <option value="1INCH">1inch (1INCH)</option>
                  </select>
                </div>

                <div>
                  <label>TIMEFRAME</label>
                  <select value={timeframe} disabled={loading} onChange={(e) => handleManualSetupChange({ timeframe: e.target.value }, true)} onWheel={(e) => e.currentTarget.blur()}>
                    <option value="5M">5M</option>
                    <option value="15M">15M</option>
                    <option value="1H">1H</option>
                    <option value="4H">4H</option>
                    <option value="1D">1D</option>
                  </select>
                </div>

                <div>
                  <label>RISK PROFILE</label>
                  <select value={risk} disabled={loading} onChange={(e) => handleManualSetupChange({ risk: e.target.value }, true)} onWheel={(e) => e.currentTarget.blur()}>
                    <option value="low">CONSERVATIVE</option>
                    <option value="medium">BALANCED</option>
                    <option value="high">AGGRESSIVE / GOVERNED</option>
                  </select>
                </div>

                <div>
                  <label>BACKTEST CAPITAL</label>
                  <div className="capital-input">
                    <span>$</span>
                    <input type="number" min="100" step="100" value={initialCapital} disabled={loading} onChange={(e) => handleManualSetupChange({ initial_capital: Number(e.target.value) }, true)} />
                  </div>
                </div>

                <div>
                  <label>TRADE SIZE ({coin})</label>
                  <div className="capital-input trade-size-input">
                    <input type="number" min="0" step="0.001" value={tradeSize} disabled={loading} onChange={(e) => handleManualSetupChange({ trade_size: Number(e.target.value) }, false)} />
                  </div>
                </div>
              </div>

              {result && (
                <div className="metrics strategy-library-box" style={{ marginTop: "26px" }}>
                  <p>AUTO-OPTIMIZER SELECTED TIMEFRAME..... {result.timeframe || timeframe}</p>
                  <p>AUTO-OPTIMIZER SELECTED STRATEGY...... {result.selected_strategy || "N/A"}</p>
                  <p>AUTO-OPTIMIZER SELECTED RISK.......... {getRiskProfileLabel(result.risk || risk)}</p>
                </div>
              )}

              <h2 className="strategy-library-title">CUSTOM SETUP</h2>
              <div className="agent-control-panel">
                <button onClick={generateStrategy} disabled={loading} className="copy-btn" style={getButtonStyle("generate")}>
                  {loading && loadingMode === "generate" ? "GENERATING..." : "> GENERATE STRATEGY <"}
                </button>

                <div>
                  <select
                    value={executionMode || ""}
                    disabled={autonomousMode || loading}
                    onChange={(e) => {
                      const mode = e.target.value;
                      handleManualSetupChange({
                        execution_mode: mode,
                        live_execution: mode === "live_trading",
                      }, false);
                    }}
                  onWheel={(e) => e.currentTarget.blur()}
                  >
                    <option value="" disabled>Execution Mode</option>
                    <option value="decision_simulation">Simulation Mode</option>
                    <option value="paper_trading">Paper Mode</option>
                    <option value="live_trading">Live Mode</option>
                  </select>
                </div>

                <label style={{ gridColumn: "1 / -1", textAlign: "center", marginTop: "10px" }}>
                  AUTO CHECK FOR NEW TRADE OPPORTUNITY EVERY
                </label>

                <select
  value={autonomousInterval}
  disabled={autonomousMode}
  onChange={(e) => handleManualSetupChange({ interval_minutes: Number(e.target.value) }, false)}
  onWheel={(e) => e.currentTarget.blur()}
>
                  <option value={1}>1 MINUTE</option>
                  <option value={5}>5 MINUTES</option>
                  <option value={15}>15 MINUTES</option>
                  <option value={30}>30 MINUTES</option>
                </select>

                <div className="metrics strategy-library-box timing-logic-note">
                  <p><strong>TIMING LOGIC</strong></p>
                  <p>I can check every {autonomousInterval} minutes, but I only act when the selected strategy has confirmed. If the setup is based on a closed {timeframe} candle, I wait for that close before approving a trade.</p>
                  <p>Terminal note: the candle is not worthy until the rules say so.</p>
                </div>
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
                  <p>TRADE TIMING........ CHECKS EVERY {autonomousInterval} MINUTES / ACTS ON CONFIRMED {timeframe} STRATEGY CANDLES</p>
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
            <span>HOW?</span>
            <span>LOGIC + PROOF</span>
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
                    <p>ACTIVE STRATEGY.... {getActiveStrategyLabel()}</p>
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

            <details
              ref={liveAgentActivityRef}
              className="retro-window trade-log-window"
              open
            >
              <summary><span className={autonomousMode ? "detailed-agent-text-glow" : ""}>LIVE AGENT ACTIVITY</span></summary>
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
                      const tradeTypeLabel = getTradeLogTypeLabel(trade);
                      const isRealTrade = tradeTypeLabel === "REAL TRADE / EXECUTION";

                      if (status === "portfolio_check") return false;
                      if (showOnlyRealTrades && !isRealTrade) return false;
                      return true;
                    })
                    .slice()
                    .reverse()
                    .map((trade, index) => {
                      const executionResult = trade.execution_result || trade.result || {};
                      const tradePlan = trade.trade_plan || {};
                      const tradeTypeLabel = getTradeLogTypeLabel(trade);
                      const isRealTrade = tradeTypeLabel === "REAL TRADE / EXECUTION";
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
                          <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>TYPE: {tradeTypeLabel}</p>
                          <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>{timestamp}</p>
                          <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>EVENT: {getTradeLogEventLabel(trade)}</p>
                          {trade.confidence_score !== undefined && <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>TRADE CONFIDENCE: {trade.confidence_score} / 100</p>}
                          {trade.risk_control?.current_drawdown_pct !== undefined && <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>DRAWDOWN: {trade.risk_control.current_drawdown_pct}% / LIMIT {trade.risk_control.max_drawdown_limit_pct}%</p>}
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
                          {isRealTrade ? (
                          <p style={{ color: "#9cff8f" }}>REALIZED P/L: {getTradeLogPnlLabel(trade)}</p>
                        ) : (
                          <p style={{ color: "#808080" }}>EXECUTION RESULT: {getTradeLogNonExecutionLabel(trade)}</p>
                        )}
                        </div>
                      );
                    })}
              </div>
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
                  <p>TX HASH............. {getLatestLiveTxHash() || "NO LIVE TX HASH STORED YET"}</p>
                  {getExecutionTxHash() && (
                    <p>BSCSCAN............. https://bscscan.com/tx/{getExecutionTxHash()}</p>
                  )}
                  <p>SOURCE.............. {getExecutionSourceLabel()}</p>
                </div>
              </details>
            )}

            {agentResult?.confidence_score !== undefined && (
              <details className="retro-window" open>
                <summary>TRADE CONFIDENCE / WHY</summary>
                <div className="metrics strategy-library-box">
                  <p><strong>{getTradePlan()?.to_token === "BNB" || getTradePlan()?.from_token === "BNB" ? "BNB EXECUTION CONFIDENCE" : `${coin} TRADE CONFIDENCE`}</strong></p>
                  <p>OVERALL CONFIDENCE.... {agentResult.confidence_score} / 100</p>
                  <br />
                  <p><strong>CONFIDENCE BREAKDOWN</strong></p>
                  <p>MARKET TREND.......... {agentResult.signal_breakdown?.cmc_bias ?? "N/A"} / 30</p>
                  <p>FEAR & GREED.......... {agentResult.signal_breakdown?.fear_greed ?? "N/A"} / 20</p>
                  <p>ALTCOIN ROTATION...... {agentResult.signal_breakdown?.altcoin_season ?? "N/A"} / 10</p>
                  <p>STRATEGY QUALITY...... {getDetailedStrategyQualityLabel()}</p>
                  <p>RISK CONDITIONS....... {getDetailedRiskConditionsLabel()}</p>
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
                  <p>CURRENT STOP LOSS... {getCurrentStopLossPctLabel()}</p>
                  <p>AVG POSSIBLE LOSS... {getAveragePossibleLossLabel()}</p>
                  <p>SLIPPAGE + FEES..... 0.10%</p>
                  <p>RISK / REWARD....... {getCurrentRiskRewardRatioLabel()}</p>
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
                  <p>TRADE STYLE......... {result.backtest.trade_style || result.backtest.activity_profile?.trade_style || "N/A"}</p>
                  <p>SIGNALS / DAY....... {result.backtest.signals_per_day || result.backtest.activity_profile?.signals_per_day || "N/A"}</p>
                  <p>ACTIVE DAYS......... {result.backtest.active_days_pct || result.backtest.activity_profile?.active_days_pct || "N/A"}</p>
                  <p>MAX QUIET GAP....... {result.backtest.longest_quiet_gap || result.backtest.activity_profile?.longest_quiet_gap || "N/A"}</p>
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
                    <br />
                    <p>MARKET REGIME....... {getMarketRegime()}</p>
                    <p>STRATEGY MODE....... AUTO-SELECT BEST BACKTESTED STRATEGY</p>
                    <p>SELECTED STRATEGY... {result.selected_strategy}</p>
                    <p>OPTIMIZER PROFILE... {getRiskProfileLabel(result.risk)}</p>
                    <p>LAST DECISION....... {getAgentDecision()}</p>
                    <p>TRADE CONFIDENCE..... {agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "WAITING"}</p>
                    <p>RISK STATUS.......... {agentResult?.risk_control?.status || "WAITING"}</p>
                    <p>TRADE PLAN.......... {agentResult?.trade_plan ? "GENERATED" : "NONE"}</p>
                    <p>ACTION TAKEN........ {agentResult?.execution_result ? "EXECUTION ATTEMPTED" : "NONE"}</p>
                    <br />
                    <p>AGENT FLOW.......... COINMARKETCAP → MARKET ANALYSIS → STRATEGY ENGINE → CONFIDENCE MODEL → RISK GOVERNOR → TWAK → PANCAKESWAP → BNB SMART CHAIN</p>
                    <p>RULE ADHERENCE...... USER RISK LIMITS ENFORCED</p>
            <p>TERMINAL COMMENT.... {getFullTerminalComment()}</p>
                          </div>
                </details>

                <details className="retro-sub-window">
                  <summary>STRATEGY ACTIVITY PROFILE</summary>
                  <div className="metrics strategy-library-box">
                    <p><strong>HOW OFTEN DOES THIS STRATEGY TRADE?</strong></p>
                    <p>STYLE............... {result.backtest.trade_style || result.backtest.activity_profile?.trade_style || "N/A"}</p>
                    <p>STATUS.............. {result.backtest.activity_status || result.backtest.activity_profile?.activity_status || "N/A"}</p>
                    <p>SIGNALS / DAY....... {result.backtest.signals_per_day || result.backtest.activity_profile?.signals_per_day || "N/A"}</p>
                    <p>ACTIVE DAYS......... {result.backtest.active_days_pct || result.backtest.activity_profile?.active_days_pct || "N/A"}</p>
                    <p>AVG WAIT............ {result.backtest.avg_hours_between_signals || result.backtest.activity_profile?.avg_hours_between_signals || "N/A"}</p>
                    <p>MAX QUIET GAP....... {result.backtest.longest_quiet_gap || result.backtest.activity_profile?.longest_quiet_gap || "N/A"}</p>
                    <p>QUIET GAP STATUS.... {result.backtest.quiet_gap_status || result.backtest.activity_profile?.quiet_gap_status || "N/A"}</p>
                    <p>SAMPLE CONFIDENCE... {result.backtest.sample_confidence || result.backtest.activity_profile?.sample_confidence || "N/A"}</p>
                    <br />
                    <p>{result.backtest.activity_profile?.explanation || "Signal cadence appears here after the strategy is backtested."}</p>
                  </div>
                </details>

                {result.backtest.equity_curve && result.backtest.equity_curve.length > 1 && (
                  <details className="retro-sub-window equity-curve-window">
                    <summary>EQUITY CURVE</summary>
                    <div className="chart-box">
                      <ResponsiveContainer width="100%" height={270}>
                        <LineChart data={getEquityCurveData()} margin={{ top: 8, right: 16, left: 4, bottom: 62 }}>
                          <XAxis
                            dataKey="trade"
                            height={60}
                            tick={{ fontSize: 8, fill: "#9cff8f" }}
                            tickMargin={8}
                            tickLine={{ stroke: "#9cff8f" }}
                            axisLine={{ stroke: "#9cff8f" }}
                            label={{
                              value: "TRADES",
                              position: "insideBottom",
                              offset: 6,
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
                            labelFormatter={formatEquityTooltipLabel}
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
                    <p>BEST RISK MODEL..... {getRiskProfileLabel(result.risk)}</p>
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
                            <span>#{index + 1}</span><span>{item.timeframe}</span><span>{getRiskProfileLabel(item.risk)}</span><span>{item.selected_strategy}</span><span>{item.backtest.net_return}</span><span>{item.backtest.sharpe_ratio}</span><span>{item.backtest.calmar_ratio}</span><span>{item.backtest.profit_factor}</span><span>{item.backtest.max_drawdown}</span><span>{item.risk_adjusted_score}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </details>

                {result.optimization?.all_results && (
                  <details className="retro-sub-window">
                    <summary>SIGNAL FREQUENCY ANALYSIS</summary>
                    <div className="metrics strategy-library-box">
                      <p><strong>WHICH STRATEGIES ARE BOTH ACTIVE AND WORTH USING?</strong></p>
                      <p>Ranking rule: win rate must clear the floor first, then the table ranks by profit factor, lower drawdown, and finally signals per day.</p>
                      <p>WIN RATE FLOOR..... 30%</p>
                    </div>
                    {getFrequencyRankedResults()
                      .slice(0, 8)
                      .map((item, index) => (
                        <div className="metrics strategy-library-box" key={index}>
                          <p><strong>#{index + 1} {item.selected_strategy}</strong></p>
                          <p>TIMEFRAME.......... {item.timeframe}</p>
                          <p>RISK............... {String(item.risk).toUpperCase()}</p>
                          <p>STYLE.............. {item.backtest?.trade_style || "N/A"}</p>
                          <p>SIGNALS / DAY...... {item.backtest?.signals_per_day || "N/A"}</p>
                          <p>ACTIVE DAYS........ {item.backtest?.active_days_pct || "N/A"}</p>
                          <p>AVG WAIT........... {item.backtest?.avg_hours_between_signals || "N/A"}</p>
                          <p>MAX QUIET GAP...... {item.backtest?.longest_quiet_gap || "N/A"}</p>
                          <p>WIN FLOOR.......... {parseMetricNumber(item.backtest?.win_rate, 0) >= 30 ? "PASS" : "FAIL"}</p>
                          <p>WIN RATE........... {item.backtest?.win_rate || "N/A"}</p>
                          <p>PROFIT FACTOR...... {item.backtest?.profit_factor || "N/A"}</p>
                          <p>MAX DRAWDOWN....... {item.backtest?.max_drawdown || "N/A"}</p>
                        </div>
                      ))}
                  </details>
                )}

                <details className="retro-sub-window">
                  <summary>STRATEGY RULES</summary>
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
                    <p>TRADE STYLE......... {result.backtest.trade_style || "N/A"}</p>
                    <p>SIGNALS / DAY....... {result.backtest.signals_per_day || "N/A"}</p>
                    <p>ACTIVE DAYS......... {result.backtest.active_days_pct || "N/A"}</p>
                    <p>AVG WAIT............ {result.backtest.avg_hours_between_signals || "N/A"}</p>
                    <p>MAX QUIET GAP....... {result.backtest.longest_quiet_gap || "N/A"}</p>
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
                    <p>AVG BACKTEST P/L.... {result.backtest.avg_pnl}</p>
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
                    <p>I Know Quant Fu is an AI trading agent that combines CoinMarketCap market intelligence, proprietary strategy testing, portfolio risk management, Trust Wallet Agent Kit (TWAK), PancakeSwap routing, and BNB Smart Chain settlement.</p>
                    <p>The system continuously scans market conditions, compares multiple strategies, scores trade quality, evaluates risk, generates explainable AI decisions, and can operate in Simulation, Paper Trading, or Live Trading mode.</p>
                    <br />
                    <p><strong>EXECUTION MODES</strong></p>
                    <p>Decision Simulation: the agent generates and logs decisions only. No live trade and no virtual position is opened.</p>
                    <p>Paper Trading: the agent opens and closes virtual positions, tracks paper profit/loss, and can be reset without touching the live wallet.</p>
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

                  <div
                    className="trade-table strategy-backtest-scroll-table"
                    style={{ maxHeight: "220px", overflowY: "auto", overflowX: "auto" }}
                  >
                  <div className="trade-row trade-header">
                    <span>ENTRY TIME</span><span>EXIT TIME</span><span>ENTRY</span><span>EXIT</span><span>RESULT</span><span>P/L</span><span>DURATION</span>
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

          </div>
        </section>

        <div className="footer retro-footer">
          CMC AGENT HUB: OK &nbsp;&nbsp; TWAK: OK &nbsp;&nbsp; PANCAKESWAP: OK &nbsp;&nbsp; BNB CHAIN: OK &nbsp;&nbsp; BACKTEST ENGINE: OK &nbsp;&nbsp; OPTIMIZER: OK
        </div>
      </div>
    </div>
  );



  const renderFullSizeVersion = () => {
    const executionStatus = getExecutionStatus();

    const latestActivity = tradeHistory
      .filter((trade) => {
        const status = String(trade.status || "").toLowerCase();
        const tradeTypeLabel = getTradeLogTypeLabel(trade);
        const isRealTrade = tradeTypeLabel === "REAL TRADE / EXECUTION";

        if (status === "portfolio_check") return false;
        if (showOnlyRealTrades && !isRealTrade) return false;

        return true;
      })
      .slice()
      .reverse()
      .slice(0, 5);

    return (
      <div className="ikqf-full-v2-page">
        <main className="ikqf-full-v2-terminal">
          <header className="ikqf-full-v2-hero">
            <div className="ikqf-full-v2-topbar">
              <span>IKQF v0.1.0</span>
              <span>AI ONLINE</span>
            </div>

            <h1 className="ikqf-full-v2-title">
              I KNOW QUANT FU<span className="blink">_</span>
            </h1>

            <p className="ikqf-full-v2-slogan">ROUNDHOUSE KICK DUMB TRADES.</p>
            <p className="ikqf-full-v2-subline">Backtest the signal. Lock the risk. Automate the move.</p>

            <div className="ikqf-full-v2-intro">
              I Know Quant Fu is an AI trading agent that tests crypto strategies, reads market conditions,
              controls risk, and explains every decision before anything is simulated, paper traded, or executed.
            </div>
          </header>

          <section className="ikqf-full-v2-grid ikqf-full-v2-grid-top">
            <div className="ikqf-full-v2-panel">
              <div className="ikqf-full-v2-panel-title">CURRENT AGENT STATE</div>

              <div className="ikqf-full-v2-rows">
                <div><span>SIGNAL</span><strong>{getExecutionAction()}</strong></div>
                <div><span>MODE</span><strong>{getExecutionModeLabel()}</strong></div>
                <div><span>STRATEGY</span><strong>{getActiveStrategyLabel()}</strong></div>
                <div><span>STATUS</span><strong>{executionStatus.status}</strong></div>
                <div><span>TRADE EXECUTED</span><strong>{executionStatus.executed}</strong></div>
                <div><span>NEXT ACTION</span><strong>{executionStatus.nextAction}</strong></div>
              </div>

              <div className="ikqf-full-v2-comment">{getFullTerminalComment()}</div>
              <p className="ikqf-full-v2-reason">{executionStatus.reason}</p>
            </div>

            <div className="ikqf-full-v2-panel">
              <div className="ikqf-full-v2-panel-title">QUICK START</div>

              <div className="ikqf-full-v2-button-grid">
                <button onClick={optimizeStrategy} disabled={loading} style={getButtonStyle("optimize")}>
                  {loading && loadingMode === "optimize" ? (
                    <>
                      OPTIMIZING<span className="loading-dots"></span>
                    </>
                  ) : autoOptimized ? (
                    "AUTO-OPTIMIZED"
                  ) : (
                    "> AUTO-OPTIMIZE <"
                  )}
                </button>

                <button onClick={connectWallet} disabled={loading} style={getButtonStyle("wallet")}>
                  {walletAddress ? "WALLET CONNECTED" : "> CONNECT WALLET <"}
                </button>

                <button onClick={runAgentCycle} disabled={loading} style={getButtonStyle("run")}>
                  {loading && loadingMode === "agent" ? (
                    <>
                      RUNNING<span className="loading-dots"></span>
                    </>
                  ) : autonomousMode ? (
                    "AGENT RUNNING"
                  ) : (
                    "> RUN AGENT <"
                  )}
                </button>

                <button onClick={stopAutonomousMode} disabled={loading} style={getButtonStyle("stop")}>
                  {agentStopConfirmed && !autonomousMode ? "AGENT STOPPED" : "> STOP AGENT <"}
                </button>
              </div>

              <div className="ikqf-full-v2-rows">
                <div><span>AUTONOMOUS</span><strong>{autonomousMode ? "RUNNING" : "STOPPED"}</strong></div>
                <div><span>CHECK INTERVAL</span><strong>{autonomousInterval} MINUTES</strong></div>
              </div>
            </div>
          </section>

          <section className="ikqf-full-v2-panel">
            <div className="ikqf-full-v2-panel-title">TRADE SETUP / OPERATOR CONTROLS</div>

            <div className="ikqf-full-v2-control-grid">
              <div>
                <label>ASSET</label>
                <select
                  value={coin}
                  disabled={loading}
                  onChange={(e) => handleManualSetupChange({ coin: e.target.value }, true)}
                  onWheel={(e) => e.currentTarget.blur()}
                >
                  <option value="ETH">Ethereum (ETH)</option>
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
                  <option value="FIL">Filecoin (FIL)</option>
                  <option value="FET">Fetch.ai (FET)</option>
                  <option value="PENDLE">Pendle (PENDLE)</option>
                  <option value="FLOKI">Floki (FLOKI)</option>
                  <option value="1INCH">1inch (1INCH)</option>
                </select>
              </div>

              <div>
                <label>TIMEFRAME</label>
                <select
                  value={timeframe}
                  disabled={loading}
                  onChange={(e) => handleManualSetupChange({ timeframe: e.target.value }, true)}
                  onWheel={(e) => e.currentTarget.blur()}
                >
                  <option value="5M">5M</option>
                  <option value="15M">15M</option>
                  <option value="1H">1H</option>
                  <option value="4H">4H</option>
                  <option value="1D">1D</option>
                </select>
              </div>

              <div>
                <label>RISK PROFILE</label>
                <select
                  value={risk}
                  disabled={loading}
                  onChange={(e) => handleManualSetupChange({ risk: e.target.value }, true)}
                  onWheel={(e) => e.currentTarget.blur()}
                >
                  <option value="low">CONSERVATIVE</option>
                  <option value="medium">BALANCED</option>
                  <option value="high">AGGRESSIVE / GOVERNED</option>
                </select>
              </div>

              <div>
                <label>BACKTEST CAPITAL</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={initialCapital}
                  disabled={loading}
                  onChange={(e) => handleManualSetupChange({ initial_capital: Number(e.target.value) }, true)}
                />
              </div>

              <div>
                <label>TRADE SIZE ({coin})</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={tradeSize}
                  disabled={loading}
                  onChange={(e) => handleManualSetupChange({ trade_size: Number(e.target.value) }, false)}
                />
              </div>

              <div>
                <label>STRATEGY</label>
                <select
                  value={manualStrategy || result?.selected_strategy || ""}
                  disabled={loading}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const selectedStrategy = e.target.value;
                    handleManualSetupChange({
                      selected_strategy: selectedStrategy,
                      source: "manual_strategy_selection",
                    }, false);
                  }}
                >
                  <option value="" disabled>Choose Strategy</option>
                  {MANUAL_STRATEGY_OPTIONS.map((strategyName) => (
                    <option key={strategyName} value={strategyName}>
                      {strategyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>EXECUTION MODE</label>
                <select
                  value={executionMode || ""}
                  disabled={autonomousMode || loading}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const mode = e.target.value;
                    handleManualSetupChange({
                      execution_mode: mode,
                      live_execution: mode === "live_trading",
                    }, false);
                  }}
                >
                  <option value="" disabled>Execution Mode</option>
                  <option value="decision_simulation">Simulation Mode</option>
                  <option value="paper_trading">Paper Mode</option>
                  <option value="live_trading">Live Mode</option>
                </select>
              </div>

              <div>
                <label>AUTO CHECK FOR NEW TRADE OPPORTUNITY EVERY</label>
                <select
                  value={autonomousInterval}
                  disabled={autonomousMode}
                  onChange={(e) => handleManualSetupChange({ interval_minutes: Number(e.target.value) }, false)}
                  onWheel={(e) => e.currentTarget.blur()}
                >
                  <option value={1}>1 MINUTE</option>
                  <option value={5}>5 MINUTES</option>
                  <option value={15}>15 MINUTES</option>
                  <option value={30}>30 MINUTES</option>
                </select>
              </div>
            </div>

            <div className="ikqf-full-v2-button-grid ikqf-full-v2-secondary-actions">
              <button onClick={generateStrategy} disabled={loading}>
                {loading && loadingMode === "generate" ? "GENERATING..." : "> GENERATE STRATEGY <"}
              </button>
            </div>
          </section>

          <section className="ikqf-full-v2-grid">
            <div className="ikqf-full-v2-panel">
              <div className="ikqf-full-v2-panel-title">STRATEGY PROOF</div>

              {result ? (
                <div className="ikqf-full-v2-rows">
                  <div><span>STRATEGY</span><strong>{result.selected_strategy}</strong></div>
                  <div><span>STATUS</span><strong>{isApproved() ? "APPROVED" : "REJECTED"}</strong></div>
                  <div><span>RATING</span><strong>{getOverallRating()}</strong></div>
                  <div><span>RETURN</span><strong>{result.backtest.net_return}</strong></div>
                  <div><span>MAX DRAWDOWN</span><strong>{result.backtest.max_drawdown}</strong></div>
                  <div><span>WIN RATE</span><strong>{result.backtest.win_rate}</strong></div>
                  <div><span>PROFIT FACTOR</span><strong>{result.backtest.profit_factor}</strong></div>
                  <div><span>EDGE</span><strong>{parsePercent(result.backtest.expectancy) > 0 ? "POSITIVE" : "NEGATIVE"}</strong></div>
                </div>
              ) : (
                <p className="ikqf-full-v2-muted">Run auto-optimize to show strategy rating, return, drawdown, win rate, and profit factor.</p>
              )}
            </div>

            <div className="ikqf-full-v2-panel">
              <div className="ikqf-full-v2-panel-title">WALLET + RISK STATE</div>

              <div className="ikqf-full-v2-rows">
                <div><span>BROWSER WALLET</span><strong>{walletAddress ? "CONNECTED" : "NOT CONNECTED"}</strong></div>
                <div><span>BROWSER NETWORK</span><strong>{getUserNetworkLabel()}</strong></div>
                <div><span>AGENT NETWORK</span><strong>{getAgentNetworkLabel()}</strong></div>
                <div><span>AGENT ADDRESS</span><strong>{shortenAddress(twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C")}</strong></div>
                <div><span>AGENT TOTAL VALUE</span><strong>{formatMoney(portfolio?.totalUsdValue || 0)}</strong></div>
                <div><span>PAPER VALUE</span><strong>{paperPortfolio ? formatMoney(paperPortfolio.total_value_usdt) : "N/A"}</strong></div>
                <div><span>CONFIDENCE</span><strong>{agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "WAITING"}</strong></div>
                <div><span>RISK STATUS</span><strong>{agentResult?.risk_control?.status || "WAITING"}</strong></div>
              </div>
            </div>
          </section>

          {getTradePlan() && (
            <section className="ikqf-full-v2-panel">
              <div className="ikqf-full-v2-panel-title">TRADE PLAN / LAST EXECUTION</div>

              <div className="ikqf-full-v2-rows">
                <div><span>SIGNAL ASSET</span><strong>{getSignalAssetLabel()}</strong></div>
                <div><span>EXECUTION ROUTE</span><strong>{getExecutionRouteLabel()}</strong></div>
                <div><span>SIDE</span><strong>{getTradeSide()}</strong></div>
                <div><span>SIZE</span><strong>{getTradePlan()?.amount || "N/A"} {getTradePlan()?.from_token || ""}</strong></div>
                <div><span>TX STATUS</span><strong>{getExecutionTxStatus()}</strong></div>
                <div><span>TX HASH</span><strong>{shortenHash(getLatestLiveTxHash() || getExecutionTxHash())}</strong></div>
              </div>
            </section>
          )}

          {loading && (
            <section className="ikqf-full-v2-panel">
              <div className="ikqf-full-v2-panel-title">PROCESSING</div>
              <p>{loadingMode === "optimize" ? "AUTO-OPTIMIZER RUNNING" : "STRATEGY ENGINE RUNNING"}<span className="loading-dots"></span></p>
              <div className="progress-bar"><div className="progress-fill"></div></div>
            </section>
          )}

          <section className="ikqf-full-v2-panel">
            <div className="ikqf-full-v2-panel-title">LIVE AGENT ACTIVITY</div>

            <button
              onClick={() => setShowOnlyRealTrades(!showOnlyRealTrades)}
              className="ikqf-full-v2-filter"
            >
              {showOnlyRealTrades ? "> SHOW ALL AGENT ACTIVITY <" : "> SHOW REAL TRADES ONLY <"}
            </button>

            {latestActivity.length > 0 ? (
              <div className="ikqf-full-v2-log-list">
                {latestActivity.map((trade, index) => {
                  const tradePlan = trade.trade_plan || {};
                  const tradeTypeLabel = getTradeLogTypeLabel(trade);
                  const isRealTrade = tradeTypeLabel === "REAL TRADE / EXECUTION";
                  const timestamp = formatDateTime(trade.timestamp);
                  const executionRoute =
                    tradePlan.from_token || trade.from_token
                      ? `${tradePlan.from_token || trade.from_token} → ${tradePlan.to_token || trade.to_token}`
                      : "N/A";
                  const tradeSize = trade.amount || trade.trade_plan?.amount || "N/A";

                  return (
                    <div className={isRealTrade ? "ikqf-full-v2-log is-real" : "ikqf-full-v2-log"} key={index}>
                      <div><span>TYPE</span><strong>{tradeTypeLabel}</strong></div>
                      <div><span>TIME</span><strong>{timestamp}</strong></div>
                      <div><span>EVENT</span><strong>{getTradeLogEventLabel(trade)}</strong></div>
                      {trade.decision && <div><span>DECISION</span><strong>{trade.decision}</strong></div>}
                      <div><span>SIGNAL ASSET</span><strong>{trade.coin || "N/A"}</strong></div>
                      <div><span>ROUTE</span><strong>{executionRoute}</strong></div>
                      <div><span>SIZE</span><strong>{tradeSize}</strong></div>
                      <div><span>RESULT</span><strong>{isRealTrade ? getTradeLogPnlLabel(trade) : getTradeLogNonExecutionLabel(trade)}</strong></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="ikqf-full-v2-muted">No agent activity loaded yet.</p>
            )}
          </section>

          {result && (
            <section className="ikqf-full-v2-panel">
              <div className="ikqf-full-v2-panel-title">DEEP PROOF</div>

              <details className="ikqf-full-v2-details">
                <summary>MARKET + DECISION PROOF</summary>
                <div className="ikqf-full-v2-rows">
                  <div><span>ASSET</span><strong>{result.coin}</strong></div>
                  <div><span>PRICE</span><strong>{formatPrice(result.cmc_signal?.price_usd)}</strong></div>
                  <div><span>MARKET BIAS</span><strong>{String(result.cmc_signal?.market_bias || "UNKNOWN").toUpperCase()}</strong></div>
                  <div><span>MARKET REGIME</span><strong>{getMarketRegime()}</strong></div>
                  <div><span>LAST DECISION</span><strong>{getAgentDecision()}</strong></div>
                  <div><span>TERMINAL COMMENT</span><strong>{getFullTerminalComment()}</strong></div>
                </div>
              </details>

              <details className="ikqf-full-v2-details">
                <summary>OPTIMIZER REPORT</summary>
                <div className="ikqf-full-v2-rows">
                  <div><span>WHY SELECTED</span><strong>{result.reason}</strong></div>
                  <div><span>MODE</span><strong>{result.optimization?.mode || "SINGLE RUN"}</strong></div>
                  <div><span>COMBINATIONS</span><strong>{result.optimization?.tested_combinations || "N/A"}</strong></div>
                  <div><span>BEST TIMEFRAME</span><strong>{result.timeframe}</strong></div>
                  <div><span>BEST RISK MODEL</span><strong>{getRiskProfileLabel(result.risk)}</strong></div>
                  <div><span>BEST STRATEGY</span><strong>{result.selected_strategy}</strong></div>
                </div>
              </details>

              <details className="ikqf-full-v2-details">
                <summary>STRATEGY RULES</summary>
                <div className="ikqf-full-v2-copy">
                  <p><strong>ENTRY:</strong> {result.entry?.condition}</p>
                  <p><strong>CONFIRMATION:</strong> {result.confirmation?.condition}</p>
                  <p><strong>TAKE PROFIT:</strong> {result.take_profit?.condition}</p>
                  <p><strong>STOP LOSS:</strong> {result.stop_loss?.condition}</p>
                  <p><strong>RISK GOVERNOR:</strong> Max open trades {result.risk_governor?.max_open_trades}, risk per trade {result.risk_governor?.risk_per_trade}, stop after losses {result.risk_governor?.stop_after_consecutive_losses}</p>
                </div>
                <button onClick={copyStrategySummary}>COPY STRATEGY SUMMARY</button>
              </details>

              <details className="ikqf-full-v2-details">
                <summary>PERFORMANCE ANALYTICS</summary>
                <div className="ikqf-full-v2-rows">
                  <div><span>TEST PERIOD</span><strong>{result.backtest.backtest_period}</strong></div>
                  <div><span>CANDLES</span><strong>{result.backtest.candles_tested}</strong></div>
                  <div><span>TRADES</span><strong>{result.backtest.trades}</strong></div>
                  <div><span>WINS</span><strong>{result.backtest.wins}</strong></div>
                  <div><span>LOSSES</span><strong>{result.backtest.losses}</strong></div>
                  <div><span>SHARPE</span><strong>{result.backtest.sharpe_ratio}</strong></div>
                  <div><span>SORTINO</span><strong>{result.backtest.sortino_ratio}</strong></div>
                  <div><span>CALMAR</span><strong>{result.backtest.calmar_ratio}</strong></div>
                </div>
              </details>
            </section>
          )}

          <footer className="ikqf-full-v2-footer">
            SYSTEM HEALTH // CMC AGENT HUB: OK // TWAK: OK // PANCAKESWAP: OK // BNB CHAIN: OK // BACKTEST ENGINE: OK // OPTIMIZER: OK
          </footer>
        </main>
      </div>
    );
  };


  return (
    <>
      {renderVersionMenu()}
      {viewMode === "simple"
        ? renderSimpleVersion()
        : viewMode === "full"
        ? renderFullSizeVersion()
        : renderDetailedVersion()}
    </>
  );

}

export default App;
