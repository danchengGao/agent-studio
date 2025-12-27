#!/usr/bin/python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved
"""llm service"""

import logging
from typing import Dict, Any

from ops.config import ModelConfigManager
from ops.modules.llm.model import ModelConfig, ListModelResponse
from ops.modules.llm.schema import ListModelRequest
from ops.modules.prompt.domain.repositories import AgentRepository
from ops.modules.prompt.infra.repositories import orm_repo
from openjiuwen_studio.core.manager.model_manager.utils import SecurityUtils


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class LLMConfigService:
    """llm service"""

    def __init__(self, model_config_manager: ModelConfigManager, agent_repo: AgentRepository, ):
        self.model_config_manager = model_config_manager
        self.agent_repo = agent_repo

    async def get_model(self, model_id: str, source: str) -> Dict[str, Any]:
        """
        获取单个模型信息
        """
        logger.info(f"get model called with model_id:{model_id}, source: {source}")

        if source == "config":
            model_config = self.model_config_manager.get_model_config(model_id)
            if not model_config:
                logger.error(f"Model with id {model_id} not found")
                raise ValueError(f"Model with id {model_id} not found")
            # 将字典转换为 ModelConfig 对象
            model_config_obj = ModelConfig(**model_config)
        else:
            try:
                model_config = self.agent_repo.find_model_config_by_modelid(model_id, orm_repo.ModelConfig)
                model_config_obj = convert_orm_to_model_config(model_config, False)
            except Exception as e:
                logger.error(f"Query Model Config from DB {model_id} failed: {e}")
                raise ValueError(f"Model with id {model_id} not found") from e

        logger.info(f"Model retrieved: {model_config_obj}")

        return {
            "msg": "success",
            "code": 0,
            "model": model_config_obj
        }

    def get_llm_model_info(self, model_id: str, source: str) -> Dict[str, str]:
        """
        获取模型信息：原始格式参考model_config.yaml，全部信息信息字段
        """
        logger.info(f"get model called with model_id:{model_id}, source:{source}")

        if source == "config":
            try:
                model_config = self.model_config_manager.get_model_config(model_id)
                if not model_config:
                    logger.error(f"Model with id {model_id} not found")
                    raise ValueError(f"Model with id {model_id} not found in config")
            except Exception as e:
                logger.error(f"Query Model Config from config {model_id} failed: {e}")
                raise ValueError(f"Model with id {model_id} not found in config") from e
        else:
            try:
                model_config_db = self.agent_repo.find_model_config_by_modelid(int(model_id), orm_repo.ModelConfig)
                if model_config_db is None:
                    raise ValueError(f"Model with id {model_id} not found")
                model_config = convert_orm_to_model_config(model_config_db).model_dump()
            except Exception as e:
                logger.error(f"Query Model Config from DB {model_id} failed: {e}")
                raise ValueError(f"Model with id {model_id} not found") from e
        return model_config

    def get_llm_model_key_info(self, model_id: str, source: str) -> Dict[str, Any]:
        """
        获取模型关键信息：api_key， base_url, 温度等参数
        """
        logger.info(f"get model apikey called with model_id：{model_id} ： {source}")

        result = {}
        model_config = self.get_llm_model_info(model_id, source)
        # 获取api_key和base_url
        base_url = model_config.get("protocol_config", {}).get("base_url", "")
        api_key = model_config.get("protocol_config", {}).get("api_key", "")
        provider = model_config.get("protocol_config", {}).get("provider", "")
        model_name = model_config.get("protocol_config", {}).get("model", "")
        param_schemas = model_config.get("openModel", {}).get("param_config", {}).get("param_schemas", [])

        params = {}
        param_mapping = {
            "temperature": ("float", 0.7),
            "max_tokens": ("int", 4000),
            "top_p": ("float", 0.9)
        }

        for param in param_schemas:
            name = param.get("name")
            if name in param_mapping:
                expected_type, default_value = param_mapping[name]
                try:
                    if expected_type == "float":
                        params[name] = float(param.get("default_val", default_value))
                    elif expected_type == "int":
                        params[name] = int(param.get("default_val", default_value))
                except (ValueError, TypeError):
                    params[name] = default_value

        # 确保所有参数都有值
        for name, (expected_type, default_value) in param_mapping.items():
            if name not in params:
                params[name] = default_value

        result["base_url"] = base_url
        result["api_key"] = api_key
        result["provider"] = provider
        result["params"] = params
        result["model_name"] = model_name
        return result

    async def list_models(
            self,
            request: ListModelRequest
    ) -> ListModelResponse:
        """
        获取所有可用模型列表
        :param request:
        :return:
        """
        logger.info(f"list models called with request {request.model_dump()}")
        model_objects = []
        try:
            # 配置文件中获取模型配置
            models = self.model_config_manager.list_models()
            # 将字典列表转换为 ModelConfig 对象列表
            model_objects = [ModelConfig(**model) for model in models]
        except Exception as e:
            logger.warning(f"Query Model Config from config failed: {e}")

        # 从studio库中获取模型配置
        try:

            models_db = self.agent_repo.find_model_config_by_spaceid(request.workspace_id,
                                                                     orm_repo.ModelConfig,
                                                                     request.is_active,
                                                                     request.page_num,
                                                                     request.page_size)
            if models_db is None:
                models_db = []
            for model_db in models_db:
                model_db_res = convert_orm_to_model_config(model_db, False)
                model_objects.append(model_db_res)

        except Exception as e:
            logger.warning(f"Query Model Config from DB failed: {e}")

        # 模拟分页逻辑
        start_index = int(request.page_token) * request.page_size
        end_index = start_index + request.page_size
        paginated_models = model_objects[start_index:end_index]
        next_page_token = str(int(request.page_token) + 1) if end_index < len(model_objects) else "0"
        has_more = next_page_token != "0"

        response = ListModelResponse(
            msg="success",
            code=0,
            has_more=has_more,
            models=paginated_models,
            next_page_token=next_page_token,
            total=len(model_objects),
        )
        logger.info(f"Model retrieved: {response}")
        return response


