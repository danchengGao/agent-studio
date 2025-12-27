#!/usr/bin/env python
# -*- coding: UTF-8 -*-
from typing import Optional, Any, Dict, List, TypeVar, Union
from fastapi import status
from pydantic import BaseModel, Field

from openjiuwen_studio.core.common.dsl import Connection
from openjiuwen.core.common.exception.exception import JiuWenBaseException


class JiuWenComponentException(JiuWenBaseException):
    def __init__(self, error_code: int, message: str, component_id: str, component_type: int,
                 error_stage: str = "convert") -> None:
        super().__init__(error_code, message)
        self._component_id = component_id
        self._component_type = component_type
        self._error_stage = error_stage

    @property
    def component_id(self) -> str:
        return self._component_id

    @property
    def component_type(self) -> int:
        return self._component_type

    @property
    def error_stage(self) -> str:
        return self._error_stage


class ErrorNodeInfo(BaseModel):
    node_id: str = Field(default="")
    connection: Connection = Field(default_factory=Connection)
    error_message: str = Field(default="")
    error_code: int = Field(default=int)


class WorkflowErrorData(BaseModel):
    error_nodes_info: Optional[List[ErrorNodeInfo]] = Field(default_factory=list)
    workflow_id: str = Field("")


class WorkflowFailedResponse(BaseModel):
    data: Optional[WorkflowErrorData] = Field(default_factory=WorkflowErrorData)
    code: int = Field(default=status.HTTP_400_BAD_REQUEST)
    message: str = Field(default="工作流运行失败")


class JiuWenExecuteException(JiuWenBaseException):
    """workflow图异常"""

    def __init__(self, error_code: int, message: str, workflow_id="", node_id="", connection=None):
        super().__init__(error_code, message)
        self._workflow_id = workflow_id
        self._node_id = node_id
        self._connection = connection

    # 添加公共的setter方法
    def set_workflow_id(self, workflow_id: str) -> None:
        self._workflow_id = workflow_id

    # 添加公共的setter方法
    def set_node_id(self, node_id: str) -> None:
        self._node_id = node_id

    def set_connection(self, connection: Connection) -> None:
        self._connection = connection

    @property
    def workflow_id(self) -> str:
        return self._workflow_id

    @property
    def node_id(self) -> str:
        return self._node_id

    @property
    def connection(self):
        if self._connection is None or (
                isinstance(self._connection, type) and issubclass(self._connection, Connection)):
            self._connection = Connection()
        return self._connection
