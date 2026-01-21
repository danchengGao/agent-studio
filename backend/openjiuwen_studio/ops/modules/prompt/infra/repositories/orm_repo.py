# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import Column, Integer, String, \
    Text, DateTime, Boolean, ForeignKey, BigInteger, UniqueConstraint, JSON, Float, Index, DECIMAL
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from pydantic import BaseModel, Field, field_validator

from openjiuwen_studio.ops.modules.prompt.domain.entities import LLMModelInfo
from openjiuwen_studio.ops.modules.prompt.infra.database import Base, BaseAgent
from openjiuwen_studio.ops.modules.prompt.domain import entities
from openjiuwen_studio.ops.config import settings


# ORM模型
class PromptModel(Base):
    __tablename__ = "prompts"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True)
    content = Column(Text)
    description = Column(Text, nullable=True)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    is_deleted = Column(Boolean, default=False)


class UserModel(Base):
    __tablename__ = "user"

    id = Column(BigInteger, primary_key=True, nullable=False, comment='Primary Key ID')
    name = Column(String(128), nullable=False, default='', comment='User Nickname')
    unique_name = Column(String(128), nullable=False, default='', comment='User Unique Name')
    email = Column(String(128), nullable=False, default='', comment='Email')
    mobile = Column(Integer, nullable=False, default=0, comment='Mobile')
    password = Column(String(128), nullable=False, default='', comment='Password (Encrypted)')
    description = Column(String(512), nullable=False, default='', comment='User Description')
    icon_uri = Column(String(512), nullable=False, default='', comment='Avatar URI')
    user_verified = Column(Boolean, nullable=False, default=False, comment='User Verification Status')
    country_code = Column(BigInteger, nullable=False, default=0, comment='Country Code')
    session_key = Column(String(512), nullable=False, default='', comment='Session Key')
    deleted_at = Column(BigInteger, nullable=False, default=0, comment='删除时间')
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


class PromptUserDraftModel(Base):
    __tablename__ = "prompt_user_draft"

    if settings.DB_TYPE.lower() == "sqlite":
        id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    else:
        id = Column(BigInteger, primary_key=True, autoincrement=True, comment="主键ID")

    space_id = Column(BigInteger, nullable=False, default=0, comment="空间ID")
    prompt_id = Column(BigInteger, nullable=False, comment="Prompt ID")
    user_id = Column(String(128), nullable=False, default="", comment="用户ID")
    template_type = Column(String(64), default="Normal", comment="模版类型")
    messages = Column(Text, comment="托管消息列表")
    prompt_model_config = Column(Text, comment="模型配置")
    variable_defs = Column(Text, comment="变量定义")
    tools = Column(Text, comment="tools")
    tool_call_config = Column(Text, comment="tool调用配置")
    base_version = Column(String(128), nullable=False, default="", comment="草稿关联版本")
    is_draft_edited = Column(Boolean, nullable=False, default=False, comment="草稿内容是否基于BaseVersion有变更")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    deleted_at = Column(BigInteger, nullable=False, default=0, comment="删除时间")


class PromptCommitModel(Base):
    __tablename__ = "prompt_commit"

    __table_args__ = (
        UniqueConstraint('space_id', 'prompt_id', 'version',
                         name='uq_space_prompt_commit'),
    )

    if settings.DB_TYPE.lower() == "sqlite":
        id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    else:
        id = Column(BigInteger, primary_key=True, autoincrement=True, comment="主键ID")

    space_id = Column(BigInteger, nullable=False, default=0, comment="空间ID")
    prompt_id = Column(BigInteger, nullable=False, comment="Prompt ID")
    prompt_key = Column(String(128), nullable=False, default="", comment="Prompt key")
    template_type = Column(String(64), default="normal", comment="模版类型")
    messages = Column(Text, comment="托管消息列表")
    prompt_model_config = Column(Text, comment="模型配置")
    variable_defs = Column(Text, comment="变量定义")
    tools = Column(Text, comment="tools")
    tool_call_config = Column(Text, comment="tool调用配置")
    version = Column(String(128), nullable=False, default="", comment="版本")
    base_version = Column(String(128), nullable=False, default="", comment="来源版本")
    committed_by = Column(String(128), nullable=False, default="", comment="提交人")
    description = Column(Text, comment="提交版本描述")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="更新时间")


class PromptBasicModel(Base):
    __tablename__ = "prompt_basic"
    __table_args__ = (
        UniqueConstraint('space_id', 'prompt_key', 'deleted_at',
                         name='uq_space_prompt_deleted'),
    )
    id = Column(Integer, primary_key=True, autoincrement=True, comment='主键ID')
    space_id = Column(BigInteger, nullable=False, index=True, comment='空间ID')
    prompt_key = Column(String(128), nullable=False, default='', comment='Prompt key')
    name = Column(String(128), nullable=False, default='', comment='Prompt名称')
    description = Column(String(1024), nullable=False, default='', comment='描述')
    created_by = Column(String(128), nullable=False, default='', comment='创建人')
    updated_by = Column(String(128), nullable=False, default='', comment='更新人')
    latest_version = Column(String(128), nullable=False, default='', comment='最新版本')
    latest_commit_time = Column(DateTime, comment='最新提交时间')
    created_at = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")
    deleted_at = Column(DateTime, nullable=True)


