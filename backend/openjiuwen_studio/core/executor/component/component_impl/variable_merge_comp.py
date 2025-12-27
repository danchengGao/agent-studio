#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved.

from typing import Any, Dict

from openjiuwen.core.component.base import WorkflowComponent
from openjiuwen.core.graph.executable import Input, Output
from openjiuwen.core.runtime.base import ComponentExecutable
from openjiuwen.core.runtime.runtime import Runtime

from openjiuwen_studio.core.common.dsl import VariMergeConfig


class VariableMergeComponent(ComponentExecutable, WorkflowComponent):
    def __init__(self, conf: VariMergeConfig) -> None:
        super().__init__()
        self.conf = conf
        self.groups = self.conf.groups

    def _is_empty(self, value: Any) -> bool:
        """检查组件输出值是否为空"""
        return value in [None, "", [], {}, ()] or (hasattr(value, '__len__') and len(value) == 0)

    async def invoke(self, inputs: Input, runtime: Runtime, context: Any) -> Output:
        result: Dict[str, Any] = {}
        for group in self.groups:
            for item in group.items:
                if item in inputs and not self._is_empty(inputs[item]):
                    result[group.name] = inputs[item]
                    break
        return result


