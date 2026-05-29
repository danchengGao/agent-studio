"""Demo 1 endpoint."""
from openjiuwen.core.common.logging import logger
from connect.client import OpenJiuwenClient
from ...auth import client_dep
from .models import RunRequest


def workflow_demo1(
    body: RunRequest,
    client: OpenJiuwenClient = client_dep,
):
    message = "✅ Demo 1 Will be triggered here"
    logger.info(message)
    return {"success": True, "data": {"message": message}, "error": None}
