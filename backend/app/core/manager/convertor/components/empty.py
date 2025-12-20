#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from typing import List, Any

from app.core.common import dsl
from app.schemas.node import Node
from app.core.common.dsl import ComponentType


def empty_convert(node: Node) -> dsl.Component:
    try:
        data = node.data
        return dsl.Component(
            id=node.id,
            type=ComponentType.COMPONENT_TYPE_EMPTY,
            type_version="1.0.0",
            description="",
            name=data.title
        )
    except Exception as e:
        raise RuntimeError(f"Failed to convert empty node: {str(e)}") from e
