"""Agent routes package."""
from fastapi import APIRouter

from ...auth import api_key_dep
from .models import RunRequest
from .list import agent_list
from .search import agent_search
from .run import agent_run

router = APIRouter(prefix="/agents", tags=["Agents"])

router.add_api_route("/list", agent_list, methods=["GET"], summary="List all agents", dependencies=[api_key_dep])
router.add_api_route("/search", agent_search, methods=["GET"], summary="Search agents by keyword",
                     dependencies=[api_key_dep])
router.add_api_route("/execute", agent_run, methods=["POST"],
                     summary="Send a message to an agent and return the response", dependencies=[api_key_dep])

__all__ = [
    "router",
    "RunRequest",
    "agent_list", "agent_search", "agent_run",
]
