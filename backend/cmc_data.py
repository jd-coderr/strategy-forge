import os
import requests
from dotenv import load_dotenv

load_dotenv()

CMC_API_KEY = os.getenv("CMC_API_KEY")


def classify_fear_greed(value):
    if value <= 24:
        return "Extreme Fear"
    if value <= 44:
        return "Fear"
    if value <= 55:
        return "Neutral"
    if value <= 75:
        return "Greed"
    return "Extreme Greed"


def classify_altcoin_season(value):
    if value >= 75:
        return "Altcoin Season"
    if value <= 25:
        return "Bitcoin Season"
    return "Neutral Rotation"


def get_cmc_fear_greed():
    if not CMC_API_KEY:
        return {
            "status": "missing_api_key",
            "value": None,
            "label": "unknown"
        }

    url = "https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest"

    headers = {
        "Accepts": "application/json",
        "X-CMC_PRO_API_KEY": CMC_API_KEY
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        value = int(data["data"]["value"])

        return {
            "status": "active",
            "value": value,
            "label": data["data"].get("value_classification", classify_fear_greed(value)),
            "last_updated": data["data"].get("update_time")
        }

    except Exception as error:
        return {
            "status": "error",
            "message": str(error),
            "value": None,
            "label": "unknown"
        }


def get_cmc_altcoin_season():
    if not CMC_API_KEY:
        return {
            "status": "missing_api_key",
            "value": None,
            "label": "unknown"
        }

    url = "https://pro-api.coinmarketcap.com/v1/altcoin-season-index/latest"

    headers = {
        "Accepts": "application/json",
        "X-CMC_PRO_API_KEY": CMC_API_KEY
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        value = int(data["data"]["altcoin_index"])

        return {
            "status": "active",
            "value": value,
            "label": classify_altcoin_season(value),
            "snapshot_time": data["data"].get("snapshot_time"),
            "yearly_high": data["data"].get("yearly_high"),
            "yearly_low": data["data"].get("yearly_low")
        }

    except Exception as error:
        return {
            "status": "error",
            "message": str(error),
            "value": None,
            "label": "unknown"
        }


def get_cmc_signal(coin: str):
    if not CMC_API_KEY:
        return {
            "source": "CoinMarketCap",
            "status": "missing_api_key",
            "message": "CMC_API_KEY is not configured.",
            "market_bias": "unknown"
        }

    symbol = coin.upper().replace("USDT", "").replace("/", "").replace("-", "")

    url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest"

    headers = {
        "Accepts": "application/json",
        "X-CMC_PRO_API_KEY": CMC_API_KEY
    }

    params = {
        "symbol": symbol,
        "convert": "USD"
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()

        data = response.json()

        token = data["data"][symbol]
        quote = token["quote"]["USD"]

        percent_change_24h = quote.get("percent_change_24h", 0)
        percent_change_7d = quote.get("percent_change_7d", 0)
        volume_change_24h = quote.get("volume_change_24h", 0)

        if percent_change_24h > 1 and percent_change_7d > 1:
            market_bias = "bullish"
        elif percent_change_24h < -1 and percent_change_7d < -1:
            market_bias = "bearish"
        else:
            market_bias = "neutral"

        fear_greed = get_cmc_fear_greed()
        altcoin_season = get_cmc_altcoin_season()

        return {
            "source": "CoinMarketCap",
            "status": "active",
            "symbol": symbol,
            "name": token.get("name"),
            "price_usd": quote.get("price", 0),
            "volume_24h": quote.get("volume_24h", 0),
            "volume_change_24h": volume_change_24h,
            "percent_change_1h": quote.get("percent_change_1h", 0),
            "percent_change_24h": percent_change_24h,
            "percent_change_7d": percent_change_7d,
            "market_cap": quote.get("market_cap", 0),
            "market_bias": market_bias,
            "fear_greed": fear_greed,
            "altcoin_season": altcoin_season
        }

    except Exception as error:
        return {
            "source": "CoinMarketCap",
            "status": "error",
            "message": str(error),
            "market_bias": "unknown"
        }