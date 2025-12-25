#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

"""
Agent Trace Utils - Agent通用追踪工具模块

本模块提供Agent执行过程中的追踪功能，包括：
1. 追踪上下文管理
2. Chunk级别的追踪信息处理
3. 追踪数据的保存和清理
4. 追踪错误的统一处理

核心功能：
- 统一管理Agent执行的追踪信息
- 提供可复用的追踪处理函数
- 支持不同Agent类型的追踪需求
"""

from dataclasses import dataclass, field
from typing import Any, Optional, List, Dict

from openjiuwen.core.tracer.span import TraceWorkflowSpan
from openjiuwen.core.stream.writer import TraceSchema, OutputSchema
from openjiuwen.core.common.logging import logger

from app.core.executor.util.utils import (
    result_convert,
    handle_stream_error,
    save_trace_details,
)
from app.core.manager.repositories.trace_summary_repository import (
    trace_summary_repository,
)
from app.schemas.agent import AgentId
from app.schemas.trace_detail import TraceDetail


@dataclass
class TraceContext:
    """
    追踪上下文，用于管理Agent执行过程中的追踪信息

    Attributes:
        agent_id: Agent标识符
        last_chunk: 最后一个chunk，用于错误处理
        trace_id: 追踪ID，用于创建执行摘要
        mapping: 映射表，用于存储invoke_type到invoke_name的映射
        trace_details: 批量收集的trace_detail，用于性能优化
    """
    agent_id: AgentId
    last_chunk: Any = None
    trace_id: Optional[str] = None
    mapping: Dict[str, str] = field(default_factory=dict)
    trace_details: List[TraceDetail] = field(default_factory=list)
    agent_ouput: Optional[dict] = None
    agent_input: Optional[dict] = None


def initialize_trace_context(
    space_id: str, agent_id: str, agent_version: str, mapping: Optional[Dict[str, str]] = None
) -> TraceContext:
    """
    初始化追踪上下文

    Args:
        space_id: 工作空间ID
        agent_id: Agent ID
        agent_version: Agent版本号
        mapping: 映射表，用于存储invoke_type到invoke_name的映射

    Returns:
        TraceContext: 初始化的追踪上下文
    """
    return TraceContext(
        trace_details=[],
        agent_id=AgentId(
            space_id=space_id,
            agent_id=agent_id,
            agent_version=agent_version
        ),
        mapping=mapping or {},
        agent_ouput={},
        agent_input={},
    )


async def process_chunk_trace(
    chunk: Any, trace_context: TraceContext, business_type: str = "AGENT"
) -> Any:
    """
    处理单个chunk的追踪信息

    Args:
        chunk: Agent执行返回的chunk
        trace_context: 追踪上下文
        business_type: 业务类型，默认为"AGENT"

    Returns:
        Tuple[Optional[Any], bool]: (响应数据, 是否有响应)
    """

    # 检查是否为需要过滤的workflow trace chunk
    if isinstance(chunk, TraceSchema) and chunk.type == "tracer_workflow":
        wf = TraceWorkflowSpan.model_validate(chunk.payload)
        # 检查条件：有workflowId字段且invokeId == workflowId
        if hasattr(wf, 'workflow_id') and wf.invoke_id == wf.workflow_id:
            return None

    if isinstance(chunk, OutputSchema) and chunk.type == "answer":
        payload = chunk.payload
        if 'output' in payload:
            trace_context.agent_ouput = {'outputs': payload.get('output')}
        return None

    # 转换chunk为响应格式和追踪信息
    rsp, _, trace_detail = result_convert(chunk, business_type=business_type, mapping=trace_context.mapping)

    # 保存详细的追踪信息
    if trace_detail:
        # 保存最后一个trace chunk，用于错误处理
        trace_context.last_chunk = chunk
        trace_context.trace_details.append(trace_detail)
        if trace_context.trace_id is None:
            trace_context.trace_id = trace_detail.trace_id
            logger.debug(f"Set trace_id: {trace_context.trace_id}")

    # 收集追踪日志
    # if trace_log:
    #     trace_context.trace_logs.append(trace_log)
    #     logger.debug(f"Added trace log, total count: {len(trace_context.trace_logs)}")

    return rsp


async def finalize_trace(trace_context: TraceContext) -> None:
    """
    完成追踪，保存最终的追踪信息

    Args:
        trace_context: 追踪上下文
    """
    logger.info(f"Finalizing trace for agent: {trace_context.agent_id.agent_id}, "
               f"details size: {len(trace_context.trace_details)}")

    # 批量保存所有收集的trace details
    if trace_context.trace_details:
        try:
            await save_trace_details(trace_context.agent_id, trace_context.trace_details)
            logger.debug(f"Successfully saved {len(trace_context.trace_details)} trace details")
        except Exception as e:
            logger.error(f"Failed to save trace details: {e}")

    # 创建执行摘要
    if trace_context.trace_id is not None:
        try:
            trace_summary_repository.create_trace_summary_by_trace_id(
                trace_context.trace_id, 
                trace_context.agent_input, 
                trace_context.agent_ouput
            )
            logger.debug(f"Created trace summary for trace_id: {trace_context.trace_id}")
        except Exception as e:
            logger.error(f"Failed to create trace summary: {e}")


async def handle_trace_error(
    trace_context: TraceContext, error_code: int, error_message: str
) -> None:
    """
    处理追踪相关的错误

    Args:
        trace_context: 追踪上下文
        error_code: 错误码
        error_message: 错误消息
    """
    logger.warning(f"Handling trace error for agent: {trace_context.agent_id.agent_id}, "
                   f"error_code: {error_code}, error_message: {error_message}")

    # 处理流式错误
    try:
        trace_id = await handle_stream_error(
            [],
            trace_context.trace_details,
            trace_context.last_chunk,
            error_code,
            error_message,
            trace_context.agent_id,
        )
        if trace_id and trace_context.trace_id is None:
            trace_context.trace_id = trace_id
    except Exception as e:
        logger.error(f"Failed to handle stream error: {e}")

    # 确保错误情况下也能保存追踪摘要
    if trace_context.trace_id is not None:
        try:
            trace_summary_repository.create_trace_summary_by_trace_id(
                trace_context.trace_id, 
                trace_context.agent_input, 
                trace_context.agent_ouput
            )
            logger.debug(f"Created trace summary after error for trace_id: {trace_context.trace_id}")
        except Exception as e:
            logger.error(f"Failed to create trace summary after error: {e}")
