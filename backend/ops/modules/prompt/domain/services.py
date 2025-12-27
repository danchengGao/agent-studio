#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

import json
from typing import Optional, List

from pydantic import ValidationError

from openjiuwen_studio.routers.models import logger
from ops.common.date_time_util import get_china_datetime
from ops.modules.prompt.domain import entities
from ops.modules.prompt.domain.entities import BatchGetPromptRequest, BatchPromptResponseItem, PromptCommit, \
    Base, BatchGetPromptResponse, PromptBasic, PromptDraft, AgentRelationObj, OptimizeTaskCreationRequest, \
    OptimizeProgressResponse, JobInfo, Progress, HistoryItem, OptimizeInfo, JobDetails, JobDetailItem, \
    OptimizeTaskGetInfoResponse
from ops.modules.prompt.domain.repositories import PromptUserDraftRepository, PromptSubmitRepository, \
    PromptRepository, AgentRepository, JobRepository
from ops.modules.prompt.application.exception import DuplicateException, NotFoundException
from ops.common.json_util import convert_json
from ops.modules.prompt.infra.database import BaseAgent
from ops.modules.prompt.infra.repositories import orm_repo


class DraftDomainService:

    def __init__(self, draft_repo: PromptUserDraftRepository, commit_repo: PromptSubmitRepository):
        self.draft_repo = draft_repo
        self.commit_repo = commit_repo

    def save_draft(self, prompt_id: int, draft_input: entities.PromptDraftInput) -> entities.DraftInfoOutput:
        """
        保存草稿的业务逻辑 domain层放核心业务逻辑
        """
        # 准备数据
        detail = draft_input.prompt_draft.detail
        draft_info = draft_input.prompt_draft.draft_info

        # 转换数据为JSON字符串
        messages_json = json.dumps([msg.dict() for msg in detail.prompt_template.messages])
        variable_defs_json = json.dumps([var.dict() for var in detail.prompt_template.variable_defs])

        # 处理tools数据
        tools_data = []
        for tool in detail.tools:
            tool_data = tool.dict()
            # 如果parameters是字典，转换为JSON字符串
            if isinstance(tool_data['function']['parameters'], dict):
                tool_data['function']['parameters'] = json.dumps(tool_data['function']['parameters'])
            tools_data.append(tool_data)
        tools_json = json.dumps(tools_data)

        draft_po = entities.DraftPO(prompt_id=prompt_id,
                                    user_id=draft_info.user_id,
                                    space_id=draft_info.space_id,
                                    template_type=detail.prompt_template.template_type,
                                    messages=messages_json,
                                    prompt_model_config=convert_json(detail.prompt_model_config),
                                    variable_defs=variable_defs_json,
                                    tools=tools_json,
                                    tool_call_config=convert_json(detail.tool_call_config),
                                    base_version=draft_info.base_version or "",
                                    is_draft_edited=True
                                    )
        draft_info_output = self.draft_repo.save_draft(draft_po)
        return draft_info_output

    def get_draft(self, prompt_id: int, user_id: str) -> Optional[entities.PromptDraftInput]:
        """
        获取草稿的业务逻辑
        """
        # 从Repository获取原始数据
        draft_data = self.draft_repo.get_draft(prompt_id, user_id)
        if not draft_data:
            return None
        prompt_draft = trans_prompt_user_draft(draft_data)
        return entities.PromptDraftInput(prompt_draft=prompt_draft)

    def revert_from_commit(
            self,
            prompt_id: int,
            user_id: str,
            commit_version: str
    ) -> None:
        """
        从提交记录恢复草稿
        """

        commit = self.commit_repo.find_commit_by_version(prompt_id, commit_version)
        if not commit:
            raise NotFoundException(f"Commit with version '{commit_version}' not found for prompt {prompt_id}")

        draft_po = entities.DraftPO(prompt_id=prompt_id,
                                    user_id=user_id,
                                    space_id=str(commit.space_id),
                                    template_type=commit.template_type,
                                    messages=commit.messages,
                                    prompt_model_config=commit.prompt_model_config,
                                    variable_defs=commit.variable_defs,
                                    tools=commit.tools,
                                    tool_call_config=commit.tool_call_config,
                                    base_version=commit_version,
                                    is_draft_edited=True
                                    )
        # 调用Repository的原子操作
        self.draft_repo.save_draft(draft_po)


