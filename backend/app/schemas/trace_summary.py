"""
Trace Summary Pydantic 模型

基于设计文档: TRACE_SUMMARY_SCHEMA.md
用于workflow和agent执行摘要的数据验证
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class TraceSummary(BaseModel):
    """Trace Summary 模型"""
    space_id: str = Field(..., max_length=100)
    business_id: str = Field(..., max_length=100)
    business_type: str = Field(..., max_length=20)
    business_version: Optional[str] = Field(None, max_length=100)
    trace_id: str = Field(..., max_length=100)
    mode: int = Field(..., description="执行模式：0-调试运行，1-发布运行，2-节点调试")
    call_type: Optional[str] = Field(None, max_length=100)
    duration: Optional[int] = Field(None, description="执行时长（毫秒）")
    inputs: Optional[Dict[str, Any]] = Field(None)
    outputs: Optional[Dict[str, Any]] = Field(None)
    error_code: Optional[int] = Field(None)
    fail_reason: Optional[str] = Field(None)
    input_tokens: Optional[int] = Field(None)
    output_tokens: Optional[int] = Field(None)
    execute_info_list: Optional[List[Dict[str, Any]]] = Field(None)
    create_time: Optional[datetime] = Field(None)
    update_time: Optional[datetime] = Field(None)
    status: Optional[str] = Field(None, max_length=16)

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
    )


class TraceSummaryListRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    space_id: Optional[str] = Field(default=None, alias="spaceId", validation_alias=AliasChoices("spaceId", "space_id"))
    business_id: str = Field(alias="businessId", validation_alias=AliasChoices("businessId", "business_id"))
    business_type: str = Field(alias="businessType", validation_alias=AliasChoices("businessType", "business_type"))


class TraceSummaryByTraceIdRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    space_id: Optional[str] = Field(default=None, alias="spaceId", validation_alias=AliasChoices("spaceId", "space_id"))
    trace_id: str = Field(alias="traceId", validation_alias=AliasChoices("traceId", "trace_id"))


class TraceSummaryLatestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    space_id: Optional[str] = Field(default=None, alias="spaceId", validation_alias=AliasChoices("spaceId", "space_id"))
    business_id: str = Field(alias="businessId", validation_alias=AliasChoices("businessId", "business_id"))
    business_type: str = Field(alias="businessType", validation_alias=AliasChoices("businessType", "business_type"))


class TraceSummaryBrief(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    trace_id: str = Field(alias="traceId", validation_alias=AliasChoices("traceId", "trace_id"))
    create_time: Optional[datetime] = Field(default=None, alias="createTime",
                                            validation_alias=AliasChoices("createTime", "create_time"))
