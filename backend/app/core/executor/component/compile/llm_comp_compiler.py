#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict

from openjiuwen.core.component.common.configs.model_config import ModelConfig
from openjiuwen.core.component.llm_comp import LLMCompConfig, LLMComponent
from openjiuwen.core.utils.llm.base import BaseModelInfo

from app.core.common.dsl import LLMConfig as LLMConfigDL
from app.core.executor.component.compile.base_comp_compiler import BaseCompCompiler


def parse_model_config(llm_comp_config_dict: Dict[str, Any]) -> ModelConfig:
    llm_config_dl = LLMConfigDL.model_validate(llm_comp_config_dict)

    base_model_info_dl = llm_config_dl.model.model_info
    model_config_dl = llm_config_dl.model
    return ModelConfig(
        model_provider=model_config_dl.model_provider,
        model_info=BaseModelInfo(
            model=base_model_info_dl.model_name,
            api_base=base_model_info_dl.api_base,
            api_key=base_model_info_dl.api_key,
            temperature=base_model_info_dl.temperature,
            top_p=base_model_info_dl.top_p,
            timeout=base_model_info_dl.timeout,
        )
    )


class LLMCompCompiler(BaseCompCompiler):
    def __init__(self, llm_comp_config_dict: Dict[str, Any]) -> None:
        super().__init__()
        self.llm_comp_config_dict = llm_comp_config_dict
        self.llm_config_dl = LLMConfigDL.model_validate(llm_comp_config_dict)

    def compile(self) -> LLMComponent:
        model_config = parse_model_config(self.llm_comp_config_dict)

        llm_comp_config = LLMCompConfig(
            model=model_config,
            template_content=self.llm_config_dl.template_content,
            response_format={
                "type": self.llm_config_dl.response_format_type,
            },
            output_config=self.llm_config_dl.output_config,
        )

        return LLMComponent(llm_comp_config)
