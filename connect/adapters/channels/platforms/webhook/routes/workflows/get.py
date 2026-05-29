"""Get workflow endpoint."""
from fastapi import Query

from connect.client import OpenJiuwenClient
from connect.client.workflows.get_workflow import get_workflow
from ...auth import client_dep


def workflow_get(
    workflow_id: str = Query(...),
    client: OpenJiuwenClient = client_dep,
):
    try:
        result = get_workflow(client, workflow_id)
        return {"success": True, "data": result.get("data", {}), "error": None}
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}