class CommitDomainService:
    def __init__(
            self,
            draft_repo: PromptUserDraftRepository,
            commit_repo: PromptSubmitRepository,
            agent_repo: AgentRepository,
    ):
        self.draft_repo = draft_repo
        self.commit_repo = commit_repo
        self.agent_repo = agent_repo

    def commit_draft(
            self,
            prompt_id: int,
            user_id: str,
            commit_version: str,
            commit_description: str,
            prompt_key: str
    ) -> None:
        """
        提交草稿为正式版本
        """
        # 检查版本是否已存在
        existing_commit = self.commit_repo.find_commit_by_version(prompt_id, commit_version)
        if existing_commit:
            raise DuplicateException(f"Version '{commit_version}' already exists for prompt {prompt_id}")

        # 获取草稿数据
        draft_data = self.draft_repo.get_draft(prompt_id, user_id)
        if not draft_data:
            raise NotFoundException(f"No draft found for prompt {prompt_id} and user {user_id}")

        # 创建提交记录
        commit = entities.PromptSubmit(
            prompt_id=prompt_id,
            space_id=draft_data.space_id,
            prompt_key=prompt_key,
            template_type=draft_data.template_type,
            messages=convert_json(draft_data.messages),
            prompt_model_config=convert_json(draft_data.prompt_model_config),
            variable_defs=convert_json(draft_data.variable_defs),
            tools=convert_json(draft_data.tools),
            tool_call_config=convert_json(draft_data.tool_call_config),
            version=commit_version,
            base_version=draft_data.base_version,
            committed_by=user_id,
            description=commit_description,
        )
        # 保存提交记录
        self.commit_repo.save_commit(commit)

    def list_commits(self, prompt_id: int, page_size: int) -> List[entities.CommitInfo]:
        """获取提交记录列表，按版本号逆序排列"""
        # 获取提交记录
        commits = self.commit_repo.list_commits_by_prompt_id(prompt_id, page_size)

        # 转换为响应格式
        commit_infos = []
        for commit in commits:
            # 将 datetime 转换为时间戳字符串（毫秒）
            committed_at = str(int(commit.updated_at.timestamp() * 1000))

            try:
                agent_relation_obj = trans_agent_to_relation_obj(
                    self.agent_repo.find_by_id(prompt_id, commit.version, orm_repo.AgentModel))
                committed_by_name = trans_agent_to_user_name(
                    self.agent_repo.find_user_name_by_id(commit.committed_by, orm_repo.User))

            except Exception as e:
                agent_relation_obj = None
                committed_by_name = ""

            commit_info = entities.CommitInfo(
                committed_at=committed_at,
                committed_by=commit.committed_by,
                committed_by_name=committed_by_name,
                description=commit.description,
                version=commit.version,
                base_version=commit.base_version,
                relation_obj=agent_relation_obj
            )
            commit_infos.append(commit_info)

        return commit_infos


