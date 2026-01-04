#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
import datetime
import functools
import math
import os
import time
import uuid
import json
from typing import TYPE_CHECKING, Callable, Type, Set, Any, Dict

from fastapi import status
from openjiuwen.core.common.logging import logger
from pydantic import BaseModel, ValidationError

import openjiuwen_studio.core.manager.convertor.agent as convert
from openjiuwen_studio.core.common.dsl import AgentEditMode
from openjiuwen_studio.core.common.status_code import StatusCode
from openjiuwen_studio.core.database import milliseconds
from openjiuwen_studio.core.manager.internal.agent import (
    AgentItem,
    AgentListInfo,
    AgentListPagination,
    AgentModelListNode,
    AgentOptionInfo,
    AgentWorkflowListNode,
    SingleAgentData,
)
from openjiuwen_studio.core.manager.login_manager.space import check_user_space
from openjiuwen_studio.core.manager.model_manager.managers import ModelConfigManager
from openjiuwen_studio.core.manager.reference_extractor import extract_agent_references
from openjiuwen_studio.core.manager.repositories.agent_repository import (
    agent_repository,
)
from openjiuwen_studio.core.manager.repositories.reference_repository import (
    reference_repository,
)
from openjiuwen_studio.core.manager.repositories.workflow_repository import (
    workflow_repository,
)
from openjiuwen_studio.core.manager.repositories.plugin_repository import (
    plugin_repository,
)
from openjiuwen_studio.core.manager.repositories.tool_repository import tool_repository
from openjiuwen_studio.core.manager.utils.utils import Version, check_version
from openjiuwen_studio.models.agent import AgentBaseDBPd
from openjiuwen_studio.models.agent import AgentPublishDBPd
from openjiuwen_studio.models.workflow import WorkflowBaseDBPd
from openjiuwen_studio.schemas.agent import (
    AGENT_NAME_MAX_SIZE,
    AgentConstraint,
    AgentCopy,
    AgentCreate,
    AgentDisplayInfo,
    AgentGet,
    AgentGetVersion,
    AgentId,
    AgentList,
    AgentModel,
    AgentPublish,
    AgentResponseCreate,
    AgentResponsePublish,
    AgentSearchRequest,
    AgentUpdate,
    AgentVersionInfo,
    AgentVersionListRequest,
    AgentVersionListResponse,
    AgentExportRequest,
    AgentImportRequest,
    AgentExportData,
    AgentDependencies,
    AgentExportMetadata,
)
from openjiuwen_studio.schemas.common import ResponseModel
from openjiuwen_studio.schemas.model_config import ModelParameters
from openjiuwen_studio.schemas.space import SpaceAWPQuery

if TYPE_CHECKING:
    # 只为类型检查器服务，运行时不执行
    AgentBaseDBPd: Type[BaseModel]

DEFAULT_OPENING_REMARKS = (
    "您好！我是您的智能助手，很高兴为您服务。请问有什么可以帮助您的吗？"
)
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
                data = current_user.get("data", "unknown")
                user_id = data["user_id_str"]

        operation_tag = func_name.upper().replace("AGENT_", "[AGENT_")

        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time

            # 记录成功执行的性能指标
            if hasattr(result, "code") and result.code == status.HTTP_200_OK:
                logger.debug(
                    f"{operation_tag}] Performance - User: {user_id}, Duration: {execution_time:.3f}s"
                )

            return result

        except ValidationError as e:
            execution_time = time.time() - start_time
            # 构造友好的错误信息
            error_msg = ", ".join(
                [
                    f"{'.'.join(map(str, err['loc'])) if isinstance(err['loc'], tuple) else str(err['loc'])}: "
                    f"{err['msg']}"
                    for err in e.errors()
                ]
            )
            logger.error(
                f"{operation_tag} Validation failed - User: {user_id}, "
                f"Duration: {execution_time:.3f}s, Errors: {e.errors()}"
            )

            return ResponseModel(
                code=StatusCode.AGENT_VALIDATION_ERROR.code,
                message=StatusCode.AGENT_VALIDATION_ERROR.errmsg.format(msg=error_msg),
            )

        except ValueError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Invalid value - User: {user_id}, Duration: {execution_time:.3f}s, Error: {error_msg}"
            )

            return ResponseModel(
                code=StatusCode.AGENT_INVALID_VALUE.code,
                message=StatusCode.AGENT_INVALID_VALUE.errmsg.format(msg=error_msg),
            )

        except KeyError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Missing required field - User: {user_id}, "
                f"Duration: {execution_time:.3f}s, Error: {error_msg}"
            )

            return ResponseModel(
                code=StatusCode.AGENT_MISSING_FIELD.code,
                message=StatusCode.AGENT_MISSING_FIELD.errmsg.format(msg=error_msg),
            )

        except TimeoutError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Operation timeout - User: {user_id}, "
                f"Duration: {execution_time:.3f}s, Error: {error_msg}"
            )

            return ResponseModel(
                code=StatusCode.AGENT_TIMEOUT.code,
                message=StatusCode.AGENT_TIMEOUT.errmsg.format(msg=error_msg),
            )

        except ConnectionError as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            logger.error(
                f"{operation_tag}] Database connection error - User: {user_id}, "
                f"Duration: {execution_time:.3f}s, Error: {error_msg}"
            )

            return ResponseModel(
                code=StatusCode.AGENT_DB_CONNECTION_ERROR.code,
                message=StatusCode.AGENT_DB_CONNECTION_ERROR.errmsg.format(
                    msg=error_msg
                ),
            )

        except Exception as e:
            execution_time = time.time() - start_time
            error_type = type(e).__name__
            error_msg = str(e)

            # 记录详细的错误信息包括堆栈跟踪
            logger.error(
                f"{operation_tag}] Unexpected error - User: {user_id}, Duration: {execution_time:.3f}s, "
                f"Type: {error_type}, Error: {error_msg}",
                exc_info=True,
            )

            # 根据错误类型返回不同的状态码
            if "database" in error_msg.lower() or "sql" in error_type.lower():
                status_code = StatusCode.AGENT_DATABASE_OPERATION_ERROR.code
                message = StatusCode.AGENT_DATABASE_OPERATION_ERROR.errmsg
            elif "network" in error_msg.lower() or "connection" in error_msg.lower():
                status_code = StatusCode.AGENT_NETWORK_CONNECTION_ERROR.code
                message = StatusCode.AGENT_NETWORK_CONNECTION_ERROR.errmsg
            elif (
                "permission" in error_msg.lower() or "unauthorized" in error_msg.lower()
            ):
                status_code = StatusCode.AGENT_PERMISSION_ERROR.code
                message = StatusCode.AGENT_PERMISSION_ERROR.errmsg
            else:
                status_code = StatusCode.AGENT_INTERNAL_SERVER_ERROR.code
                message = StatusCode.AGENT_INTERNAL_SERVER_ERROR.errmsg.format(
                    msg=error_type
                )

            return ResponseModel(code=status_code, message=message)

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
        agent_type=req.agent_type,
        # configs=configs,  # 待configs功能完善后再获取
        icon=req.icon,
        edit_mode=AgentEditMode.Manual,
        # plugins=plugins,  # 待plugins功能完善后再获取
        # model=req.model,
        constraint=constraint.model_dump(),
        opening_remarks=DEFAULT_OPENING_REMARKS,
        create_time=current_time,
        update_time=current_time,
    )

    return default_agent_info


