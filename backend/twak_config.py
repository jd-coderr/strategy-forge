import os
import subprocess
from dotenv import load_dotenv

load_dotenv()


def get_live_twak_agent_address():
    try:
        result = subprocess.run(
            ["npx", "@trustwallet/cli", "wallet", "address", "--chain", "bsc"],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()

    except Exception:
        pass

    return os.getenv("TWAK_AGENT_ADDRESS")


def get_twak_status():
    agent_address = get_live_twak_agent_address()

    return {
        "status": "configured" if agent_address else "missing",
        "agent_address": agent_address,
        "chain": "BSC",
        "registration": "ready" if agent_address else "not_ready",
    }