class BatchPromptDomainService:
    def __init__(
            self,
            prompt_repo: PromptRepository
    ):
        self.prompt_repo = prompt_repo

    def batch_get_prompts(self, request: BatchGetPromptRequest) -> BatchGetPromptResponse:
        """批量获取prompt"""

        results = []
        # 循环遍历每个查询项
        for query in request.queries:
            response_item = BatchPromptResponseItem(query=query)

            try:
                # 获取基础prompt信息
                base_prompt = self.prompt_repo.find_by_id(query.prompt_id, orm_repo.PromptBasicModel)
                if not base_prompt:
                    response_item.error_code = 404
                    response_item.error_msg = f"Prompt with ID {query.prompt_id} not found"
                    results.append(response_item)
                    continue
                # 根据查询类型处理
                if query.with_commit:
                    # 查询commit版本
                    if not query.commit_version:
                        response_item.error_code = 400
                        response_item.error_msg = "commit_version is required when with_commit is true"
                        results.append(response_item)
                        continue
                    commit_prompt = self.prompt_repo.find_commit_by_id_version(query.prompt_id, query.commit_version,
                                                                               orm_repo.PromptCommitModel)
                    if not commit_prompt:
                        response_item.error_code = 404
                        response_item.error_msg = (f"Commit version {query.commit_version} "
                                                   f"not found for prompt {query.prompt_id}")
                        results.append(response_item)
                        continue

                    response_item.prompt = entities.Prompt(
                        id=base_prompt.id,
                        workspace_id=base_prompt.space_id,
                        prompt_key=base_prompt.prompt_key,
                        prompt_basic=trans_prompt_basic(base_prompt),
                        prompt_draft=None,
                        prompt_commit=trans_prompt_commit(commit_prompt)
                    )

                else:
                    # 查询草稿
                    draft = self.prompt_repo.find_draft_by_id(query.prompt_id, orm_repo.PromptUserDraftModel)
                    if not draft:
                        response_item.error_code = 404
                        response_item.error_msg = (f"Draft not found for prompt {query.prompt_id} "
                                                   f"and user {query.user_id}")
                        results.append(response_item)
                        continue

                    response_item.prompt = entities.Prompt(
                        id=base_prompt.id,
                        workspace_id=base_prompt.space_id,
                        prompt_key=base_prompt.prompt_key,
                        prompt_basic=trans_prompt_basic(base_prompt),
                        prompt_draft=trans_prompt_user_draft(draft),
                        prompt_commit=None
                    )

                results.append(response_item)

            except Exception as e:
                response_item.error_code = 500
                response_item.error_msg = f"Internal server error: {str(e)}"
                results.append(response_item)

        return results


class GetPromptDetailService:
    def __init__(
            self,
            prompt_repo: PromptRepository,
            agent_repo: AgentRepository
    ):
        self.prompt_repo = prompt_repo
        self.agent_repo = agent_repo

    def get_prompt_from_basic(self, prompts_basic_model: orm_repo.PromptBasicModel, prompts: dict) -> entities.Prompt:
        """从basic prompt中关联和解析出prompt数据结构"""
        prompts_draft_conditions = [
            orm_repo.PromptUserDraftModel.user_id == prompts_basic_model.updated_by,
            orm_repo.PromptUserDraftModel.prompt_id == prompts_basic_model.id,
        ]
        prompts_draft_ori = self.prompt_repo.get_all(prompts_draft_conditions, orm_repo.PromptUserDraftModel)

        prompts_commit_conditions = [orm_repo.PromptCommitModel.prompt_id == prompts_basic_model.id]
        if prompts.get("commit_version") != "-1":
            prompts_commit_conditions.append(orm_repo.PromptCommitModel.version == prompts.get("commit_version"))
        prompts_commit_ori = self.prompt_repo.get_all(prompts_commit_conditions, orm_repo.PromptCommitModel)

        try:
            created_by_name = trans_agent_to_user_name(
                self.agent_repo.find_user_name_by_id(prompts_basic_model.created_by, orm_repo.User))
            updated_by_name = trans_agent_to_user_name(
                self.agent_repo.find_user_name_by_id(prompts_basic_model.updated_by, orm_repo.User))
        except Exception as e:
            created_by_name = ""
            updated_by_name = ""

        prompt_basics = entities.PromptBasic(
            display_name=prompts_basic_model.name,
            description=prompts_basic_model.description,
            latest_version=prompts_basic_model.latest_version,
            created_by=prompts_basic_model.created_by,
            updated_by=prompts_basic_model.updated_by,
            created_by_name=created_by_name,
            updated_by_name=updated_by_name,
            created_at=prompts_basic_model.created_at,
            updated_at=prompts_basic_model.updated_at,
            latest_committed_at=prompts_basic_model.latest_commit_time
        )
        prompt_draft, prompt_commit = None, None
        if prompts_draft_ori:
            prompts_draft_ori = prompts_draft_ori[0]
            prompt_draft = trans_prompt_user_draft(prompts_draft_ori)
        if prompts_commit_ori:
            prompts_commit_ori = prompts_commit_ori[-1]
            prompt_commit = trans_prompt_commit(prompts_commit_ori)

        try:
            agent_relation_obj = trans_agent_to_relation_obj(
                self.agent_repo.find_by_id(prompts_basic_model.id, "", orm_repo.AgentModel))
        except Exception as e:
            agent_relation_obj = None

        return entities.Prompt(
            id=prompts_basic_model.id,
            workspace_id=prompts_basic_model.space_id,
            prompt_key=prompts_basic_model.prompt_key,
            prompt_basic=prompt_basics,
            prompt_draft=prompt_draft,
            prompt_commit=prompt_commit,
            relation_obj=agent_relation_obj
        )


