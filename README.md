# I Know Quant Fu

https://www.iknowquantfu.com

## Autonomous Crypto Trading Agent for the BNB Hack: AI Trading Agent Edition

**I Know Quant Fu** is an autonomous crypto trading agent built for the **BNB Hack: AI Trading Agent Edition — CoinMarketCap × Trust Wallet** competition.

It connects CoinMarketCap market intelligence, strategy testing, risk control, and Trust Wallet Agent Kit execution into one explainable trading loop.

**Roundhouse kick dumb trades.**
**Backtest the signal. Lock the risk. Automate the move.**

The agent does not chase candles.
It reads the market, tests the strategy, checks the risk, explains the decision, and only then decides whether to wait, simulate, paper trade, or execute.

No confidence. No trade.
No logic. No trade.
No dojo. No roundhouse.

---

## Vision

I Know Quant Fu bridges market intelligence and disciplined execution.

It reads CoinMarketCap signals, compares and backtests strategies, applies risk guardrails, then decides whether to wait, simulate, paper trade, or execute through Trust Wallet Agent Kit on BNB Chain with on-chain proof.

The goal is not just automation.

The goal is explainable, self-custodial, risk-aware trading.

---

## Problem

Crypto traders often face two bad options:

1. **Manual trading**, where emotion, fear, greed, and inconsistent rules lead to bad entries and poor risk control.

2. **Basic trading bots**, which blindly execute fixed rules without understanding market regime, confidence, risk, or whether a trade should be skipped.

Most systems also separate the market intelligence layer from the wallet execution layer.

A user reads data in one place, makes decisions somewhere else, and manually executes trades through another interface.

I Know Quant Fu solves this by connecting the full loop:

```txt
CoinMarketCap intelligence
→ strategy comparison
→ backtesting
→ confidence scoring
→ risk guardrails
→ autonomous decision
→ TWAK execution
→ BNB Chain proof
```

---

## What It Does

I Know Quant Fu can:

* Read CoinMarketCap market intelligence
* Detect market regime and sentiment conditions
* Generate, compare, and backtest trading strategies
* Rank strategies by risk-adjusted performance
* Apply confidence scoring and drawdown protection
* Decide whether to hold, simulate, paper trade, or execute live
* Connect to a user wallet
* Attempt execution through Trust Wallet Agent Kit
* Route swaps through PancakeSwap on BNB Smart Chain
* Display trade decisions, execution status, portfolio state, and proof
* Maintain paper trading history and performance analytics
* Explain why it acted — or why it waited

Waiting is not a bug.
Waiting is the agent refusing to roundhouse kick itself in the face.

---

## Core Agent Loop

```txt
Market Data In
→ Strategy Engine
→ Backtest + Optimizer
→ Confidence Model
→ Risk Governor
→ Decision Engine
→ TWAK / Wallet Execution
→ On-Chain Proof
```

The agent does not force trades.

If the market is unclear, confidence is too low, or risk controls fail, the agent can choose:

```txt
HOLD / NO EXECUTION
```

This is intentional.

The agent is designed to avoid dumb trades, not chase every signal.

---

## Competition Track

This project is built for:

```txt
Track 1: Autonomous Trading Agents
BNB Hack: AI Trading Agent Edition
CoinMarketCap × Trust Wallet
```

The project focuses on:

* Autonomous trading logic
* CoinMarketCap-powered market intelligence
* Trust Wallet Agent Kit execution
* Self-custody wallet flow
* BNB Chain settlement
* Risk-aware trading guardrails
* On-chain proof of execution

---

## Registered Agent Wallet

The agent wallet used for the competition is:

```txt
0x695b32DdB023f76dE3FE4de485F7C0131De4754C
```

BSC explorer:

```txt
https://bscscan.com/address/0x695b32DdB023f76dE3FE4de485F7C0131De4754C
```

Registration status reported by the application:

```txt
registered: true
alreadyRegistered: true
chain: bsc
```

---

## Agent Wallet Funding Proof

The agent wallet has been funded on BNB Smart Chain and holds non-zero in-scope assets.

Funding transaction:

```txt
0x4f5469a769c9298572fee10da3fbc92b9db57f032d262ffe283e4882537ac9f
```

