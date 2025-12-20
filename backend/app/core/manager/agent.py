#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
import functools
import math
import time
import uuid
from typing import TYPE_CHECKING, Callable, Type

from fastapi import status
from openjiuwen.core.common.logging import logger
from pydantic import BaseModel, ValidationError

import app.core.manager.convertor.agent as convert
from app.core.common.dsl import AgentEditMode, AgentType
from app.core.common.status_code import StatusCode
from app.core.database import milliseconds
from app.core.manager.internal.agent import (AgentItem, AgentListInfo,
                                             AgentListPagination,
                                             AgentModelListNode,
                                             AgentOptionInfo,
                                             AgentWorkflowListNode,
                                             SingleAgentData)
from app.core.manager.login_manager.space import check_user_space
from app.core.manager.model_manager.managers import ModelConfigManager
from app.core.manager.reference_extractor import extract_agent_references
from app.core.manager.repositories.agent_repository import agent_repository
from app.core.manager.repositories.reference_repository import reference_repository
from app.core.manager.repositories.workflow_repository import \
    workflow_repository
from app.core.manager.utils.utils import Version, check_version
from app.models.agent import AgentBaseDBPd
from app.models.agent import AgentPublishDBPd
from app.schemas.agent import (AGENT_NAME_MAX_SIZE, AgentConstraint, AgentCopy,
                               AgentCreate, AgentDisplayInfo, AgentGet,
                               AgentGetVersion, AgentId, AgentList, AgentModel,
                               AgentPublish,
                               AgentResponseCreate, AgentResponsePublish,
                               AgentSearchRequest, AgentUpdate,
                               AgentVersionInfo, AgentVersionListRequest,
                               AgentVersionListResponse)
from app.schemas.common import ResponseModel
from app.schemas.model_config import ModelParameters
from app.schemas.space import SpaceAWPQuery

if TYPE_CHECKING:
    # 只为类型检查器服务，运行时不执行
    AgentBaseDBPd: Type[BaseModel]

DEFAULT_OPENING_REMARKS = "您好！我是您的智能助手，很高兴为您服务。请问有什么可以帮助您的吗？"
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 10


