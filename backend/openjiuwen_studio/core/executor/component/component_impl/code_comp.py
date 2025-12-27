#!/usr/bin/python3.10
# coding: utf-8
# Copyright (c) Huawei Technologies Co., Ltd. 2025-2025. All rights reserved
import textwrap
from typing import Any, Callable, Dict, List, Tuple, Union

from openjiuwen.core.common.exception.exception import JiuWenBaseException
from openjiuwen.core.component.base import WorkflowComponent
from openjiuwen.core.component.branch_router import BranchRouter
from openjiuwen.core.component.condition.condition import Condition
from openjiuwen.core.graph.base import Graph
from openjiuwen.core.graph.executable import Input, Output
from openjiuwen.core.runtime.base import ComponentExecutable
from openjiuwen.core.runtime.runtime import BaseRuntime, Runtime

from openjiuwen_studio.core.common.dsl import CodeLanguage, ExceptHandlingMethod, ExceptConfig, CodeConfig, ErrorBody
from openjiuwen_studio.core.executor.component.code_runner.base import CodeRunner
from openjiuwen_studio.core.executor.component.code_runner.remote import remote_code_runner
from openjiuwen_studio.core.common.exceptions import JiuWenExecuteException
from openjiuwen_studio.core.common.status_code import StatusCode


class ExceptedCondition(Condition):
    def __init__(self, excepted: bool = False) -> None:
        super().__init__()
        self.excepted: bool = excepted

    def set_excepted(self, excepted: bool) -> None:
        self.excepted = excepted

    def invoke(self, inputs: Input, runtime: BaseRuntime) -> bool:
        return self.excepted


class DefaultCondition(Condition):
    def __init__(self, excepted_condition: ExceptedCondition) -> None:
        super().__init__()
        self.excepted_condition = excepted_condition

    def invoke(self, inputs: Input, runtime: BaseRuntime) -> bool:
        return not self.excepted_condition.invoke(inputs, runtime)


DEFAULT_PY_CODE = """
class Args:
    def __init__(self, params):
        self.params = params

class Outputs(dict):
    pass
"""

DEFAULT_JS_CODE = """
class Args {
    constructor(params) {
        this.params = params;
    }
}
"""


class CodeComponent(ComponentExecutable, WorkflowComponent):
    def __init__(self, node_id: str, conf: CodeConfig) -> None:
        super().__init__()
        self.conf = conf
        self.node_id = node_id
        self._router = BranchRouter()
        self.excepted_condition: ExceptedCondition = None

    def set_excepted_condition(self, excepted_condition: ExceptedCondition) -> None:
        self.excepted_condition = excepted_condition

    def add_branch(self, condition: Union[str, Callable[[], bool], Condition], target: Union[str, List[str]],
                   branch_id: str = None) -> None:
        if isinstance(target, str):
            target = [target]
        self._router.add_branch(condition, target, branch_id=branch_id)

    def add_component(self, graph: Graph, node_id: str, wait_for_all: bool = False) -> None:
        graph.add_node(node_id, self.to_executable(), wait_for_all=wait_for_all)
        graph.add_conditional_edges(node_id, self._router)

    async def invoke(self, inputs: Input, runtime: Runtime, context: Any) -> Output:
        self._router.set_runtime(runtime)
        code = self.conf.code
        language = self.conf.language
        execute_type = self.conf.execute_type
        exception_config = self.conf.exception_config

        if not code.strip():
            raise JiuWenExecuteException(
                StatusCode.CODE_COMPONENT_INVOKE_ERROR.code,
                StatusCode.CODE_COMPONENT_INVOKE_ERROR.errmsg.format(msg="No code provided for execution"),
                node_id=self.node_id
            )

        error_body, response = await self._run(language, code, inputs, exception_config, execute_type)

        final_result = self._process_output(error_body, response, exception_config)
        return final_result

    @staticmethod
    async def _run(language: str, code: str, params: Input, except_config: ExceptConfig,
                   execute_type: str) -> Tuple[ErrorBody, Any]:
        # 只支持remote执行，移除local支持
        run_func = remote_code_runner.run

        if language in [CodeLanguage.PYTHON, CodeLanguage.PYTHON3]:
            language = CodeLanguage.PYTHON
            dedented_code = textwrap.dedent(DEFAULT_PY_CODE + "\n" + code)
        else:
            language = CodeLanguage.JAVASCRIPT
            dedented_code = DEFAULT_JS_CODE + "\n" + code

        return await CodeRunner.run_with_retry(except_config.max_retries, run_func,
                                               code_language=language,
                                               code_str=dedented_code,
                                               timeout=except_config.timeout_seconds,
                                               params=params)

    def _process_output(self, error_body: ErrorBody, response: Any, except_config: ExceptConfig) -> Dict[str, Any]:
        output_params = self.conf.output_params
        response_result: Dict[str, Any] = {}

        if error_body.error_code:
            response_result = self._process_error_body(except_config, error_body, self.excepted_condition,
                                                       response_result)
        else:
            if response:
                for param in output_params:
                    response_result[param.name] = response.get(param.name)  # 不存在的参数返回None
            response_result["is_success"] = True

        return response_result

    @staticmethod
    def _process_error_body(except_config: ExceptConfig, error_body: ErrorBody, excepted_condition: ExceptedCondition,
                            response_result: Dict[str, Any]) -> Dict[str, Any]:
        # 处理异常策略
        if except_config.except_handling_method == ExceptHandlingMethod.BREAK:
            raise JiuWenBaseException(
                error_code=error_body.error_code,
                message=error_body.error_message,
            )
        elif except_config.except_handling_method == ExceptHandlingMethod.EXECUTE_EXCEPT_STEP:
            excepted_condition.set_excepted(True)
        else:
            response_result = except_config.return_content

        response_result["error_body"] = error_body.model_dump()
        response_result["is_success"] = False

        return response_result
