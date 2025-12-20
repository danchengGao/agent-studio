#!/usr/bin/env python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict

from app.core.common.dsl import TextEditorConfig
from app.core.executor.component.component_impl.text_editor_comp import TextEditorComponent
from app.core.executor.component.compile.base_comp_compiler import BaseCompCompiler
from app.core.common.exceptions import JiuWenExecuteException
from app.core.common.status_code import StatusCode


class TextEditorCompCompiler(BaseCompCompiler):
    def __init__(self, node_id: str, comp_config_dict: Dict[str, Any], outputs: Dict[str, Any]) -> None:
        super().__init__()
        self.comp_config_dict: Dict[str, Any] = comp_config_dict
        self.node_id: str = node_id
        self.outputs: Dict[str, Any] = outputs

    def compile(self) -> TextEditorComponent:
        if not self.comp_config_dict:
            raise JiuWenExecuteException(
                StatusCode.TEXT_EDITOR_COMP_COMPILER_ERROR.code,
                StatusCode.TEXT_EDITOR_COMP_COMPILER_ERROR.errmsg.format(msg="节点数据 <comp_config_dict> 为空"),
                node_id=self.node_id
            )
        text_editor_config = TextEditorConfig.model_validate(self.comp_config_dict)
        if not self.outputs.keys():
            self.outputs["output"] = ""
        output_name = next(iter(self.outputs))
        return TextEditorComponent(self.node_id, text_editor_config, output_name)