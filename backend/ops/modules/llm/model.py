#!/usr/bin/python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved
"""llm service model"""

from typing import Dict, List, Any

from pydantic import BaseModel


class ModelConfig(BaseModel):
    """
    模型配置信息
    """
    tags: List[str] = []
    icon: str = ""
    openModel: Dict[str, Any] = {}
    series: Dict[str, Any] = {}
    model_from: str = "db"
    protocol_config: Dict[str, Any] = {}


class ListModelResponse(BaseModel):
    """
    列出可用模型信息列表的响应数据结构
    """
    msg: str = ""
    code: int = 0
    has_more: bool = False
    models: List[ModelConfig] = []
    next_page_token: str = ""
    total: int = 0
