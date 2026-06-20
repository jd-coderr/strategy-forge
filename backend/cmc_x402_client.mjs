"""CoinMarketCap x402 paid market-data client.

This module is intentionally optional and safe by default. It only spends USDC
when X402_ENABLED=true and X402_EVM_PRIVATE_KEY or EVM_PRIVATE_KEY is set.
If disabled or misconfigured, the normal CMC API flow still works and the agent
returns an x402 status object explaining what is missing.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

CMC_X402_QUOTES_URL = "https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest"
X402_PAYMENT_NETWORK = "Base"
X402_PAYMENT_CHAIN_ID = 8453
X402_PAYMENT_ASSET = "USDC"
X402_EXPECTED_PRICE_USD = "0.01"


def env_flag(name: str, default: str = "false") -> bool:
    return str(os.getenv(name, default)).strip().lower() in {"1", "true", "yes", "on"}


def normalize_symbol(coin: str) -> str:
    symbol = str(coin or "ETH").upper().replace("USDT", "").replace("/", "").replace("-", "").strip()
    return symbol or "ETH"


def _safe_payment_settlement(value: Any) -> Any:
    """Return payment-settlement proof without exposing signatures/private data."""
    if value is None:
        return None

    try:
        if isinstance(value, dict):
            redacted = {}
            for key, item in value.items():
                key_text = str(key).lower()
                if any(secret_word in key_text for secret_word in ("signature", "authorization", "payload", "token", "private")):
                    redacted[key] = "REDACTED"
                else:
                    redacted[key] = item
            return redacted
    except Exception:
        pass

    text = str(value)
    if len(text) > 500:
        return text[:500] + "..."
    return text


def extract_cmc_price(payload: dict, symbol: str) -> float | None:
    try:
        data = payload.get("data") or {}
        coin_data = data.get(symbol) or data.get(symbol.upper()) or next(iter(data.values()))
        price = coin_data["quote"]["USD"]["price"]
        return float(price)
    except Exception:
        return None


def get_cmc_x402_quote(coin: str = "ETH") -> dict:
    """Pay for a CMC quote through x402 and return judge-friendly proof.

    Required Railway/backend env vars for real paid mode:
    - X402_ENABLED=true
    - X402_EVM_PRIVATE_KEY or EVM_PRIVATE_KEY: Base wallet private key with USDC and ETH.

    This does not use a CMC API key. The x402 payment is the access mechanism.
    """
    symbol = normalize_symbol(coin)
    x402_enabled = env_flag("X402_ENABLED", "false")
    private_key = os.getenv("X402_EVM_PRIVATE_KEY") or os.getenv("EVM_PRIVATE_KEY")

    proof = {
        "enabled": x402_enabled,
        "configured": bool(private_key),
        "success": False,
        "paid": False,
        "used_in_decision": False,
        "provider": "CoinMarketCap",
        "protocol": "x402",
        "endpoint": CMC_X402_QUOTES_URL,
        "tool": "cryptocurrency quotes latest",
        "symbol": symbol,
        "payment_network": X402_PAYMENT_NETWORK,
        "payment_chain_id": X402_PAYMENT_CHAIN_ID,
        "payment_asset": X402_PAYMENT_ASSET,
        "expected_price_usd": X402_EXPECTED_PRICE_USD,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if not x402_enabled:
        return {
            **proof,
            "status": "disabled",
            "message": "Set X402_ENABLED=true to allow paid CMC x402 requests. Disabled mode spends no USDC.",
        }

    if not private_key:
        return {
            **proof,
            "status": "not_configured",
            "message": "Set X402_EVM_PRIVATE_KEY or EVM_PRIVATE_KEY with a Base wallet funded with USDC and ETH.",
        }

    try:
        from eth_account import Account
        from x402 import x402ClientSync
        from x402.http import x402HTTPClientSync
        from x402.http.clients import x402_requests
        from x402.mechanisms.evm import EthAccountSigner
        from x402.mechanisms.evm.exact.register import register_exact_evm_client
    except Exception as error:
        return {
            **proof,
            "status": "missing_dependency",
            "message": "Install x402[requests] and eth-account in requirements.txt.",
            "error": str(error),
        }

    try:
        client = x402ClientSync()
        account = Account.from_key(private_key)
        register_exact_evm_client(client, EthAccountSigner(account))
        http_client = x402HTTPClientSync(client)

        with x402_requests(client) as session:
            response = session.get(
                CMC_X402_QUOTES_URL,
                params={"symbol": symbol},
                timeout=30,
            )

            try:
                payload = response.json() if response.text else {}
            except Exception:
                payload = {"raw_response": response.text[:500]}

            settle_response = None

            if response.ok:
                try:
                    settle_response = http_client.get_payment_settle_response(
                        lambda name: response.headers.get(name)
                    )
                except Exception as settle_error:
                    settle_response = {"settlement_parse_error": str(settle_error)}

            price_usd = extract_cmc_price(payload, symbol)
            success = bool(response.ok and price_usd is not None)

            safe_headers = {
                key: value
                for key, value in dict(response.headers).items()
                if key.lower() not in {
                    "authorization",
                    "payment",
                    "payment-signature",
                    "x-api-key",
                    "cookie",
                    "set-cookie",
                }
            }

            response_body_preview = payload
            if isinstance(response_body_preview, dict):
                response_body_preview = {
                    key: value
                    for key, value in response_body_preview.items()
                    if str(key).lower() not in {
                        "authorization",
                        "payment",
                        "payment-signature",
                        "signature",
                        "private_key",
                        "token",
                    }
                }

            return {
                **proof,
                "enabled": True,
                "configured": True,
                "success": success,
                "paid": bool(response.ok),
                "used_in_decision": success,
                "status": "paid" if response.ok else "request_failed",
                "http_status": response.status_code,
                "price_usd": price_usd,
                "payment_response": _safe_payment_settlement(settle_response),
                "payment_response_header_present": bool(response.headers.get("PAYMENT-RESPONSE")),
                "response_headers": safe_headers,
                "response_body_preview": response_body_preview,
                "message": (
                    "CMC x402 quote paid and used in the agent decision."
                    if success
                    else "CMC x402 request returned but no usable USD price was parsed."
                    if response.ok
                    else "CMC x402 request failed. Inspect response_headers and response_body_preview."
                ),
            }

    except Exception as error:
        return {
            **proof,
            "enabled": True,
            "configured": True,
            "status": "error",
            "message": "CMC x402 paid request failed.",
            "error": str(error),
        }