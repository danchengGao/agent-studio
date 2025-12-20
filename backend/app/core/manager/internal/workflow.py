from typing import Optional

from pydantic import Field, BaseModel

from app.schemas.node import Node, Edge


class InputElem(BaseModel):
    name: Optional[str] = Field("", min_length=1, max_length=100)
    description: Optional[str] = Field("")
    type: Optional[str] = Field("")
    required: Optional[bool] = Field(False)


class WorkflowCanvas(BaseModel):
    nodes: list[Node] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)


class WorkflowResponseBase(BaseModel):
    workflow_id: str = Field(..., min_length=1, max_length=100)
    success: bool = Field(...)


class WorkflowResponseCreate(WorkflowResponseBase):
    pass


class WorkflowResponseUpdate(WorkflowResponseBase):
    pass


class WorkflowResponsePublish(WorkflowResponseBase):
    pass
