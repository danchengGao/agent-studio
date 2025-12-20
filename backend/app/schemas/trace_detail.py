"""
Trace Detail Pydantic 模型定义

统一的追踪数据模型，替代原有的workflow_trace和agent_trace分离设计
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class TraceDetail(BaseModel):
    """统一的 Trace Detail 模型"""
    space_id: str = Field("", max_length=100)
    business_id: str = Field("", max_length=100)
    business_type: str = Field("", max_length=20)
    trace_id: str = Field("", max_length=100)
    span_id: str = Field("", max_length=100)
    span_type: str = Field("", max_length=512)
    span_name: str = Field("", max_length=255)
    parent_span_id: Optional[str] = Field(None, max_length=100)
    method: Optional[str] = Field(None, max_length=10)
    psm: Optional[str] = Field(None, max_length=100)
    logid: Optional[str] = Field(None, max_length=100)
    platform_type: Optional[str] = Field(None, max_length=50)
    start_time_micros: Optional[int] = Field(0, description="开始时间微秒戳")
    end_time_micros: Optional[int] = Field(0, description="结束时间微秒戳")
    status_code: Optional[str] = Field(None, max_length=10)
    input: Optional[str] = Field(None)
    output: Optional[str] = Field(None)
    attributes: Optional[Dict[str, Any]] = Field({})

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
    )