Funding transaction link:

```txt
https://bscscan.com/tx/0x4f5469a769c9298572fee10da3fbc92b9db57f032d262ffe283e4882537ac9f
```

This transaction proves that the agent wallet received BNB for gas.

It is **wallet funding proof**, not a live trade proof.

---

## Current On-Chain Wallet State

The agent wallet currently shows non-zero balances on BNB Smart Chain, including:

```txt
BNB
Binance-Peg ETH
Binance-Peg USDT
```

This matters because Track 1 requires the agent wallet to hold non-zero in-scope assets at competition start and maintain capital for the live trading window.

---

## Live Trade Proof Status

The system is designed to detect and display BSC transaction hashes from TWAK execution output.

Live trade proof format:

```txt
Live TWAK Trade Proof:
https://bscscan.com/tx/FULL_TRANSACTION_HASH_HERE
```

Current proof status:

```txt
Agent wallet funded: yes
Agent wallet has non-zero assets: yes
TWAK execution path implemented: yes
Live trade transaction hash: pending / to be added after successful live execution
```

---

## Features

### Market Intelligence

* CoinMarketCap market data
* CoinMarketCap Skill Hub / MCP integration
* Market regime detection
* Fear and greed context
* Asset and timeframe analysis

### Strategy Engine

* Strategy generation
* Multi-strategy optimization
* Historical backtesting
* Risk-adjusted ranking
* Strategy selection based on performance and guardrails

### Risk Control

* Drawdown checks
* Confidence scoring
* Risk status display
* Daily qualification guard
* Trade size controls
* Execution mode controls
* Portfolio safety checks
* Eligible-token allowlist
* Conservative per-token trade caps
* Cooldown protection between live trade attempts

### Execution Modes

The agent supports three execution modes:

```txt
Decision Simulation
Paper Trading
Live Trading
```

**Decision Simulation** logs the decision only. No live trade is executed and no virtual position is opened.

**Paper Trading** opens and closes virtual positions, tracks paper PnL, and can be reset without touching the live wallet.

**Live Trading** attempts real wallet-based execution through TWAK when configured, authorized, and allowed by the risk guardrails.

### Wallet + Execution

* Wallet connection
* BNB Smart Chain network support
* Trust Wallet Agent Kit execution layer
* PancakeSwap route support
* Transaction status display
* BSC transaction hash detection
* Agent registration display
* BscScan proof display

---

## Frontend Views

The app includes three interface modes:

### 1. Simple Version

A judge-friendly 4-panel interface that explains the project quickly and clearly.

This mode focuses on:

* What the agent is
* What it does
* When the operator uses it
* How the decision logic works

### 2. Detailed Version

A compact terminal dashboard showing agent status, strategy selection, portfolio state, execution readiness, risk controls, and system proof.

This mode is for users who want more information without reading the full trading terminal.

### 3. Full Size Version

A full scrolling terminal interface with trading controls, optimizer reports, market regime analysis, live logs, strategy analytics, backtest history, execution details, and system health.

This is the machine room.

---

## Technology Stack

### Frontend

* React
* Vite
* Recharts
* CSS terminal UI

### Backend

* Python
* FastAPI
* Railway deployment

### Market Intelligence

* CoinMarketCap API
* CoinMarketCap Skill Hub MCP

### Wallet / Execution

* Trust Wallet Agent Kit / TWAK
* BNB Smart Chain
* PancakeSwap route logic

### Deployment

* Railway frontend
* Railway backend
* Custom domain

---

## Current Deployment

Frontend:

```txt
https://www.iknowquantfu.com
```

Backend:

```txt
https://strategy-forge-production-a3f6.up.railway.app
```

The backend URL may still contain the old project name because it is the Railway service URL, not the visible product branding.

---

## How It Works

1. The user selects an eligible asset.
2. The user chooses an execution mode.
3. The user selects trade interval and trade size.
4. The agent reads market intelligence.
5. The agent generates or optimizes strategy logic.
6. The strategy is backtested and ranked.
7. Risk guardrails are checked.
8. The agent decides whether to wait, simulate, paper trade, or execute.
9. If execution is allowed, TWAK handles the self-custody execution path.
10. The UI displays decision, route, status, and proof.
11. If a live transaction succeeds, the UI surfaces the BSC transaction hash and BscScan proof link.