@with_exception_handling
def agent_react_create(req: AgentCreate, current_user: dict) -> ResponseModel:
    """创建新的智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )

    logger.info(
        f"[AGENT_CREATE] Creating agent - User: {user_id}, Name: {req.agent_name}"
    )

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 生成agent_info信息
    agent_info = create_agent_react_info(req)
    logger.debug(f"[AGENT_CREATE] Generated agent ID: {agent_info.agent_id}")

    # 3. 保存agent_info信息至DB中
    create_result = agent_repository.create_agent_db(agent_info)

    if create_result.code != status.HTTP_200_OK:
        logger.error(
            f"[AGENT_CREATE] Database save failed - ID: {agent_info.agent_id}, Error: {create_result.message}"
        )
        return ResponseModel(
            code=create_result.code,
            message=create_result.message,
        )

    # 4. 准备响应数据
    response_data = AgentResponseCreate(id=agent_info.agent_id)

    logger.info(
        f"[AGENT_CREATE] Agent created - ID: {agent_info.agent_id}, User: {user_id}, "
        f"Duration: {time.time() - start_time:.3f}s"
    )

    # 5. 返回创建结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="create agent success",
        data=response_data.model_dump(by_alias=False),
    )


@with_exception_handling
def agent_delete(req: AgentGet, current_user: dict) -> ResponseModel:
    """删除已有的智能体的draft+publish数据"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )

    logger.info(f"[AGENT_DELETE] Deleting agent - User: {user_id}, ID: {req.agent_id}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 构建删除查询参数
    agent_query = AgentId(
        space_id=req.space_id, agent_id=req.agent_id, agent_version=None
    )

    # 3. 从DB中删除agent及其所有版本
    delete_result = agent_repository.delete_agent_db(agent_query)

    if delete_result.code != status.HTTP_200_OK:
        logger.error(
            f"[AGENT_DELETE] Database deletion failed - ID: {req.agent_id}, Error: {delete_result.message}"
        )
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
                f"[AGENT_DELETE] Failed to cleanup references for deleted agent {req.agent_id}: "
                f"{cleanup_result['message']}"
            )
    except Exception as e:
        logger.error(
            f"[AGENT_DELETE] Error cleaning up references for agent {req.agent_id}: {e}"
        )

    logger.info(
        f"[AGENT_DELETE] Agent deleted - ID: {req.agent_id}, User: {user_id}, Duration: {time.time() - start_time:.3f}s"
    )

    # 5. 返回删除结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message=f"delete agent with id {req.agent_id} success",
    )


@with_exception_handling
def agent_publish_delete(req: AgentId, current_user: dict) -> ResponseModel:
    """删除指定id及publish版本的智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )

    logger.info(
        f"[AGENT_PUBLISH_DELETE] Deleting agent publish - User: {user_id}, ID: {req.agent_id}, "
        f"Version: {req.agent_version}"
    )

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 从DB中删除agent的指定publish版本
    delete_result = agent_repository.delete_agent_publish_db(req)

    if delete_result.code != status.HTTP_200_OK:
        logger.error(
            f"[AGENT_PUBLISH_DELETE] Database deletion failed - ID: {req.agent_id}, "
            f"Version: {req.agent_version}, Error: {delete_result.message}"
        )
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
                f"[AGENT_PUBLISH_DELETE] Failed to cleanup references for deleted agent publish "
                f"{req.agent_id}:{req.agent_version}: {cleanup_result['message']}"
            )
    except Exception as e:
        logger.error(
            f"[AGENT_PUBLISH_DELETE] Error cleaning up references for agent publish "
            f"{req.agent_id}:{req.agent_version}: {e}"
        )

    logger.info(
        f"[AGENT_PUBLISH_DELETE] Agent publish deleted - ID: {req.agent_id}, User: {user_id}, "
        f"Version: {req.agent_version}, Duration: {time.time() - start_time:.3f}s"
    )

    # 4. 返回删除结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message=f"delete agent publish with id {req.agent_id} and version {req.agent_version} success",
    )


@with_exception_handling
def get_single_agent_info(
    req: AgentGetVersion, current_user: dict, manager: ModelConfigManager
) -> ResponseModel:
    """获取单个智能体信息"""
    _ = check_user_space(req.space_id, current_user)

    # 1. 从db中获取agent_info信息
    agent_query = AgentId(
        space_id=req.space_id,
        agent_id=req.agent_id,
        agent_version=req.agent_version,  # 使用指定的版本，None时获取draft版本
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
    list_result = workflow_repository.workflow_list(
        SpaceAWPQuery.model_validate(workflow_request)
    )
    if list_result.code != status.HTTP_200_OK:
        wf_list: list[AgentWorkflowListNode] = []
    else:
        wf_list: list[AgentWorkflowListNode] = []
        for w in list_result.data.get("workflow_list", []):
            node = AgentWorkflowListNode(
                id=w.get("workflow_id"),
                version=w.get("workflow_version", "draft"),
                name=w.get("name"),
                desc=w.get("desc"),
            )
            wf_list.append(node)

    # 4. 获取model list列表
    filters = {"space_id": req.space_id}
    models, _ = manager.get_paginated_configs(
        page=DEFAULT_PAGE, size=DEFAULT_PAGE_SIZE, filters=filters
    )
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
            timeout=model.timeout,
        )

        m_list.append(m_info)

    options = AgentOptionInfo(workflow_list=wf_list, model_list=m_list)

    data_response = SingleAgentData(agent_info=agent_info, agent_option_info=options)

    # 5. 返回创建结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="create agent success",
        data=data_response.model_dump(by_alias=False),
    )


@with_exception_handling
def agent_save(
    req: AgentDisplayInfo, current_user: dict, manager: ModelConfigManager
) -> ResponseModel:
    """更新并保存智能体"""
    start_time = time.time()
    data = current_user.get("data", "unknown")
    user_id = data["user_id_str"]

    logger.info(
        f"[AGENT_SAVE] Saving agent - User: {user_id}, ID: {req.agent_id}, Name: {req.agent_name}"
    )

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 验证agent版本（保存时应该为空）
    if req.agent_version is not None and req.agent_version != "":
        logger.error(
            f"[AGENT_SAVE] Invalid version for save - ID: {req.agent_id}, Version: {req.agent_version}"
        )
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message="agent version should be empty or None when agent save",
        )

    # 3. Get model configuration
    req_dict = req.model_dump()
    model_using = None

    # 尝试获取模型配置
    req_model = req.model
    model_id = getattr(req_model.model_info, "model_id", None)

    logger.info(f"[AGENT_SAVE] model id: {model_id}")
    # 首先尝试根据ID获取模型
    if model_id:
        models, _ = manager.get_paginated_configs(
            page=1, size=1, filters={"id": model_id, "space_id": req.space_id}
        )
        model_using = models[0] if models else None

    # 如果没有ID或未找到，尝试根据名称获取
    if not model_using:
        models, _ = manager.get_paginated_configs(
            page=1,
            size=1,
            filters={"name": req_model.model_info.model_name, "space_id": req.space_id},
        )
        model_using = models[0] if models else None

    if model_using:
        # 提取模型基础参数
        model_params = model_using.parameters
        model_base_config = {
            "model_name": model_using.name,
            "model_type": model_using.model_type,
            "api_key": model_using.api_key,
            "api_base": model_using.base_url,
            "streaming": model_using.enable_streaming,
            "timeout": model_using.timeout,
            "temperature": model_params.get("temperature", 0.7),
            "top_p": model_params.get("top_p", 0.9),
            "max_tokens": model_params.get("max_tokens", 4096),
            "provider": model_using.provider,
        }
        logger.info(
            f"[AGENT_SAVE] model url: {model_using.base_url}, model id: {model_using.model_type}"
        )

        # 合并模型信息
        req_model_info = req_model.model_info.model_dump()
        # 更新必要字段
        req_model_info.update(
            {
                "api_key": model_base_config["api_key"],
                "api_base": model_base_config["api_base"],
                "model_id": model_using.id,  # 确保设置model_id
            }
        )

        # 填充空值
        for key, value in req_model_info.items():
            if value is None and key in model_base_config:
                req_model_info[key] = model_base_config[key]

        # 构建完整模型字典
        req_dict["model"] = {
            "model_provider": model_using.provider,
            "model_info": req_model_info,
        }
        logger.info(f"[AGENT_SAVE] model_provider: {model_using.provider}")

    # 创建AgentBaseDBPd实例
    agent_info = AgentBaseDBPd(**req_dict, update_time=milliseconds())

    # 4. 更新agent_info信息至DB中
    save_result = agent_repository.save_agent_db(agent_info)

    if save_result.code != status.HTTP_200_OK:
        logger.error(
            f"[AGENT_SAVE] Database save failed - ID: {req.agent_id}, Error: {save_result.message}"
        )
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
                f"[AGENT_SAVE] Failed to delete old references for agent {req.agent_id}: {delete_result['message']}"
            )

        # 5.2 提取并创建新的引用关系
        references = extract_agent_references(req.model_dump(), req.space_id, "draft")
        for ref in references:
            create_result = reference_repository.reference_create(ref)
            if create_result["code"] != status.HTTP_200_OK:
                logger.warning(
                    f"[AGENT_SAVE] Failed to create reference {ref}: {create_result['message']}"
                )

        logger.info(
            f"[AGENT_SAVE] Reference management completed for agent {req.agent_id}: "
            f"{len(references)} references processed"
        )
    except Exception as e:
        logger.error(
            f"[AGENT_SAVE] Error managing references for agent {req.agent_id}: {e}"
        )
        # 引用关系管理失败不影响主要保存功能

    logger.info(
        f"[AGENT_SAVE] Agent saved - ID: {req.agent_id}, User: {user_id}, Duration: {time.time() - start_time:.3f}s"
    )

    # 6. 返回保存结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="save agent success",
    )


@with_exception_handling
def agent_meta_update(req: AgentUpdate, current_user: dict) -> ResponseModel:
    """更新并保存智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )

    logger.info(f"[AGENT_UPDATE] Updating agent metadata - User: {user_id}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 构建agent_info对象
    agent_info = AgentBaseDBPd(**req.model_dump(), update_time=milliseconds())

    # 3. 更新agent_info信息至DB中
    save_result = agent_repository.save_agent_db(agent_info)

    if save_result.code != status.HTTP_200_OK:
        logger.error(
            f"[AGENT_UPDATE] Database update failed, Error: {save_result.message}"
        )
        return ResponseModel(
            code=save_result.code,
            message=save_result.message,
        )

    logger.info(
        f"[AGENT_UPDATE] Agent metadata updated, User: {user_id}, Duration: {time.time() - start_time:.3f}s"
    )

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
def agent_get_list(req: AgentList, current_user: dict) -> ResponseModel:
    """获取智能体列表"""
    # 从current_user中正确获取user_id_str
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )

    logger.info(
        f"[AGENT_LIST] Getting agent list - User: {user_id}, Space: {req.space_id}, Page: {req.page}"
    )

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 构建查询参数
    query_info = SpaceAWPQuery(**req.model_dump())

    # 3. 从数据库获取agent列表
    list_result = agent_repository.get_space_agent_list_db(query_info)

    if list_result.code != status.HTTP_200_OK:
        # 查询有异常错误，直接报出来
        return ResponseModel(code=list_result.code, message=list_result.message)

    items: list[AgentItem] = []
    for item_data in list_result.data["items"]:
        model_name = "no model"
        if item_data.get("model"):
            try:
                # 简化模型数据处理
                model = AgentModel(**item_data.get("model"))
                model_name = model.model_info.model_name
            except Exception as e:
                logger.error(
                    f"[AGENT_GET_LIST] Failed to process model data: {item_data.get('model')}, error: {e}"
                )
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
            api_endpoint=item_data.get("api_endpoint", "test"),
        )

        items.append(item)

    total_agent = int(list_result.data["total"])
    total_pages = math.ceil(total_agent / req.page_size)

    page_info = AgentListPagination(
        page=req.page,
        page_size=req.page_size,
        total=total_agent,
        total_pages=total_pages,
    )

    response_data = AgentListInfo(agent_items=items, pagination=page_info)

    # 4. 返回创建结果
    return ResponseModel(
        code=status.HTTP_200_OK,
        message="get agent list success",
        data=response_data.model_dump(by_alias=False),
    )


