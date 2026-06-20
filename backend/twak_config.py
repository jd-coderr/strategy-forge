import os
import subprocess
from dotenv import load_dotenv

load_dotenv()

DEFAULT_AGENT_WALLET_ADDRESS = "0x695b32DdB023f76dE3FE4de485F7C0131De4754C"


def clean_address(value):
    if not value:
        return None

    value = str(value).strip()

    if value.startswith("0x") and len(value) == 42:
        return value

    return None


def get_configured_agent_address():
    """Address the app should display and use for portfolio checks."""
    return (
        clean_address(os.getenv("AGENT_WALLET_ADDRESS"))
        or clean_address(os.getenv("TWAK_AGENT_ADDRESS"))
        or DEFAULT_AGENT_WALLET_ADDRESS
    )


def get_live_twak_agent_address():
    """Address currently reported by the local TWAK CLI, if available."""
    try:
        result = subprocess.run(
            ["npx", "@trustwallet/cli", "wallet", "address", "--chain", "bsc"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        output = result.stdout.strip()

        if result.returncode == 0 and "0x" in output:
            start = output.find("0x")
            return clean_address(output[start:start + 42])

    except Exception:
        pass

    return None


def get_twak_status():
    configured_agent_address = get_configured_agent_address()
    live_cli_agent_address = get_live_twak_agent_address()

    return {
        "status": "configured" if configured_agent_address else "missing",
        "agent_address": configured_agent_address,
        "configured_agent_address": configured_agent_address,
        "live_cli_agent_address": live_cli_agent_address,
        "cli_address_matches_configured": (
            live_cli_agent_address is not None
            and configured_agent_address is not None
            and live_cli_agent_address.lower() == configured_agent_address.lower()
        ),
        "chain": "BSC",
        "registration": "ready" if configured_agent_address else "not_ready",
    }