class JobDomainService:

    def __init__(self, job_repo: JobRepository):
        self.job_repo = job_repo

    def save_draft(self, space_id: str, user_id: str, draft_id: str, draft_input: OptimizeTaskCreationRequest):
        """
        保存草稿的业务逻辑 domain层放核心业务逻辑
        """
        cur_datetime = get_china_datetime()
        existing_draft = None
        if draft_id:
            existing_draft = self.job_repo.find_draft_by_draft_id(draft_id, orm_repo.JobUserDraftModel)

        if existing_draft:
            # 更新现有记录
            existing_draft.name = draft_input.name
            existing_draft.desc = draft_input.desc
            existing_draft.rawTemplates = draft_input.raw_templates
            existing_draft.optimizeInfo = draft_input.optimize_info.model_dump_json() \
                if draft_input.optimize_info else "{}"
            existing_draft.modelInfo = draft_input.model_info.model_dump_json() \
                if draft_input.model_info else "{}"
            existing_draft.assistantInfo = draft_input.assistant_info.model_dump_json() \
                if draft_input.assistant_info else "{}"
            existing_draft.agentTools = json.dumps(draft_input.agent_tools) \
                if draft_input.agent_tools else "[]"
            existing_draft.updated_at = cur_datetime

            # 更新现有对象
            self.job_repo.update(existing_draft)
            result_id = existing_draft.id
        else:
            # 创建新记录
            new_draft = orm_repo.JobUserDraftModel(
                space_id=space_id,
                user_id=user_id,
                name=draft_input.name,
                desc=draft_input.desc,
                rawTemplates=draft_input.raw_templates,
                optimizeInfo=draft_input.optimize_info.model_dump_json() if draft_input.optimize_info else "{}",
                modelInfo=draft_input.model_info.model_dump_json() if draft_input.model_info else "{}",
                assistantInfo=draft_input.assistant_info.model_dump_json() if draft_input.assistant_info else "{}",
                agentTools=json.dumps(draft_input.agent_tools) if draft_input.agent_tools else "[]",
                is_deleted=False,
                created_at=cur_datetime,
                updated_at=cur_datetime
            )

            self.job_repo.save(new_draft)
            result_id = new_draft.id
        return result_id

    def get_draft(self, space_id: str, user_id: str, draft_id: str) -> Optional[entities.JobDraftResponse]:
        """
        获取job草稿的业务逻辑
        """
        draft_data = self.job_repo.find_draft_by_draft_id(draft_id, orm_repo.JobUserDraftModel)

        if not draft_data:
            return None

        job_draft = trans_job_draft(draft_data)
        return job_draft

    def del_draft(self, space_id: str, user_id: str, draft_id: str) -> None:
        """
        删除草稿的业务逻辑 软删除
        """
        cur_datetime = get_china_datetime()

        # 先查询是否已存在
        existing_draft = self.job_repo.find_draft_by_draft_id(draft_id, orm_repo.JobUserDraftModel)

        if not existing_draft:
            raise NotFoundException(f"No draft found space_id: {space_id} and user: {user_id}")

        # 更新现有记录
        existing_draft.is_deleted = True
        existing_draft.updated_at = cur_datetime
        # 更新现有对象
        self.job_repo.update(existing_draft)
        result_id = existing_draft.id
        return result_id

    def get_drafts(self, space_id: str, user_id: str) -> Optional[List[entities.JobDraftResponse]]:
        """
        获取job草稿的业务逻辑
        """
        draft_datas = self.job_repo.find_draft_by_id(space_id, user_id, orm_repo.JobUserDraftModel)
        result = []
        for draft in draft_datas:
            job_draft = trans_job_draft(draft)
            result.append(job_draft)

        return result

    def create_job(self, job_data: dict):
        """创建任务记录"""
        try:
            # 创建新的任务记录
            cur_datetime = get_china_datetime()

            new_job_data = orm_repo.JobUserInfoModel(
                job_id=job_data.get("job_id"),
                space_id=job_data.get("space_id"),
                user_id=job_data.get("user_id"),
                name=job_data.get("name"),
                desc=job_data.get("desc"),
                rawTemplates=job_data.get("rawTemplates"),
                optimizeInfo=job_data.get("optimizeInfo"),
                modelInfo=job_data.get("modelInfo"),
                assistantInfo=job_data.get("assistantInfo"),
                agentTools=job_data.get("agentTools"),
                status=job_data.get("status"),
                progress_rate=job_data.get("progress_rate"),
                is_deleted=False,
                created_at=cur_datetime,
                updated_at=cur_datetime
            )
            return self.job_repo.save(new_job_data)
        except Exception as e:
            raise ValueError(f"save db job data failed: {e}") from e

    def update_job(self, job_id: str, space_id: str, user_id: str, update_data: dict):
        """更新任务信息"""
        try:

            job = self.job_repo.find_job_by_job_id(job_id, space_id, user_id, orm_repo.JobUserInfoModel)

            if job:
                for key, value in update_data.items():
                    if hasattr(job, key):
                        setattr(job, key, value)
                self.job_repo.update(job)
            return True
        except Exception as e:
            raise ValueError(f"update db job data failed: {e}") from e

    def get_job_info(self, space_id: str, user_id: str, job_id: str) -> Optional[entities.OptimizeProgressResponse]:
        """查询任务信息"""
        job_data = self.job_repo.find_job_by_job_id(job_id, space_id, user_id, orm_repo.JobUserInfoModel)

        if not job_data:
            return OptimizeProgressResponse(
                code=404,
                msg=f"未找到任务记录: job_id={job_id}, space_id={space_id}, user_id={user_id}",
                history=None,
                progress=None,
                optimizeInfo=None,
                message="任务不存在"
            )

        job_info = trans_job_info(job_data)
        return job_info

    def get_jobs(self, space_id: str, user_id: str, job_ids: List[str]) -> Optional[entities.OptimizeTaskGetInfoResponse]:
        """查询任务信息"""
        if job_ids == ["*"]:
            # 查询所有任务
            job_records = self.job_repo.find_jobs_by_user(space_id, user_id, orm_repo.JobUserInfoModel)
        else:
            # 查询指定job_id的任务
            job_records = self.job_repo.find_jobs_by_job_ids(job_ids, space_id, user_id, orm_repo.JobUserInfoModel)

        # 有草稿默认添加返回
        draft_datas = []
        try:
            draft_datas = self.get_drafts(space_id, user_id)
        except Exception as e:
            logger.warning(f"get draft data failed: {e}")

        if not job_records and not draft_datas:
            return entities.OptimizeTaskGetInfoResponse(
                code=200,
                msg="查询成功，无任务记录",
                job_details=JobDetails(
                    data=[],
                    failed_jobs=0,
                    finished_jobs=0,
                    running_jobs=0,
                    total_jobs=0
                )
            )
        try:
            status_count = {
                "failed": 0,
                "finished": 0,
                "running": 0,
                "total": len(job_records)
            }

            # 构建任务详情列表
            job_details_list = []

            for job_record in job_records:
                if job_record.status:
                    status_lower = job_record.status.lower()
                    if status_lower in status_count:
                        status_count[status_lower] += 1
                    else:
                        status_count["running"] += 1

                optimize_info = json.loads(job_record.optimizeInfo) if job_record.optimizeInfo else {}
                model_info = json.loads(job_record.modelInfo) if job_record.modelInfo else {}
                assistant_info = json.loads(job_record.assistantInfo) if job_record.assistantInfo else None
                agent_tools_data = json.loads(job_record.agentTools) if job_record.agentTools else []
                history_data = json.loads(job_record.history) if job_record.history else []

                # 构建JobInfo
                job_info = JobInfo(
                    created_at=job_record.created_at.strftime("%Y-%m-%d %H:%M:%S") if job_record.created_at else "",
                    desc=job_record.desc or "",
                    id=job_record.job_id,
                    name=job_record.name or "",
                    num_iter=optimize_info.get("num_iter", 0),
                    job_type="formal",
                    modelInfo=model_info,
                    assistantInfo=assistant_info
                )

                # 构建JobDetailItem
                job_detail = JobDetailItem(
                    error_msg=job_record.errorMsg,
                    job_info=job_info,
                    progress_rate=float(job_record.progress_rate) if job_record.progress_rate is not None else 0.0,
                    status=job_record.status or "",
                    time_cost=job_record.timeCost or 0
                )

                job_details_list.append(job_detail)

            # 添加草稿记录
            for draft_data in draft_datas:
                draft_job_info = entities.JobDetailItem()
                draft_job_info.job_info.id = draft_data.draft_id
                draft_job_info.job_info.name = draft_data.content.name
                draft_job_info.job_info.desc = draft_data.content.desc
                draft_job_info.job_info.job_type = "draft"
                draft_job_info.job_info.created_at = draft_data.created_at.strftime("%Y-%m-%d %H:%M:%S")
                job_details_list.append(draft_job_info)

            # 构建JobDetails
            job_details = JobDetails(
                data=job_details_list,
                failed_jobs=status_count["failed"],
                finished_jobs=status_count["finished"],
                running_jobs=status_count["running"],
                total_jobs=status_count["total"]
            )

            return OptimizeTaskGetInfoResponse(
                code=200,
                msg="Optimization progress list query success.",
                job_details=job_details
            )

        except Exception as e:
            return OptimizeTaskGetInfoResponse(
                code=500,
                msg=f"查询失败: {str(e)}",
                job_details=None
            )

    def del_job(self, space_id: str, user_id: str, job_id: str) -> None:
        """
        删除job的业务逻辑 软删除
        """
        cur_datetime = get_china_datetime()

        # 先查询是否已存在
        existing_job = self.job_repo.find_job_by_job_id(job_id, space_id, user_id, orm_repo.JobUserInfoModel)

        if not existing_job:
            raise NotFoundException(f"No job found space_id: {space_id} and user: {user_id}")

        # 更新现有记录
        existing_job.is_deleted = True
        existing_job.updated_at = cur_datetime
        # 更新现有对象
        self.job_repo.update(existing_job)
        result_id = existing_job.id
        return result_id