def with_exception_handling(func: Callable) -> Callable:
    """增强的异常处理装饰器，提供统一的错误处理、性能监控和日志记录"""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        func_name = func.__name__

        # 尝试从参数中提取用户信息
        user_id = "unknown"
        if len(args) >= 2:
            # 假设第二个参数是current_user字典
            current_user = args[1]
            if isinstance(current_user, dict):
                data = current_user.get('data', 'unknown')
                user_id = data['user_id_str']

        operation_tag = func_name.upper().replace('AGENT_', '[AGENT_')

        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time

            # 记录成功执行的性能指标
            if hasattr(result, 'code') and result.code == status.HTTP_200_OK:
                logger.debug(f"{operation_tag}] Performance - User: {user_id}, Duration: {execution_time:.3f}s")

            return result

        except ValidationError as e:
            execution_time = time.time() - start_time
            # 构造友好的错误信息
            error_msg = ", ".join(
                [f"{'.'.join(map(str, err['loc'])) if isinstance(err['loc'], tuple) else str(err['loc'])}: {err['msg']}" for err in e.errors()])
            logger.error(
                f"{operation_tag}] Validation failed - User: {user_id}, Duration: {execution_time:.3f}s, Errors: {e.errors()}")

            return ResponseModel(
                code=StatusCode.AGENT_VALIDATION_ERROR.code,
                message=StatusCode.AGENT_VALIDATION_ERROR.errmsg.format(msg=error_msg)
            )

        except ValueError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Invalid value - User: {user_id}, Duration: {execution_time:.3f}s, Error: {error_msg}")

            return ResponseModel(
                code=StatusCode.AGENT_INVALID_VALUE.code,
                message=StatusCode.AGENT_INVALID_VALUE.errmsg.format(msg=error_msg)
            )

        except KeyError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Missing required field - User: {user_id}, Duration: {execution_time:.3f}s, Error: {error_msg}")

            return ResponseModel(
                code=StatusCode.AGENT_MISSING_FIELD.code,
                message=StatusCode.AGENT_MISSING_FIELD.errmsg.format(msg=error_msg)
            )

        except TimeoutError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Operation timeout - User: {user_id}, Duration: {execution_time:.3f}s, Error: {error_msg}")

            return ResponseModel(
                code=StatusCode.AGENT_TIMEOUT.code,
                message=StatusCode.AGENT_TIMEOUT.errmsg.format(msg=error_msg)
            )

        except ConnectionError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Database connection error - User: {user_id}, Duration: {execution_time:.3f}s, Error: {error_msg}")

            return ResponseModel(
                code=StatusCode.AGENT_DB_CONNECTION_ERROR.code,
                message=StatusCode.AGENT_DB_CONNECTION_ERROR.errmsg.format(msg=error_msg)
            )

        except Exception as e:
            execution_time = time.time() - start_time
            error_type = type(e).__name__
            error_msg = str(e)

            # 记录详细的错误信息包括堆栈跟踪
            logger.error(
                f"{operation_tag}] Unexpected error - User: {user_id}, Duration: {execution_time:.3f}s, Type: {error_type}, Error: {error_msg}",
                exc_info=True)

            # 根据错误类型返回不同的状态码
            if "database" in error_msg.lower() or "sql" in error_type.lower():
                status_code = StatusCode.AGENT_DATABASE_OPERATION_ERROR.code
                message = StatusCode.AGENT_DATABASE_OPERATION_ERROR.errmsg
            elif "network" in error_msg.lower() or "connection" in error_msg.lower():
                status_code = StatusCode.AGENT_NETWORK_CONNECTION_ERROR.code
                message = StatusCode.AGENT_NETWORK_CONNECTION_ERROR.errmsg
            elif "permission" in error_msg.lower() or "unauthorized" in error_msg.lower():
                status_code = StatusCode.AGENT_PERMISSION_ERROR.code
                message = StatusCode.AGENT_PERMISSION_ERROR.errmsg
            else:
                status_code = StatusCode.AGENT_INTERNAL_SERVER_ERROR.code
                message = StatusCode.AGENT_INTERNAL_SERVER_ERROR.errmsg.format(msg=error_type)

            return ResponseModel(
                code=status_code,
                message=message
            )

    return wrapper


def create_agent_react_info(req: AgentCreate) -> AgentBaseDBPd:
    # 1 生成agent_id
    agent_id = str(uuid.uuid4())
    current_time = milliseconds()

    # 2 获取和agent绑定的workflow信息列表
    constraint = AgentConstraint()

    default_agent_info = AgentBaseDBPd(
        agent_id=agent_id,
        agent_name=req.agent_name,
        space_id=req.space_id,
        description=req.description,
        agent_type=AgentType.ReAct,
        # configs=configs,  # 待configs功能完善后再获取
        icon=req.icon,
        edit_mode=AgentEditMode.Manual,
        # plugins=plugins,  # 待plugins功能完善后再获取
        # model=req.model,
        constraint=constraint.model_dump(),
        opening_remarks=DEFAULT_OPENING_REMARKS,
        create_time=current_time,
        update_time=current_time
    )

    return default_agent_info