def convert_orm_to_model_config(orm_obj, api_key_flag: bool = True) -> ModelConfig:
    """
    转换数据为ModelConfig
    """
    # 解析 tags
    tags = orm_obj.tags or []

    # 构建 series
    series = {
        "icon": "",
        "name": orm_obj.provider,
        "vendor": orm_obj.provider
    }

    parameters = orm_obj.parameters or {}

    # 构建 param_schemas
    param_schemas = [
        {
            "name": "temperature",
            "label": "温度",
            "desc": "temperature:控制模型生成结果的随机性与创造性。值越高，输出越随机、多样；值越低，结果越确定、保守。范围通常为0~2，推荐设置0.1~1.0。示例：0.7（平衡随机性与一致性）、1.2（更具创造性的输出）。",
            "type": "float",
            "min": "0",
            "max": "2",
            "default_val": str(parameters.get("temperature", 0.7))
        },
        {
            "name": "top_p",
            "label": "核采样",
            "desc": "Top-p:选择累计概率达到p的最小词集合进行采样。动态调整候选词的数量，平衡输出的多样性和质量。建议：通常设置为0.9-0.95，与温度配合使用时建议只调整其中一个。",
            "type": "float",
            "min": "0",
            "max": "1",
            "default_val": str(parameters.get("top_p", 0.7))
        }
    ]

    # 构建 openModel
    open_model = {
        "workspace_id": orm_obj.space_id,
        "desc": orm_obj.description or "",
        "name": orm_obj.name,
        "model_id": str(orm_obj.id),
        "param_config": {
            "param_schemas": param_schemas
        }
    }

    protocol_config = {
        "base_url": orm_obj.base_url,
        "api_key": SecurityUtils().decrypt_api_key(orm_obj.api_key) if api_key_flag else "",
        "model": orm_obj.model_type,
        "provider": orm_obj.provider
    }

    # 创建并返回目标对象
    return ModelConfig(
        tags=tags,
        icon="",
        openModel=open_model,
        series=series,
        model_from="db",
        protocol_config=protocol_config
    )
