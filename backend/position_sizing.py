def get_portfolio_value_usd(portfolio_items):
    total = 0.0

    for item in portfolio_items:
        try:
            total += float(item.get("usdValue", 0) or 0)
        except (TypeError, ValueError):
            continue

    return total


def get_balance(portfolio_items, symbol):
    symbol = symbol.upper()

    for item in portfolio_items:
        if str(item.get("symbol", "")).upper() == symbol:
            try:
                return float(item.get("balance", 0) or 0)
            except (TypeError, ValueError):
                return 0.0

    return 0.0


def calculate_trade_size(
    portfolio_items,
    from_token,
    risk_level="low",
):
    from_token = from_token.upper()

    risk_pct_map = {
        "low": 0.10,
        "medium": 0.20,
        "high": 0.30,
    }

    risk_pct = risk_pct_map.get(str(risk_level).lower(), 0.10)

    portfolio_value_usd = get_portfolio_value_usd(portfolio_items)
    from_balance = get_balance(portfolio_items, from_token)

    target_trade_value_usd = portfolio_value_usd * risk_pct

    if from_token == "BNB":
        bnb_usd_value = 0.0

        for item in portfolio_items:
            if str(item.get("symbol", "")).upper() == "BNB":
                bnb_balance = float(item.get("balance", 0) or 0)
                bnb_usd_value = float(item.get("usdValue", 0) or 0)

                if bnb_balance > 0:
                    bnb_price = bnb_usd_value / bnb_balance
                    amount = target_trade_value_usd / bnb_price
                    return {
                        "amount": str(round(min(amount, from_balance), 6)),
                        "portfolio_value_usd": portfolio_value_usd,
                        "risk_pct": risk_pct,
                        "target_trade_value_usd": target_trade_value_usd,
                        "from_balance": from_balance,
                    }

        return {
            "amount": "0",
            "portfolio_value_usd": portfolio_value_usd,
            "risk_pct": risk_pct,
            "target_trade_value_usd": target_trade_value_usd,
            "from_balance": from_balance,
        }

    if from_token == "USDT":
        amount = min(target_trade_value_usd, from_balance)

        return {
            "amount": str(round(amount, 6)),
            "portfolio_value_usd": portfolio_value_usd,
            "risk_pct": risk_pct,
            "target_trade_value_usd": target_trade_value_usd,
            "from_balance": from_balance,
        }

    return {
        "amount": "0",
        "portfolio_value_usd": portfolio_value_usd,
        "risk_pct": risk_pct,
        "target_trade_value_usd": target_trade_value_usd,
        "from_balance": from_balance,
    }