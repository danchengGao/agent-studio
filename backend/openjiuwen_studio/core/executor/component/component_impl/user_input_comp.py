#!/usr/bin/python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved
import json
from typing import Any, List, Tuple

from openjiuwen.core.component.base import WorkflowComponent
from openjiuwen.core.graph.executable import Input, Output
from openjiuwen.core.runtime.base import ComponentExecutable
from openjiuwen.core.runtime.runtime import Runtime

from openjiuwen_studio.core.common.dsl import UserInputsConfig, UserInputElem
from openjiuwen_studio.core.common.exceptions import JiuWenExecuteException
from openjiuwen_studio.core.common.status_code import StatusCode

# {
#     "id": "UserInput1",
#     "version": "",
#     "name": "",
#     "description": "",
#     "type": "jiuwen.UserInputComponent",
#     "typeVersion": "1.0.0",
#     "inputs": {},
#     "outputs": {},
#     "configs": {
#        "inputs": {
#         {"input_name": "AA", "description": "", "type":"str", "required": True},
#         {"input_name": "BB", "description": "", "type":"int", "required": True},
#         {"input_name": "CC", "description": "", "type":"bool", "required": False}
#        }
#     }
# }

# user_input = InteractiveInput()
# user_input.update(self.node_id, {"AA": "ishshe", "BB": 444, "CC": 1})


class UserInputComponent(ComponentExecutable, WorkflowComponent):
    def __init__(self, conf: UserInputsConfig) -> None:
        super().__init__()
        self.input_conf_list: List[UserInputElem] = conf.inputs

    async def invoke(self, inputs: Input, runtime: Runtime, context: Any) -> Output:
        result = await runtime.interact(self.input_conf_list)
        for input_elem in self.input_conf_list:
            if not isinstance(input_elem, UserInputElem):
                raise ValueError("Node data type is wrong")
            if result.get(input_elem.input_name) is None and input_elem.required is True:
                raise JiuWenExecuteException(
                    StatusCode.USERINPUT_COMPONENT_INVOKE_ERROR.code,
                    StatusCode.USERINPUT_COMPONENT_INVOKE_ERROR.errmsg,
                )
        return result
