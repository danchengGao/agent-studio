#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from typing import List

from openjiuwen_studio.core.common import dsl
from openjiuwen_studio.schemas.node import Node
from openjiuwen_studio.core.manager.convertor.components.common import input_params_convert, exception_config_convert
from openjiuwen_studio.core.common.dsl import ComponentType

output_type_mapping = {
    "string": "string",
    "boolean": "bool",
    "array": "list",
    "integer": "int",
    "number": "float",
    "object": "object",
    "date-time": "date-time",
}


def _output_params_convert(node: Node) -> List[dsl.ParamConfig]:
    params: List[dsl.ParamConfig] = []
    outputs = node.data.outputs
    if outputs is None:
        raise TypeError("outputs is none")

    if outputs.type != "object":
        raise TypeError("outputs type is not object")

    for key, value in outputs.properties.items():
        param = dsl.ParamConfig(
            name=key,
            type=output_type_mapping[value.type],
        )
        params.append(param)

    return params


def _code_config_convert(node: Node) -> dsl.CodeConfig:
    data = node.data
    inputs = data.inputs
    exception_conf = data.exception_config
    if exception_conf is None:
        raise TypeError("exception config is none")

    return dsl.CodeConfig(
        language=inputs.language,
        code=inputs.code,
        output_params=_output_params_convert(node),
        exception_config=exception_config_convert(exception_conf),
    )


def code_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        inputs = data.inputs
        if inputs is None:
            raise TypeError("inputs is none")
        input_parameters = inputs.input_parameters
        if input_parameters is None:
            raise TypeError("input_parameters is none")

        convert_inputs = input_params_convert(input_parameters)

        return dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_CODE,
            type_version="1.0.0",
            description="",
            inputs=convert_inputs,
            configs=_code_config_convert(node).model_dump(),
            name=data.title
        )
    except Exception as e:
        raise RuntimeError(f"Failed to convert code node: {str(e)}") from e
