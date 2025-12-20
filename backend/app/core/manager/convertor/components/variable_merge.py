#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from app.core.common import dsl
from app.core.manager.convertor.components.common import outputs_convert, input_params_convert
from app.core.common.dsl import ComponentType
from app.schemas.node import Node


def variable_merge_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        inputs = data.inputs
        if inputs is None:
            raise ValueError("inputs is none")
        input_parameters = inputs.input_parameters
        if input_parameters is None:
            raise ValueError("input_parameters is empty")

        converted_inputs = input_params_convert(input_parameters)

        data_outputs = data.outputs
        if data_outputs is None:
            raise ValueError("outputs is none")
        converted_outputs = outputs_convert(data_outputs)

        variable_merge = inputs.variable_merge
        if variable_merge is None:
            raise ValueError("variable_merge is empty")
        variable_merge_configs = {"groups": [group.model_dump() for group in variable_merge]}

        # 构建转换后的LLM组件配置
        variable_merge_component = dsl.Component(
            id=getattr(node, 'id', ""),
            type=ComponentType.COMPONENT_TYPE_VARIABLE_MERGE,
            type_version="1.0.0",
            inputs=converted_inputs,
            outputs=converted_outputs,
            configs=variable_merge_configs,
            name=data.title
        )
        return variable_merge_component
    except Exception as e:
        raise RuntimeError(f"Failed to convert variable_merge: {str(e)}") from e
