#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.
from typing import List

from app.core.common import dsl
from app.schemas.node import Edge


def connection_convert(edges: List[Edge]) -> List[dsl.Connection]:
    connections: List[dsl.Connection] = []
    for edge in edges:
        conn = dsl.Connection(source=edge.source_node_id, target=edge.target_node_id, branch_id=edge.source_port_id)
        connections.append(conn)
    return connections
