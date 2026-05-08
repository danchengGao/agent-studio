from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.agents.list_agents import list_agents as _list_agents
from ._formatters import format_agents


def list_agents_tool(client: OpenJiuwenClient, page: int = 1, page_size: int = 20) -> str:
    """Return a formatted list of agents in the space."""
    try:
        data = _list_agents(client, page=page, page_size=page_size)
        return format_agents(data)
    except Exception as exc:
        return f"ERROR listing agents: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def list_agents(page: int = 1, page_size: int = 20) -> str:
        """
        List agents available in the connected OpenJiuwen space.

        Args:
            page: Page number (1-based, default 1)
            page_size: Number of agents per page (default 20)
        """
        return list_agents_tool(client, page=page, page_size=page_size)
