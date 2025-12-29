#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List

from openjiuwen_studio.ops.modules.prompt.domain.debug_entity import DebugLog


class DebugContextRepository(ABC):
    """调试上下文存储接口"""

    @abstractmethod
    async def upsert(self, req: Dict[str, Any]) -> None:
        """
        保存或更新 prompt 的最新上下文
        :param prompt_id: prompt 唯一标识
        :param context: 需要持久化的 dict
        """

    @abstractmethod
    async def fetch(self, prompt_id: int, user_id: str) -> Optional[Dict[str, Any]]:
        """
        获取指定 prompt 的最新上下文
        :return: 若不存在返回 None
        """


class DebugLogRepository(ABC):
    """调试历史仓储接口"""

    @abstractmethod
    async def add_record(self, log: Dict[str, Any]) -> None:
        """
        追加一条历史记录（只写不改）
        """

    @abstractmethod
    async def list_records(
        self, prompt_id: int, workspace_id: str, days_limit: Optional[int], page_size: int, page_token: Optional[str]
    ) -> List[DebugLog]:
        """
        按时间倒序分页查询历史
        """