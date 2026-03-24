#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from fastapi import APIRouter, Depends

from openjiuwen_studio.core.manager.login_manager.user import get_current_user
from openjiuwen_studio.routers.common import handle_response, validate_request
import openjiuwen_studio.core.manager.knowledge_base as kb_mgr
from openjiuwen_studio.schemas.knowledge_base import KnowledgeBaseListRequest
from openjiuwen_studio.schemas.common import ResponseModel
from pydantic import ValidationError

deepsearch_knowledge_base_router = APIRouter()


@deepsearch_knowledge_base_router.post("/knowledge-base/list", response_model=ResponseModel[dict])
async def deepsearch_knowledge_base_list(
    request: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    查询 DeepSearch 知识库列表，返回含索引状态，配置弹框中仅可选已建好索引的知识库。仅返回已同步到 DeepSearch 的项，不包含 Studio 原始知识库。
    """
    try:
        req = validate_request(request, KnowledgeBaseListRequest)
    except ValidationError:
        req = KnowledgeBaseListRequest(
            space_id=request.get("space_id", "") if isinstance(request, dict) else "",
            page=request.get("page", 1) if isinstance(request, dict) else 1,
            size=request.get("size", 10) if isinstance(request, dict) else 10,
        )
    res = await kb_mgr.knowledge_base_ds_list(
        space_id=req.space_id,
        page=req.page,
        size=req.size,
        current_user=current_user,
    )
    return handle_response(res)