def trans_prompt_basic(prompt_basic: Base) -> PromptBasic:
    """解析数据并构建领域对象"""
    return entities.PromptBasic(
        display_name=prompt_basic.name,
        description=prompt_basic.description,
        latest_version=prompt_basic.latest_version,
        created_by=prompt_basic.created_by,
        updated_by=prompt_basic.updated_by,
        created_at=str(int(prompt_basic.created_at.timestamp())),
        updated_at=str(int(prompt_basic.updated_at.timestamp())),
        latest_committed_at=prompt_basic.latest_commit_time
    )


def trans_prompt_commit(prompt_commit: Base) -> PromptCommit:
    """解析数据并构建领域对象"""

    messages = [entities.Message(**msg) for msg in json.loads(prompt_commit.messages)]
    variable_defs = [entities.VariableDef(**var) for var in json.loads(prompt_commit.variable_defs)]
    tools = [entities.Tool(**tool) for tool in json.loads(prompt_commit.tools)]

    prompt_detail = entities.PromptDetail(
        prompt_template=entities.PromptTemplate(
            template_type=prompt_commit.template_type,
            messages=messages,
            variable_defs=variable_defs
        ),
        tools=tools,
        tool_call_config=entities.ToolCallConfig(**json.loads(prompt_commit.tool_call_config)),
        prompt_model_config=entities.ModelConfig(**json.loads(prompt_commit.prompt_model_config))
    )

    commit_info = entities.CommitInfo(
        version=prompt_commit.version,
        base_version=prompt_commit.base_version,
        description=prompt_commit.description,
        committed_by=prompt_commit.committed_by,
        committed_at=str(int(prompt_commit.updated_at.timestamp()))
    )
    return entities.PromptCommit(
        detail=prompt_detail,
        commit_info=commit_info
    )


