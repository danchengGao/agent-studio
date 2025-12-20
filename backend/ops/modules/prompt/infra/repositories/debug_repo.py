#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Column, Integer, String, DateTime, BigInteger, func, JSON, select, desc
from ops.modules.prompt.infra.database import Base
from ops.modules.prompt.domain.debug_entity import DebugContext, DebugCore, DebugLog, DebugMessage, VariableVal, \
    DebugToolCall, ToolCall, FunctionCall, ContentPart, ContentType, ImageURL, Role, ToolType, Message, VariableType, \
    MockTool
from ops.modules.prompt.domain.debug_repository import DebugLogRepository, DebugContextRepository


class PromptDebugContext(Base):
    """
    调试上下文表
    每行代表一个 prompt 当前最新的调试上下文（upsert 机制）
    """
    __tablename__ = "prompt_debug_context"
    __table_args__ = {"extend_existing": True, "mysql_charset": "utf8mb4"}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    prompt_id = Column(BigInteger, nullable=False, index=True)
    user_id = Column(String(128), nullable=False)
    mock_contexts = Column(JSON)
    mock_variables = Column(JSON)
    mock_tools = Column(JSON)
    debug_config = Column(JSON)
    compare_config = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(BigInteger, default=0, nullable=False)


class PromptDebugLog(Base):
    """
    调试历史表
    """
    __tablename__ = "prompt_debug_log"
    __table_args__ = {"extend_existing": True, "mysql_charset": "utf8mb4"}

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    prompt_id = Column(BigInteger, nullable=False, index=True)
    space_id = Column(BigInteger, nullable=False)
    prompt_key = Column(String(128), nullable=False)
    version = Column(String(128), nullable=False)
    input_tokens = Column(BigInteger, default=0)
    output_tokens = Column(BigInteger, default=0)
    started_at = Column(BigInteger)
    ended_at = Column(BigInteger)
    cost_ms = Column(BigInteger)
    status_code = Column(Integer)
    debugged_by = Column(String(128), default='0')
    debug_id = Column(BigInteger, nullable=False, index=True)
    debug_step = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(BigInteger, default=0, nullable=False)


