# I Know Quant Fu - https://www.iknowquantfu.com

## Autonomous Crypto Trading Agent for the BNB Hack: AI Trading Agent Edition

**I Know Quant Fu** is an autonomous crypto trading agent built for the **BNB Hack: AI Trading Agent Edition — CoinMarketCap × Trust Wallet** competition.

The project connects market intelligence, strategy logic, risk control, and self-custody execution into one trading loop.

**Roundhouse kick dumb trades.**
**Backtest the signal. Lock the risk. Automate the move.**

---

## Vision

I Know Quant Fu bridges market intelligence and disciplined execution. It reads CoinMarketCap signals, compares and backtests strategies, applies risk guardrails, then decides whether to wait, simulate, paper trade, or execute through Trust Wallet Agent Kit on BNB Chain with on-chain proof.

The goal is not just automation. The goal is explainable, self-custodial, risk-aware trading.

---

## Problem

Crypto traders often face two bad options:

1. **Manual trading**, where emotion, fear, greed, and inconsistent rules lead to bad entries and poor risk control.
2. **Basic trading bots**, which blindly execute fixed rules without understanding market regime, confidence, or whether a trade should be skipped.

Most systems also separate the market intelligence layer from the wallet execution layer. A user reads data in one place, makes decisions somewhere else, and manually executes trades through another interface.

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
* Generate and compare trading strategies
* Run historical backtests
* Rank strategies by risk-adjusted performance
* Check confidence and risk guardrails
* Decide whether to wait, simulate, paper trade, or execute live
* Connect to a user wallet
* Execute through Trust Wallet Agent Kit / TWAK
* Route trades on BNB Chain
* Display trade decisions, execution status, and proof
* Maintain paper portfolio and trade history
* Explain why it acted or why it waited

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

The agent does not force trades. Waiting is part of the system.

If the market is unclear, confidence is too low, or risk controls fail, the agent can choose:

```txt
HOLD / NO EXECUTION
```

This is intentional. The agent is designed to avoid dumb trades, not chase every signal.

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

The agent wallet has been registered on BSC for the competition.

```txt
Registered participant:
0x695b32DdB023f76dE3FE4de485F7C0131De4754C
```

Registration status:

```txt
registered: true
alreadyRegistered: true
chain: bsc
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
* Backtesting
* Risk-adjusted ranking
* Strategy selection based on performance and guardrails

### Risk Control

* Drawdown checks
* Confidence scoring
* Risk status display
* Daily qualification guard
* Trade size controls
* Execution mode controls

### Execution Modes

The agent supports three modes:

```txt
Decision Simulation
Paper Trading
Live Trading
```

Decision Simulation logs the decision without opening a trade.

Paper Trading tests execution logic without real capital.

Live Trading routes execution through TWAK on BNB Chain.

### Wallet + Execution

* Wallet connection
* BNB Smart Chain network support
* TWAK execution layer
* PancakeSwap route support
* Transaction status display
* BSC transaction hash detection
* Agent registration display

### Frontend Views

The app includes three website modes:

1. **Simple Version**
   A 4-panel explanation-focused interface for judges and users.

2. **Detailed Version**
   A 4-square expandable terminal interface showing technical agent status, activity, strategy logic, proof, portfolio, and analytics.

3. **Full Size Version**
   A long-form terminal interface with full trading controls, logs, strategy analytics, and execution details.

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

1. User selects an eligible asset.
2. User chooses execution mode.
3. User selects trade interval and trade size.
4. Agent reads market intelligence.
5. Agent generates or optimizes strategy logic.
6. Strategy is backtested and ranked.
7. Risk guardrails are checked.
8. Agent decides whether to wait, simulate, paper trade, or execute.
9. If execution is allowed, TWAK handles the self-custody execution path.
10. The UI displays decision, route, status, and proof.

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

---

## Example Agent Decisions

The agent may decide:

```txt
HOLD
```

when the market is neutral, risk is not clean, or confidence is too low.

It may produce a trade plan when conditions align:

```txt
BUY / SELL
```

with route, trade size, execution status, and proof.

In live mode, successful execution should return a BSC transaction hash.

---

## Eligible Assets

The frontend is designed to use competition-eligible assets only. Examples include:

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
TWAK_CONFIG=your_twak_config
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

Self-custody integrity is important to the project. Signing authority should stay with the user or configured agent wallet through the TWAK flow.

---

## Disclaimer

This software is provided for educational, experimental, and hackathon demonstration purposes only.

Nothing in this project is financial advice, investment advice, or a recommendation to buy or sell any asset.

Cryptocurrency trading involves significant risk and may result in loss of capital. Past performance does not guarantee future results.

Use live trading mode only with small amounts and at your own risk.
