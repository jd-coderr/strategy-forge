import os
import shutil
import subprocess
from typing import Optional
import json

def get_twak_command():
    if os.name == "nt":
        return get_twak_command(),

    return shutil.which("twak") or "twak"


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
        get_twak_command(),
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
    cmd = [
        get_twak_command(),
        "wallet",
        "portfolio",
        "--chains",
        "bsc",
        "--json",
    ]

    print("TWAK PORTFOLIO COMMAND:", cmd)

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )

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