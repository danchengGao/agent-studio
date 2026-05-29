"""Workflow request models."""
from typing import Any, Dict

from pydantic import BaseModel


class RunRequest(BaseModel):
    workflow_id: str
    inputs: Dict[str, Any] = {}