@with_exception_handling
def agent_publish(req: AgentPublish, current_user: dict) -> ResponseModel:
    """发布智能体"""
    start_time = time.time()
    # 从current_user中正确获取user_id_str
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )
    logger.info(
        f"[AGENT_PUBLISH] Publishing agent - User: {user_id}, ID: {req.agent_id}, Version: {req.agent_version}"
    )

    # 1. 校验Space_id是否有权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 获取最新版本信息进行版本校验
    latest_version_query = AgentId(
        agent_id=req.agent_id,
        space_id=req.space_id,
        agent_version="latest_publish_version",
    )

    # 获取最新的发布版本信息
    latest_publish_version = agent_repository.get_agent_latest_publish_version_db(
        latest_version_query
    )

    # 3. 判断当前版本格式是否正确，且version是否为递增的
    if latest_publish_version is None:
        current_version, check_err = Version.string_to_object(req.agent_version)
        logger.info(
            f"[AGENT_PUBLISH] First time publishing - ID: {req.agent_id}, Version: {req.agent_version}"
        )
        if check_err is not None:
            logger.error(
                f"[AGENT_PUBLISH] Invalid version format - ID: {req.agent_id}, "
                f"Version: {req.agent_version}, Error: {check_err}"
            )
            return ResponseModel(
                code=status.HTTP_400_BAD_REQUEST,
                message=f"check version {req.agent_version} failed, error: {check_err}",
                data=None,
            )
    else:
        check_res, check_err = check_version(latest_publish_version, req.agent_version)
        logger.debug(
            f"[AGENT_PUBLISH] Version validation - ID: {req.agent_id}, "
            f"Latest: {latest_publish_version}, Current: {req.agent_version}"
        )
        if not check_res:
            logger.error(
                f"[AGENT_PUBLISH] Version validation failed - ID: {req.agent_id}, Error: {check_err}"
            )
            return ResponseModel(
                code=status.HTTP_400_BAD_REQUEST,
                message=f"check version failed, error: {check_err}",
                data=None,
            )

    # 4. 获取draft数据库中agent的信息
    agent_draft_query = AgentId(
        space_id=req.space_id,
        agent_id=req.agent_id,
        agent_version=None,  # 获取draft版本
    )
    draft_result = agent_repository.get_agent_db(agent_draft_query)

    if draft_result.code != status.HTTP_200_OK:
        logger.error(
            f"[AGENT_PUBLISH] Failed to get draft agent - ID: {req.agent_id}, Error: {draft_result.message}"
        )
        return ResponseModel(
            code=draft_result.code,
            message=f"Get agent with id {req.agent_id} failed, error: {draft_result.message}",
            data=None,
        )

    agent_data = AgentBaseDBPd(**draft_result.data)

    # 5. 使用agent_convert进行智能体校验
    logger.debug(f"[AGENT_PUBLISH] Starting validation - ID: {req.agent_id}")
    agent_dsl, err = convert.agent_convert(req.space_id, agent_data)
    if err is not None:
        logger.error(
            f"[AGENT_PUBLISH] Validation failed - ID: {req.agent_id}, Error: {err}"
        )
        return ResponseModel(
            code=status.HTTP_400_BAD_REQUEST,
            message=f"Agent validation failed: {err}",
            data=None,
        )
    logger.debug(f"[AGENT_PUBLISH] Validation passed - ID: {req.agent_id}")

    # 6. 构建publish需要的AgentPublishDB结构，并将其存入数据库中
    # 获取智能体基础数据，明确排除 agent_version 字段以避免冲突
    agent_publish_data = agent_data.model_dump(
        exclude_none=True, exclude={"agent_version"}
    )

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
        logger.error(
            f"[AGENT_PUBLISH] Database publish failed - ID: {req.agent_id}, Error: {publish_result.message}"
        )
        return ResponseModel(
            code=publish_result.code,
            message=f"publish agent failed, error: {publish_result.message}",
            data=None,
        )

    # 8. 管理发布版本的引用关系
    try:
        # 8.1 提取并创建发布版本的引用关系
        references = extract_agent_references(
            agent_publish_data, req.space_id, req.agent_version
        )
        for ref in references:
            create_result = reference_repository.reference_create(ref)
            if create_result["code"] != status.HTTP_200_OK:
                logger.warning(
                    f"[AGENT_PUBLISH] Failed to create publish reference {ref}: {create_result['message']}"
                )

        logger.info(
            f"[AGENT_PUBLISH] Publish reference management completed for agent {req.agent_id} "
            f"v{req.agent_version}: {len(references)} references processed"
        )
    except Exception as e:
        logger.error(
            f"[AGENT_PUBLISH] Error managing publish references for agent {req.agent_id}: {e}"
        )
        # 引用关系管理失败不影响主要发布功能

    # 9. 构建响应数据
    res_data = AgentResponsePublish(agent_id=req.agent_id, success=True)

    # 记录完成指标
    execution_time = time.time() - start_time
    logger.info(
        f"[AGENT_PUBLISH] Published successfully - ID: {req.agent_id}, Version: {req.agent_version}, "
        f"User: {user_id}, Duration: {execution_time:.3f}s"
    )

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="publish agent success",
        data=res_data.model_dump(),
    )


