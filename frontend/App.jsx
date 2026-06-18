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
  const [startingPortfolioValue, setStartingPortfolioValue] = useState(null);
  const [liveExecution, setLiveExecution] = useState(false);
  const [executionMode, setExecutionMode] = useState(() => getSavedSetting("ikqf_execution_mode", "decision_simulation"));
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

  function getAgentRuntimeStatusLabel() {
    if (!autonomousMode) return "STOPPED";

    const mode = String(getCurrentExecutionMode() || "decision_simulation").toLowerCase();

    if (mode === "live_trading") return "LIVE TRADING READY";
    if (mode === "paper_trading") return "PAPER TRADING READY";

    return "DECISION SIMULATION RUNNING";
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
      setExecutionMode(setup.execution_mode);
      setLiveExecution(setup.execution_mode === "live_trading");
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
      live_execution: patch.live_execution !== undefined ? patch.live_execution : executionMode === "live_trading",
      execution_mode: patch.execution_mode !== undefined ? patch.execution_mode : executionMode,
      trade_size: patch.trade_size !== undefined ? patch.trade_size : tradeSize,
      interval_minutes: patch.interval_minutes !== undefined ? patch.interval_minutes : autonomousInterval,
      selected_strategy: patch.selected_strategy !== undefined ? patch.selected_strategy : snapshot?.selected_strategy || null,
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

    if (patch.execution_mode !== undefined) {
      const nextExecutionMode = patch.execution_mode || "decision_simulation";
      setExecutionMode(nextExecutionMode);
      setLiveExecution(nextExecutionMode === "live_trading");
    } else if (patch.live_execution !== undefined) {
      setLiveExecution(Boolean(patch.live_execution));
      if (patch.live_execution === true) {
        setExecutionMode("live_trading");
      }
    }

    const savePatch = { ...patch, source: patch.source || "manual_selection" };

    if (resetStrategy) {
      setAutoOptimized(false);
      setResult(null);
      setAgentResult(null);
      savePatch.selected_strategy = null;
      savePatch.result_snapshot = null;
      savePatch.optimization = null;
    }

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
        live_execution: executionMode === "live_trading",
        execution_mode: executionMode,
        trade_size: tradeSize,
        selected_strategy: result?.selected_strategy || null,
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
  window.localStorage.setItem("ikqf_execution_mode", executionMode);
  window.localStorage.setItem("ikqf_autonomous_interval", String(autonomousInterval));
}, [coin, timeframe, risk, tradeSize, initialCapital, executionMode, autonomousInterval]);

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
    const currentExecutionMode = String(getCurrentExecutionMode() || "decision_simulation").toLowerCase();

    if (currentExecutionMode === "decision_simulation") return "SIMULATED / NOT SENT";
    if (executionResult.executed === false) return currentExecutionMode === "paper_trading" ? "PAPER MODE / NOT FILLED" : "LIVE MODE / NOT SENT";
    if (executionResult.success && currentExecutionMode === "paper_trading") return "PAPER FILLED";
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
      setTwakAgentChain(data.chain || "bsc");
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
      setAutoOptimized(false);
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
        live_execution: executionMode === "live_trading",
        execution_mode: executionMode,
        selected_strategy: result?.selected_strategy || null,
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
    const executionSource = getExecutionSourceLabel();
    const simpleTxStatus = tradePlan ? getExecutionTxStatus() : "WAITING FOR APPROVED TRADE";
    const simpleExecutionRoute = tradePlan ? getExecutionRouteLabel() : "ROUTE APPEARS AFTER TRADE PLAN";
    const simpleTxHash = txHash || "ONLY AFTER LIVE ON-CHAIN EXECUTION";

    return (
      <div className="retro-page">
        <div className={`simple-square ${expandedSimpleQuadrant ? "simple-has-expanded" : ""}`}>
          <section className={getSimpleQuadrantClass("intro", "simple-quadrant simple-q-intro")}>
            <div className="simple-quadrant-header">
              <span>I AM AN</span>
              {renderSimpleExpandButton("intro")}
            </div>
            <div className="simple-quadrant-body">
              <div className="simple-brand-block">
                <p className="simple-kicker">AI TRADING AGENT</p>
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
                <div className="simple-status-box">
                  <span>WALLET</span>
                  <strong>{walletAddress ? "IS CONNECTED" : "IS NOT CONNECTED"}</strong>
                </div>

                <div className="simple-status-box">
                  <span>OPERATOR</span>
                  <strong>{operatorUnlocked ? "UNLOCKED" : "LOCKED"}</strong>
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
              <span>PREPARE TO TRADE</span>
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
                  {loading && loadingMode === "agent" ? (
                    <>
                      I AM RUNNING<span className="loading-dots"></span>
                    </>
                  ) : autonomousMode ? (
                    "I AM RUNNING"
                  ) : (
                    "> RUN AGENT <"
                  )}
                </button>
                <button onClick={stopAutonomousMode} disabled={loading} style={getButtonStyle("stop")}>
                  {agentStopConfirmed && !autonomousMode ? "I AM STOPPED" : "> STOP AGENT <"}
                </button>
              </div>

              <div className="simple-control-grid">
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
                    value={executionMode}
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
                  <label>TRADE SIZE ({coin})</label>
                  <input type="number" min="0" step="0.001" value={tradeSize} disabled={loading} onChange={(e) => handleManualSetupChange({ trade_size: Number(e.target.value) }, false)} />
                </div>
              </div>

              <div className="simple-metric-row"><span>RISK STATUS</span><strong>{riskStatus}</strong></div>
              <div className="simple-metric-row"><span>CURRENT DRAWDOWN</span><strong>{agentResult?.risk_control?.current_drawdown_pct !== undefined ? `${agentResult.risk_control.current_drawdown_pct}%` : "N/A"}</strong></div>
              <div className="simple-metric-row"><span>MAX DRAWDOWN LIMIT</span><strong>{agentResult?.risk_control?.max_drawdown_limit_pct !== undefined ? `${agentResult.risk_control.max_drawdown_limit_pct}%` : "N/A"}</strong></div>
              <div className="simple-metric-row"><span>PORTFOLIO VALUE</span><strong>{portfolioValue}</strong></div>
            </div>
          </section>

          <section
            ref={simpleProofRef}
            className={`${getSimpleQuadrantClass("proof", "simple-quadrant simple-q-proof")} ${autonomousMode ? "agent-active-glow" : ""}`}
          >
            <div className="simple-quadrant-header">
              <span>I ACT OR I WAIT</span>
              {renderSimpleExpandButton("proof")}
            </div>
            <div className="simple-quadrant-body">
              <p className="simple-speech-text">
                This is my final answer. If I wait, I explain why. If I act, I show the route, the status, and the proof.
              </p>

              <div className="simple-metric-row simple-agent-current-state"><span>I AM</span><strong>{autonomousMode ? "CURRENTLY RUNNING" : "CURRENTLY STOPPED"}</strong></div>
              <div className="simple-metric-row"><span>MY ACTION</span><strong>{executionStatus.action}</strong></div>
              <div className="simple-metric-row"><span>DID I TRADE?</span><strong>{executionStatus.executed}</strong></div>
              <div className="simple-metric-row"><span>STATUS</span><strong>{executionStatus.status}</strong></div>
              <div className="simple-metric-row"><span>TX STATUS</span><strong>{simpleTxStatus}</strong></div>
              <div className="simple-metric-row"><span>SIGNAL ASSET</span><strong>{getSignalAssetLabel()}</strong></div>
              <div className="simple-metric-row"><span>EXECUTION ROUTE</span><strong>{simpleExecutionRoute}</strong></div>
              <div className="simple-metric-row"><span>SOURCE</span><strong>{executionSource}</strong></div>
              <div className="simple-metric-row"><span>CHAIN</span><strong>BNB SMART CHAIN / BSC</strong></div>
              <div className="simple-metric-row"><span>REGISTRATION</span><strong>{getRegistrationLabel()}</strong></div>
              <div className="simple-metric-row"><span>AGENT ADDRESS</span><strong>{twakAgentAddress || "0x695b32DdB023f76dE3FE4de485F7C0131De4754C"}</strong></div>
              <div className="simple-metric-row"><span>TX HASH</span><strong>{simpleTxHash}</strong></div>
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
            <span>v0.1.0</span>
            {renderDetailedExpandButton("who")}
          </div>

          <div className="retro-quadrant-body">
            <div className="retro-brand-card">
              <div className="topbar retro-topbar">
                <span>IKQF v0.1.0 - AI ONLINE</span>
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
                <p><strong>Roundhouse kick dumb trades.</strong></p>
                                <p>Backtest the signal. Lock the risk. Automate the move.</p>
                <p>I Know Quant Fu turns noisy crypto market data into explainable autonomous trading decisions.</p>
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

            {agentResult && (
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

            <details
              ref={agentStatusRef}
              className="retro-window"
            >
              <summary><span className={autonomousMode ? "detailed-agent-text-glow" : ""}>AGENT STATUS</span></summary>
              <div className="metrics strategy-library-box">
                <p>AGENT STATUS....... {getAgentRuntimeStatusLabel()}</p>
                <p>USER WALLET......... {walletAddress ? "CONNECTED" : "NOT CONNECTED"}</p>
                <p>CONNECTED WALLET........ {walletAddress || "N/A"}</p>
                <p>USER NETWORK....... {getUserNetworkLabel()}</p>
                <p>AGENT NETWORK...... {getAgentNetworkLabel()}</p>
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

            {getCurrentExecutionMode() === "paper_trading" && (
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
                  <label>RISK LEVEL</label>
                  <select value={risk} disabled={loading} onChange={(e) => handleManualSetupChange({ risk: e.target.value }, true)} onWheel={(e) => e.currentTarget.blur()}>
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
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
                      handleManualSetupChange({
                        execution_mode: mode,
                        live_execution: mode === "live_trading",
                      }, false);
                    }}
                  onWheel={(e) => e.currentTarget.blur()}
                  >
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

                  <div
                    className="trade-table strategy-backtest-scroll-table"
                    style={{ maxHeight: "220px", overflowY: "auto", overflowX: "auto" }}
                  >
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

          </div>
        </section>

        <div className="footer retro-footer">
          CMC AGENT HUB: OK &nbsp;&nbsp; TWAK: OK &nbsp;&nbsp; PANCAKESWAP: OK &nbsp;&nbsp; BNB CHAIN: OK &nbsp;&nbsp; BACKTEST ENGINE: OK &nbsp;&nbsp; OPTIMIZER: OK
        </div>
      </div>
    </div>
  );



  const renderFullSizeVersion = () => (
    <div className="full-size-page">
      <main className="full-terminal">
      <div className="topbar">
        <span>IKQF v0.1.0</span>
        <span>STRATEGY MATRIX LOADED</span>
        <span>AI ONLINE</span>
      </div>

      <h1 className="title">
        I KNOW QUANT FU<span className="blink">_</span>
      </h1>

      <p className="subtitle">AI-POWERED TRADING AGENT</p>

      <p className="full-slogan">Roundhouse kick dumb trades.<br />Backtest the signal. Lock the risk. Automate the move.</p>

      <div className="hero-description">
        I Know Quant Fu is an autonomous cryptocurrency trading platform powered by CoinMarketCap market intelligence,
        Trust Wallet Agent Kit (TWAK), PancakeSwap execution routing,
        and Binance Smart Chain infrastructure.

        It continuously analyzes market conditions, compares strategy performance,
        backtests multiple approaches, evaluates portfolio risk, generates explainable
        AI trade decisions, and can operate in Decision Simulation, Paper Trading,
        or Live Trading Mode.

        Every decision passes through market regime analysis, confidence scoring,
        strategy validation, drawdown protection, portfolio risk controls,
        and execution safety checks before a trade is approved.
      </div>
<div className="panel">
        <div className="panel-title">QUICK START ACTIONS</div>

<div className="agent-control-panel">
  <button
    onClick={optimizeStrategy}
    disabled={loading}
    className="copy-btn"
    style={getButtonStyle("optimize")}
  >
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

  <button
    onClick={connectWallet}
    disabled={loading}
    className="copy-btn"
    style={getButtonStyle("wallet")}
  >
    {walletAddress ? "WALLET CONNECTED" : "> CONNECT WALLET <"}
  </button>
</div>

<div className="button-row">
  <button
    onClick={runAgentCycle}
    disabled={loading}
    className="copy-btn"
    style={getButtonStyle("run")}
  >
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

  <button
    onClick={stopAutonomousMode}
    disabled={loading}
    className="copy-btn"
    style={getButtonStyle("stop")}
  >
    {agentStopConfirmed && !autonomousMode
      ? "AGENT STOPPED"
      : activeButton === "stop"
      ? "> STOPPING... <"
      : "> STOP AGENT <"}
  </button>
</div>
      </div>



<div className="panel operator-controls-panel">
  <div className="panel-title">TRADE SETUP / OPERATOR CONTROLS</div>
<h2 className="strategy-library-title">TRADE SETUP</h2>

        <div className="input-row">
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
            <select value={timeframe} disabled={loading} onChange={(e) => handleManualSetupChange({ timeframe: e.target.value }, true)} onWheel={(e) => e.currentTarget.blur()}>
              <option value="5M">5M</option>
              <option value="15M">15M</option>
              <option value="1H">1H</option>
              <option value="4H">4H</option>
              <option value="1D">1D</option>
            </select>
          </div>

          <div>
            <label>RISK LEVEL</label>
            <select value={risk} disabled={loading} onChange={(e) => handleManualSetupChange({ risk: e.target.value }, true)} onWheel={(e) => e.currentTarget.blur()}>
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
                onChange={(e) => handleManualSetupChange({ initial_capital: Number(e.target.value) }, true)}
              />
            </div>
          </div>

          <div>
            <label>TRADE SIZE ({coin})</label>

            <div className="capital-input trade-size-input">
              <input
                type="number"
                min="0"
                step="0.001"
                value={tradeSize}
                disabled={loading}
                onChange={(e) => handleManualSetupChange({ trade_size: Number(e.target.value) }, false)}
              />
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
          <button
            onClick={generateStrategy}
            disabled={loading}
            className="copy-btn"
            style={getButtonStyle("generate")}
          >
            {loading && loadingMode === "generate" ? "GENERATING..." : "> GENERATE STRATEGY <"}
          </button>

        <div>
          <select
  value={executionMode}
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

         
        </div>
</div>

{(() => {
  const executionStatus = getExecutionStatus();
  const tradePlan = getTradePlan();

  return (
    <div className="metrics strategy-library-box execution-status-panel" style={{ marginTop: "24px" }}>
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

{getTradePlan() && (
  <div className="metrics strategy-library-box last-execution-panel" style={{ marginTop: "24px" }}>
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
    <p>SOURCE.............. {getExecutionSourceLabel()}</p>
  </div>
)}

<div className="panel portfolio-section-panel">
  <div className="panel-title">PORTFOLIO</div>
{walletAddress && (
  <div className="panel portfolio-panel">
    <div className="panel-title">AGENT PORTFOLIO</div>

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

      <button
        onClick={resetPnlBaseline}
        className="copy-btn"
        style={{ marginTop: "12px", ...getButtonStyle("resetPnl") }}
      >
        {"> RESET PNL BASELINE <"}
      </button>
    </div>
  </div>
)}

        {getCurrentExecutionMode() === "paper_trading" && (
          <div className="panel portfolio-panel">
            <div className="panel-title">PAPER PORTFOLIO</div>

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

              <button
                onClick={resetPaperPortfolio}
                disabled={autonomousMode || loading}
                className="copy-btn"
                style={{ marginTop: "12px", ...getButtonStyle("resetPaper") }}
              >
                {"> RESET PAPER PORTFOLIO <"}
              </button>
            </div>
          </div>
        )}
</div>

<div className="panel decision-section-panel">
  <div className="panel-title">AGENT DECISION ENGINE</div>
<h2 className="strategy-library-title">AGENT STATUS</h2>

<div className="metrics strategy-library-box">
  <p>USER WALLET......... {walletAddress ? "CONNECTED" : "NOT CONNECTED"}</p>

  <p>USER ADDRESS........ {walletAddress || "N/A"}</p>

  <p>USER NETWORK....... {getUserNetworkLabel()}</p>

  <p>AGENT NETWORK...... {getAgentNetworkLabel()}</p>

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
  <p>EXECUTION MODE..... {getExecutionModeLabel()}</p>
  <p>SELECTED TIMEFRAME.. {timeframe}</p>
  <p>SIGNAL ASSET........ {getSignalAssetLabel()}</p>
  <p>TRADE SIZE.......... {tradeSize} BNB TARGET</p>
  <p>TRADE CONFIDENCE.... {agentResult?.confidence_score !== undefined ? `${agentResult.confidence_score} / 100` : "N/A"}</p>
  <p>DRAWDOWN............ {agentResult?.risk_control?.current_drawdown_pct !== undefined ? `${agentResult.risk_control.current_drawdown_pct}%` : "N/A"}</p>
  <p>RISK STATUS......... {agentResult?.risk_control?.status || "N/A"}</p>
  <p>PAPER VALUE........ {paperPortfolio ? formatMoney(paperPortfolio.total_value_usdt) : "N/A"}</p>
  <p>AGENT STATUS....... {getAgentRuntimeStatusLabel()}</p>
</div>

<div className="autonomous-container">
  <div className="autonomous-status-box">
    <p>AUTONOMOUS MODE..... {autonomousMode ? "RUNNING" : "STOPPED"}</p>
    <p>CHECK INTERVAL...... {autonomousInterval} MINUTES</p>
    <p>LAST DECISION....... {autonomousStatus?.last_decision || "N/A"}</p>
    <p>LAST REASON......... {autonomousStatus?.last_reason || "N/A"}</p>
    <p>NEXT CHECK.......... {formatDateTime(autonomousStatus?.next_run)}</p>
  </div>
</div>
<div className="metrics strategy-library-box" style={{ marginTop: "24px" }}>
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
</div>

{agentResult?.confidence_score !== undefined && (
  <div className="metrics strategy-library-box" style={{ marginTop: "24px" }}>
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
)}

{agentResult?.why?.length > 0 && (
  <div className="metrics strategy-library-box" style={{ marginTop: "24px" }}>
    <p><strong>WHY THE AGENT DECIDED</strong></p>
    {agentResult.why.map((reason, index) => (
      <p key={index}>- {reason}</p>
    ))}
  </div>
)}

{agentResult?.risk_control && (
  <div className="metrics strategy-library-box" style={{ marginTop: "24px" }}>
    <p><strong>RISK CONTROL</strong></p>
    <p>CURRENT VALUE....... {formatMoney(agentResult.risk_control.current_portfolio_value_usd || 0)}</p>
    <p>BASELINE VALUE...... {formatMoney(agentResult.risk_control.baseline_portfolio_value_usd || 0)}</p>
    <p>PEAK VALUE.......... {formatMoney(agentResult.risk_control.peak_portfolio_value_usd || 0)}</p>
    <p>CURRENT DRAWDOWN.... {agentResult.risk_control.current_drawdown_pct ?? "N/A"}%</p>
    <p>MAX DRAWDOWN LIMIT.. {agentResult.risk_control.max_drawdown_limit_pct ?? "N/A"}%</p>
    <p>DAILY LOSS LIMIT.... {agentResult.risk_control.daily_loss_limit_pct ?? "N/A"}%</p>
    <p>STATUS.............. {agentResult.risk_control.status || "N/A"}</p>
  </div>
)}
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
          borderBottom: "1px solid rgba(156,255,143,0.25)",
        }}
      >
        <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
  {timestamp}
</p>

<p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
  EVENT:{" "}
  {(trade.status || "UNKNOWN")
    .replaceAll("_", " ")
    .toUpperCase()}
</p>

<p style={{ color: "#9cff8f" }}>
  TYPE:{" "}
  {isRealTrade
    ? "REAL TRADE / EXECUTION"
    : "DECISION ONLY"}
</p>

{trade.confidence_score !== undefined && (
  <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
    TRADE CONFIDENCE: {trade.confidence_score} / 100
  </p>
)}

{trade.risk_control?.current_drawdown_pct !== undefined && (
  <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
    DRAWDOWN: {trade.risk_control.current_drawdown_pct}% / LIMIT {trade.risk_control.max_drawdown_limit_pct}%
  </p>
)}


{trade.why?.length > 0 && (
  <div style={{ color: isRealTrade ? "#9cff8f" : "#808080", marginTop: "8px" }}>
    <p>WHY:</p>
    {trade.why.slice(0, 5).map((reason, reasonIndex) => (
      <p key={reasonIndex}>- {reason}</p>
    ))}
  </div>
)}
       

{trade.decision && (
  <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
    DECISION: {trade.decision}
  </p>
)}

{(trade.coin || executionRoute) && (
  <>
    <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
      SIGNAL ASSET: {trade.coin || "N/A"}
    </p>
    <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
      EXECUTION ROUTE: {executionRoute || "N/A"}
    </p>
  </>
)}

{txHash && (
  <>
    <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
      TX HASH: {txHash}
    </p>
    <p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
      BSCSCAN: https://bscscan.com/tx/{txHash}
    </p>
  </>
)}

<p style={{ color: isRealTrade ? "#9cff8f" : "#808080" }}>
  TRADE SIZE: {tradeSize}
</p>
      </div>
    );
  })}
    </div>
  </div>
)}

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
                        offset: 6
                      }}
                    />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip
                      labelFormatter={formatEquityTooltipLabel}
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, "Equity"]}
                      contentStyle={{
                        backgroundColor: "#001a08",
                        border: "1px solid #9cff8f",
                        color: "#9cff8f"
                      }}
                      labelStyle={{ color: "#9cff8f" }}
                      itemStyle={{ color: "#9cff8f" }}
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

        </div>
      )}


