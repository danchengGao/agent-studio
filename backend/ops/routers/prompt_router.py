#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from fastapi import APIRouter, Depends, status, Path, Body, Query
from sqlalchemy.orm import Session

from ops.common.handle_exceptions_util import handle_exceptions
from ops.modules.prompt.application.service import PromptService
from ops.modules.prompt.domain import entities
from ops.modules.prompt.domain.entities import BatchGetPromptResponse, BatchGetPromptRequest
from ops.modules.prompt.infra.repositories import SQLPromptUserDraftRepository
from ops.modules.prompt.infra.repositories import SQLPromptRepository
from ops.modules.prompt.infra.database import get_db_ops, get_db_agent
from ops.modules.prompt.infra.repositories.agent_repo import SQLAgentRepository
from ops.modules.prompt.infra.repositories.prompt_repo import SQLPromptSubmitRepository

router = APIRouter(prefix="/api/v1/prompts", tags=["prompts"])


def get_prompt_service(db: Session = Depends(get_db_ops), agent_db: Session = Depends(get_db_agent)) -> PromptService:
    """ 依赖注入，获取 PromptService 实例 """
    prompt_repo = SQLPromptRepository(db)
    prompt_user_draft_repo = SQLPromptUserDraftRepository(db)
    prompt_commit_repo = SQLPromptSubmitRepository(db)
    agent_repo = SQLAgentRepository(agent_db)
    return PromptService(prompt_repo, prompt_user_draft_repo, prompt_commit_repo, agent_repo)


@router.post("/", response_model=entities.CreatePromptResponse, status_code=status.HTTP_201_CREATED)
@handle_exceptions(response_model=entities.CreatePromptResponse)
def create_prompt(new_prompt: entities.CreatePromptRequest, service: PromptService = Depends(get_prompt_service)):
    """ 创建新的 Prompt """
    return service.create_prompt(new_prompt)


@router.post("/list", response_model=entities.ListPromptResponse)
@handle_exceptions(response_model=entities.ListPromptResponse)
def list_prompts(list_prompt: entities.ListPromptRequest, service: PromptService = Depends(get_prompt_service)):
    """ 列出所有 Prompts """
    return service.list_prompts(list_prompt)


@router.get("/{prompt_id}", response_model=entities.GetPromptResponse)
@handle_exceptions(response_model=entities.GetPromptResponse)
def get_prompt(
        prompt_id: int = Path(..., title="Prompt ID"),
        with_draft: bool = Query(True, title="return with draft"),
        with_commit: bool = Query(True, title="return with commit"),
        commit_version: str = Query("-1", title="commit version"),
        with_default_config: bool = Query(True, title="return with default_config"),
        service: PromptService = Depends(get_prompt_service)):
    """ 获取指定 Prompt 详情 """
    prompts = {"prompt_id": prompt_id, "with_draft": with_draft, "with_commit": with_commit,
               "with_default_config": with_default_config, "commit_version": commit_version}
    return service.get_prompt(prompts)


@router.get("/{prompt_id}", response_model=entities.PromptWithVersions)
@handle_exceptions(response_model=entities.PromptWithVersions)
def get_prompt_with_version(prompt_id: int, service: PromptService = Depends(get_prompt_service)):
    """ 获取指定 Prompt 及其版本历史 """
    prompts = {"prompt_id": prompt_id}
    return service.get_prompt(prompts)


@router.put("/{prompt_id}", response_model=entities.UpdatePromptResponse)
@handle_exceptions(response_model=entities.UpdatePromptResponse)
def update_prompt(
        new_prompt: entities.UpdatePromptRequest,
        service: PromptService = Depends(get_prompt_service)
):
    """ 更新指定 Prompt """
    return service.update_prompt(new_prompt)


@router.delete("/{prompt_id}", response_model=entities.DeletePromptResponse)
@handle_exceptions(response_model=entities.DeletePromptResponse)
def delete_prompt(prompts: entities.DeletePromptRequest, service: PromptService = Depends(get_prompt_service)):
    """ 删除指定 Prompt """
    return service.delete_prompt(prompts)


