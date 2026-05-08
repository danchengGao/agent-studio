from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.general.health_check import health_check as _health_check


def health_check_tool(client: OpenJiuwenClient) -> str:
    """Check connectivity to the OpenJiuwen backend. Returns the backend status."""
    try:
        result = _health_check(client)
        return f"Backend is healthy. Status: {result}"
    except Exception as exc:
        return f"ERROR: Could not reach backend — {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def health_check() -> str:
        """Check connectivity to the OpenJiuwen backend. Returns the backend status."""
        return health_check_tool(client)