{agentResult && (
  <div className="panel verification-panel">
    <div className="panel-title">AGENT VERIFICATION</div>

    <div className="metrics strategy-library-box">
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
  </div>
)}

{result && (
  <div className="panel result-details-panel">
    <div className="panel-title">RESULT DETAILS</div>

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
              <>
                <div className="table-scroll-hint"><span>&lt;</span><strong>THIS TABLE SCROLLS LEFT TO RIGHT</strong><span>&gt;</span></div>
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
              </>
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

            <div className="table-scroll-hint"><span>&lt;</span><strong>THIS TABLE SCROLLS LEFT TO RIGHT</strong><span>&gt;</span></div>
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
            <summary>METRICS / AGENT LOGIC EXPLAINED</summary>

            <div className="metrics">
              <p><strong>WHAT STRATEGYFORGE DOES</strong></p>
              <p>I Know Quant Fu combines CoinMarketCap market intelligence, proprietary strategy testing, portfolio risk management, Trust Wallet Agent Kit (TWAK), PancakeSwap routing, and Binance Smart Chain settlement into a single autonomous trading platform.</p><p>The system continuously scans market conditions, compares multiple strategies, scores trade quality, evaluates risk, generates explainable AI decisions, and can operate in Simulation, Paper Trading, or Live Trading mode.</p>

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
  </div>
)}



      <div className="footer">
        CMC AGENT HUB: OK &nbsp;&nbsp; TWAK: OK &nbsp;&nbsp; PANCAKESWAP: OK &nbsp;&nbsp; BNB CHAIN: OK &nbsp;&nbsp; BACKTEST ENGINE: OK &nbsp;&nbsp; OPTIMIZER: OK
      </div>
      </main>
    </div>
  );


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
