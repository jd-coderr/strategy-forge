from datetime import datetime, timezone

# Competition/token routes allowed through TWAK on BSC.
# USDT is included as the settlement token. BNB is included for gas/reduce-risk fallback only.
ALLOWED_TOKENS = {
    "USDT", "BNB", "ETH", "XRP", "DOGE", "LINK", "ADA", "AVAX", "UNI", "INJ",
    "CAKE", "TWT", "AAVE", "ATOM", "LTC", "DOT", "SHIB", "FIL", "FET",
    "PENDLE", "FLOKI", "1INCH",
}

# Conservative per-swap caps. Amount is denominated in the FROM token that TWAK will spend.
# These caps are intentionally small for the competition wallet so a forced/normal trade cannot drain funds.
MAX_TRADE_AMOUNTS = {
    # Raised to 5 USDT so the default 0.001 ETH-style trade size is not accidentally blocked
    # when ETH is above 2,000 USDT. Still conservative for the competition wallet.
    "USDT": 5.0,
    "BNB": 0.002,
    "ETH": 0.002,
    "XRP": 5.0,
    "DOGE": 25.0,
    "LINK": 0.25,
    "ADA": 5.0,
    "AVAX": 0.25,
    "UNI": 0.5,
    "INJ": 0.25,
    "CAKE": 1.0,
    "TWT": 2.0,
    "AAVE": 0.05,
    "ATOM": 0.5,
    "LTC": 0.05,
    "DOT": 1.0,
    "SHIB": 250000.0,
    "FIL": 1.0,
    "FET": 5.0,
    "PENDLE": 1.0,
    "FLOKI": 75000.0,
    "1INCH": 10.0,
}

MIN_SECONDS_BETWEEN_TRADES = 60

last_trade_time = None


def normalize_token(value: str) -> str:
    token = str(value or "").upper().replace("/", "").replace("-", "").strip()

    if token == "USDT":
        return "USDT"

    if token.endswith("USDT"):
        token = token[:-4]

    return token or ""


def validate_trade_request(amount: str, from_token: str, to_token: str, quote_only: bool):
    global last_trade_time

    from_token = normalize_token(from_token)
    to_token = normalize_token(to_token)

    if from_token not in ALLOWED_TOKENS:
        return False, f"Blocked: from_token {from_token} is not allowed."

    if to_token not in ALLOWED_TOKENS:
        return False, f"Blocked: to_token {to_token} is not allowed."

    if from_token == to_token:
        return False, "Blocked: from_token and to_token cannot be the same."

    # Force all live swaps to settle against USDT. This keeps the route simple and auditable:
    # USDT -> selected asset or selected asset -> USDT.
    if "USDT" not in {from_token, to_token}:
        return False, "Blocked: one side of every live route must be USDT."

    try:
        numeric_amount = float(amount)
    except (TypeError, ValueError):
        return False, "Blocked: amount must be numeric."

    max_allowed = MAX_TRADE_AMOUNTS.get(from_token)

    if max_allowed is None:
        return False, f"Blocked: no max trade rule for {from_token}."

    if numeric_amount <= 0:
        return False, "Blocked: amount must be greater than zero."

    if numeric_amount > max_allowed:
        return False, f"Blocked: {amount} {from_token} exceeds max allowed {max_allowed} {from_token}."

    if not quote_only and last_trade_time is not None:
        now = datetime.now(timezone.utc)
        seconds_since_last_trade = (now - last_trade_time).total_seconds()

        if seconds_since_last_trade < MIN_SECONDS_BETWEEN_TRADES:
            return False, f"Blocked: wait {MIN_SECONDS_BETWEEN_TRADES - int(seconds_since_last_trade)} seconds before another live trade."

    return True, "Trade request passed safety checks."


def mark_live_trade_executed():
    global last_trade_time
    last_trade_time = datetime.now(timezone.utc)
