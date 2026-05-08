from typing import Any, Dict, Optional

from mcp.server.fastmcp import FastMCP

from connect.client.client import OpenJiuwenClient
from connect.client.workflows.execute_workflow import execute_workflow as _execute_workflow
from connect.client.workflows.result_parser import parse_workflow_result


def run_workflow_tool(
    client: OpenJiuwenClient,
    workflow_id: str,
    inputs: Optional[Dict[str, Any]] = None,
) -> str:
    """Execute a workflow and return its outputs as formatted text."""
    try:
        events = _execute_workflow(client, workflow_id, inputs or {})
        outputs, error = parse_workflow_result(events)
        if error:
            return f"ERROR from workflow: {error}"
        if not outputs:
            return "Workflow completed with no output."
        if len(outputs) == 1:
            return str(next(iter(outputs.values())))
        return "\n".join(f"{k}: {v}" for k, v in outputs.items())
    except Exception as exc:
        return f"ERROR running workflow: {exc}"


def register(mcp: FastMCP, client: OpenJiuwenClient) -> None:
    @mcp.tool()
    def run_workflow(workflow_id: str, inputs: Optional[Dict[str, Any]] = None) -> str:
        """
        Execute a workflow and return its outputs.

        Use get_workflow() first to see what input parameters the workflow requires.

        Args:
            workflow_id: The workflow's ID (from list_workflows or search_workflows)
            inputs: Dictionary of input parameter values expected by the workflow (optional)

        Returns:
            The workflow's output values as formatted text.
        """
        return run_workflow_tool(client, workflow_id, inputs)