@with_exception_handling
def agent_react_create(
        req: AgentCreate,
        current_user: dict
) -> ResponseModel:
    """创建新的智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown') if isinstance(data, dict) else 'unknown'

    logger.info(f"[AGENT_CREATE] Creating agent - User: {user_id}, Name: {req.agent_name}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 生成agent_info信息
    agent_info = create_agent_react_info(req)
    logger.debug(f"[AGENT_CREATE] Generated agent ID: {agent_info.agent_id}")

    # 3. 保存agent_info信息至DB中
    create_result = agent_repository.create_agent_db(agent_info)

    if create_result.code != status.HTTP_200_OK:
        logger.error(f"[AGENT_CREATE] Database save failed - ID: {agent_info.agent_id}, Error: {create_result.message}")
        return ResponseModel(
            code=create_result.code,
            message=create_result.message,
        )

    # 4. 准备响应数据
    response_data = AgentResponseCreate(id=agent_info.agent_id)

    logger.info(
        f"[AGENT_CREATE] Agent created - ID: {agent_info.agent_id}, User: {user_id}, Duration: {time.time() - start_time:.3f}s")

    # 5. 返回创建结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="create agent success",
        data=response_data.model_dump(by_alias=False)
    )


@with_exception_handling
def agent_delete(
        req: AgentGet,
        current_user: dict
) -> ResponseModel:
    """删除已有的智能体的draft+publish数据"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown') if isinstance(data, dict) else 'unknown'

    logger.info(f"[AGENT_DELETE] Deleting agent - User: {user_id}, ID: {req.agent_id}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 构建删除查询参数
    agent_query = AgentId(
        space_id=req.space_id,
        agent_id=req.agent_id,
        agent_version=None
    )

    # 3. 从DB中删除agent及其所有版本
    delete_result = agent_repository.delete_agent_db(agent_query)

    if delete_result.code != status.HTTP_200_OK:
        logger.error(f"[AGENT_DELETE] Database deletion failed - ID: {req.agent_id}, Error: {delete_result.message}")
        return ResponseModel(
            code=delete_result.code,
            message=delete_result.message,
        )

    # 4. 清理引用关系（删除成功后）
    try:
        cleanup_result = reference_repository.reference_delete_by_referer(
            req.space_id, "AGENT", req.agent_id
        )
        if cleanup_result["code"] != status.HTTP_200_OK:
            logger.warning(
                f"[AGENT_DELETE] Failed to cleanup references for deleted agent {req.agent_id}: {cleanup_result['message']}")
    except Exception as e:
        logger.error(f"[AGENT_DELETE] Error cleaning up references for agent {req.agent_id}: {e}")

    logger.info(
        f"[AGENT_DELETE] Agent deleted - ID: {req.agent_id}, User: {user_id}, Duration: {time.time() - start_time:.3f}s")

    # 5. 返回删除结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message=f"delete agent with id {req.agent_id} success",
    )


