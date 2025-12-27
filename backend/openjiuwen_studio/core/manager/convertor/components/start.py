#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from typing import Any

from openjiuwen_studio.core.common import dsl
from openjiuwen_studio.core.manager.internal.workflow import InputElem
from openjiuwen_studio.schemas.node import Node, NodeData
from openjiuwen_studio.core.manager.convertor.components.common import outputs_convert
from openjiuwen_studio.core.common.dsl import ComponentType


def start_inputs_convert(data: NodeData) -> list[dict[str, Any]]:
    outputs = data.outputs
    if outputs is None:
        raise ValueError("outputs is none")

    inputs_res: list[dict[str, Any]] = []
    for key, value in outputs.properties.items():
        required = False
        if key in outputs.required:
            required = True
        inputs_res.append(InputElem(
            name=key,
            type=value.type,
            description=value.description,
            required=required,
        ).model_dump())
    return inputs_res


def start_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        outputs = data.outputs
        if outputs is None:
            raise ValueError("outputs is none")

        inputs = outputs_convert(outputs)

        start_node = dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_START,
            type_version="1.0.0",
            inputs=inputs,
            description="",
            name=data.title
        )

        return start_node

    except Exception as e:
        raise ValueError(f"Failed to convert start node: {str(e)}") from e
