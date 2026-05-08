"""Agent search command."""
from openjiuwen.core.common.logging import logger
from connect.client.agents import search_agents

from ...session import require_client
from ...output import print_agents


def cmd_agent_search(backend_url: str, keyword: str) -> None:
    client = require_client(backend_url)
    try:
        result = search_agents(client, keyword)
        agents = result.get('data', {}).get('agent_items', [])
        if not agents:
            logger.info(f"ℹ️  No agents found matching '{keyword}'.")
            return
        print_agents(agents)
    except Exception as e:
        error = f"❌ {e}"
        logger.error(error)
        raise RuntimeError(error) from e