class SQLDebugContextRepository(DebugContextRepository):
    """
    SQLAlchemy 异步实现
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _process_message_tool_calls(tool_calls_data: Optional[List[dict]]) -> Optional[List[ToolCall]]:
        """处理 Message 中的 tool_calls 数据转换"""
        if not tool_calls_data:
            return None

        return [
            ToolCall(
                index=tc.get("index"),
                id=tc.get("id"),
                type=ToolType(tc.get("type")) if tc.get("type") else None,
                function_call=FunctionCall(
                    name=tc.get("function_call", {}).get("name"),
                    arguments=tc.get("function_call", {}).get("arguments")
                ) if tc.get("function_call") else None
            ) for tc in tool_calls_data
        ]

    @staticmethod
    def _process_mock_tools(mock_tools_data: List[dict]) -> List[MockTool]:
        """处理 mock_tools - MockTool 列表"""
        mock_tools = []
        for tool_data in mock_tools_data:
            mock_tool = MockTool(
                name=tool_data.get("name"),
                mock_response=tool_data.get("mock_response")
            )
            mock_tools.append(mock_tool)
        return mock_tools

    @staticmethod
    def _process_tool_calls(tool_calls_data: Optional[List[dict]]) -> Optional[List[DebugToolCall]]:
        """处理 tool_calls 数据转换"""
        if not tool_calls_data:
            return None

        return [
            DebugToolCall(
                tool_call=ToolCall(
                    index=tc.get("tool_call").get("index"),
                    id=tc.get("tool_call").get("id"),
                    type=tc.get("tool_call").get("type"),
                    function_call=FunctionCall(
                        name=tc.get("tool_call", {}).get("function_call", {}).get("name"),
                        arguments=tc.get("tool_call", {}).get("function_call", {}).get("arguments")
                    ) if tc.get("tool_call", {}).get("function_call") else None
                ) if tc.get("tool_call") else None,
                mock_response=tc.get("mock_response"),
                debug_trace_key=tc.get("debug_trace_key")
            ) for tc in tool_calls_data
        ]

    @staticmethod
    def _process_content_parts(parts_data: Optional[List[dict]]) -> Optional[List[ContentPart]]:
        """处理 content parts 数据转换"""
        if not parts_data:
            return None

        return [
            ContentPart(
                type=ContentType(part.get("type")) if part.get("type") else None,
                text=part.get("text"),
                image_url=ImageURL(
                    uri=part.get("image_url", {}).get("uri"),
                    url=part.get("image_url", {}).get("url")
                ) if part.get("image_url") else None
            ) for part in parts_data
        ]

    async def upsert(self, req: Dict[str, Any]) -> None:
        """req 已结构化为 dict，直接 upsert"""
        prompt_id_int = int(req["prompt_id"])
        user_id = req.get("user_id", "0")

        # 查记录
        stmt = select(PromptDebugContext).where(
            PromptDebugContext.prompt_id == prompt_id_int,
            PromptDebugContext.user_id == user_id,
            PromptDebugContext.deleted_at == 0,
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()

        # 构造 JSON 字段
        ctx_json = req["debug_context"]

        if row:
            # 更新
            row.mock_contexts = ctx_json.get("debug_core", {}).get("mock_contexts")
            row.mock_variables = ctx_json.get("debug_core", {}).get("mock_variables")
            row.mock_tools = ctx_json.get("debug_core", {}).get("mock_tools")
            row.debug_config = ctx_json.get("debug_config")
            row.compare_config = ctx_json.get("compare_config")
            await self.db.flush()
        else:
            # 插入
            new = PromptDebugContext(
                prompt_id=prompt_id_int,
                user_id=user_id,
                mock_contexts=ctx_json.get("debug_core", {}).get("mock_contexts"),
                mock_variables=ctx_json.get("debug_core", {}).get("mock_variables"),
                mock_tools=ctx_json.get("debug_core", {}).get("mock_tools"),
                debug_config=ctx_json.get("debug_config"),
                compare_config=ctx_json.get("compare_config"),
            )
            self.db.add(new)
        await self.db.commit()

    async def fetch(self, prompt_id: int, user_id: str) -> Optional[DebugContext]:
        """根据 prompt_id 和 user_id 查询最新的调试上下文"""
        stmt = select(PromptDebugContext).where(
            PromptDebugContext.prompt_id == prompt_id,
            PromptDebugContext.user_id == user_id,
            PromptDebugContext.deleted_at == 0,
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return None

        # 分别处理不同的数据部分
        mock_contexts = self._process_mock_contexts(row.mock_contexts or [])
        mock_variables = self._process_mock_variables(row.mock_variables or [])
        mock_tools = self._process_mock_tools(row.mock_tools or [])

        return DebugContext(
            debug_core=DebugCore(
                mock_contexts=mock_contexts,
                mock_variables=mock_variables,
                mock_tools=mock_tools,
            ),
            debug_config=row.debug_config,
            compare_config=row.compare_config,
        )

    def _process_mock_contexts(self, mock_contexts_data: List[dict]) -> List[DebugMessage]:
        """处理 mock_contexts - DebugMessage 列表"""
        mock_contexts = []
        for msg_data in mock_contexts_data:
            debug_tool_calls = self._process_tool_calls(msg_data.get("tool_calls"))
            content_parts = self._process_content_parts(msg_data.get("parts"))

            debug_message = DebugMessage(
                role=Role(msg_data.get("role")) if msg_data.get("role") else None,
                content=msg_data.get("content"),
                reasoning_content=msg_data.get("reasoning_content"),
                parts=content_parts,
                tool_call_id=msg_data.get("tool_call_id"),
                tool_calls=debug_tool_calls,
                debug_id=msg_data.get("debug_id"),
                input_tokens=msg_data.get("input_tokens"),
                output_tokens=msg_data.get("output_tokens"),
                cost_ms=msg_data.get("cost_ms"),
                msg_time=msg_data.get("msg_time")
            )
            mock_contexts.append(debug_message)
        return mock_contexts

    def _process_mock_variables(self, mock_variables_data: List[dict]) -> List[VariableVal]:
        """处理 mock_variables - VariableVal 列表"""
        mock_variables = []
        for var_data in mock_variables_data:
            placeholder_msgs = self._process_placeholder_messages(var_data.get("placeholder_messages"))

            variable_val = VariableVal(
                key=var_data.get("key"),
                value=var_data.get("value"),
                desc=var_data.get("desc"),
                type=VariableType(var_data.get("type")) if var_data.get("type") else None,
                placeholder_messages=placeholder_msgs
            )
            mock_variables.append(variable_val)
        return mock_variables

    def _process_placeholder_messages(self, messages_data: Optional[List[dict]]) -> Optional[List[Message]]:
        """处理 placeholder messages 数据转换"""
        if not messages_data:
            return None

        placeholder_msgs = []
        for msg_data in messages_data:
            msg_parts = self._process_content_parts(msg_data.get("parts"))
            msg_tool_calls = self._process_message_tool_calls(msg_data.get("tool_calls"))

            message = Message(
                role=Role(msg_data.get("role")) if msg_data.get("role") else None,
                reasoning_content=msg_data.get("reasoning_content"),
                content=msg_data.get("content"),
                parts=msg_parts,
                tool_call_id=msg_data.get("tool_call_id"),
                tool_calls=msg_tool_calls
            )
            placeholder_msgs.append(message)
        return placeholder_msgs


class SQLDebugLogRepository(DebugLogRepository):
    """
    SQLAlchemy 异步实现
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_record(self, log: Dict[str, Any]) -> None:
        """ 添加一条调试日志记录 """
        rec = PromptDebugLog(
            prompt_id=int(log["prompt_id"]),
            space_id=int(log.get("workspace_id", 0)),
            prompt_key=log.get("prompt_key", ""),
            version=log.get("version", ""),
            input_tokens=int(log.get("input_tokens", 0)),
            output_tokens=int(log.get("output_tokens", 0)),
            started_at=int(log["started_at"]) if log.get("started_at") else None,
            ended_at=int(log["ended_at"]) if log.get("ended_at") else None,
            cost_ms=int(log["cost_ms"]) if log.get("cost_ms") else None,
            status_code=log.get("status_code"),
            debugged_by=log.get("debugged_by", ""),
            debug_id=int(log["debug_id"]),
            debug_step=int(log.get("debug_step", 1)),
        )
        self.db.add(rec)
        await self.db.commit()

    async def list_records(
        self, prompt_id: int, workspace_id: str, days_limit: Optional[int], page_size: int, page_token: Optional[str]
    ) -> List[DebugLog]:
        """ 分页查询调试日志 """
        stmt = select(PromptDebugLog).where(
            PromptDebugLog.prompt_id == prompt_id,
            PromptDebugLog.deleted_at == 0,
        )
        if workspace_id:
            stmt = stmt.where(PromptDebugLog.space_id == int(workspace_id))
        if days_limit:
            stmt = stmt.where(PromptDebugLog.created_at >= func.now() - func.interval(days_limit, "DAY"))
        stmt = stmt.order_by(desc(PromptDebugLog.created_at)).limit(page_size).offset(page_token or 0)
        rows = (await self.db.execute(stmt)).scalars().all()
        return [
            DebugLog(
                id=str(r.id),
                prompt_id=str(r.prompt_id),
                workspace_id=str(r.space_id),
                prompt_key=r.prompt_key,
                version=r.version,
                input_tokens=str(r.input_tokens),
                output_tokens=str(r.output_tokens),
                cost_ms=str(r.cost_ms),
                status_code=r.status_code,
                debugged_by=r.debugged_by,
                debug_id=str(r.debug_id),
                debug_step=r.debug_step,
                started_at=str(r.started_at) if r.started_at else None,
                ended_at=str(r.ended_at) if r.ended_at else None,
            )
            for r in rows
        ]
