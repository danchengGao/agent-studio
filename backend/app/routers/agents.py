#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import ValidationError

from openjiuwen.core.common.logging import logger

from app.core.manager.login_manager.user import get_current_user
from app.core.manager.model_manager.managers import ModelConfigManager
from app.routers.common import handle_response, validate_request
import app.core.manager.agent as mgr
from app.routers.models import get_model_config_manager
from app.schemas.agent import AgentCreate, AgentGet, AgentDisplayInfo, AgentList, AgentPublish, AgentGetVersion, \
    AgentUpdate, AgentCopy, AgentId, AgentSearchRequest, AgentVersionListRequest, AgentVersionListResponse
from app.schemas.common import ResponseModel
from app.schemas.execution_log import ExecutionLogsCreateList, ApiExecutionLogGet, ApiExecutionLogsDebugEnter, \
    AgExecutionLogsFilter, AgExecutionLogIndex
import app.core.manager.execution_log as exe_mgr


def _get_friendly_error_message(err, operation: str) -> str:
    """
    根据错误类型和操作类型返回友好的错误消息
    """
    # 检查是否为模型配置为空的错误
    if (operation == "AGENT_SAVE"
            and err.get("ctx") == {"class_name": "AgentModel"}
            and err.get("msg") == 'Input should be a valid dictionary or instance of AgentModel'):
        return "智能体自动保存失败，模型配置为空，请为智能体配置模型"
    # 默认返回原始错误消息
    return err.get('msg', 'Validation error')


def handle_validation_error(e: ValidationError, operation: str, user_id: str = 'unknown') -> HTTPException:
    """处理ValidationError，生成友好的错误信息"""
    logger.error(f"[{operation}] Validation failed - User: {user_id}, Errors: {e.errors()}")
    # 构造友好的错误信息
    error_details = []
    for err in e.errors():
        # 提取字段路径和错误信息
        field = '.'.join(map(str, err['loc'])) if isinstance(err['loc'], tuple) else str(err['loc'])
        msg = _get_friendly_error_message(err, operation)
        error_details.append(f"{field}: {msg}")
    
    # 拼接最终的错误信息
    error_msg = ", ".join(error_details)
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Validation failed: {error_msg}"
    )


agents_router = APIRouter()


@agents_router.post("/create", response_model=ResponseModel[dict])
async def agent_create(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    创建新的智能体实例。

    Args:
        request (dict): 包含创建需求的请求体数据，需符合AgentCreate模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了创建成功的智能体详情及元数据。
        如果创建失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentCreate)
        res = mgr.agent_react_create(req, current_user)
        if res.code == status.HTTP_200_OK:
            logger.info(
                f"[AGENT_CREATE] Agent created - ID: {res.data.get('id')}, User: {current_user.get('user_id', 'unknown')}")
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_CREATE", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/delete", response_model=ResponseModel[dict])
async def agent_delete(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    删除指定id智能体的draft+publish所有版本数据。

    Args:
        request (dict): 包含创建需求的请求体数据，需符合AgentGet模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了删除成功的智能体详情及元数据。
        如果删除失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentGet)
        res = mgr.agent_delete(req, current_user)
        if res.code == status.HTTP_200_OK:
            logger.info(
                f"[AGENT_DELETE] Agent deleted - ID: {req.agent_id}, User: {current_user.get('user_id', 'unknown')}")
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_DELETE", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/delete_publish", response_model=ResponseModel[dict])
async def agent_publish_delete(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    删除指定id及publish版本的智能体。

    Args:
        request (dict): 包含删除需求的请求体数据，需符合AgentId模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了删除成功的智能体详情及元数据。
        如果删除失败，则包含相应的错误码与提示信息。
    """
    try:
        logger.info(f"agent publish delete start")
        req = validate_request(request, AgentId)
        logger.debug(f"received request {req}")
        res = mgr.agent_publish_delete(req, current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_PUBLISH_DELETE") from e


@agents_router.post("/get_agent_info", response_model=ResponseModel[dict])
async def agent_get_info(
        request: dict,
        current_user: dict = Depends(get_current_user),
        manager: ModelConfigManager = Depends(get_model_config_manager)
):
    """
    获取智能体信息。

    Args:
        request (dict): 包含创建需求的请求体数据，需符合AgentGet模型定义。
        current_user (dict): 执行此操作的用户上下文信息。
        manager (ModelConfigManager): 模型配置管理实例。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了获取成功的智能体详情及元数据。
        如果获取失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentGetVersion)
        res = mgr.get_single_agent_info(req, current_user, manager)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_GET_INFO", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/save", response_model=ResponseModel[dict])
