"""Search workflows endpoint."""
from fastapi import Query

from connect.client import OpenJiuwenClient
from connect.client.workflows import search_workflows
from ...auth import client_dep


def workflow_search(
    keyword: str = Query(...),
    client: OpenJiuwenClient = client_dep,
):
    try:
        result = search_workflows(client, keyword)
        return {"success": True, "data": result.get("data", {}), "error": None}
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}