def trans_prompt_user_draft(prompt_user_draft: Base) -> PromptDraft:
    """解析数据并构建领域对象"""

    messages = [entities.Message(**msg) for msg in json.loads(prompt_user_draft.messages)]
    variable_defs = [entities.VariableDef(**var) for var in json.loads(prompt_user_draft.variable_defs)]
    tools = [entities.Tool(**tool) for tool in json.loads(prompt_user_draft.tools)]

    prompt_detail = entities.PromptDetail(
        prompt_template=entities.PromptTemplate(
            template_type=prompt_user_draft.template_type,
            messages=messages,
            variable_defs=variable_defs
        ),
        tools=tools,
        tool_call_config=entities.ToolCallConfig(**json.loads(prompt_user_draft.tool_call_config)),
        prompt_model_config=entities.ModelConfig(**json.loads(prompt_user_draft.prompt_model_config))
    )
    draft_info = entities.DraftInfo(
        base_version=prompt_user_draft.base_version,
        created_at=str(int(prompt_user_draft.created_at.timestamp())),
        is_draft_edited=prompt_user_draft.is_draft_edited,
        updated_at=str(int(prompt_user_draft.updated_at.timestamp())),
        user_id=prompt_user_draft.user_id
    )

    prompt_draft = entities.PromptDraft(
        detail=prompt_detail,
        draft_info=draft_info
    )

    return prompt_draft


