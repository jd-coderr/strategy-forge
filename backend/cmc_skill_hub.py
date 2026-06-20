import os

CMC_SKILL_HUB_URL = "https://mcp.coinmarketcap.com/skill-hub/stream"


async def find_cmc_skill(query: str = "btc price"):
    """Find a CMC MCP skill without making the whole backend depend on MCP at import time."""
    api_key = os.getenv("CMC_MCP_API_KEY")

    if not api_key:
        return {
            "ok": False,
            "error": "CMC_MCP_API_KEY is not configured",
        }

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client
    except Exception as error:
        return {
            "ok": False,
            "error": f"CMC Skill Hub MCP client unavailable: {error}",
        }

    headers = {
        "X-CMC-MCP-API-KEY": api_key,
    }

    try:
        async with streamablehttp_client(
            CMC_SKILL_HUB_URL,
            headers=headers,
        ) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()

                result = await session.call_tool(
                    "find_skill",
                    {"query": query},
                )

                return {
                    "ok": True,
                    "query": query,
                    "source": "CMC Skill Hub MCP",
                    "result": result,
                }
    except Exception as error:
        return {
            "ok": False,
            "query": query,
            "source": "CMC Skill Hub MCP",
            "error": str(error),
        }
