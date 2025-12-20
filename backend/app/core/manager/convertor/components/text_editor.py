#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from typing import Any, Dict

from app.core.common import dsl
from app.core.manager.convertor.components.common import outputs_convert, input_params_convert
from app.core.common.dsl import ComponentType
from app.schemas.node import Node, Outputs, BaseValue


def text_editor_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        inputs = data.inputs
        if inputs is None:
            raise ValueError("text_editor_convert inputs is none")
        input_parameters = inputs.input_parameters
        if input_parameters is None:
            raise ValueError("text_editor_convert input_parameters is empty")

        converted_inputs = input_params_convert(input_parameters)

        data_outputs = data.outputs
        if data_outputs is None:
            raise ValueError("text_editor_convert outputs is none")
        converted_outputs = outputs_convert(data_outputs)

        text_editor_param = inputs.text_editor_param
        if text_editor_param is None:
            raise ValueError("text_editor_param is empty")
        delimiters = (text_editor_param.delimiters or []) + (text_editor_param.custom_delimiters or [])
        text_configs = dsl.TextEditorConfig(
            edit_type=text_editor_param.edit_type,
            delimiters=delimiters,
            concatenate_format=(
                text_editor_param.concatenate_format.content if text_editor_param.concatenate_format else None
            )
        )

        # 构建转换后的LLM组件配置
        text_editor_component = dsl.Component(
            id=getattr(node, 'id', ""),
            type=ComponentType.COMPONENT_TYPE_TEXT_EDITOR,
            type_version="1.0.0",
            inputs=converted_inputs,
            outputs=converted_outputs,
            configs=text_configs.model_dump(),
            name=data.title
        )
        return text_editor_component
    except Exception as e:
        raise RuntimeError(f"Failed to convert text_editor: {str(e)}") from e
