"""Workflow routes package."""
from fastapi import APIRouter

from ...auth import api_key_dep
from .models import RunRequest
from .list import workflow_list
from .search import workflow_search
from .get import workflow_get
from .run import workflow_run
from .demo1 import workflow_demo1
from .demo2 import workflow_demo2

router = APIRouter(prefix="/workflows", tags=["Workflows"])

router.add_api_route("/list", workflow_list, methods=["GET"], summary="List all workflows",
                     dependencies=[api_key_dep])
router.add_api_route("/search", workflow_search, methods=["GET"], summary="Search workflows by keyword",
                     dependencies=[api_key_dep])
router.add_api_route("/get", workflow_get, methods=["GET"], summary="Get workflow details",
                     dependencies=[api_key_dep])
router.add_api_route("/execute", workflow_run, methods=["POST"], summary="Execute a workflow and return outputs",
                     dependencies=[api_key_dep])
router.add_api_route("/demo1", workflow_demo1, methods=["POST"], summary="Demo 1 Runner",
                     dependencies=[api_key_dep])
router.add_api_route("/demo2", workflow_demo2, methods=["POST"], summary="Demo 2 Runner",
                     dependencies=[api_key_dep])

__all__ = [
    "router",
    "RunRequest",
    "workflow_list", "workflow_search", "workflow_get", "workflow_run",
    "workflow_demo1", "workflow_demo2",
]
