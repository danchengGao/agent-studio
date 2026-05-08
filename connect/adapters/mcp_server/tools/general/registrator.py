"""
MCP tool registration hub.

Calls register() from each individual tool module. Each module owns both
the @mcp.tool() registration and its business logic.
"""
from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from .health import register as register_health


def register_all(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    """Register every MCP tool onto *mcp* with the given *client*."""
    register_health(mcp, client)
