#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from openjiuwen_studio.core.common import dsl
from openjiuwen_studio.schemas.node import Node
from openjiuwen_studio.core.manager.convertor.components.common import input_params_convert
from openjiuwen_studio.core.common.dsl import ComponentType


def output_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        inputs = data.inputs
        if inputs is None:
            raise TypeError("inputs is none")
        input_parameters = inputs.input_parameters
        if input_parameters is None:
            raise TypeError("input_parameters is none")

        convert_inputs = input_params_convert(input_parameters)

        content = inputs.content
        if content is None:
            raise TypeError("content is none")

        configs = dsl.UserOutputConfig(
            streaming=inputs.streaming,
            output_message=content.content,
        )

        return dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_OUTPUT,
            type_version="1.0.0",
            inputs=convert_inputs,
            configs=configs.model_dump(),
            description="",
            name=data.title
        )
    except Exception as e:
        raise ValueError(f"Failed to convert user output node: {str(e)}") from e
