#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from abc import ABC, abstractmethod
from typing import Any, List, Optional, Tuple, Union, Dict

from openjiuwen_studio.ops.modules.prompt.domain import entities
from openjiuwen_studio.ops.modules.prompt.infra.database import Base, BaseAgent


class PromptRepository(ABC):
    @abstractmethod
    def save(self, db_prompt: Base) -> int:
        """
        interface define
        """
        pass

    @abstractmethod
    def update(self, new_prompt: Base) -> None:
        """更新basic prompt"""
        pass

    @abstractmethod
    def find_by_id(self, prompt_id: int, promptmodel: Base) -> Optional[Base]:
        """
        prompt_basic基表中通过id主键(prompt_id)查询记录
        """
        pass

    @abstractmethod
    def find_by_prompt_id(self, prompt_id: int, promptmodel: Base) -> Optional[Base]:
        """
        prompt_user_draft表中通过pormpt_id外键查询记录
        """
        pass

    @abstractmethod
    def find_by_name(self, name: str, promptmodel: Base) -> Optional[entities.Prompt]:
        """
        interface define
        """
        pass

    @abstractmethod
    def get_all(self, conditions: list, promptmodel: Base) -> Base:
        """通用条件式查库方法"""
        pass

    def get_default_model_config(self) -> Optional[entities.PromptDetail]:
        """获取detail页默认模型配置"""
        pass

    @abstractmethod
    def list_all(self, page_num: int, page_size: int, conditions: list, order_by: Optional[Union[Any, List[Any]]],
                 promptmodel: Base) -> Tuple[List[Base], List[Base]]:
        """
        interface define
        """
        pass

    @abstractmethod
    def delete(self, prompt_id: int, promptmodel: Base) -> None:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_commit_by_id_version(self, prompt_id: int, version: str, promptmodel: Base) -> Optional[Base]:
        """查询prompt"""
        pass

    @abstractmethod
    def find_draft_by_id(self, prompt_id: int, promptmodel: Base) -> Optional[Base]:
        """查询prompt草稿"""
        pass

    def trans_promptbasic_to_userinfo(self, db_prompts: Base) -> entities.UserInfoDetail:
        """从prompt basic里获取user info"""
        pass


class PromptVersionRepository(ABC):
    @abstractmethod
    def save_version(self, version: entities.PromptVersionBase) -> entities.PromptVersion:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_versions_by_prompt(self, prompt_id: int) -> List[entities.PromptVersion]:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_version(self, prompt_id: int, version: int) -> Optional[entities.PromptVersion]:
        """
        interface define
        """
        pass

    @abstractmethod
    def set_current_version(self, prompt_id: int, version: int) -> None:
        """
        interface define
        """
        pass


class PromptUserDraftRepository(ABC):
    @abstractmethod
    def save_draft(
            self,
            draft_po: entities.DraftPO
    ) -> entities.DraftInfoOutput:
        """
        保存prompt草稿的接口
        """
        pass

    @abstractmethod
    def get_draft(self, prompt_id: int, user_id: str) -> Optional[Any]:
        """
        获取prompt草稿的接口
        """
        pass


class PromptSubmitRepository(ABC):
    @abstractmethod
    def save_commit(self, commit: entities.PromptSubmit) -> entities.PromptSubmit:
        """
        提交prompt的接口
        """
        pass

    @abstractmethod
    def find_commit_by_version(self, prompt_id: int, version: str) -> Optional[entities.PromptSubmit]:
        """
        获取已提交prompt的接口
        """
        pass

    @abstractmethod
    def list_commits_by_prompt_id(self, prompt_id: int, limit: int) -> List[Any]:
        """
        获取提交prompt的历史记录的接口
        """
        pass


class AgentRepository(ABC):

    @abstractmethod
    def find_by_id(self, prompt_id: int, prompt_version: str, agentmodel: BaseAgent) -> Optional[List[BaseAgent]]:
        """
        interface define
        """
        pass

    def find_user_name_by_id(self, user_id: str, agentmodel: BaseAgent) -> Optional[BaseAgent]:
        """
        interface define
        """

    @abstractmethod
    def find_model_config_by_spaceid(self, space_id: str, agentmodel: BaseAgent,
                                     is_active: bool = True,
                                     page_num: int = 1,
                                     page_size: int = 100) -> Optional[List[BaseAgent]]:
        """
        interface define
        """

    @abstractmethod
    def find_model_config_by_modelid(self, model_id: int, agentmodel: BaseAgent) \
            -> Optional[BaseAgent]:
        """
        interface define
        """

    @abstractmethod
    def update_field_by_prompt_id(self, prompt_id: int, field_updates: Dict[str, Any], agentmodel: BaseAgent,
                     prompt_version: str = None) -> int:
        """
        interface define
        """


class JobRepository(ABC):
    @abstractmethod
    def save(self, db_job: Base) -> None:
        """
        interface define
        """
        pass

    @abstractmethod
    def update(self, new_db_job: Base) -> None:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_draft_by_id(self, space_id: str, user_id: str, jobmodel: Base) -> Optional[List[Base]]:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_draft_by_draft_id(self, draft_id: str, jobmodel: Base) -> Optional[Base]:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_job_by_job_id(self, job_id: str, space_id: str, user_id: str, jobmodel: Base) -> Optional[Base]:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_jobs_by_user(self, space_id: str, user_id: str, jobmodel: Base) -> Optional[List[Base]]:
        """
        interface define
        """
        pass

    @abstractmethod
    def find_jobs_by_job_ids(self, job_ids: List[str], space_id: str, user_id: str, jobmodel: Base) -> Optional[List[Base]]:
        """
        interface define
        """
        pass
