"""Deprecated direct PancakeSwap helper.

Real live execution for IKQF must go through TWAK (`twak_executor.run_twak_swap`).
These stubs prevent accidental import/runtime crashes while making direct PancakeSwap use explicit.
"""


def _disabled(*_args, **_kwargs):
    return {
        "success": False,
        "blocked": True,
        "execution_layer": "disabled_direct_pancakeswap",
        "message": "Direct PancakeSwap execution is disabled. Use TWAK swap interface instead.",
    }


def get_quote(*args, **kwargs):
    return _disabled(*args, **kwargs)


def build_swap(*args, **kwargs):
    return _disabled(*args, **kwargs)


def execute_swap(*args, **kwargs):
    return _disabled(*args, **kwargs)


def get_token_balance(*args, **kwargs):
    return _disabled(*args, **kwargs)


def get_usdt_balance(*args, **kwargs):
    return _disabled(*args, **kwargs)
