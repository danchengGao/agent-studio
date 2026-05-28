from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.workflows.get_workflow import get_workflow as _get_workflow
from ._formatters import format_workflow_detail


def get_workflow_tool(client: OpenJiuwenClient, workflow_id: str) -> str:
    """Fetch a workflow's full definition and format its input parameters."""
    try:
        data = _get_workflow(client, workflow_id)
        return format_workflow_detail(data)
    except Exception as exc:
        return f"ERROR fetching workflow: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def get_workflow(workflow_id: str) -> str:
        """
        Get the full definition of a workflow, including its input parameters.

        Use this before run_workflow() to know what inputs the workflow expects.

        Args:
            workflow_id: The workflow's ID (from list_workflows or search_workflows)
        """
        return get_workflow_tool(client, workflow_id)
