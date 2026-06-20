import requests
import pandas as pd


BINANCE_KLINE_ENDPOINTS = [
    "https://api.binance.com/api/v3/klines",
    "https://api1.binance.com/api/v3/klines",
    "https://api.binance.us/api/v3/klines",
]


def fetch_binance_klines(symbol: str, interval: str = "4h", limit: int = 500):
    params = {
        "symbol": symbol.upper(),
        "interval": interval,
        "limit": limit,
    }

    last_error = None
    data = None
    used_url = None

    for url in BINANCE_KLINE_ENDPOINTS:
        try:
            response = requests.get(url, params=params, timeout=12)
            response.raise_for_status()
            data = response.json()
            used_url = url
            break
        except Exception as error:
            last_error = error

    if data is None:
        raise RuntimeError(
            f"Binance kline lookup failed for {params['symbol']} {interval}: {last_error}"
        )

    if not isinstance(data, list) or len(data) == 0:
        raise RuntimeError(
            f"Binance kline lookup returned no candles for {params['symbol']} {interval} from {used_url}."
        )

    df = pd.DataFrame(data, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_asset_volume", "number_of_trades",
        "taker_buy_base_volume", "taker_buy_quote_volume", "ignore",
    ])

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
        "taker_buy_quote_volume",
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=["open", "high", "low", "close", "volume"])

    if df.empty:
        raise RuntimeError(
            f"Binance kline lookup produced no valid numeric candles for {params['symbol']} {interval}."
        )

    return df
