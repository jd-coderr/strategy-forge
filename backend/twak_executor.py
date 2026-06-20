import os
import shutil
import subprocess
from typing import Optional
import json


DEFAULT_AGENT_WALLET_ADDRESS = "0x695b32DdB023f76dE3FE4de485F7C0131De4754C"


def clean_address(value: Optional[str]):
    if not value:
        return None

    value = str(value).strip()

    if value.startswith("0x") and len(value) == 42:
        return value

    return None


def get_agent_wallet_address(address: Optional[str] = None):
    return (
        clean_address(address)
        or clean_address(os.getenv("AGENT_WALLET_ADDRESS"))
        or clean_address(os.getenv("TWAK_AGENT_ADDRESS"))
        or DEFAULT_AGENT_WALLET_ADDRESS
    )


def extract_portfolio_items(parsed):
    if isinstance(parsed, list):
        return parsed

    if isinstance(parsed, dict):
        for key in ("portfolio", "assets", "balances", "tokens"):
            value = parsed.get(key)
            if isinstance(value, list):
                return value

        for key in ("result", "data", "event"):
            value = parsed.get(key)
            nested = extract_portfolio_items(value)
            if nested:
                return nested

    return []


def get_twak_base_command():
    if os.name == "nt":
        return [r"C:\Users\oo\AppData\Roaming\npm\twak.cmd"]

    if shutil.which("twak"):
        return ["twak"]

    return ["npx", "@trustwallet/cli"]


def run_twak_swap(
    amount: str,
    from_token: str,
    to_token: str,
    chain: str = "bsc",
    slippage: str = "1",
    quote_only: bool = True,
    password: Optional[str] = None,
):
    cmd = [
        *get_twak_base_command(),
        "swap",
        amount,
        from_token,
        to_token,
        "--chain",
        chain,
        "--slippage",
        slippage,
        "--json",
    ]

    if quote_only:
        cmd.append("--quote-only")

    if password:
        cmd.extend(["--password", password])

    safe_command = " ".join(cmd)
    if password:
        safe_command = safe_command.replace(password, "***")

    print("TWAK COMMAND:", safe_command, flush=True)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )

        print("TWAK SWAP RETURNCODE:", result.returncode, flush=True)
        print("TWAK SWAP STDOUT:", result.stdout, flush=True)
        print("TWAK SWAP STDERR:", result.stderr, flush=True)

        return {
            "success": result.returncode == 0,
            "command": safe_command,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }

    except subprocess.TimeoutExpired as error:
        print("TWAK SWAP TIMEOUT:", str(error), flush=True)

        return {
            "success": False,
            "command": safe_command,
            "stdout": error.stdout or "",
            "stderr": error.stderr or "TWAK swap timed out after 300 seconds.",
            "returncode": None,
            "error": "TIMEOUT",
        }

    except Exception as error:
        print("TWAK SWAP ERROR:", str(error), flush=True)

        return {
            "success": False,
            "command": safe_command,
            "stdout": "",
            "stderr": str(error),
            "returncode": None,
            "error": "EXCEPTION",
        }


def run_twak_portfolio(address: Optional[str] = None, chain: str = "bsc"):
    target_address = get_agent_wallet_address(address)
    base_command = get_twak_base_command()

    if target_address:
        command_attempts = [
            [
                *base_command,
                "wallet",
                "portfolio",
                "--chains",
                chain,
                "--address",
                target_address,
                "--json",
            ],
            [
                *base_command,
                "wallet",
                "portfolio",
                "--address",
                target_address,
                "--chains",
                chain,
                "--json",
            ],
            [
                *base_command,
                "wallet",
                "portfolio",
                target_address,
                "--chains",
                chain,
                "--json",
            ],
        ]
    else:
        command_attempts = [
            [
                *base_command,
                "wallet",
                "portfolio",
                "--chains",
                chain,
                "--json",
            ]
        ]

    attempts = []

    for cmd in command_attempts:
        print("TWAK PORTFOLIO COMMAND:", cmd, flush=True)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
            )
        except FileNotFoundError as error:
            return {
                "success": False,
                "portfolio": [],
                "raw_portfolio_response": None,
                "address": target_address,
                "address_used": target_address,
                "chain": chain,
                "stdout": "",
                "stderr": str(error),
                "returncode": None,
                "command": " ".join(cmd),
                "message": "TWAK CLI is not installed on this server.",
            }

        parsed = None
        portfolio_items = []

        try:
            parsed = json.loads(result.stdout)
            portfolio_items = extract_portfolio_items(parsed)
        except Exception:
            parsed = None
            portfolio_items = []

        attempt = {
            "command": " ".join(cmd),
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "parsed": parsed is not None,
            "portfolio_item_count": len(portfolio_items),
        }
        attempts.append(attempt)

        if result.returncode == 0 and parsed is not None:
            return {
                "success": True,
                "command": " ".join(cmd),
                "portfolio": portfolio_items,
                "raw_portfolio_response": parsed,
                "address": target_address,
                "address_used": target_address,
                "chain": chain,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "attempts": attempts,
            }

    return {
        "success": False,
        "portfolio": [],
        "raw_portfolio_response": None,
        "address": target_address,
        "address_used": target_address,
        "chain": chain,
        "stdout": attempts[-1]["stdout"] if attempts else "",
        "stderr": attempts[-1]["stderr"] if attempts else "No TWAK command was attempted.",
        "returncode": attempts[-1]["returncode"] if attempts else None,
        "command": attempts[-1]["command"] if attempts else "",
        "attempts": attempts,
        "message": f"TWAK portfolio lookup failed for agent address {target_address}.",
    }

