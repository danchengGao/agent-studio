from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.agents.search_agents import search_agents as _search_agents
from ._formatters import format_agents


def search_agents_tool(client: OpenJiuwenClient, keyword: str) -> str:
    """Search for agents by keyword and return formatted results."""
    try:
        data = _search_agents(client, keyword=keyword)
        return format_agents(data)
    except Exception as exc:
        return f"ERROR searching agents: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def search_agents(keyword: str) -> str:
        """
        Search for agents by keyword (searches name and description).

        Args:
            keyword: Search term
        """
        return search_agents_tool(client, keyword=keyword)