@with_exception_handling
def agent_convert(req: AgentGetVersion, current_user: dict) -> ResponseModel:
    """转换agent数据格式"""
    _ = check_user_space(req.space_id, current_user)

    # 1. 从db中获取agent_info信息
    agent_query = AgentId(
        space_id=req.space_id, agent_id=req.agent_id, agent_version=None
    )
    get_result = agent_repository.get_agent_db(agent_query)
    if get_result.code != status.HTTP_200_OK:
        return ResponseModel(
            code=get_result.code,
            message=get_result.message,
        )

    # 2. 将展示面信息转换成执行面可用信息
    agent_dsl, err = convert.agent_convert(
        req.space_id, AgentBaseDBPd(**get_result.data)
    )
    if err is not None:
        return ResponseModel(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="convert agent dsl failed",
        )
    return ResponseModel(
        code=status.HTTP_200_OK, message="convert agent success", data=agent_dsl
    )


@with_exception_handling
def agent_react_copy(req: AgentCopy, current_user: dict) -> ResponseModel:
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
            message=f"Agent name add '_copy' suffix exceeds the {AGENT_NAME_MAX_SIZE}-character length limit.",
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
        data=response_data.model_dump(by_alias=False),
    )


@with_exception_handling
def agent_search(req: AgentSearchRequest, current_user: dict) -> ResponseModel:
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
        page_size=req.page_size or 10,
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
            "total_pages": total_pages,
        },
        "search_term": req.search_term,
        "filters": {
            "status_filter": req.status_filter or "all",
            "sort_by": query_params.sort_by,
            "sort_order": query_params.sort_order,
        },
    }

    return ResponseModel(
        code=status.HTTP_200_OK, message="Search agent success", data=res_data
    )


@with_exception_handling
def agent_version_list(
    req: AgentVersionListRequest, current_user: dict
) -> ResponseModel:
    """获取智能体的发布版本列表"""
    _ = check_user_space(req.space_id, current_user)

    # 调用repository获取版本列表
    version_result = agent_repository.get_agent_publish_list(req.model_dump())

    if version_result.code == status.HTTP_404_NOT_FOUND:
        logger.info(
            f"No published versions found for agent {req.agent_id}, returning empty list"
        )
        response_data = AgentVersionListResponse(agent_id=req.agent_id, versions=[])
        return ResponseModel(
            code=status.HTTP_200_OK,
            message="No agent version was found",
            data=response_data,
        )

    if version_result.code != status.HTTP_200_OK:
        return ResponseModel(
            code=version_result.code, message=version_result.message, data=None
        )

    # 构建响应数据
    versions_data = version_result.data or []
    versions = []

    for version_info in versions_data:
        versions.append(
            AgentVersionInfo(
                agent_version=version_info.get("agent_version", ""),
                version_description=version_info.get("version_description", ""),
                create_time=version_info.get("create_time", 0),
            )
        )

    response_data = {"agent_id": req.agent_id, "versions": versions}

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="Get agent version list success",
        data=response_data,
    )


def _extract_dependencies_from_nodes(nodes: list) -> tuple[set, set]:
    """从节点列表中递归提取 workflow_ids 和 plugin_ids"""
    workflow_ids = set()
    plugin_ids = set()

    for node in nodes:
        node_data = node.get("data", {})
        configs = node_data.get("configs", {})
        inputs = node_data.get("inputs", {})

        # 1. Sub-Workflow
        sub_workflow = configs.get("subWorkflow")
        if sub_workflow and isinstance(sub_workflow, dict):
            wf_id = sub_workflow.get("workflowId")
            if wf_id:
                workflow_ids.add(wf_id)

        # 2. Plugin
        plugin_param = inputs.get("pluginParam")
        if plugin_param and isinstance(plugin_param, dict):
            p_id = plugin_param.get("pluginID")
            if p_id:
                plugin_ids.add(p_id)

        # 3. Loop Node (Recursive)
        blocks = node.get("blocks", [])
        if blocks:
            sub_wf_ids, sub_pl_ids = _extract_dependencies_from_nodes(blocks)
            workflow_ids.update(sub_wf_ids)
            plugin_ids.update(sub_pl_ids)

    return workflow_ids, plugin_ids


def _collect_workflow_dependencies(
    workflow_id: str,
    space_id: str,
    workflows: list,
    processed_workflow_ids: Set[str],
    plugins: list,
    processed_plugin_ids: Set[str],
):
    """递归收集Workflow依赖（包括子工作流和插件）"""
    if workflow_id in processed_workflow_ids:
        return

    from openjiuwen_studio.schemas.workflow import WorkflowId

    wf_query = WorkflowId(
        space_id=space_id, workflow_id=workflow_id, workflow_version=None
    )

    wf_result = workflow_repository.workflow_get(wf_query)

    if wf_result.code != status.HTTP_200_OK or not wf_result.data:
        return

    wf_data = wf_result.data
    processed_workflow_ids.add(workflow_id)
    workflows.append(wf_data)

    # 解析 schema 提取依赖
    schema_str = wf_data.get("schema")
    if not schema_str:
        return

    try:
        schema = json.loads(schema_str)
        nodes = schema.get("nodes", [])

        sub_wf_ids, sub_pl_ids = _extract_dependencies_from_nodes(nodes)

        # 递归收集子工作流
        for sub_id in sub_wf_ids:
            _collect_workflow_dependencies(
                sub_id,
                space_id,
                workflows,
                processed_workflow_ids,
                plugins,
                processed_plugin_ids,
            )

        # 收集插件
        for pl_id in sub_pl_ids:
            _collect_plugin_dependencies(pl_id, space_id, plugins, processed_plugin_ids)

    except Exception as e:
        logger.error(f"Failed to parse workflow schema for dependencies: {e}")


def _collect_plugin_dependencies(
    plugin_id: str, space_id: str, plugins: list, processed_plugin_ids: Set[str]
):
    """收集Plugin依赖"""
    if plugin_id in processed_plugin_ids:
        return

    query_body = {"plugin_id": plugin_id, "space_id": space_id}
    plugin_res, tool_list = plugin_repository.plugin_get(query_body)

    if plugin_res.get("code") != status.HTTP_200_OK:
        return

    plugin_data = plugin_res.get("data")
    if not plugin_data or "plugin_id" not in plugin_data:
        return

    # Merge tool_list into plugin_data if not present or empty
    if tool_list:
        plugin_data["tool_list"] = tool_list

    processed_plugin_ids.add(plugin_id)
    plugins.append(plugin_data)


