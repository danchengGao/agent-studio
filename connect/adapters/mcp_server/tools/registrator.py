"""
MCP tool registration hub.

Calls register() from each individual tool module. Each module owns both
the @mcp.tool() registration and its business logic.
"""
from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from .agents import register_all_agents
from .general import register_all_general
from .workflows import register_all_workflows


def register_all(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    """Register every MCP tool onto *mcp* with the given *client*."""
    register_all_agents(mcp, client)
    register_all_general(mcp, client)
    register_all_workflows(mcp, client)
