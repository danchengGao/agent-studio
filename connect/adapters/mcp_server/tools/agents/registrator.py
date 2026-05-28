"""
MCP tool registration hub.

Calls register() from each individual tool module. Each module owns both
the @mcp.tool() registration and its business logic.
"""
from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from .get_agent import register as register_get_agent
from .list_agents import register as register_list_agents
from .reset_agent import register as register_reset_agent
from .run_agent import register as register_run_agent
from .search_agents import register as register_search_agents


def register_all(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    """Register every MCP tool onto *mcp* with the given *client*."""
    register_list_agents(mcp, client)
    register_search_agents(mcp, client)
    register_get_agent(mcp, client)
    register_run_agent(mcp, client)
    register_reset_agent(mcp, client)