def _update_workflow_ids_in_json(data: Any, workflow_id_map: Dict[str, str]) -> Any:
    """递归更新JSON中的workflow_id"""
    if isinstance(data, dict):
        new_data = {}
        for k, v in data.items():
            # 检查值是否为旧ID
            if isinstance(v, str) and v in workflow_id_map:
                new_data[k] = workflow_id_map[v]
            else:
                new_data[k] = _update_workflow_ids_in_json(v, workflow_id_map)
        return new_data
    elif isinstance(data, list):
        return [_update_workflow_ids_in_json(item, workflow_id_map) for item in data]
    else:
        return data


def _create_plugin_and_tools(
    space_id: str, plugin_tpl: dict, tool_id_map: Dict[str, str]
) -> tuple[str, list[str]]:
    """创建插件和工具，类似pre_installed.py中的同名函数"""
    created_tool_ids = []
    if not plugin_tpl:
        return None, created_tool_ids
    plugin_id = str(uuid.uuid4())
    current_time = milliseconds()

    plugin = {
        "plugin_id": plugin_id,
        "name": plugin_tpl.get("name"),
        "desc": plugin_tpl.get("desc"),
        "url": os.environ.get("VITE_PLUGIN_SERVICE_URL") or plugin_tpl.get("url") or "",
        "icon_uri": plugin_tpl.get("icon_uri") or "",
        "space_id": space_id,
        "plugin_type": int(plugin_tpl.get("plugin_type", 1)),
        "create_time": current_time,
        "update_time": current_time,
    }
    plugin_repository.plugin_create(plugin)

    # 同时支持tools和tool_list字段，兼容不同的数据结构
    tools = plugin_tpl.get("tools") or plugin_tpl.get("tool_list") or []
    # 方法与类型映射，适配模板变更
    _method_map = {"GET": 1, "POST": 2, "PUT": 3, "DELETE": 4}
    _type_map = {
        "string": 1,
        "int": 2,
        "integer": 2,
        "bool": 3,
        "boolean": 3,
        "list": 4,
        "array": 4,
        "float": 5,
        "number": 5,
        "object": 6,
        "dict": 6,
    }

    for t in tools:
        # 统一方法为数值枚举
        m = str(t.get("method", "GET")).upper()
        method_num = _method_map.get(m, 1)

        # 统一请求/响应参数为列表结构
        req_params = t.get("request_params") or []
        if isinstance(req_params, dict):
            _rp = []
            for k, v in req_params.items():
                if not isinstance(v, dict):
                    continue
                _rp.append(
                    {
                        "name": k,
                        "desc": v.get("description") or "",
                        "type": _type_map.get(str(v.get("type", "string")).lower(), 1),
                        "is_required": bool(v.get("required", False)),
                    }
                )
            req_params = _rp

        res_params = t.get("response_params") or []
        if isinstance(res_params, dict):
            _sp = []
            for k, v in res_params.items():
                if not isinstance(v, dict):
                    continue
                _sp.append(
                    {
                        "name": k,
                        "desc": v.get("description") or "",
                        "type": _type_map.get(str(v.get("type", "string")).lower(), 1),
                        "is_required": bool(v.get("required", False)),
                    }
                )
            res_params = _sp

        # 获取旧的工具ID
        old_tool_id = t.get("tool_id")
        # 生成新的工具ID，避免冲突
        tool_id = old_tool_id or str(uuid.uuid4())

        # 获取插件版本，兼容不同字段名，默认值为"draft"（与__version_none__保持一致）
        plugin_version = (
            plugin_tpl.get("plugin_version") or plugin_tpl.get("version") or "draft"
        )
        tool_dict = {
            "space_id": space_id,
            "plugin_id": plugin_id,
            "plugin_version": plugin_version,
            "plugin_type": int(plugin.get("plugin_type", 1)),
            "tool_id": tool_id,
            "name": t.get("name"),
            "desc": t.get("description") or t.get("desc") or "",
            "request_params": req_params,
            "response_params": res_params,
            # 兼容API字段，存入_rest_确保列表接口能取到
            "_rest_": {
                "path": t.get("path"),
                "method": method_num,
                "headers": t.get("headers") or [],
            },
            "path": t.get("path"),
            "method": method_num,
        }

        # 记录工具创建日志
        logger.info(
            f"[AGENT_IMPORT] Creating tool {t.get('name')} for plugin {plugin_id}"
        )
        logger.debug(f"[AGENT_IMPORT] Tool data: {tool_dict}")

        # 创建工具并处理冲突
        create_res = tool_repository.tool_create(tool_dict)
        logger.debug(f"[AGENT_IMPORT] Tool create result: {create_res}")

        final_tool_id = tool_id
        if create_res.get("code") != status.HTTP_200_OK:
            # 检查是否是ID冲突
            if "This db already exists" in create_res.get(
                "message", ""
            ) or "Duplicate entry" in create_res.get("message", ""):
                # 生成新的工具ID并重试
                logger.warning(
                    f"[AGENT_IMPORT] Tool {tool_id} exists, generating new ID."
                )
                final_tool_id = str(uuid.uuid4())
                tool_dict["tool_id"] = final_tool_id
                create_res = tool_repository.tool_create(tool_dict)
                logger.debug(f"[AGENT_IMPORT] Tool create retry result: {create_res}")

                if create_res.get("code") == status.HTTP_200_OK:
                    logger.info(
                        f"[AGENT_IMPORT] Created tool {t.get('name')} with new ID {final_tool_id}"
                    )
                    created_tool_ids.append(final_tool_id)
                else:
                    logger.error(
                        f"[AGENT_IMPORT] Failed to create tool {t.get('name')} with new ID: {create_res.get('message')}"
                    )
                    continue
            else:
                logger.error(
                    f"[AGENT_IMPORT] Failed to create tool {t.get('name')}: {create_res.get('message')}"
                )
                continue
        else:
            logger.info(
                f"[AGENT_IMPORT] Created tool {t.get('name')} with ID {final_tool_id}"
            )
            created_tool_ids.append(final_tool_id)

        # 更新tool_id_map，记录旧的工具ID和新的工具ID的映射关系
        if old_tool_id:
            tool_id_map[old_tool_id] = final_tool_id
    return plugin_id, created_tool_ids