class PromptVersionModel(Base):
    __tablename__ = "prompt_versions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True)
    prompt_id = Column(Integer, ForeignKey("prompt_basic.id"))
    version = Column(Integer)
    content = Column(Text)
    description = Column(Text, nullable=True)
    created_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.now(timezone.utc).replace(tzinfo=None))
    is_current = Column(Boolean, default=False)


class AgentModel(BaseAgent):
    __tablename__ = 'prompt_relation'
    __table_args__ = (
        UniqueConstraint('prompt_id', 'prompt_version', 'aw_id', 'aw_version',
                         name='unique_prompt_id_version_aw_id_version'),
    )

    if settings.DB_TYPE.lower() == "sqlite":
        id = Column(Integer, primary_key=True, autoincrement=True,
                comment='Primary Key ID, Auto Increment')
    else:
        id = Column(BigInteger, primary_key=True, autoincrement=True,
                comment='Primary Key ID, Auto Increment')

    space_id = Column(String(100), nullable=True)
    prompt_id = Column(String(100), nullable=True)
    prompt_version = Column(String(100), nullable=True)
    prompt_name = Column(String(255), nullable=True)
    aw_id = Column(String(100), nullable=True, comment='workflow/agent的id, 与prompt关联')
    aw_version = Column(String(100), nullable=True, comment='workflow/agent的version')
    aw_name = Column(String(255), nullable=True)
    create_time = Column(BigInteger, nullable=True)
    update_time = Column(BigInteger, nullable=True)
    type = Column(String(255), nullable=True, comment='AW Type: 0.AGENT 1.WORKFLOW 2.PROMPT')
    is_active = Column(Boolean, default=True)


class User(BaseAgent):
    __tablename__ = 'user'

    if settings.DB_TYPE.lower() == "sqlite":
        id = Column(Integer, primary_key=True, autoincrement=True, comment='Primary Key ID')
    else:
        id = Column(BigInteger, primary_key=True, autoincrement=True, comment='Primary Key ID')

    user_id = Column(String(100), nullable=False, unique=True, comment='USER ID')
    email = Column(String(128), nullable=False, unique=True)
    user_unique_name = Column(String(128), nullable=False, unique=True)
    user_name = Column(String(128), nullable=False)
    # 省略了 password 字段
    session_key = Column(String(256), nullable=False)
    role_type = Column(Integer, nullable=False)
    user_verified = Column(Boolean, nullable=False)
    is_active = Column(Boolean, nullable=False)
    description = Column(String(512))
    icon_uri = Column(String(512))
    locale = Column(String(128))
    first_name = Column(String(128))
    last_name = Column(String(128))
    phone_number = Column(String(128))
    company = Column(String(128))
    occupation = Column(String(512))
    skills = Column(JSON)
    _rest_ = Column(JSON)
    create_time = Column(BigInteger)
    update_time = Column(BigInteger)
    delete_time = Column(BigInteger)

    # 定义索引
    __table_args__ = (
        Index('idx_session_key', 'session_key'),
    )


class ModelConfig(BaseAgent):
    __tablename__ = 'model_configs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    space_id = Column(String(50), nullable=False)
    provider = Column(String(50), nullable=False)
    model_type = Column(String(100), nullable=False)
    description = Column(Text)
    tags = Column(JSON)
    api_key = Column(Text)
    base_url = Column(String(500))
    is_active = Column(Boolean)
    parameters = Column(JSON)
    timeout = Column(Integer)
    retry_count = Column(Integer)
    enable_streaming = Column(Boolean)
    enable_function_calling = Column(Boolean)
    total_requests = Column(Integer)
    total_tokens = Column(Integer)
    total_cost = Column(Float)
    success_rate = Column(Float)
    avg_response_time = Column(Float)
    last_used = Column(DateTime)
    daily_requests = Column(Integer)
    daily_tokens = Column(Integer)
    daily_cost = Column(Float)
    monthly_requests = Column(Integer)
    monthly_tokens = Column(Integer)
    monthly_cost = Column(Float)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('ix_model_configs_name', 'name'),
        Index('ix_model_configs_provider', 'provider'),
        Index('ix_model_configs_space_id', 'space_id'),
        Index('ix_model_configs_id', 'id'),
        Index('ix_model_configs_is_active', 'is_active'),
    )


class JobUserDraftModel(Base):
    __tablename__ = "job_user_draft"

    if settings.DB_TYPE.lower() == "sqlite":
        id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    else:
        id = Column(BigInteger, primary_key=True, autoincrement=True, comment="主键ID")

    space_id = Column(String(128), nullable=False, comment="空间ID")
    user_id = Column(String(128), nullable=False, comment="用户ID")
    name = Column(String(64), comment="任务名称")
    desc = Column(String(256), comment="任务描述")
    rawTemplates = Column(Text, comment="原始模板信息")
    if settings.DB_TYPE.lower() == "sqlite":
        optimizeInfo = Column(Text, comment="优化配置")
    else:
        optimizeInfo = Column(MEDIUMTEXT, comment="优化配置")
    modelInfo = Column(Text, comment="调优大模型配置")
    assistantInfo = Column(Text, comment="调优大模型配置")
    agentTools = Column(Text, comment="调优工具")
    is_deleted = Column(Integer, nullable=False, comment="草稿是否删除，1 删除 0 有效")
    created_at = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")


