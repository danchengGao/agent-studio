"""List workflows endpoint."""
from connect.client import OpenJiuwenClient
from connect.client.workflows import list_workflows
from ...auth import client_dep


def workflow_list(client: OpenJiuwenClient = client_dep):
    try:
        result = list_workflows(client)
        return {"success": True, "data": result.get("data", {}), "error": None}
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}