def _import_plugin_tools(
    plugin_data: dict,
    space_id: str,
    tool_id_map: Dict[str, str],
    plugin_id_map: Dict[str, str],
) -> list[str]:
    """导入插件工具，返回创建的工具ID列表"""
    # 同时支持tools和tool_list字段，兼容不同的数据结构
    tool_list = plugin_data.get("tool_list", []) or plugin_data.get("tools", [])
    created_tool_ids = []

    if not tool_list:
        logger.info(
            f"[AGENT_IMPORT] No tools found for plugin {plugin_data.get('plugin_id')}"
        )
        return created_tool_ids
    logger.info(
        f"[AGENT_IMPORT] Found {len(tool_list)} tools for plugin {plugin_data.get('plugin_id')}"
    )

    current_plugin_id = plugin_data.get("plugin_id")
    # 确保工具的 plugin_type 与插件一致
    plugin_type = plugin_data.get("plugin_type", 1)
    # 获取插件版本，默认值为"draft"（与__version_none__保持一致）
    plugin_version = (
        plugin_data.get("plugin_version") or plugin_data.get("version") or "draft"
    )

    # 方法与类型映射
    _method_map = {"GET": 1, "POST": 2, "PUT": 3, "DELETE": 4}
    _type_map = {
        "string": 1,
        "int": 2,
        "integer": 2,
        "bool": 3,
        "boolean": 3,
        "list": 4,
        "array": 4,
        "float": 5,
        "number": 5,
        "object": 6,
    }

    for tool in tool_list:
        # 1. 基础字段补全
        tool["plugin_id"] = current_plugin_id
        tool["space_id"] = space_id
        tool["plugin_type"] = plugin_type
        tool["plugin_version"] = plugin_version

        # 2. 规范化 method
        method_val = tool.get("method", 1)
        if isinstance(method_val, str):
            tool["method"] = _method_map.get(method_val.upper(), 1)

        # 3. 规范化参数类型 (request_params / response_params)
        for param_key in ["request_params", "response_params"]:
            params = tool.get(param_key)
            if isinstance(params, list):
                for p in params:
                    if isinstance(p, dict) and isinstance(p.get("type"), str):
                        p["type"] = _type_map.get(str(p.get("type")).lower(), 1)
            elif isinstance(params, dict):
                # 如果是字典格式（如模板中可能出现），转换为列表
                _new_params = []
                for k, v in params.items():
                    if not isinstance(v, dict):
                        continue
                    _new_params.append(
                        {
                            "name": k,
                            "desc": v.get("description") or "",
                            "type": _type_map.get(
                                str(v.get("type", "string")).lower(), 1
                            ),
                            "is_required": bool(v.get("required", False)),
                        }
                    )
                tool[param_key] = _new_params

        # 4. 构建或修复 _rest_ 字段
        if "_rest_" not in tool or not isinstance(tool["_rest_"], dict):
            tool["_rest_"] = {
                "path": tool.get("path", ""),
                "method": tool.get("method", 1),
                "headers": tool.get("headers") or [],
            }
        else:
            # 确保 _rest_ 里的 method 也是 int
            rest_method = tool["_rest_"].get("method")
            if isinstance(rest_method, str):
                tool["_rest_"]["method"] = _method_map.get(rest_method.upper(), 1)
            elif rest_method is None:
                tool["_rest_"]["method"] = tool.get("method", 1)

            if "path" not in tool["_rest_"]:
                tool["_rest_"]["path"] = tool.get("path", "")

        # 5. ID 处理
        old_tool_id = tool.get("tool_id")
        # 如果 tool_id 已经被映射（即在插件创建冲突处理时更新了），使用新ID
        if old_tool_id and old_tool_id in tool_id_map:
            tool["tool_id"] = tool_id_map[old_tool_id]

        # 检查工具是否存在 - 使用正确的查询参数（包括plugin_version）
        check_query = {"tool_id": tool.get("tool_id"), "plugin_version": plugin_version}
        existing_tool_res, _ = tool_repository.tool_get(check_query)

        if existing_tool_res.get("code") == status.HTTP_200_OK:
            # 更新
            tool_repository.tool_save(tool)
        else:
            # 创建
            # 清除时间戳让其自动生成
            tool["create_time"] = None
            tool["update_time"] = None
            create_res = tool_repository.tool_create(tool)

            if create_res.get("code") != status.HTTP_200_OK:
                message = create_res.get("message", "")
                if "Duplicate entry" in str(message) or "IntegrityError" in str(
                    message
                ):
                    # 工具ID冲突，生成新ID
                    logger.warning(
                        f"[AGENT_IMPORT] Tool {tool.get('tool_id')} exists, generating new ID."
                    )
                    new_tool_id = str(uuid.uuid4())
                    if old_tool_id:
                        tool_id_map[old_tool_id] = new_tool_id
                    tool["tool_id"] = new_tool_id
                    create_res_retry = tool_repository.tool_create(tool)
                    if create_res_retry.get("code") == status.HTTP_200_OK:
                        created_tool_ids.append(new_tool_id)
                else:
                    logger.error(
                        f"[AGENT_IMPORT] Failed to create tool {tool.get('tool_name')}: {message}"
                    )
            else:
                # 记录创建成功的ID
                created_tool_ids.append(tool.get("tool_id"))

    return created_tool_ids


@with_exception_handling
def agent_export(req: AgentExportRequest, current_user: dict) -> ResponseModel:
    """导出智能体及其依赖项"""
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )

    logger.info(f"[AGENT_EXPORT] Exporting agent - User: {user_id}, ID: {req.agent_id}")

    # 1. 验证用户空间权限
    _ = check_user_space(req.space_id, current_user)

    # 2. 获取Agent基础配置
    agent_query = AgentId(
        space_id=req.space_id, agent_id=req.agent_id, agent_version=req.agent_version
    )
    # 优先获取发布版本，如果没有指定版本，获取draft
    if req.agent_version:
        get_result = agent_repository.get_agent_publish_db(agent_query)
    else:
        get_result = agent_repository.get_agent_db(agent_query)

    if get_result.code != status.HTTP_200_OK:
        return ResponseModel(code=get_result.code, message=get_result.message)

    agent_data = get_result.data

    # 3. 递归获取依赖项
    workflows = []
    plugins = []

    # 收集已处理的依赖项ID，防止重复
    processed_workflow_ids: Set[str] = set()
    processed_plugin_ids: Set[str] = set()

    # 3.1 处理直接依赖的Workflows
    agent_workflows = agent_data.get("workflows", []) or []
    for wf in agent_workflows:
        # 兼容处理：尝试获取 "id" 或 "workflow_id"
        wf_id = wf.get("id") or wf.get("workflow_id")
        if wf_id and wf_id not in processed_workflow_ids:
            _collect_workflow_dependencies(
                wf_id,
                req.space_id,
                workflows,
                processed_workflow_ids,
                plugins,
                processed_plugin_ids,
            )

    # 3.2 处理直接依赖的Plugins
    agent_plugins = agent_data.get("plugins", []) or []
    for pl in agent_plugins:
        pl_id = pl.get("plugin_id")
        if pl_id and pl_id not in processed_plugin_ids:
            _collect_plugin_dependencies(
                pl_id, req.space_id, plugins, processed_plugin_ids
            )

    # 4. 清理敏感信息 (如 API Key)
    if "model" in agent_data and agent_data["model"]:
        if "model_info" in agent_data["model"]:
            # 注意：如果是 dict 访问，如果是对象则 getattr
            # agent_data 来自 repository get_agent_db，通常是 dict
            if (
                isinstance(agent_data["model"], dict)
                and "model_info" in agent_data["model"]
            ):
                if isinstance(agent_data["model"]["model_info"], dict):
                    agent_data["model"]["model_info"]["api_key"] = ""
                    agent_data["model"]["model_info"]["api_base"] = ""

    # 5. 构建导出数据
    export_data = AgentExportData(
        agent=agent_data,
        dependencies=AgentDependencies(workflows=workflows, plugins=plugins),
        metadata=AgentExportMetadata(
            export_time=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            export_by=user_id,
            agent_studio_version="1.0.0",
        ),
    )

    return ResponseModel(
        code=status.HTTP_200_OK,
        message="export agent success",
        data=export_data.model_dump(),
    )


