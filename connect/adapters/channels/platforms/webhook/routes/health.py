"""Health check endpoint."""
from fastapi import APIRouter

from connect.client import OpenJiuwenClient
from connect.client.general.health_check import health_check
from ..auth import client_dep

router = APIRouter(tags=["General"])


@router.get("/health", summary="Check webhook server and backend health")
def get_health(client: OpenJiuwenClient = client_dep):
    """Returns the backend health status."""
    try:
        result = health_check(client)
        return {"webhook": "ok", "backend": result}
    except Exception as e:
        return {"webhook": "ok", "backend": "unreachable", "error": str(e)}
