"""
MCP tool registration hub.

Calls register() from each individual tool module. Each module owns both
the @mcp.tool() registration and its business logic.
"""
from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from .get_workflow import register as register_get_workflow
from .list_workflows import register as register_list_workflows
from .run_workflow import register as register_run_workflow
from .search_workflows import register as register_search_workflows


def register_all(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    """Register every MCP tool onto *mcp* with the given *client*."""
    register_list_workflows(mcp, client)
    register_search_workflows(mcp, client)
    register_get_workflow(mcp, client)
    register_run_workflow(mcp, client)