def trans_agent_to_relation_obj(agent_models: List[BaseAgent]) -> List[AgentRelationObj]:
    """
    将 AgentModel 对象列表转换为关系对象字典列表
    """
    relation_objs = []
    for agent in agent_models:
        relation_obj = entities.AgentRelationObj(
            obj_id=agent.aw_id,
            obj_version=agent.aw_version,
            obj_name=agent.aw_name,
            obj_type_name=agent.type
        )
        relation_objs.append(relation_obj)
    return relation_objs


def trans_agent_to_user_name(agent_model: BaseAgent) -> str:
    """
    获取user表中用户名
    """
    return agent_model.user_name


def process_job_draft_body(body: dict):
    """
    草稿允许body体中desc，optimizeInfo.cases ，rawTemplates字段为空
    """
    if 'optimizeInfo' in body and 'cases' in body['optimizeInfo']:
        for case in body['optimizeInfo']['cases']:
            if 'messages' in case and isinstance(case['messages'], list):
                if not case['messages']:
                    # 如果messages为空，添加空的assistant消息
                    case['messages'] = [{"role": "assistant", "content": ""}]
                else:
                    last_message = case['messages'][-1]
                    if last_message.get('role') != 'assistant':
                        # 最后一条不是assistant，添加空的assistant消息
                        case['messages'].append({"role": "assistant", "content": ""})
    fields_to_check = ['desc', 'rawTemplates']
    for field in fields_to_check:
        if field in body and not body[field]:
            body[field] = " "

    if 'optimizeInfo' in body and isinstance(body['optimizeInfo'], dict):
        if 'cases' in body['optimizeInfo'] and (
                body['optimizeInfo']['cases'] is None or body['optimizeInfo']['cases'] == []):
            del body['optimizeInfo']['cases']


