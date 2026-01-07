#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from enum import Enum

from openjiuwen_studio.core.common import dsl
from openjiuwen_studio.core.common.dsl import LoopType
from openjiuwen_studio.schemas.node import Node, Inputs
from openjiuwen_studio.core.manager.convertor.components.common import outputs_convert, input_params_convert, \
    base_value_convert
from openjiuwen_studio.core.common.dsl import ComponentType

MAX_LOOP_NUM = 1000


def _loop_inputs_convert(inputs: Inputs) -> dsl.LoopInput:
    loop_inputs = dsl.LoopInput()
    loop_param = inputs.loop_param
    if loop_param is None:
        raise TypeError("loopParam is none")

    loop_inputs.loop_type = loop_param.type
    if loop_param.type == "numLoop":
        loop_inputs.loop_type = LoopType.Number.value
        loop_inputs.loop_number = base_value_convert(loop_param.loop_num)
        loop_num = loop_inputs.loop_number
        if isinstance(loop_num, int) and (loop_num < 1 or loop_num > MAX_LOOP_NUM):
            raise ValueError(f"loop num must be between 1 and {MAX_LOOP_NUM}")
    elif loop_param.type == "arrayLoop":
        loop_inputs.loop_type = LoopType.Array.value
        loop_array = loop_param.loop_array
        if loop_array is None:
            raise TypeError("loop array is none")
        loop_inputs.loop_array = input_params_convert(loop_array)
    else:
        raise ValueError("unknow loop type")

    intermediate_var = loop_param.intermediate_var
    if intermediate_var is not None:
        loop_inputs.intermediate_var = input_params_convert(intermediate_var)

    return loop_inputs


def loop_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        outputs = data.outputs
        if outputs is None:
            raise TypeError("outputs is none")
        convert_output = outputs_convert(outputs)

        inputs = data.inputs
        if inputs is None:
            raise TypeError("inputs is none")
        convert_inputs = _loop_inputs_convert(inputs)

        return dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_LOOP,
            type_version="1.0.0",
            inputs=convert_inputs.model_dump(),
            outputs=convert_output,
            configs={},
            description="",
            name=data.title
        )
    except Exception as e:
        raise ValueError(f"Failed to convert loop node: {str(e)}") from e


def loop_continue_convert(node: Node) -> dsl.Component:
    try:
        data = node.data

        return dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_CONTINUE,
            type_version="1.0.0",
            configs={},
            description="",
            name=data.title
        )
    except Exception as e:
        raise ValueError(f"Failed to convert loop continue node: {str(e)}") from e


def loop_break_convert(node: Node) -> dsl.Component:
    try:
        data = node.data

        return dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_BREAK,
            type_version="1.0.0",
            configs={},
            description="",
            name=data.title
        )
    except Exception as e:
        raise ValueError(f"Failed to convert loop break node: {str(e)}") from e
