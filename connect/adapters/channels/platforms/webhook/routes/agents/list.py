"""List agents endpoint."""
from connect.client import OpenJiuwenClient
from connect.client.agents import list_agents
from ...auth import client_dep


def agent_list(client: OpenJiuwenClient = client_dep):
    try:
        result = list_agents(client)
        return {"success": True, "data": result.get("data", {}), "error": None}
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}