@with_exception_handling
def agent_publish_delete(
        req: AgentId,
        current_user: dict
) -> ResponseModel:
    """删除指定id及publish版本的智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown') if isinstance(data, dict) else 'unknown'

    logger.info(
        f"[AGENT_PUBLISH_DELETE] Deleting agent publish - User: {user_id}, ID: {req.agent_id}, Version: {req.agent_version}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 从DB中删除agent的指定publish版本
    delete_result = agent_repository.delete_agent_publish_db(req)

    if delete_result.code != status.HTTP_200_OK:
        logger.error(
            f"[AGENT_PUBLISH_DELETE] Database deletion failed - ID: {req.agent_id}, Version: {req.agent_version}, Error: {delete_result.message}")
        return ResponseModel(
            code=delete_result.code,
            message=delete_result.message,
        )

    # 3. 清理该版本的引用关系（删除成功后）
    try:
        cleanup_result = reference_repository.reference_delete_by_referer_with_version(
            req.space_id, "AGENT", req.agent_id, req.agent_version
        )
        if cleanup_result["code"] != status.HTTP_200_OK:
            logger.warning(
                f"[AGENT_PUBLISH_DELETE] Failed to cleanup references for deleted agent publish {req.agent_id}:{req.agent_version}: {cleanup_result['message']}")
    except Exception as e:
        logger.error(
            f"[AGENT_PUBLISH_DELETE] Error cleaning up references for agent publish {req.agent_id}:{req.agent_version}: {e}")

    logger.info(
        f"[AGENT_PUBLISH_DELETE] Agent publish deleted - ID: {req.agent_id}, User: {user_id}, Version: {req.agent_version}, Duration: {time.time() - start_time:.3f}s")

    # 4. 返回删除结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message=f"delete agent publish with id {req.agent_id} and version {req.agent_version} success",
    )


@with_exception_handling
def get_single_agent_info(
        req: AgentGetVersion,
        current_user: dict,
        manager: ModelConfigManager
) -> ResponseModel:
    """获取单个智能体信息"""
    _ = check_user_space(req.space_id, current_user)

    # 1. 从db中获取agent_info信息
    agent_query = AgentId(
        space_id=req.space_id,
        agent_id=req.agent_id,
        agent_version=req.agent_version  # 使用指定的版本，None时获取draft版本
    )
    get_result = agent_repository.get_agent_db(agent_query)
    if get_result.code != status.HTTP_200_OK:
        return ResponseModel(
            code=get_result.code,
            message=get_result.message,
        )
    agent_info = AgentBaseDBPd(**get_result.data)

    # 2. 获取workflow list列表
    workflow_request = req.model_dump()
    workflow_request.update({"page": 1, "page_size": 10000})  # 获取所有工作流
    list_result = workflow_repository.workflow_list(SpaceAWPQuery.model_validate(workflow_request))
    if list_result.code != status.HTTP_200_OK:
        wf_list: list[AgentWorkflowListNode] = []
    else:
        wf_list: list[AgentWorkflowListNode] = []
        for w in list_result.data.get('workflow_list', []):
            node = AgentWorkflowListNode(
                id=w.get("workflow_id"),
                version=w.get("workflow_version", "draft"),
                name=w.get("name"),
                desc=w.get("desc")
            )
            wf_list.append(node)

    # 4. 获取model list列表
    filters = {'space_id': req.space_id}
    models, _ = manager.get_paginated_configs(page=DEFAULT_PAGE,
                                              size=DEFAULT_PAGE_SIZE,
                                              filters=filters)
    m_list: list[AgentModelListNode] = []
    for model in models:
        if not model.is_active:
            continue
        param = ModelParameters(**model.parameters)
        m_info = AgentModelListNode(
            **param.model_dump(),
            id=model.id,
            name=model.name,
            type=model.model_type,
            api_key=model.api_key or "",
            api_base=model.base_url or "",
            model_provider=model.provider,
            streaming=model.enable_streaming,
            timeout=model.timeout
        )

        m_list.append(m_info)

    options = AgentOptionInfo(
        workflow_list=wf_list,
        model_list=m_list
    )

    data_response = SingleAgentData(
        agent_info=agent_info,
        agent_option_info=options
    )

    # 5. 返回创建结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="create agent success",
        data=data_response.model_dump(by_alias=False)
    )


@with_exception_handling
def agent_save(
        req: AgentDisplayInfo,
        current_user: dict,
        manager: ModelConfigManager
) -> ResponseModel:
    """更新并保存智能体"""
    start_time = time.time()
    data = current_user.get('data', 'unknown')
    user_id = data['user_id_str']

    logger.info(f"[AGENT_SAVE] Saving agent - User: {user_id}, ID: {req.agent_id}, Name: {req.agent_name}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 验证agent版本（保存时应该为空）
    if req.agent_version is not None and req.agent_version != "":
        logger.error(f"[AGENT_SAVE] Invalid version for save - ID: {req.agent_id}, Version: {req.agent_version}")
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message="agent version should be empty or None when agent save",
        )

    # 3. Get model configuration
    req_dict = req.model_dump()
    model_using = None

    # 尝试获取模型配置
    req_model = req.model
    model_id = getattr(req_model.model_info, 'model_id', None)

    logger.info(f"[AGENT_SAVE] model id: {model_id}")
    # 首先尝试根据ID获取模型
    if model_id:
        models, _ = manager.get_paginated_configs(
            page=1, size=1, filters={'id': model_id, 'space_id': req.space_id}
        )
        model_using = models[0] if models else None

    # 如果没有ID或未找到，尝试根据名称获取
    if not model_using:
        models, _ = manager.get_paginated_configs(
            page=1, size=1,
            filters={'name': req_model.model_info.model_name, 'space_id': req.space_id}
        )
        model_using = models[0] if models else None

    if model_using:
        # 提取模型基础参数
        model_params = model_using.parameters
        model_base_config = {
            'model_name': model_using.name,
            'model_type': model_using.model_type,
            'api_key': model_using.api_key,
            'api_base': model_using.base_url,
            'streaming': model_using.enable_streaming,
            'timeout': model_using.timeout,
            'temperature': model_params.get('temperature', 0.7),
            'top_p': model_params.get('top_p', 0.9),
            'max_tokens': model_params.get('max_tokens', 4096),
            'provider': model_using.provider,
        }
        logger.info(f"[AGENT_SAVE] model url: {model_using.base_url}, model id: {model_using.model_type}")

        # 合并模型信息
        req_model_info = req_model.model_info.model_dump()
        # 更新必要字段
        req_model_info.update({
            "api_key": model_base_config["api_key"],
            "api_base": model_base_config["api_base"],
            "model_id": model_using.id  # 确保设置model_id
        })

        # 填充空值
        for key, value in req_model_info.items():
            if value is None and key in model_base_config:
                req_model_info[key] = model_base_config[key]

        # 构建完整模型字典
        req_dict['model'] = {
            'model_provider': model_using.provider,
            'model_info': req_model_info
        }
        logger.info(f"[AGENT_SAVE] model_provider: {model_using.provider}")

    # 创建AgentBaseDBPd实例
    agent_info = AgentBaseDBPd(**req_dict, update_time=milliseconds())

    # 4. 更新agent_info信息至DB中
    save_result = agent_repository.save_agent_db(agent_info)

    if save_result.code != status.HTTP_200_OK:
        logger.error(f"[AGENT_SAVE] Database save failed - ID: {req.agent_id}, Error: {save_result.message}")
        return ResponseModel(
            code=save_result.code,
            message=save_result.message,
        )

    # 5. 管理引用关系
    try:

        # 5.1 删除旧的草稿引用关系
        delete_result = reference_repository.reference_delete_by_referer_with_version(
            req.space_id, "AGENT", req.agent_id, "draft"
        )
        if delete_result["code"] != status.HTTP_200_OK:
            logger.warning(
                f"[AGENT_SAVE] Failed to delete old references for agent {req.agent_id}: {delete_result['message']}")

        # 5.2 提取并创建新的引用关系
        references = extract_agent_references(req.model_dump(), req.space_id, "draft")
        for ref in references:
            create_result = reference_repository.reference_create(ref)
            if create_result["code"] != status.HTTP_200_OK:
                logger.warning(f"[AGENT_SAVE] Failed to create reference {ref}: {create_result['message']}")

        logger.info(
            f"[AGENT_SAVE] Reference management completed for agent {req.agent_id}: {len(references)} references processed")
    except Exception as e:
        logger.error(f"[AGENT_SAVE] Error managing references for agent {req.agent_id}: {e}")
        # 引用关系管理失败不影响主要保存功能

    logger.info(
        f"[AGENT_SAVE] Agent saved - ID: {req.agent_id}, User: {user_id}, Duration: {time.time() - start_time:.3f}s")

    # 6. 返回保存结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="save agent success",
    )


@with_exception_handling
def agent_meta_update(
        req: AgentUpdate,
        current_user: dict
) -> ResponseModel:
    """更新并保存智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown') if isinstance(data, dict) else 'unknown'

    logger.info(f"[AGENT_UPDATE] Updating agent metadata - User: {user_id}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 构建agent_info对象
    agent_info = AgentBaseDBPd(
        **req.model_dump(),
        update_time=milliseconds()
    )

    # 3. 更新agent_info信息至DB中
    save_result = agent_repository.save_agent_db(agent_info)

    if save_result.code != status.HTTP_200_OK:
        logger.error(f"[AGENT_UPDATE] Database update failed, Error: {save_result.message}")
        return ResponseModel(
            code=save_result.code,
            message=save_result.message,
        )

    logger.info(
        f"[AGENT_UPDATE] Agent metadata updated, User: {user_id}, Duration: {time.time() - start_time:.3f}s")

    # 4. 返回更新结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="update agent success",
    )


