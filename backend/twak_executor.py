import os
import shutil
import subprocess
from typing import Optional
import json

def get_twak_base_command():
    if os.name == "nt":
        return [r"C:\Users\oo\AppData\Roaming\npm\twak.cmd"]

    if shutil.which("twak"):
        return ["twak"]

    return ["npx", "@trustwallet/cli"]

def ensure_twak_wallet():
    private_key = os.getenv("TWAK_PRIVATE_KEY")
    password = os.getenv("TWAK_WALLET_PASSWORD")

    if not private_key:
        print("TWAK WALLET IMPORT SKIPPED: TWAK_PRIVATE_KEY missing")
        return

    if not password:
        print("TWAK WALLET IMPORT SKIPPED: TWAK_WALLET_PASSWORD missing")
        return

    cmd = [
        *get_twak_base_command(),
        "wallet",
        "import",
        private_key,
        "--password",
        password,
    ]

    safe_cmd = [
        "***" if part == private_key or part == password else part
        for part in cmd
    ]

    print("TWAK WALLET IMPORT COMMAND:", safe_cmd)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )

        print("TWAK WALLET IMPORT RETURNCODE:", result.returncode)
        print("TWAK WALLET IMPORT STDOUT:", result.stdout)
        print("TWAK WALLET IMPORT STDERR:", result.stderr)

    except Exception as error:
        print("TWAK WALLET IMPORT ERROR:", str(error))


def run_twak_swap(
    amount: str,
    from_token: str,
    to_token: str,
    chain: str = "bsc",
    slippage: str = "1",
    quote_only: bool = True,
    password: Optional[str] = None,
):
    ensure_twak_wallet()

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

    print("TWAK COMMAND:", cmd)

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )

    return {
        "success": result.returncode == 0,
        "command": " ".join(cmd).replace(password or "", "***")
        if password
        else " ".join(cmd),
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
    }

def run_twak_portfolio():
    ensure_twak_wallet()

    cmd = [
        *get_twak_base_command(),
        "wallet",
        "portfolio",
        "--chains",
        "bsc",
        "--json",
    ]

    print("TWAK PORTFOLIO COMMAND:", cmd)

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
            "stdout": "",
            "stderr": str(error),
            "returncode": None,
            "command": " ".join(cmd),
            "message": "TWAK CLI is not installed on this server. Portfolio works only on local backend unless TWAK/Node is installed on Railway.",
        }

    parsed = None

    try:
        parsed = json.loads(result.stdout)
    except Exception:
        parsed = None

    return {
        "success": parsed is not None,
        "command": " ".join(cmd),
        "portfolio": parsed,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
    }