async def agent_save(
        request: dict,
        current_user: dict = Depends(get_current_user),
        manager: ModelConfigManager = Depends(get_model_config_manager)
):
    """
    保存智能体信息。

    Args:
        request (dict): 包含保存agent的请求体数据，需符合AgentDisplayInfo模型定义。
        current_user (dict): 执行此操作的用户上下文信息。
        manager (ModelConfigManager): 模型配置管理实例。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了保存成功的智能体详情及元数据。
        如果保存智能体失败，则包含相应的错误码与提示信息。
    """
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown')

    # 打印完整的请求数据，用于调试
    logger.info(f"[AGENT_SAVE] Raw request data: {request}")

    try:
        req = validate_request(request, AgentDisplayInfo)
        logger.info(f"[AGENT_SAVE] Validated request - ID: {req.agent_id}, User: {user_id}")
        logger.info(f"[AGENT_SAVE] Validated request data: {req.model_dump()}")

        # 验证知识库的 embedding 模型一致性（如果有多个知识库）
        if req.knowledge and len(req.knowledge) > 1:
            from app.core.database import SessionLocal
            from app.core.manager.repositories.knowledge_base_repository import knowledge_base_repository
            from app.core.manager.repositories import EmbeddingModelConfigRepository
            from app.schemas.knowledge_base import KnowledgeBaseGet

            db = SessionLocal()
            try:
                embed_repo = EmbeddingModelConfigRepository(db)
                model_ids = []

                for kb_id in req.knowledge:
                    kb_result = knowledge_base_repository.knowledge_base_get(
                        KnowledgeBaseGet(space_id=req.space_id, kb_id=kb_id)
                    )
                    if kb_result.code != status.HTTP_200_OK or not kb_result.data:
                        continue

                    embed_config_id = kb_result.data.get('embedding_model_config_id')
                    if not embed_config_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"知识库 '{kb_result.data.get('name', kb_id)}' 未配置 embedding 模型"
                        )

                    embed_config = embed_repo.get_by_id(embed_config_id)
                    if not embed_config:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Embedding 模型配置不存在: {embed_config_id}"
                        )

                    model_ids.append(embed_config.model_id)

                # 验证所有 model_id 是否相同
                if len(set(model_ids)) > 1:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="所选知识库使用了不同的 embedding 模型（model_id），无法同时检索。请确保所有知识库使用相同的 embedding 模型。"
                    )
            finally:
                db.close()

        res = mgr.agent_save(req, current_user, manager)
        if res.code == status.HTTP_200_OK:
            logger.info(f"[AGENT_SAVE] Agent saved - ID: {req.agent_id}, User: {user_id}")
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_SAVE", user_id) from e