@router.post("/{prompt_id}/clone", response_model=entities.ClonePromptResponse, status_code=status.HTTP_201_CREATED)
@handle_exceptions(response_model=entities.ClonePromptResponse)
def clone_prompt(
        prompt_id: str,
        new_prompt: entities.ClonePromptRequest,
        service: PromptService = Depends(get_prompt_service)):
    """ 创建新的 Prompt """
    return service.clone_prompt(prompt_id, new_prompt)


@router.post("/{prompt_id}/drafts/save", response_model=entities.DraftSaveResponse)
@handle_exceptions(response_model=entities.DraftSaveResponse)
def save_draft(
        prompt_id: int = Path(..., title="Prompt ID"),
        draft_input: entities.PromptDraftInput = Body(...),
        service: PromptService = Depends(get_prompt_service)
):
    """
    保存Prompt草稿
    """
    draft_info = service.save_draft(prompt_id, draft_input)
    return entities.DraftSaveResponse(code=0, msg="Success", draft_info=draft_info)


@router.get("/{prompt_id}/drafts", response_model=entities.PromptDraftInput)
@handle_exceptions(response_model=entities.PromptDraftInput)
def get_draft(
        prompt_id: int = Path(..., title="Prompt ID"),
        user_id: str = Query(..., title="User ID"),
        service: PromptService = Depends(get_prompt_service)
):
    """
    获取用户草稿
    """
    draft = service.get_draft(prompt_id, user_id)
    return draft


@router.post("/{prompt_id}/drafts/commit", response_model=entities.CommitResponse)
@handle_exceptions(response_model=entities.CommitResponse)
def commit_draft(
        prompt_id: int = Path(..., title="Prompt ID"),
        commit_request: entities.CommitRequest = Body(...),
        user_id: str = Query(..., title="User ID"),  # 假设从查询参数获取用户ID
        service: PromptService = Depends(get_prompt_service)
):
    """
    提交草稿为正式版本
    """
    service.commit_draft(
        prompt_id=prompt_id,
        user_id=user_id,
        commit_version=commit_request.commit_version,
        commit_description=commit_request.commit_description
    )

    return entities.CommitResponse(code=0, msg="success")


@router.get("/{prompt_id}/commits/list", response_model=entities.CommitListResponse)
@handle_exceptions(response_model=entities.CommitListResponse)
def list_commits(
        prompt_id: int = Path(..., title="Prompt ID"),
        page_size: int = Query(10, title="Page Size"),
        service: PromptService = Depends(get_prompt_service)
):
    """
    获取提交记录列表
    """
    commit_infos = service.list_commits(prompt_id, page_size)

    return entities.CommitListResponse(
        code=0,
        msg="success",
        prompt_commit_infos=commit_infos
    )


@router.post("/{prompt_id}/drafts/revert_from_commit", response_model=entities.RevertFromCommitResponse)
@handle_exceptions(response_model=entities.RevertFromCommitResponse)
def revert_from_commit(
        prompt_id: int = Path(..., title="Prompt ID"),
        revert_request: entities.RevertFromCommitRequest = Body(...),
        user_id: str = Query(..., title="User ID"),  # 假设从查询参数获取用户ID
        service: PromptService = Depends(get_prompt_service)
):
    """
    从提交记录恢复草稿
    """

    service.revert_from_commit(
        prompt_id=prompt_id,
        user_id=user_id,
        commit_version=revert_request.commit_version_reverting_from
    )

    return entities.RevertFromCommitResponse(code=0, msg="success")


@router.post("/batch-get", response_model=BatchGetPromptResponse)
@handle_exceptions(response_model=BatchGetPromptResponse)
def batch_get_prompts(
    request: BatchGetPromptRequest = Body(...),
    service: PromptService = Depends(get_prompt_service)
):
    """
    批量获取prompt
    """

    items = service.batch_get_prompts(request)
    return BatchGetPromptResponse(items=items, code=0, msg="success")
