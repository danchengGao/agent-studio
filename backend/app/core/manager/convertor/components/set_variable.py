#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from typing import List

from app.core.common import dsl
from app.schemas.node import Node
from app.core.manager.convertor.components.common import base_value_convert
from app.core.common.dsl import ComponentType


def set_variable_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        assign_list = data.assign
        if not assign_list:
            raise TypeError("assign is empty")

        configs = dsl.SetVariableConfig()
        for assign in assign_list:
            if assign.operator != "assign":
                raise TypeError("assign operator type is not assign")
            key = base_value_convert(assign.left)
            value = base_value_convert(assign.right)
            configs.inter_variable[key] = value

        return dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_SET_VARIABLE,
            type_version="1.0.0",
            configs=configs.model_dump(),
            description="",
            name=data.title
        )
    except Exception as e:
        raise ValueError(f"Failed to convert set_variable node: {str(e)}") from e