class JobUserInfoModel(Base):
    __tablename__ = "job_user_info"

    if settings.DB_TYPE.lower() == "sqlite":
        id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    else:
        id = Column(BigInteger, primary_key=True, autoincrement=True, comment="主键ID")

    job_id = Column(String(128), nullable=False, comment="任务ID")
    space_id = Column(String(128), nullable=False, comment="空间ID")
    user_id = Column(String(128), nullable=False, comment="用户ID")
    name = Column(String(64), nullable=True, comment="任务名称")
    desc = Column(String(256), nullable=True, comment="任务描述")
    rawTemplates = Column(Text, nullable=True, comment="原prompt信息")
    bestTemplates = Column(Text, nullable=True, comment="最优prompt信息")
    bestIteration = Column(Integer, nullable=True, comment="最优迭代轮数")
    timeCost = Column(Integer, nullable=True, comment="任务时间消耗，单位秒")
    history = Column(JSON, nullable=True, comment="历史记录信息")
    success_rate = Column(DECIMAL(5, 4), nullable=True, comment="最优任务成功率")
    progress_rate = Column(DECIMAL(5, 4), nullable=True, comment="任务进展")
    if settings.DB_TYPE.lower() == "sqlite":
        optimizeInfo = Column(Text, nullable=True, comment="优化配置")
    else:
        optimizeInfo = Column(MEDIUMTEXT, nullable=True, comment="优化配置")
    modelInfo = Column(Text, nullable=True, comment="调优大模型配置")
    assistantInfo = Column(Text, nullable=True, comment="助手模型配置")
    agentTools = Column(Text, nullable=True, comment="调优工具")
    status = Column(String(64), nullable=True, comment="任务状态：running finished failed")
    errorMsg = Column(Text, nullable=True, comment="任务报错信息")
    is_deleted = Column(Integer, nullable=False, default=0, comment="是否删除，1 删除 0 有效")
    created_at = Column(DateTime, nullable=False, default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now(), comment="更新时间")


class OptFeedBackInfo(BaseModel):
    modelInfo: LLMModelInfo = Field(default=LLMModelInfo(url="", token=""))
    prompt: str = Field(min_length=1)
    feedback: str = Field(min_length=1, max_length=65535)
    select_content_index: Optional[Tuple[int, int]] = Field(default=None)
    insert_pos_index: Optional[int] = Field(default=None)
    stream: bool = Field(default=True)
    templateInfo: entities.TemplateInfo = Field(default=entities.TemplateInfo())

    @field_validator('feedback')
    @classmethod
    def validate_feedback(cls, value):
        """validate select content index"""
        if not value.strip():
            raise ValueError("feedback is empty string")
        return value

    @field_validator('prompt')
    @classmethod
    def validate_prompt(cls, value):
        """validate select content index"""
        if not value.strip():
            raise ValueError("prompt is empty string")
        return value

    # 验证 select_content_index 字段
    @field_validator('select_content_index')
    @classmethod
    def validate_select_content_index(cls, value):
        """validate select content index"""
        if value is not None:
            if len(value) != 2:
                raise ValueError("select_content_index should contain two elements")
            start, end = value
            if not isinstance(start, int) or not isinstance(end, int):
                raise ValueError("select_content_index must be int")
            if start > end:
                raise ValueError("start index is bigger than end index")
        return value

    # 验证 insert_pos_index 字段
    @field_validator('insert_pos_index')
    @classmethod
    def validate_insert_pos_index(cls, value):
        """validate insert pos index"""
        if value is not None and not isinstance(value, int):
            raise ValueError("insert_pos_index should be int")
        return value


class OptBadCaseInfo(BaseModel):
    modelInfo: LLMModelInfo = Field(default=LLMModelInfo(url="", token=""))
    prompt: str = Field(min_length=1)
    badcases: Optional[List[dict]] = None
    stream: bool = Field(default=True)
    templateInfo: entities.TemplateInfo = Field(default=entities.TemplateInfo())

    @field_validator('prompt')
    @classmethod
    def validate_prompt(cls, value):
        """validate select content index"""
        if not value.strip():
            raise ValueError("prompt is empty string")
        return value

    @field_validator('badcases')
    @classmethod
    def validate_badcases(cls, value):
        """Validate badcases"""
        if value is not None:
            for badcase in value:
                if not isinstance(badcase, dict):
                    raise ValueError("Each badcase must be a dictionary")
                query = badcase.get("query", "")
                label = badcase.get("label", "")
                if not isinstance(query, str) or not isinstance(label, str):
                    raise ValueError("'query' and 'label' fields should be str")
                if not query.strip() or not label.strip():
                    raise ValueError("'query' and 'label' fields in badcase cannot be empty")
        return value

