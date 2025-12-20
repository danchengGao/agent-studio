#!/usr/bin/python3.10
# -*- coding: utf-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
import os
from pathlib import Path
from typing import Dict, List, Any
from functools import lru_cache
import yaml
from pydantic_settings import BaseSettings
from pydantic import Field


def find_env_file():
    current_dir_env = Path(__file__).parent / ".env"
    parent_dir_env = Path(__file__).parent.parent / ".env"
    for env_path in [parent_dir_env, current_dir_env]:
        if env_path.exists():
            return env_path

    return None


class Settings(BaseSettings):
    # mysql配置
    DB_HOST: str = Field(..., env="DB_HOST")
    DB_PORT: int = Field(..., env="DB_PORT")
    DB_USER: str = Field(..., env="DB_USER")
    DB_PASSWORD: str = Field(..., env="DB_PASSWORD")
    OPS_DB_NAME: str = Field(..., env="OPS_DB_NAME")
    AGENT_DB_NAME: str = Field(..., env="AGENT_DB_NAME")

    # 应用配置
    DEBUG: bool = Field(False, env="DEBUG")

    class Config:
        env_file = find_env_file()
        extra = "allow"


@lru_cache()
def get_settings():
    """
    环境设置
    """
    return Settings()

settings = get_settings()


class ModelConfigManager:
    def __init__(self):
        self.model_config_path = Path(__file__).parent / "conf" / "model_config.yaml"
        self._load_model_config()

    def get_model_config(self, model_id: str):
        """
        获取指定模型配置
        """
        for model in self.model_config.get('models', []):
            if str(model.get('openModel', {}).get('model_id', '')) == str(model_id):
                return model
        return None

    def list_models(self) -> List[Dict[str, Any]]:
        """
        获取所有模型配置
        """
        return list(self.model_config.get('models', []))

    def _load_model_config(self):
        self.model_config = {}
        if os.path.exists(self.model_config_path):
            with open(self.model_config_path, "r", encoding="utf-8") as f:
                self.model_config = yaml.safe_load(f)