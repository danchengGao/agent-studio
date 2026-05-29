"""Run workflow endpoint."""
from connect.client import OpenJiuwenClient
from connect.client.workflows.execute_workflow import execute_workflow
from connect.client.workflows import parse_workflow_result
from ...auth import client_dep
from .models import RunRequest


def workflow_run(
    body: RunRequest,
    client: OpenJiuwenClient = client_dep,
):
    """Execute a workflow synchronously and return the final outputs.

    The call blocks until the workflow finishes (or fails).
    For long-running workflows this may take a while — callers should set
    an appropriate HTTP timeout.
    """
    try:
        events = execute_workflow(client, body.workflow_id, body.inputs)
        outputs, error = parse_workflow_result(events)
        if error:
            return {"success": False, "outputs": None, "error": error}
        return {"success": True, "outputs": outputs, "error": None}
    except Exception as e:
        return {"success": False, "outputs": None, "error": str(e)}
