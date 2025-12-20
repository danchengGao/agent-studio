#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class SearchSortBy(str, Enum):
    """排序字段枚举"""
    name = "name"
    create_time = "create_time"
    update_time = "update_time"


class SearchSortOrder(str, Enum):
    """排序方向枚举"""
    asc = "asc"
    desc = "desc"


class WorkflowId(BaseModel):
    workflow_id: str = Field(alias="workflow_id")
    space_id: str = Field(alias="space_id")
    workflow_version: Optional[str] = Field("", validation_alias=AliasChoices("workflow_version", "version"),
                                            serialization_alias="workflow_version")


class WorkflowBase(WorkflowId):
    name: str = Field(..., min_length=1, max_length=255)
    desc: Optional[str] = Field(None, max_length=500)
    icon_uri: str = Field("", alias="icon_uri")
    url: Optional[str] = Field("", max_length=500)
    workflow_schema: str = Field(..., alias="schema")
    input_parameters: list[dict[str, Any]] = Field(default_factory=list)
    output_parameters: list[dict[str, Any]] = Field(default_factory=list)
    create_time: int = Field("", alias="create_time")
    update_time: int = Field("", alias="update_time")


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    desc: str = Field(..., max_length=500)
    space_id: str = Field(...)
    url: str = Field("", description="icon url, unsupported now")
    icon_uri: str = Field("")
    tags: Optional[List[str]] = Field(default_factory=list, description="List of tag names to associate with workflow")


class WorkflowBaseResponse(BaseModel):
    workflow: WorkflowBase = Field(alias="workflow")


# 基础分页请求模型
class WorkflowBaseRequest(BaseModel):
    space_id: str = Field(..., min_length=1, max_length=100, alias="space_id")
    status_filter: Optional[str] = Field("all", description="状态过滤")
    sort_by: Optional[SearchSortBy] = Field(SearchSortBy.update_time, description="排序字段")
    sort_order: Optional[SearchSortOrder] = Field(SearchSortOrder.desc, description="排序方向")
    page: Optional[int] = Field(1, ge=1, description="页码")
    page_size: Optional[int] = Field(10, ge=1, le=100, description="每页大小")


class WorkflowList(WorkflowBaseRequest):
    pass


class WorkflowResponse(BaseModel):
    workflow_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    desc: str = Field(..., min_length=1, max_length=500)
    url: str
    icon_uri: str
    create_time: int
    update_time: int
    space_id: str = Field(..., min_length=1, max_length=100, alias="space_id")
    input_parameters: list[dict[str, Any]] = Field(default_factory=list)
    output_parameters: list[dict[str, Any]] = Field(default_factory=list)
    tags: List[Dict[str, Any]] = Field(default_factory=list, description="Associated tags")


# 基础分页响应模型
class WorkflowBaseResponseList(BaseModel):
    workflow_list: List[WorkflowResponse] = Field(..., alias="workflow_list")
    total: int = Field(0, description="总记录数")
    page: int = Field(1, description="当前页码")
    page_size: int = Field(10, description="每页大小")
    total_pages: int = Field(1, description="总页数")


class WorkflowResponseList(WorkflowBaseResponseList):
    pass


class WorkflowSave(WorkflowId):
    schema: str


class WorkflowUpdate(WorkflowId):
    model_config = ConfigDict(populate_by_name=True)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    desc: Optional[str] = Field(None, max_length=500)
    url: Optional[str] = Field(None, description="icon url, unsupported now")
    icon_uri: Optional[str] = Field(None)
    tags: Optional[List[str]] = Field(default_factory=list, description="List of tag names to associate with workflow")


class WorkflowResponseSave(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=500)
    status: int
    workflow_status: int


class WorkflowPublish(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    workflow_id: str = Field(..., alias="workflow_id")
    space_id: str = Field(..., alias="space_id")
    force: bool = Field(..., alias="force")
    workflow_version: str = Field(..., alias="version")
    version_description: str = Field(..., alias="version_description")


class WorkflowSearchRequest(WorkflowBaseRequest):
    """工作流搜索请求模型"""
    search_term: Optional[str] = Field("", description="搜索关键词（支持名称、描述、标签）")
    tags: Optional[List[str]] = Field(default_factory=list, description="标签过滤")


class WorkflowSearchResponse(WorkflowBaseResponseList):
    """工作流搜索响应模型"""
    search_term: Optional[str] = Field(None, description="搜索关键词")
    filters: dict = Field(default_factory=dict, description="应用的过滤器")


class WorkflowVersionListRequest(BaseModel):
    """工作流版本列表请求模型"""
    workflow_id: str = Field(..., alias="workflow_id", description="工作流ID")
    space_id: str = Field(..., alias="space_id", description="工作空间ID")


class WorkflowVersionInfo(BaseModel):
    """工作流版本信息模型"""
    workflow_version: str = Field(..., description="版本号")
    version_description: str = Field(..., description="版本描述")
    create_time: int = Field(..., description="创建时间")


class WorkflowVersionListResponse(BaseModel):
    """工作流版本列表响应模型"""
    workflow_id: str = Field(..., description="工作流ID")
    versions: List[WorkflowVersionInfo] = Field(..., description="版本列表")
