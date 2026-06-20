import os
import uuid
import hmac
import base64
import hashlib
import requests
from email.utils import formatdate
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://tws.trustwallet.com"

ACCESS_ID = os.getenv("TWAK_ACCESS_ID")
HMAC_SECRET = os.getenv("TWAK_HMAC_SECRET")

print("ACCESS_ID =", ACCESS_ID)
print("SECRET LENGTH =", len(HMAC_SECRET) if HMAC_SECRET else 0)

BNB_NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
USDT_BSC = "0x55d398326f99059fF775485246999027B3197955"
FROM_ADDRESS = os.getenv("AGENT_WALLET_ADDRESS", "0x695b32DdB023f76dE3FE4de485F7C0131De4754C")


def sign_request(method, path, query, access_id, nonce, date, secret):
    payload = f"{method};{path};{query};{access_id};{nonce};{date}"

    digest = hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256
    ).digest()

    signature = base64.b64encode(digest).decode("utf-8")
    return f"HMAC-SHA256 Signature={signature}"


def get_route():
    method = "POST"
    path = "/amber-api/v1/route"
    query = ""

    body = {
    "fromAsset": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "fromAddress": FROM_ADDRESS,
    "fromDomain": "bsc",
    "amount": "100000000000000000",
    "toAsset": "0x55d398326f99059fF775485246999027B3197955",
    "toDomain": "bsc",
    "slippage": "1"
    }

    nonce = str(uuid.uuid4())
    date = formatdate(timeval=None, localtime=False, usegmt=True)

    print("BODY:")
    print(body)

    print("SIGNED PAYLOAD:")
    print(f"{method};{path};{query};{ACCESS_ID};{nonce};{date}")

    headers = {
        "X-TW-CREDENTIAL": ACCESS_ID,
        "X-TW-NONCE": nonce,
        "X-TW-DATE": date,
        "Authorization": sign_request(
            method,
            path,
            query,
            ACCESS_ID,
            nonce,
            date,
            HMAC_SECRET
        ),
        "Content-Type": "application/json"
    }

    url = f"{BASE_URL}{path}"

    response = requests.post(url, headers=headers, json=body, timeout=20)

    print("STATUS:", response.status_code)
    print(response.text)


if __name__ == "__main__":
    get_route()