@with_exception_handling
def agent_import(req: AgentImportRequest, current_user: dict) -> ResponseModel:
    """导入智能体及其依赖项"""
    data = current_user.get("data", {})
    user_id = (
        data.get("user_id_str", "unknown") if isinstance(data, dict) else "unknown"
    )
    space_id = req.space_id

    logger.info(f"[AGENT_IMPORT] Importing agent - User: {user_id}, Space: {space_id}")

    # 1. 验证用户空间权限
    _ = check_user_space(space_id, current_user)

    import_data = req.import_data
    agent_data = import_data.agent
    dependencies = import_data.dependencies
    old_agent_id = agent_data.get("agent_id")

    # Track created resources for rollback
    created_resources = []

    def rollback_resources(resources):
        logger.info(
            f"[AGENT_IMPORT] Rolling back {len(resources)} resources due to error"
        )
        for item in reversed(resources):
            try:
                if item["type"] == "workflow":
                    from openjiuwen_studio.schemas.workflow import WorkflowId

                    wf_id = WorkflowId(
                        workflow_id=item["id"], space_id=space_id, workflow_version=None
                    )
                    workflow_repository.workflow_draft_delete(wf_id)
                elif item["type"] == "tool":
                    tool_repository.tool_delete(
                        {"tool_id": item["id"], "space_id": space_id}
                    )
                elif item["type"] == "plugin":
                    plugin_repository.plugin_delete(
                        {"plugin_id": item["id"], "space_id": space_id}
                    )
            except Exception as e:
                logger.error(f"[AGENT_IMPORT] Rollback failed for {item}: {e}")

    try:
        # 2. 导入 Plugins
        plugin_id_map = {}
        tool_id_map = {}

        logger.info("[AGENT_IMPORT] Installing plugins from import data")
        for plugin_data in dependencies.plugins:
            old_plugin_id = plugin_data.get("plugin_id")
            if not old_plugin_id:
                continue

            # 检查是否存在
            check_query = {"plugin_id": old_plugin_id, "space_id": space_id}
            existing_plugin_res, _ = plugin_repository.plugin_get(check_query)

            if existing_plugin_res.get(
                "code"
            ) == status.HTTP_200_OK and existing_plugin_res.get("data"):
                if req.overwrite:
                    # 覆盖：使用原有ID更新
                    plugin_data["space_id"] = space_id
                    plugin_repository.plugin_save(plugin_data)
                    # 同时也更新工具
                    created_tools = _import_plugin_tools(
                        plugin_data, space_id, tool_id_map, plugin_id_map
                    )
                    # Note: We don't rollback overwritten plugins/tools usually as it's destructive,
                    # but newly created tools inside existing plugin should probably be tracked.
                    # For simplicity, we only track completely new resources.
                    for tid in created_tools:
                        created_resources.append({"type": "tool", "id": tid})
                # 记录ID映射
                plugin_id_map[old_plugin_id] = old_plugin_id
            else:
                # 使用_create_plugin_and_tools创建插件和工具
                logger.info(f"[AGENT_IMPORT] Creating plugin {plugin_data.get('name')}")
                plugin_id, created_tools = _create_plugin_and_tools(
                    space_id, plugin_data, tool_id_map
                )

                if plugin_id:
                    created_resources.append({"type": "plugin", "id": plugin_id})
                    for tid in created_tools:
                        created_resources.append({"type": "tool", "id": tid})

                    plugin_id_map[old_plugin_id] = plugin_id
                    logger.info(
                        f"[AGENT_IMPORT] Created plugin {plugin_data.get('name')} with ID {plugin_id}"
                    )
                else:
                    # 创建失败，尝试使用原有逻辑
                    plugin_data["space_id"] = space_id
                    create_res = plugin_repository.plugin_create(plugin_data)

                    # plugin_create 返回的是 dict，不是 ResponseModel
                    if create_res.get("code") != status.HTTP_200_OK:
                        message = create_res.get("message", "")
                        # 捕获 IntegrityError (全局ID冲突)
                        if "Duplicate entry" in str(message) or "IntegrityError" in str(
                            message
                        ):
                            logger.warning(
                                f"[AGENT_IMPORT] Plugin {old_plugin_id} exists in another space, generating new ID."
                            )
                            new_plugin_id = str(uuid.uuid4())
                            plugin_id_map[old_plugin_id] = new_plugin_id
                            plugin_data["plugin_id"] = new_plugin_id
                            plugin_data["plugin_name"] = (
                                f"{plugin_data.get('plugin_name')}_copy"
                            )
                            plugin_data["create_time"] = None
                            plugin_data["update_time"] = None

                            # 同时也需要更新 tool_id，防止 tool_id 冲突
                            if "tool_list" in plugin_data and isinstance(
                                plugin_data["tool_list"], list
                            ):
                                for tool in plugin_data["tool_list"]:
                                    old_tool_id = tool.get("tool_id")
                                    if old_tool_id:
                                        new_tool_id = str(uuid.uuid4())
                                        tool_id_map[old_tool_id] = new_tool_id
                                        tool["tool_id"] = new_tool_id

                            retry_res = plugin_repository.plugin_create(plugin_data)
                            if retry_res.get("code") != status.HTTP_200_OK:
                                logger.error(
                                    f"[AGENT_IMPORT] Failed to create plugin with new ID: {retry_res.get('message')}"
                                )
                            else:
                                created_resources.append(
                                    {"type": "plugin", "id": new_plugin_id}
                                )
                                # 插件创建成功，创建工具
                                created_tools = _import_plugin_tools(
                                    plugin_data, space_id, tool_id_map, plugin_id_map
                                )
                                for tid in created_tools:
                                    created_resources.append(
                                        {"type": "tool", "id": tid}
                                    )
                        else:
                            logger.error(
                                f"[AGENT_IMPORT] Failed to create plugin {old_plugin_id}: {message}"
                            )
                    else:
                        created_resources.append(
                            {"type": "plugin", "id": plugin_data.get("plugin_id")}
                        )
                        # 插件创建成功，创建工具
                        created_tools = _import_plugin_tools(
                            plugin_data, space_id, tool_id_map, plugin_id_map
                        )
                        for tid in created_tools:
                            created_resources.append({"type": "tool", "id": tid})

        # 3. 导入 Workflows
        workflow_id_map = {}

        # 使用反向迭代，先处理子工作流，再处理父工作流
        reversed_workflows = list(reversed(dependencies.workflows))

        for wf_data in reversed_workflows:
            old_wf_id = wf_data.get("workflow_id")
            if not old_wf_id:
                continue

            # 0. 先尝试更新 schema 中的依赖引用 (使用已有的 map)
            if "schema" in wf_data and wf_data["schema"] and workflow_id_map:
                try:
                    schema_obj = json.loads(wf_data["schema"])
                    new_schema_obj = _update_workflow_ids_in_json(
                        schema_obj, workflow_id_map
                    )

                    # 如果 schema 发生变化，更新 wf_data
                    if new_schema_obj != schema_obj:
                        wf_data["schema"] = json.dumps(
                            new_schema_obj, ensure_ascii=False
                        )
                        logger.info(
                            f"[AGENT_IMPORT] Updated schema for workflow {old_wf_id} with new dependencies"
                        )
                except Exception as e:
                    logger.warning(
                        f"[AGENT_IMPORT] Failed to update schema for workflow {old_wf_id}: {e}"
                    )

            # 检查是否存在
            from openjiuwen_studio.schemas.workflow import WorkflowId

            wf_query = WorkflowId(
                space_id=space_id, workflow_id=old_wf_id, workflow_version=None
            )
            existing_wf = workflow_repository.workflow_get(wf_query)

            # 如果当前空间下已存在该ID
            if existing_wf.code == status.HTTP_200_OK and existing_wf.data:
                if req.overwrite:
                    # 覆盖
                    wf_data["space_id"] = space_id
                    workflow_repository.workflow_save(wf_data)
                else:
                    # 不覆盖，重新生成ID
                    new_wf_id = str(uuid.uuid4())
                    workflow_id_map[old_wf_id] = new_wf_id
                    wf_data["workflow_id"] = new_wf_id
                    wf_data["workflow_name"] = f"{wf_data.get('workflow_name')}_copy"
                    wf_data["space_id"] = space_id
                    wf_data["create_time"] = None
                    wf_data["update_time"] = None
                    try:
                        wf_obj = WorkflowBaseDBPd(**wf_data)
                        create_res = workflow_repository.workflow_create(wf_obj)
                        if create_res.code == status.HTTP_200_OK:
                            created_resources.append(
                                {"type": "workflow", "id": new_wf_id}
                            )
                        else:
                            logger.error(
                                f"[AGENT_IMPORT] Failed to create copy workflow {old_wf_id}: {create_res.message}"
                            )
                    except Exception as e:
                        logger.error(
                            f"[AGENT_IMPORT] Failed to create copy workflow {old_wf_id}: {e}"
                        )
            else:
                # 尝试直接创建
                wf_data["space_id"] = space_id

                # 需要转换为 Pydantic 模型
                wf_obj = WorkflowBaseDBPd(**wf_data)
                # 显式清除 create_time 和 update_time，让 workflow_create 重新生成
                wf_obj.create_time = None
                wf_obj.update_time = None

                create_res = workflow_repository.workflow_create(wf_obj)

                if create_res.code == status.HTTP_200_OK:
                    created_resources.append({"type": "workflow", "id": old_wf_id})
                else:
                    # 捕获 IntegrityError 等数据库错误 (Repository层捕获了异常并返回错误信息)
                    if "Duplicate entry" in str(
                        create_res.message
                    ) or "IntegrityError" in str(create_res.message):
                        # 说明数据库中已存在该ID（但不在当前space_id下），需要重新生成ID
                        logger.warning(
                            f"[AGENT_IMPORT] Workflow {old_wf_id} exists in another space, generating new ID."
                        )
                        new_wf_id = str(uuid.uuid4())
                        workflow_id_map[old_wf_id] = new_wf_id
                        wf_data["workflow_id"] = new_wf_id
                        wf_data["workflow_name"] = (
                            f"{wf_data.get('workflow_name')}_copy"
                        )
                        wf_data["create_time"] = None
                        wf_data["update_time"] = None

                        wf_obj = WorkflowBaseDBPd(**wf_data)
                        retry_res = workflow_repository.workflow_create(wf_obj)
                        if retry_res.code == status.HTTP_200_OK:
                            created_resources.append(
                                {"type": "workflow", "id": new_wf_id}
                            )
                        else:
                            logger.error(
                                f"[AGENT_IMPORT] Failed to create workflow with new ID: {retry_res.message}"
                            )
                    else:
                        logger.error(
                            f"[AGENT_IMPORT] Failed to create workflow {old_wf_id}: {create_res.message}"
                        )

        # 4. 导入 Agent

        # 更新引用了plugin_id/tool_id的字段
        if "plugins" in agent_data and agent_data["plugins"]:
            logger.info(
                f"[AGENT_IMPORT] Updating plugin references in agent config. "
                f"Maps: Plugins={plugin_id_map}, Tools={tool_id_map}"
            )
            new_plugins_list = []
            for p in agent_data["plugins"]:
                # 1. 更新 ID
                p_id = p.get("plugin_id")
                if p_id and p_id in plugin_id_map:
                    p["plugin_id"] = plugin_id_map[p_id]

                t_id = p.get("tool_id")
                if t_id and t_id in tool_id_map:
                    p["tool_id"] = tool_id_map[t_id]

                # 2. 从数据库获取最新信息以更新名称等字段 (确保与安装的一致)
                current_plugin_id = p.get("plugin_id")
                current_tool_id = p.get("tool_id")

                if current_plugin_id and current_tool_id:
                    # 获取插件信息
                    plugin_res, _ = plugin_repository.plugin_get(
                        {"plugin_id": current_plugin_id, "space_id": space_id}
                    )
                    # 获取工具信息
                    tool_res, _ = tool_repository.tool_get(
                        {"tool_id": current_tool_id, "space_id": space_id}
                    )

                    if plugin_res.get("code") == status.HTTP_200_OK and plugin_res.get(
                        "data"
                    ):
                        p["plugin_name"] = plugin_res["data"].get("name")

                    if tool_res.get("code") == status.HTTP_200_OK and tool_res.get(
                        "data"
                    ):
                        p["tool_name"] = tool_res["data"].get("name")

                new_plugins_list.append(p)
            agent_data["plugins"] = new_plugins_list

        # 更新引用了workflow_id的字段
        if workflow_id_map:
            logger.info(
                f"[AGENT_IMPORT] Updating workflow IDs in agent config: {workflow_id_map}"
            )
            # Update workflows list
            if "workflows" in agent_data and agent_data["workflows"]:
                for wf in agent_data["workflows"]:
                    # Update ID inside the workflow reference list
                    old_ref_id = wf.get("id") or wf.get("workflow_id")
                    if old_ref_id and old_ref_id in workflow_id_map:
                        new_id = workflow_id_map[old_ref_id]
                        if "id" in wf:
                            wf["id"] = new_id
                        if "workflow_id" in wf:
                            wf["workflow_id"] = new_id

            # Update configs
            if "configs" in agent_data and agent_data["configs"]:
                agent_data["configs"] = _update_workflow_ids_in_json(
                    agent_data["configs"], workflow_id_map
                )

            # Update constraint if needed
            if "constraint" in agent_data and agent_data["constraint"]:
                agent_data["constraint"] = _update_workflow_ids_in_json(
                    agent_data["constraint"], workflow_id_map
                )

        old_agent_id = agent_data.get("agent_id")

        # 检查 Agent 是否存在于当前空间
        agent_query = AgentId(
            space_id=space_id, agent_id=old_agent_id, agent_version=None
        )
        existing_agent = agent_repository.get_agent_db(agent_query)

        final_agent_id = old_agent_id

        # 如果当前空间下已存在该ID
        if existing_agent.code == status.HTTP_200_OK:
            if req.overwrite:
                # 覆盖：更新
                agent_data["space_id"] = space_id
                agent_data["update_time"] = milliseconds()

                agent_obj = AgentBaseDBPd(**agent_data)
                save_res = agent_repository.save_agent_db(agent_obj)
                if save_res.code != status.HTTP_200_OK:
                    logger.error(
                        f"[AGENT_IMPORT] Failed to update agent {old_agent_id}: {save_res.message}"
                    )
                    rollback_resources(created_resources)
                    return ResponseModel(code=save_res.code, message=save_res.message)
            else:
                # 不覆盖，重新生成ID
                new_agent_id = str(uuid.uuid4())
                agent_data["agent_id"] = new_agent_id
                agent_data["agent_name"] = f"{agent_data.get('agent_name')}_copy"
                agent_data["space_id"] = space_id
                agent_data["create_time"] = milliseconds()
                agent_data["update_time"] = milliseconds()
                # 清除版本信息，确保是 Draft
                agent_data.pop("agent_version", None)

                final_agent_id = new_agent_id

                agent_obj = AgentBaseDBPd(**agent_data)
                create_res = agent_repository.create_agent_db(agent_obj)
                if create_res.code != status.HTTP_200_OK:
                    logger.error(
                        f"[AGENT_IMPORT] Failed to create copy agent: {create_res.message}"
                    )
                    rollback_resources(created_resources)
                    return ResponseModel(
                        code=create_res.code, message=create_res.message
                    )
        else:
            # 直接生成新的agent_id，避免全局冲突
            new_agent_id = str(uuid.uuid4())
            agent_data["agent_id"] = new_agent_id
            agent_data["space_id"] = space_id
            agent_data["create_time"] = milliseconds()
            agent_data["update_time"] = milliseconds()
            # 确保没有 agent_version (Draft)
            agent_data.pop("agent_version", None)

            logger.info(f"[AGENT_IMPORT] Creating agent with new ID {new_agent_id}")
            agent_obj = AgentBaseDBPd(**agent_data)
            create_res = agent_repository.create_agent_db(agent_obj)

            if create_res.code != status.HTTP_200_OK:
                # 捕获 IntegrityError: ID已存在但不在当前space下
                logger.error(
                    f"[AGENT_IMPORT] Failed to create agent: {create_res.message}"
                )
                rollback_resources(created_resources)
                return ResponseModel(code=create_res.code, message=create_res.message)

            final_agent_id = new_agent_id

        return ResponseModel(
            code=status.HTTP_200_OK,
            message="import agent success",
            data={"agent_id": final_agent_id},
        )

    except Exception as e:
        logger.error(f"[AGENT_IMPORT] Exception during import: {e}", exc_info=True)
        rollback_resources(created_resources)
        return ResponseModel(
            code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Import failed: {str(e)}",
        )