def trans_job_draft(db_draft: Base) -> Optional[entities.JobDraftResponse]:
    """
    将数据库模型转换为 Pydantic 请求模型
    """
    try:
        optimize_info_data = json.loads(db_draft.optimizeInfo) if db_draft.optimizeInfo else {}
        model_info_data = json.loads(db_draft.modelInfo) if db_draft.modelInfo else {}
        assistant_info_data = json.loads(db_draft.assistantInfo) if db_draft.assistantInfo else None
        agent_tools_data = json.loads(db_draft.agentTools) if db_draft.agentTools else []

        # 构建 Pydantic 模型
        request_body = {
            "name": db_draft.name,
            "desc": db_draft.desc,
            "rawTemplates": db_draft.rawTemplates or "",
            "optimizeInfo": optimize_info_data,
            "modelInfo": model_info_data,
            "assistantInfo": assistant_info_data,
            "agentTools": agent_tools_data
        }

        process_job_draft_body(request_body)
        content = OptimizeTaskCreationRequest(**request_body)

        return entities.JobDraftResponse(
            draft_id=db_draft.id,
            space_id=db_draft.space_id,
            user_id=db_draft.user_id,
            created_at=db_draft.created_at,
            content=content,
            code=200,
            msg="job draft get success."
        )

    except (json.JSONDecodeError, ValidationError) as e:
        raise ValueError(f"convert db data failed: {e}") from e


def trans_job_info(db_job: Base) -> Optional[entities.OptimizeProgressResponse]:
    """
    将数据库模型转换为 Pydantic 请求模型
    """
    try:
        optimize_info = json.loads(db_job.optimizeInfo) if db_job.optimizeInfo else {}
        model_info = json.loads(db_job.modelInfo) if db_job.modelInfo else {}
        assistant_info = json.loads(db_job.assistantInfo) if db_job.assistantInfo else None
        agent_tools_data = json.loads(db_job.agentTools) if db_job.agentTools else []
        history_data = json.loads(db_job.history) if db_job.history else []

        # 构建JobInfo
        job_info = JobInfo(
            created_at=db_job.created_at.isoformat() if db_job.created_at else "",
            desc=db_job.desc or "",
            id=db_job.job_id,
            name=db_job.name or "",
            num_iter=optimize_info.get("num_iter", 0),
            job_type="formal",
            assistantInfo=assistant_info,
            modelInfo=model_info
        )

        progress = Progress(
            best_iteration=db_job.bestIteration,
            best_prompt=db_job.bestTemplates,
            original_prompt=db_job.rawTemplates,
            status=db_job.status,
            progress_rate=float(db_job.progress_rate) if db_job.progress_rate is not None else None,
            success_rate=float(db_job.success_rate) if db_job.success_rate is not None else None,
            time_cost=db_job.timeCost,
            job_info=job_info,
            error_msg=db_job.errorMsg
        )

        # 构建History
        history = []
        if isinstance(history_data, list):
            for item in history_data:
                if isinstance(item, dict):
                    history.append(HistoryItem(**item))

        # 构建OptimizeInfo
        optimize_info_obj = OptimizeInfo(**optimize_info) if optimize_info else None
        if optimize_info_obj:
            optimize_info_obj.tools = agent_tools_data

        return OptimizeProgressResponse(
            code=200,
            msg="查询成功",
            history=history,
            progress=progress,
            optimizeInfo=optimize_info_obj,
            message="查询优化任务进度成功"
        )

    except (json.JSONDecodeError, ValidationError) as e:
        raise ValueError(f"convert db data failed: {e}") from e

