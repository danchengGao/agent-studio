from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.agents.get_agent import get_agent as _get_agent
from ._formatters import format_agent_detail


def get_agent_tool(client: OpenJiuwenClient, agent_id: str) -> str:
    """Fetch an agent's full definition and format it."""
    try:
        data = _get_agent(client, agent_id)
        return format_agent_detail(data)
    except Exception as exc:
        return f"ERROR fetching agent: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def get_agent(agent_id: str) -> str:
        """
        Get the full definition of an agent, including its description and model.

        Use this before run_agent() to understand what the agent does.

        Args:
            agent_id: The agent's ID (from list_agents or search_agents)
        """
        return get_agent_tool(client, agent_id)
