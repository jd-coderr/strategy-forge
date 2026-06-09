import os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

CMC_SKILL_HUB_URL = "https://mcp.coinmarketcap.com/skill-hub/stream"


async def find_cmc_skill(query: str = "btc price"):
    api_key = os.getenv("CMC_MCP_API_KEY")

    if not api_key:
        return {
            "ok": False,
            "error": "CMC_MCP_API_KEY is not configured"
        }

    headers = {
        "X-CMC-MCP-API-KEY": api_key
    }

    async with streamablehttp_client(
        CMC_SKILL_HUB_URL,
        headers=headers
    ) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            result = await session.call_tool(
                "find_skill",
                {
                    "query": query
                }
            )

            return {
                "ok": True,
                "query": query,
                "source": "CMC Skill Hub MCP",
                "result": result
            }