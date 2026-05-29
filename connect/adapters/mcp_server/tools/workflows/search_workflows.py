from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.workflows.search_workflows import search_workflows as _search_workflows
from ._formatters import format_workflows


def search_workflows_tool(client: OpenJiuwenClient, keyword: str) -> str:
    """Search for workflows by keyword and return formatted results."""
    try:
        data = _search_workflows(client, keyword=keyword)
        return format_workflows(data)
    except Exception as exc:
        return f"ERROR searching workflows: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def search_workflows(keyword: str) -> str:
        """
        Search for workflows by keyword (searches name and description).

        Args:
            keyword: Search term
        """
        return search_workflows_tool(client, keyword=keyword)
