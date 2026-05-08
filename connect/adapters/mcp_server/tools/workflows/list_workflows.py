from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.workflows.list_workflows import list_workflows as _list_workflows
from ._formatters import format_workflows


def list_workflows_tool(client: OpenJiuwenClient, page: int = 1, page_size: int = 20) -> str:
    """Return a formatted list of workflows in the space."""
    try:
        data = _list_workflows(client, page=page, page_size=page_size)
        return format_workflows(data)
    except Exception as exc:
        return f"ERROR listing workflows: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def list_workflows(page: int = 1, page_size: int = 20) -> str:
        """
        List workflows available in the connected OpenJiuwen space.

        Args:
            page: Page number (1-based, default 1)
            page_size: Number of workflows per page (default 20)
        """
        return list_workflows_tool(client, page=page, page_size=page_size)
