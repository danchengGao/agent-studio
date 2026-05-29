"""Search agents endpoint."""
from fastapi import Query

from connect.client import OpenJiuwenClient
from connect.client.agents import search_agents
from ...auth import client_dep


def agent_search(
    keyword: str = Query(...),
    client: OpenJiuwenClient = client_dep,
):
    try:
        result = search_agents(client, keyword)
        return {"success": True, "data": result.get("data", {}), "error": None}
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}