---

## Strategy Evaluation Metrics

I Know Quant Fu evaluates strategies using:

* Net return
* Win rate
* Profit factor
* Expectancy
* Sharpe ratio
* Sortino ratio
* Calmar ratio
* Recovery factor
* Maximum drawdown
* Risk-adjusted score
* Signal frequency
* Active trade days
* Quiet-gap analysis
* Strategy-vs-buy-hold comparison

---

## Example Agent Decisions

The agent may decide:

```txt
HOLD
```

when the market is neutral, risk is not clean, confidence is too low, or no valid entry signal exists.

This is not failure.

This is the agent refusing to kick a bad trade.

The agent may produce a trade plan when conditions align:

```txt
BUY / SELL
```

with route, trade size, execution status, and proof.

In live mode, successful execution should return a BSC transaction hash.

---

## Eligible Assets

The frontend and backend are designed to use competition-eligible assets only.

Examples include:

```txt
ETH
XRP
DOGE
ADA
LINK
LTC
AVAX
SHIB
DOT
UNI
AAVE
ATOM
INJ
CAKE
TWT
FIL
FET
PENDLE
FLOKI
1INCH
```

The project avoids unsupported assets where possible so competition trades stay inside the eligible-token rules.

---

## Competition Qualification Notes

For Track 1, the registered agent wallet must hold non-zero in-scope assets at the competition start.

The agent wallet currently has non-zero BNB and in-scope token balances visible on BNB Smart Chain.

The project is designed to support the competition requirement of at least one qualifying live trade per day during the trading week.

The backend includes daily live-trade counting logic designed to exclude:

```txt
Decision simulation
Paper trading
Quote-only route checks
Blocked execution attempts
```

Only real live execution results should count toward the daily qualification target.

---

## Self-Custody Model

I Know Quant Fu is designed around self-custody execution.

The frontend and backend do not store seed phrases or private keys.

Signing authority should stay with the user or configured agent wallet through the Trust Wallet Agent Kit flow.

The backend generates strategy decisions, risk checks, and execution requests.

TWAK handles the wallet execution path.

---

## Judge Demo Flow

1. Open the live site.
2. Start in Simple Version to understand the agent.
3. Switch to Detailed Version or Full Size Version.
4. Show the registered agent wallet address.
5. Show the BSC explorer page for the agent wallet.
6. Show the wallet funding proof transaction.
7. Select an eligible asset.
8. Run auto-optimization.
9. Show selected strategy, backtest result, risk status, and confidence.
10. Run the agent.
11. Show the decision: HOLD, paper trade, or live execution.
12. If live execution succeeds, open the BscScan transaction proof.

---

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

---

## Environment Variables

Create local environment files as needed.

Do not commit real secrets.

Example frontend variable:

```env
VITE_API_URL=http://localhost:8000
```

Example backend variables may include:

```env
CMC_API_KEY=your_coinmarketcap_key
CMC_MCP_API_KEY=your_coinmarketcap_mcp_key
TWAK_CONFIG=your_twak_config
AGENT_WALLET_ADDRESS=your_agent_wallet_address
IKQF_ADMIN_KEY=your_operator_key
```

Use `.env.example` for public documentation and keep real `.env` files private.

---

## Security Notes

Do not commit:

* Private keys
* Seed phrases
* API keys
* Wallet credentials
* Railway secrets
* Production `.env` files
* Operator admin keys

Self-custody integrity is important to the project.

Signing authority should stay with the user or configured agent wallet through the TWAK flow.

---

## Current Limitations

The project does not claim x402 usage unless that feature is added and proven.

The project does not claim BNB AI Agent SDK usage unless that feature is added and proven.

Funding proof is available.

Live trade proof should be added after a successful live TWAK swap returns a BSC transaction hash.

---

## Disclaimer

This software is provided for educational, experimental, and hackathon demonstration purposes only.

Nothing in this project is financial advice, investment advice, or a recommendation to buy or sell any asset.

Cryptocurrency trading involves significant risk and may result in loss of capital.

Past performance does not guarantee future results.

Use live trading mode only with small amounts and at your own risk.
