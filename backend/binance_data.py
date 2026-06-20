import requests
import pandas as pd


def normalize_symbol(coin: str) -> str:
    coin = coin.upper().replace("/", "").replace("-", "")

    if coin.endswith("USDT"):
        return coin

    return coin + "USDT"


def normalize_timeframe(timeframe: str) -> str:
    tf = timeframe.upper()

    mapping = {
        "5M": "5m",
        "15M": "15m",
        "1H": "1h",
        "4H": "4h",
        "1D": "1d",
    }

    return mapping.get(tf, "4h")


def get_binance_klines(coin: str, timeframe: str, limit: int = 500):
    symbol = normalize_symbol(coin)
    interval = normalize_timeframe(timeframe)

    url = "https://api.binance.com/api/v3/klines"

    params = {
        "symbol": symbol,
        "interval": interval,
        "limit": limit
    }

    response = requests.get(url, params=params, timeout=20)
    response.raise_for_status()

    data = response.json()

    df = pd.DataFrame(
        data,
        columns=[
            "open_time",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "close_time",
            "quote_asset_volume",
            "number_of_trades",
            "taker_buy_base_volume",
            "taker_buy_quote_volume",
            "ignore"
        ]
    )

    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms")

    numeric_columns = [
        "open",
        "high",
        "low",
        "close",
        "volume",
        "quote_asset_volume",
        "taker_buy_base_volume",
        "taker_buy_quote_volume"
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    return df