@agents_router.post("/update", response_model=ResponseModel[dict])
async def agent_update(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    更新智能体实例meta信息。

    Args:
        request (dict): 包含更新agent的请求体数据，需符合AgentUpdate模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了更新成功的agent详情及元数据。
        如果更新失败，则包含相应的错误码与提示信息。
    """
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown')
    try:
        req = validate_request(request, AgentUpdate)
        res = mgr.agent_meta_update(req, current_user)
        if res.code == status.HTTP_200_OK:
            logger.info(f"[AGENT_UPDATE] Agent updated - ID: {req.agent_id}, User: {user_id}")
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_UPDATE", user_id) from e


@agents_router.post("/list", response_model=ResponseModel[dict])
async def agent_list(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    获取智能体列表信息。

    Args:
        request (dict): 包含列表查询条件的请求体数据，需符合AgentList模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了获取成功的智能体列表详情及元数据。
        如果获取智能体列表失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentList)
        res = mgr.agent_get_list(req, current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_LIST", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/publish", response_model=ResponseModel[dict])
async def agent_publish(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    发布智能体。

    Args:
        request (dict): 包含发布需求的请求体数据，需符合AgentPublish模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了发布成功的智能体详情及元数据。
        如果发布失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentPublish)
        res = mgr.agent_publish(req, current_user)
        if res.code == status.HTTP_200_OK:
            logger.info(
                f"[AGENT_PUBLISH] Agent published - ID: {req.agent_id}, Version: {req.agent_version}, User: {current_user.get('user_id', 'unknown')}")
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_PUBLISH", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/version_list", response_model=ResponseModel[AgentVersionListResponse])
async def agent_version_list(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    查询智能体的发布版本列表

    Args:
        request (dict): 包含智能体ID和工作空间ID的请求体数据，需符合AgentVersionListRequest模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[AgentVersionListResponse]: 标准化响应对象，其中封装了智能体版本列表。
        如果查询失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentVersionListRequest)
        res = mgr.agent_version_list(req, current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_VERSION_LIST", current_user.get('user_id', 'unknown')) from e


@agents_router.get("/{agent_id}", response_model=ResponseModel[dict])
async def agent_get(
        agent_id: str,
        space_id: str,
        version: Optional[str] = None,
        current_user: dict = Depends(get_current_user)
):
    """
    获取转换后agent，供executor调用

    Args:
        agent_id (str): 智能体id。
        space_id (str): 工作空间id。
        version (str): 智能体版本信息。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了转换成功的agent dsl信息详情。
        如果获取失败，则包含相应的错误码与提示信息。
    """
    try:
        req = {"agent_id": agent_id, "space_id": space_id, "agent_version": version}
        res = mgr.agent_convert(AgentGetVersion(**req), current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_GET") from e


@agents_router.post("/copy", response_model=ResponseModel[dict])
async def agent_copy(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    复制智能体实例。

    Args:
        request (dict): 包含复制需求的请求体数据，需符合AgentCopy模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了创建成功的智能体详情及元数据。
        如果创建失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentCopy)
        res = mgr.agent_react_copy(req, current_user)
        if res.code == status.HTTP_200_OK:
            logger.info(
                f"[AGENT_COPY] Agent copied - SourceID: {req.agent_id}, NewID: {res.data.get('id')}, User: {current_user.get('user_id', 'unknown')}")
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_COPY", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/search", response_model=ResponseModel[dict])
async def agent_search(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    搜索智能体

    Args:
        request (dict): 包含搜索需求的请求体数据，需符合AgentSearchRequest模型定义。
        current_user (dict): 执行此操作的用户上下文信息。

    Returns:
        ResponseModel[dict]: 标准化响应对象，其中封装了搜索成功的智能体列表及元数据。
        如果搜索失败，则包含相应的错误码与提示信息。
    """
    try:
        req = validate_request(request, AgentSearchRequest)
        res = mgr.agent_search(req, current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_SEARCH", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/get_execution_logs_create_list", response_model=ResponseModel[ExecutionLogsCreateList])
async def get_agent_execution_logs_create_list(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    获取agent的所有执行日志的创建信息list

    Args:
        request: agent信息及过滤条件, AgExecutionLogsFilter类型
    Returns:
        ResponseModel[ExecutionLogsCreateList]: 创建信息list
    """
    try:
        req = validate_request(request, AgExecutionLogsFilter)
        res = exe_mgr.get_agent_execution_logs_create_list(req, current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_EXECUTION_LOGS_LIST", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/get_execution_log", response_model=ResponseModel[ApiExecutionLogGet])
async def get_agent_execution_log(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    获取agent的某次执行日志

    Args:
        request: agent及某次执行的id信息, AgExecutionLogIndex类型
    Returns:
        ResponseModel[ApiExecutionLogGet]: 创建信息list
    """
    try:
        req = validate_request(request, AgExecutionLogIndex)
        res = exe_mgr.get_agent_execution_log(req, current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_EXECUTION_LOG_GET", current_user.get('user_id', 'unknown')) from e


@agents_router.post("/enter_execution_logs_debug", response_model=ResponseModel[ApiExecutionLogsDebugEnter])
async def enter_agent_execution_logs_debug(
        request: dict,
        current_user: dict = Depends(get_current_user)
):
    """
    点击调试按钮，获取agent的所有运行log的create list及最新运行日志

    Args:
        request: agent的id信息, AgentId类型
    Returns:
        ResponseModel[ApiExecutionLogsDebugEnter]: 所有运行log的create list及最新运行日志
    """
    try:
        req = validate_request(request, AgentId)
        res = exe_mgr.enter_agent_execution_logs_debug(req, current_user)
        return handle_response(res)
    except ValidationError as e:
        raise handle_validation_error(e, "AGENT_EXECUTION_DEBUG", current_user.get('user_id', 'unknown')) from e
