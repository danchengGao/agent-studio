#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from functools import wraps
from typing import Callable

from fastapi import status

from openjiuwen_studio.models.plugin import ToolBaseDB
from openjiuwen_studio.schemas.common import ResponseModel
from openjiuwen_studio.core.manager.repositories import JiuwenBaseRepository
from openjiuwen_studio.core.manager.repositories.jiuwen_base_repository import get_val_from_dict, get_db_jw
from openjiuwen_studio.core.database import jiuwen_db_logger, milliseconds


class ToolRepository():
    def __init__(self) -> None:
        pass

    def with_exception_handling(func) -> Callable:
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            try:
                return func(self, *args, **kwargs)
            except Exception as e:
                jiuwen_db_logger.error(f"Error: tool db data preprocessing failed: {type(e).__name__}")
                return ResponseModel(code=status.HTTP_400_BAD_REQUEST,
                                     message=f"Error: tool db data preprocessing failed: {type(e).__name__}").model_dump(
                    exclude_none=True)

        return wrapper

    @with_exception_handling
    def tool_create(self, tool_data: dict) -> dict:
        with get_db_jw() as db:
            tool_db = JiuwenBaseRepository(db, ToolBaseDB)
            if not tool_data:
                jiuwen_db_logger.debug("No tool data to register")
                return ResponseModel(code=status.HTTP_400_BAD_REQUEST,
                                     message="No tool data to register").model_dump(exclude_none=True)
            find_id = {
                "tool_id": get_val_from_dict(tool_data, ["tool_id"]),
            }
            if not tool_data.get('plugin_version', ""):
                tool_data['plugin_version'] = ToolBaseDB.__version_none__
            timestamp = milliseconds()
            if "create_time" not in tool_data:
                tool_data["create_time"] = timestamp
            if "update_time" not in tool_data:
                tool_data["update_time"] = timestamp
            return tool_db.register_dl_in_sql(find_id=find_id, dl=tool_data).model_dump(exclude_none=True)

    @with_exception_handling
    def tool_get(self, query_body: dict) -> (dict, dict):
        with get_db_jw() as db:
            tool_db = JiuwenBaseRepository(db, ToolBaseDB)
            find_id = {
                "tool_id": get_val_from_dict(query_body, ["tool_id"]),
            }
            # 添加 plugin_version 到 find_id，因为唯一约束是 (tool_id, plugin_version)
            # 如果没有提供 plugin_version，使用默认值
            plugin_version = get_val_from_dict(query_body, ["plugin_version"])
            if not plugin_version:
                plugin_version = ToolBaseDB.__version_none__
            find_id["plugin_version"] = plugin_version
            res = tool_db.get_dl_in_sql(find_id=find_id, return_first_item=True, return_declarativebase=True)
            if res.code != status.HTTP_200_OK or not res.data:
                return res.model_dump(exclude_none=True), {}
            
            # Prepare plugin info dict
            plugin_info_dict = {}
            if hasattr(res.data, 'plugin_info') and res.data.plugin_info is not None:
                if hasattr(res.data.plugin_info, 'to_dict'):
                    plugin_info_dict = res.data.plugin_info.to_dict()
                elif hasattr(res.data.plugin_info, 'model_dump'):
                    plugin_info_dict = res.data.plugin_info.model_dump()
                elif hasattr(res.data.plugin_info, '__dict__'):
                    plugin_info_dict = {k: v for k, v in res.data.plugin_info.__dict__.items() if not k.startswith('_')}

            # Convert ToolBaseDB object to dict
            final_res = res.model_dump(exclude_none=True)
            if res.data:
                if hasattr(res.data, 'to_dict'):
                    final_res['data'] = res.data.to_dict()
                elif hasattr(res.data, '__dict__'):
                    # Fallback to dict conversion if to_dict is not available
                    # Be careful with relationships, we might need to exclude them or handle them
                    final_res['data'] = {k: v for k, v in res.data.__dict__.items() if not k.startswith('_')}
            
            return final_res, plugin_info_dict

    @with_exception_handling
    def tool_save(self, tool_data: dict) -> dict:
        with get_db_jw() as db:
            tool_db = JiuwenBaseRepository(db, ToolBaseDB)
            if not tool_data:
                jiuwen_db_logger.debug("No tool data to update")
                return ResponseModel(code=status.HTTP_400_BAD_REQUEST,
                                     message="No tool data to update").model_dump(exclude_none=True)
            find_id = {
                "tool_id": get_val_from_dict(tool_data, ["tool_id"]),
                "space_id": get_val_from_dict(tool_data, ["space_id", "spaceId"]),
            }
            # 添加 plugin_version 到 find_id，因为唯一约束是 (tool_id, plugin_version)
            # 如果没有提供 plugin_version，使用默认值
            plugin_version = get_val_from_dict(tool_data, ["plugin_version"])
            if not plugin_version:
                plugin_version = ToolBaseDB.__version_none__
            find_id["plugin_version"] = plugin_version
            find_id = ToolBaseDB.filter_invalid_keys(find_id)
            timestamp = milliseconds()
            if "update_time" not in tool_data:
                tool_data["update_time"] = timestamp
            return tool_db.update_dl_in_sql(find_id=find_id, update_dl=tool_data).model_dump(exclude_none=True)

    @with_exception_handling
    def tool_delete(self, query_body: dict) -> dict:
        with get_db_jw() as db:
            tool_db = JiuwenBaseRepository(db, ToolBaseDB)
            # 删除操作需要谨慎，所以这里要求find_id必须所有值都非空
            tool_id = get_val_from_dict(query_body, ["tool_id"])
            space_id = get_val_from_dict(query_body, ["space_id", "spaceId"])
            if not tool_id or not space_id:
                return ResponseModel(
                    code=status.HTTP_400_BAD_REQUEST,
                    message="tool_data must contains tool_id and space_id/spaceId in order to delete"
                ).model_dump(exclude_none=True)
            find_id = {
                "tool_id": tool_id,
                "space_id": space_id,
            }
            return tool_db.unregister_dl_in_sql(find_id=find_id).model_dump(exclude_none=True)

    @with_exception_handling
    def tool_list(self, query_body: dict) -> dict:
        with get_db_jw() as db:
            tool_db = JiuwenBaseRepository(db, ToolBaseDB)
            find_id = {
                "space_id": get_val_from_dict(query_body, ["space_id", "spaceId"]),
            }
            res = tool_db.get_dl_in_sql(find_id=find_id)
            if res.code != status.HTTP_200_OK or not res.data:
                return res.model_dump(exclude_none=True)
            for idx, data in enumerate(res.data):
                if data.get("tool_version", None) == ToolBaseDB.__version_none__:
                    res.data[idx].pop("tool_version")
            return res.model_dump(exclude_none=True)


tool_repository = ToolRepository()