def check_agent_validity(agent_meta: dict) -> bool:
    """检查agent信息是否合法"""
    try:
        agent_info = AgentBaseDBPd(**agent_meta)
        # 检查必要字段是否存在且有效
        return bool(agent_info.agent_id and agent_info.agent_name)
    except Exception:
        return False


@with_exception_handling
def agent_get_list(
        req: AgentList,
        current_user: dict
) -> ResponseModel:
    """获取智能体列表"""
    # 从current_user中正确获取user_id_str
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown') if isinstance(data, dict) else 'unknown'

    logger.info(f"[AGENT_LIST] Getting agent list - User: {user_id}, Space: {req.space_id}, Page: {req.page}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 构建查询参数
    query_info = SpaceAWPQuery(**req.model_dump())

    # 3. 从数据库获取agent列表
    list_result = agent_repository.get_space_agent_list_db(query_info)

    if list_result.code != status.HTTP_200_OK:
        # 查询有异常错误，直接报出来
        return ResponseModel(
            code=list_result.code,
            message=list_result.message
        )

    items: list[AgentItem] = []
    for item_data in list_result.data['items']:
        model_name = "no model"
        if item_data.get("model"):
            try:
                # 简化模型数据处理
                model = AgentModel(**item_data.get("model"))
                model_name = model.model_info.model_name
            except Exception as e:
                logger.error(f"[AGENT_GET_LIST] Failed to process model data: {item_data.get('model')}, error: {e}")
        item = AgentItem(
            id=item_data.get("agent_id"),
            name=item_data.get("agent_name"),
            version=item_data.get("agent_version"),
            desc=item_data.get("description"),
            icon=item_data.get("icon") or "🤖",
            status=item_data.get("status", "test"),
            model_name=model_name,
            last_activate=item_data.get("last_activate", "test"),
            usage_count=item_data.get("usage_count", 0),
            tags=item_data.get("tags", []),
            create_time=item_data.get("create_time"),
            update_time=item_data.get("update_time"),
            api_endpoint=item_data.get("api_endpoint", "test")
        )

        items.append(item)

    total_agent = int(list_result.data['total'])
    total_pages = math.ceil(total_agent / req.page_size)

    page_info = AgentListPagination(
        page=req.page,
        page_size=req.page_size,
        total=total_agent,
        total_pages=total_pages
    )

    response_data = AgentListInfo(
        agent_items=items,
        pagination=page_info
    )

    # 4. 返回创建结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="get agent list success",
        data=response_data.model_dump(by_alias=False)
    )


@with_exception_handling
def agent_publish(
        req: AgentPublish,
        current_user: dict
) -> ResponseModel:
    """发布智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get('data', {})
    user_id = data.get('user_id_str', 'unknown') if isinstance(data, dict) else 'unknown'
    logger.info(f"[AGENT_PUBLISH] Publishing agent - User: {user_id}, ID: {req.agent_id}, Version: {req.agent_version}")

    # 1. 校验Space_id是否有权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 获取最新版本信息进行版本校验
    latest_version_query = AgentId(
        agent_id=req.agent_id,
        space_id=req.space_id,
        agent_version="latest_publish_version"
    )

    # 获取最新的发布版本信息
    latest_publish_version = agent_repository.get_agent_latest_publish_version_db(latest_version_query)

    # 3. 判断当前版本格式是否正确，且version是否为递增的
    if latest_publish_version is None:
        current_version, check_err = Version.string_to_object(req.agent_version)
        logger.info(f"[AGENT_PUBLISH] First time publishing - ID: {req.agent_id}, Version: {req.agent_version}")
        if check_err is not None:
            logger.error(
                f"[AGENT_PUBLISH] Invalid version format - ID: {req.agent_id}, Version: {req.agent_version}, Error: {check_err}")
            return ResponseModel(
                code=status.HTTP_400_BAD_REQUEST,
                message=f"check version {req.agent_version} failed, error: {check_err}",
                data=None
            )
    else:
        check_res, check_err = check_version(latest_publish_version, req.agent_version)
        logger.debug(
            f"[AGENT_PUBLISH] Version validation - ID: {req.agent_id}, Latest: {latest_publish_version}, Current: {req.agent_version}")
        if not check_res:
            logger.error(f"[AGENT_PUBLISH] Version validation failed - ID: {req.agent_id}, Error: {check_err}")
            return ResponseModel(
                code=status.HTTP_400_BAD_REQUEST,
                message=f"check version failed, error: {check_err}",
                data=None
            )

    # 4. 获取draft数据库中agent的信息
    agent_draft_query = AgentId(
        space_id=req.space_id,
        agent_id=req.agent_id,
        agent_version=None  # 获取draft版本
    )
    draft_result = agent_repository.get_agent_db(agent_draft_query)

    if draft_result.code != status.HTTP_200_OK:
        logger.error(f"[AGENT_PUBLISH] Failed to get draft agent - ID: {req.agent_id}, Error: {draft_result.message}")
        return ResponseModel(
            code=draft_result.code,
            message=f"Get agent with id {req.agent_id} failed, error: {draft_result.message}",
            data=None
        )

    agent_data = AgentBaseDBPd(**draft_result.data)

    # 5. 使用agent_convert进行智能体校验
    logger.debug(f"[AGENT_PUBLISH] Starting validation - ID: {req.agent_id}")
    agent_dsl, err = convert.agent_convert(req.space_id, agent_data)
    if err is not None:
        logger.error(f"[AGENT_PUBLISH] Validation failed - ID: {req.agent_id}, Error: {err}")
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message=f"Agent validation failed: {err}",
            data=None
        )
    logger.debug(f"[AGENT_PUBLISH] Validation passed - ID: {req.agent_id}")

    # 6. 构建publish需要的AgentPublishDB结构，并将其存入数据库中
    # 获取智能体基础数据，明确排除 agent_version 字段以避免冲突
    agent_publish_data = agent_data.model_dump(exclude_none=True, exclude={"agent_version"})

    # 更新时间戳为当前发布时间
    current_time = milliseconds()
    agent_publish_data["create_time"] = current_time
    agent_publish_data["update_time"] = current_time

    # 添加发布版本必需的字段
    agent_publish_data["agent_version"] = req.agent_version
    agent_publish_data["version_description"] = req.version_description

    # 创建发布版本数据
    version_data = AgentPublishDBPd(**agent_publish_data)

    # 7. 将发布版本数据存储到数据库
    logger.debug(f"[AGENT_PUBLISH] Starting database publish - ID: {req.agent_id}")
    publish_result = agent_repository.publish_agent_db(version_data)

    if publish_result.code != status.HTTP_200_OK:
        logger.error(f"[AGENT_PUBLISH] Database publish failed - ID: {req.agent_id}, Error: {publish_result.message}")
        return ResponseModel(
            code=publish_result.code,
            message=f"publish agent failed, error: {publish_result.message}",
            data=None
        )

    # 8. 管理发布版本的引用关系
    try:

        # 8.1 提取并创建发布版本的引用关系
        references = extract_agent_references(agent_publish_data, req.space_id, req.agent_version)
        for ref in references:
            create_result = reference_repository.reference_create(ref)
            if create_result["code"] != status.HTTP_200_OK:
                logger.warning(f"[AGENT_PUBLISH] Failed to create publish reference {ref}: {create_result['message']}")

        logger.info(
            f"[AGENT_PUBLISH] Publish reference management completed for agent {req.agent_id} v{req.agent_version}: {len(references)} references processed")
    except Exception as e:
        logger.error(f"[AGENT_PUBLISH] Error managing publish references for agent {req.agent_id}: {e}")
        # 引用关系管理失败不影响主要发布功能

    # 9. 构建响应数据
    res_data = AgentResponsePublish(
        agent_id=req.agent_id,
        success=True
    )

    # 记录完成指标
    execution_time = time.time() - start_time
    logger.info(
        f"[AGENT_PUBLISH] Published successfully - ID: {req.agent_id}, Version: {req.agent_version}, User: {user_id}, Duration: {execution_time:.3f}s")

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="publish agent success",
        data=res_data.model_dump()
    )


@with_exception_handling
def agent_convert(
        req: AgentGetVersion,
        current_user: dict
) -> ResponseModel:
    """转换agent数据格式"""
    _ = check_user_space(req.space_id, current_user)

    # 1. 从db中获取agent_info信息
    agent_query = AgentId(
        space_id=req.space_id,
        agent_id=req.agent_id,
        agent_version=None
    )
    get_result = agent_repository.get_agent_db(agent_query)
    if get_result.code != status.HTTP_200_OK:
        return ResponseModel(
            code=get_result.code,
            message=get_result.message,
        )

    # 2. 将展示面信息转换成执行面可用信息
    agent_dsl, err = convert.agent_convert(req.space_id, AgentBaseDBPd(**get_result.data))
    if err is not None:
        return ResponseModel(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="convert agent dsl failed",
        )
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="convert agent success",
        data=agent_dsl
    )


@with_exception_handling
def agent_react_copy(
        req: AgentCopy,
        current_user: dict
) -> ResponseModel:
    """创建新的智能体"""
    _ = check_user_space(req.space_id, current_user)

    # 重新生成agent_id
    agent_copy_id = str(uuid.uuid4())
    current_time = milliseconds()

    # 获取要复制的agent
    get_result = agent_repository.get_agent_db(AgentId(**req.model_dump()))
    if get_result.code != status.HTTP_200_OK:
        return get_result

    # 准备复制数据
    agent_data = get_result.data.copy()
    agent_data.pop("agent_version", None)  # 复制的智能体只能生成draft版本

    # 创建复制的智能体
    agent_copy = AgentBaseDBPd(**agent_data)
    agent_copy.agent_id = agent_copy_id
    agent_copy.create_time = current_time
    agent_copy.update_time = current_time
    agent_copy.agent_name = f"{agent_copy.agent_name}_copy"
    if len(agent_copy.agent_name) > AGENT_NAME_MAX_SIZE:
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message=f"Agent name add '_copy' suffix exceeds the {AGENT_NAME_MAX_SIZE}-character length limit."
        )

    # 保存到数据库
    copy_result = agent_repository.create_agent_db(agent_copy)
    if copy_result.code != status.HTTP_200_OK:
        return copy_result

    # 构造响应数据
    response_data = AgentResponseCreate(id=agent_copy.agent_id)

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="copy agent success",
        data=response_data.model_dump(by_alias=False)
    )


@with_exception_handling
def agent_search(
        req: AgentSearchRequest,
        current_user: dict
) -> ResponseModel:
    """搜索智能体"""
    # 1. 校验Space_id是否有权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 构建查询参数，使用SpaceAgentQuery模型
    query_params = SpaceAWPQuery(
        space_id=req.space_id,
        search_term=req.search_term or "",
        status_filter=req.status_filter or "all",
        sort_by=req.sort_by.value if req.sort_by else "update_time",
        sort_order=req.sort_order.value if req.sort_order else "desc",
        page=req.page or 1,
        page_size=req.page_size or 10
    )

    # 3. 调用现有的get_space_agent_list_db接口（已支持搜索）
    list_result = agent_repository.get_space_agent_list_db(query_params)

    if list_result.code != status.HTTP_200_OK:
        return ResponseModel(
            code=list_result.code,
            message=f"Search agent with space_id {req.space_id} failed, error: {list_result.message}",
        )

    # 4. 处理智能体数据
    data_list = list_result.data.get("items", [])
    if not isinstance(data_list, list):
        data_list = []

    # 5. 构建搜索响应数据
    total = list_result.data.get("total", 0)
    page = query_params.page
    page_size = query_params.page_size
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    res_data = {
        "agent_items": data_list,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages
        },
        "search_term": req.search_term,
        "filters": {
            "status_filter": req.status_filter or "all",
            "sort_by": query_params.sort_by,
            "sort_order": query_params.sort_order
        }
    }

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="Search agent success",
        data=res_data
    )


@with_exception_handling
def agent_version_list(
        req: AgentVersionListRequest,
        current_user: dict
) -> ResponseModel:
    """获取智能体的发布版本列表"""
    _ = check_user_space(req.space_id, current_user)

    # 调用repository获取版本列表
    version_result = agent_repository.get_agent_publish_list(req.model_dump())

    if version_result.code == status.HTTP_404_NOT_FOUND:
        logger.info(f"No published versions found for agent {req.agent_id}, returning empty list")
        response_data = AgentVersionListResponse(
            agent_id=req.agent_id,
            versions=[]
        )
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="No agent version was found",
            data=response_data
        )

    if version_result.code != status.HTTP_200_OK:
        return ResponseModel(
            code=version_result.code,
            message=version_result.message,
            data=None
        )

    # 构建响应数据
    versions_data = version_result.data or []
    versions = []

    for version_info in versions_data:
        versions.append(AgentVersionInfo(
            agent_version=version_info.get("agent_version", ""),
            version_description=version_info.get("version_description", ""),
            create_time=version_info.get("create_time", 0)
        ))

    response_data = {
        "agent_id": req.agent_id,
        "versions": versions
    }

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="Get agent version list success",
        data=response_data
    )
